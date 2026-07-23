/**
 * app.js
 *
 * Orchestrierungs-Layer fuer agri-aggregator: verdrahtet die UI-Views aus
 * index.html mit den fachlichen Modulen (js/models.js, js/storage.js,
 * js/i18n.js, js/purchase.js, js/receipt.js, js/inventory.js, js/sales.js,
 * js/loss.js, js/pricing.js, js/csv.js). Enthaelt selbst KEINE fachliche
 * Logik (keine Validierung, keine Betrags-/Margen-/KPI-Berechnung) -- diese
 * lebt ausschliesslich in den jeweiligen Fachmodulen und wird hier nur
 * aufgerufen. Keine externen Requests, keine externen Bibliotheken.
 *
 * Besonderheiten der Orchestrierung:
 * - js/inventory.js haelt Bestaende rein In-Memory. Beim Start wird der
 *   Bestand deshalb deterministisch aus der in AgriStorage persistierten
 *   Ankaufs-/Verkaufshistorie rekonstruiert (chronologische Wiedergabe
 *   nach Datum).
 * - js/loss.js und js/pricing.js persistieren ihre Eintraege selbst nicht.
 *   Nach jedem AgriLoss.recordLoss / AgriPricing.recordPriceEntry wird der
 *   entstandene Datensatz deshalb zusaetzlich ueber AgriStorage gespeichert;
 *   beim Start werden vorhandene Eintraege aus AgriStorage in den jeweiligen
 *   In-Memory-Zustand zurueckgespielt (id bleibt dabei erhalten).
 * - Sprachwechsel: alle Elemente mit [data-i18n] (Textinhalt) bzw.
 *   [data-i18n-placeholder] (Platzhalter) werden ueber AgriI18n.t()
 *   aktualisiert, ausgeloest durch AgriI18n.setLanguage() im
 *   Sprachumschalter (#language-switcher).
 */
(function (global) {
  'use strict';

  function resolveModule(name, path) {
    if (global[name]) {
      return global[name];
    }
    if (typeof require === 'function') {
      return require(path);
    }
    throw new Error(name + ' (' + path + ') ist nicht verfuegbar.');
  }

  function AgriModels() { return resolveModule('AgriModels', './models.js'); }
  function AgriStorage() { return resolveModule('AgriStorage', './storage.js'); }
  function AgriI18n() { return resolveModule('AgriI18n', './i18n.js'); }
  function AgriPurchase() { return resolveModule('AgriPurchase', './purchase.js'); }
  function AgriReceipt() { return resolveModule('AgriReceipt', './receipt.js'); }
  function AgriInventory() { return resolveModule('AgriInventory', './inventory.js'); }
  function AgriSales() { return resolveModule('AgriSales', './sales.js'); }
  function AgriLoss() { return resolveModule('AgriLoss', './loss.js'); }
  function AgriPricing() { return resolveModule('AgriPricing', './pricing.js'); }
  function AgriCsv() { return resolveModule('AgriCsv', './csv.js'); }

  // In-Memory-Referenzcaches der Stammdaten (Quelle der Wahrheit bleibt
  // AgriStorage / IndexedDB-localStorage).
  var currentFarmers = [];
  var currentBuyers = [];
  var currentProducts = [];
  var lastPurchase = null;

  function qs(id) {
    return global.document.getElementById(id);
  }

  function findProductById(productId) {
    for (var i = 0; i < currentProducts.length; i += 1) {
      if (currentProducts[i] && currentProducts[i].id === productId) {
        return currentProducts[i];
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Sprachumschaltung: aktualisiert alle sichtbaren Texte ueber AgriI18n.
  // -----------------------------------------------------------------------

  function applyTranslations(lang) {
    var i18n = AgriI18n();
    var doc = global.document;
    doc.documentElement.setAttribute('lang', lang);

    var textNodes = doc.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i += 1) {
      var el = textNodes[i];
      var key = el.getAttribute('data-i18n');
      el.textContent = i18n.t(key, lang);
    }

    var placeholderNodes = doc.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholderNodes.length; j += 1) {
      var phEl = placeholderNodes[j];
      var phKey = phEl.getAttribute('data-i18n-placeholder');
      phEl.setAttribute('placeholder', i18n.t(phKey, lang));
    }

    updateActiveLanguageButton(lang);
  }

  function updateActiveLanguageButton(lang) {
    var doc = global.document;
    var buttons = doc.querySelectorAll('#language-switcher [data-lang]');
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.add('active-lang');
      } else {
        btn.classList.remove('active-lang');
      }
    }
  }

  function wireLanguageSwitcher() {
    var doc = global.document;
    var buttons = doc.querySelectorAll('#language-switcher [data-lang]');
    for (var i = 0; i < buttons.length; i += 1) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var lang = btn.getAttribute('data-lang');
          AgriI18n().setLanguage(lang);
          applyTranslations(lang);
        });
      })(buttons[i]);
    }
  }

  // -----------------------------------------------------------------------
  // View-Navigation.
  // -----------------------------------------------------------------------

  function wireNav() {
    var doc = global.document;
    var navButtons = doc.querySelectorAll('#main-nav [data-view]');
    for (var i = 0; i < navButtons.length; i += 1) {
      (function (btn) {
        btn.addEventListener('click', function () {
          showView(btn.getAttribute('data-view'));
        });
      })(navButtons[i]);
    }
  }

  function showView(viewId) {
    var doc = global.document;
    var views = doc.querySelectorAll('.view');
    for (var i = 0; i < views.length; i += 1) {
      if (views[i].id === viewId) {
        views[i].classList.add('active');
      } else {
        views[i].classList.remove('active');
      }
    }
  }

  // -----------------------------------------------------------------------
  // Select-Optionen aus den Stammdaten befuellen.
  // -----------------------------------------------------------------------

  function populateSelect(selectEl, items, valueFn, labelFn) {
    if (!selectEl) {
      return;
    }
    selectEl.innerHTML = '';
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var option = global.document.createElement('option');
      option.value = valueFn(item);
      option.textContent = labelFn(item);
      selectEl.appendChild(option);
    }
  }

  function refreshFarmerOptions() {
    populateSelect(
      qs('purchase-farmer-id'),
      currentFarmers,
      function (f) { return f.id; },
      function (f) { return f.name + ' (' + f.id + ')'; }
    );
  }

  function refreshBuyerOptions() {
    populateSelect(
      qs('sale-buyer-id'),
      currentBuyers,
      function (b) { return b.id; },
      function (b) { return b.name + ' (' + b.type + ')'; }
    );
  }

  function refreshProductOptions() {
    var targets = [
      'purchase-product-id',
      'sale-product-id',
      'loss-product-id',
      'loss-kpi-product-id',
      'pricing-product-id'
    ];
    for (var i = 0; i < targets.length; i += 1) {
      populateSelect(
        qs(targets[i]),
        currentProducts,
        function (p) { return p.id; },
        function (p) { return p.name; }
      );
    }
  }

  function refreshAllSelects() {
    refreshFarmerOptions();
    refreshBuyerOptions();
    refreshProductOptions();
  }

  // -----------------------------------------------------------------------
  // Standard-Produkte anlegen, falls noch keine Produkte im Stammsatz sind.
  // -----------------------------------------------------------------------

  function ensureDefaultProducts() {
    var models = AgriModels();
    var storage = AgriStorage();
    return storage.listProducts().then(function (products) {
      if (products.length > 0) {
        return products;
      }
      var defaults = [
        { id: 'cacao', name: 'Cacao' },
        { id: 'cashew', name: 'Anacarde / Cashew' },
        { id: 'maize', name: 'Mais / Maize' }
      ];
      return Promise.all(
        defaults.map(function (d) {
          return storage.saveProduct(models.createProduct(d));
        })
      );
    });
  }

  // -----------------------------------------------------------------------
  // Bestand beim Start aus der persistierten Ankaufs-/Verkaufshistorie
  // rekonstruieren (js/inventory.js haelt selbst nur In-Memory-Zustand).
  // -----------------------------------------------------------------------

  function rebuildInventoryFromHistory() {
    var storage = AgriStorage();
    var inventory = AgriInventory();
    return Promise.all([storage.listPurchases(), storage.listSales()]).then(function (results) {
      var purchases = results[0].map(function (p) { return { type: 'purchase', date: p.date, record: p }; });
      var sales = results[1].map(function (s) { return { type: 'sale', date: s.date, record: s }; });
      var events = purchases.concat(sales).sort(function (a, b) {
        if (a.date < b.date) { return -1; }
        if (a.date > b.date) { return 1; }
        return 0;
      });
      inventory.resetStock();
      events.forEach(function (event) {
        if (event.type === 'purchase') {
          var p = event.record;
          inventory.updateStockOnPurchase(p.productId, p.qualityGrade, p.weightKg, p.pricePerKg);
        } else {
          var s = event.record;
          var stock = inventory.getStock(s.productId, s.qualityGrade);
          if (s.weightKg <= stock.weightKg) {
            inventory.updateStockOnSale(s.productId, s.qualityGrade, s.weightKg);
          }
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Verlust- und Preiseintraege beim Start aus AgriStorage in den
  // In-Memory-Zustand von js/loss.js bzw. js/pricing.js zurueckspielen.
  // -----------------------------------------------------------------------

  function rehydrateLossAndPricingState() {
    var storage = AgriStorage();
    var loss = AgriLoss();
    var pricing = AgriPricing();
    return Promise.all([storage.listLossEntries(), storage.listPriceEntries()]).then(function (results) {
      loss.resetLossEntries();
      results[0].forEach(function (entry) { loss.recordLoss(entry); });
      pricing.resetPriceEntries();
      results[1].forEach(function (entry) { pricing.recordPriceEntry(entry); });
    });
  }

  // -----------------------------------------------------------------------
  // Rendering: Bestandsuebersicht.
  // -----------------------------------------------------------------------

  function renderInventoryTable() {
    var models = AgriModels();
    var inventory = AgriInventory();
    var tbody = qs('inventory-table-body');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '';
    currentProducts.forEach(function (product) {
      models.QUALITY_GRADES.forEach(function (grade) {
        var stock = inventory.getStock(product.id, grade);
        var row = global.document.createElement('tr');
        var cells = [product.name, grade, stock.weightKg + ' kg', String(stock.costAmount)];
        cells.forEach(function (text) {
          var td = global.document.createElement('td');
          td.textContent = text;
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
    });
  }

  // -----------------------------------------------------------------------
  // Rendering: Preistabelle.
  // -----------------------------------------------------------------------

  function renderPricingTable() {
    var pricing = AgriPricing();
    var i18n = AgriI18n();
    var tbody = qs('pricing-table-body');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '';
    pricing.listPriceEntries().forEach(function (entry) {
      var product = findProductById(entry.productId);
      var priceTypeLabel = i18n.t(entry.priceType === 'season' ? 'seasonPrice' : 'dailyPrice');
      var row = global.document.createElement('tr');
      var cells = [
        product ? product.name : entry.productId,
        entry.qualityGrade,
        priceTypeLabel,
        entry.pricePerKg + ' ' + entry.currency,
        entry.date
      ];
      cells.forEach(function (text) {
        var td = global.document.createElement('td');
        td.textContent = text;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
  }

  // -----------------------------------------------------------------------
  // Formular: Ankaufserfassung + Auszahlungsbeleg.
  // -----------------------------------------------------------------------

  function handlePurchaseSubmit(evt) {
    evt.preventDefault();
    var input = {
      farmerId: qs('purchase-farmer-id').value,
      productId: qs('purchase-product-id').value,
      qualityGrade: qs('purchase-quality-grade').value,
      weightKg: parseFloat(qs('purchase-weight-kg').value),
      pricePerKg: parseInt(qs('purchase-price-per-kg').value, 10),
      currency: qs('purchase-currency').value,
      date: qs('purchase-date').value
    };
    AgriPurchase().recordPurchase(input, currentFarmers).then(function (purchase) {
      AgriInventory().updateStockOnPurchase(purchase.productId, purchase.qualityGrade, purchase.weightKg, purchase.pricePerKg);
      lastPurchase = purchase;
      qs('purchase-total-amount').textContent = String(purchase.totalAmount);
      renderPurchaseReceiptPreview(purchase);
      renderInventoryTable();
    }).catch(function (err) {
      global.window.alert(err.message);
    });
  }

  function renderPurchaseReceiptPreview(purchase) {
    var farmer = AgriPurchase().findFarmerById(currentFarmers, purchase.farmerId);
    var product = findProductById(purchase.productId);
    var root = qs('agri-payout-receipt-root');
    if (root) {
      root.innerHTML = AgriReceipt().buildPayoutReceiptHtml(purchase, farmer, product, AgriI18n().getLanguage());
    }
  }

  function handlePrintReceiptClick() {
    if (!lastPurchase) {
      return;
    }
    var farmer = AgriPurchase().findFarmerById(currentFarmers, lastPurchase.farmerId);
    var product = findProductById(lastPurchase.productId);
    AgriReceipt().printPayoutReceipt(lastPurchase, farmer, product, AgriI18n().getLanguage());
  }

  // -----------------------------------------------------------------------
  // Formular: Verkaufsbuchung mit Margen-Anzeige.
  // -----------------------------------------------------------------------

  function handleSaleSubmit(evt) {
    evt.preventDefault();
    var input = {
      buyerId: qs('sale-buyer-id').value,
      productId: qs('sale-product-id').value,
      qualityGrade: qs('sale-quality-grade').value,
      weightKg: parseFloat(qs('sale-weight-kg').value),
      pricePerKg: parseInt(qs('sale-price-per-kg').value, 10),
      currency: qs('sale-currency').value,
      date: qs('sale-date').value
    };
    AgriSales().recordSale(input, currentBuyers).then(function (sale) {
      qs('sale-margin-amount').textContent = String(sale.margin);
      renderInventoryTable();
    }).catch(function (err) {
      global.window.alert(err.message);
    });
  }

  // -----------------------------------------------------------------------
  // Formular: Verlust-/Schwund-Erfassung + Post-Harvest-Loss-KPI.
  // -----------------------------------------------------------------------

  function handleLossSubmit(evt) {
    evt.preventDefault();
    var data = {
      productId: qs('loss-product-id').value,
      qualityGrade: qs('loss-quality-grade').value,
      weightKg: parseFloat(qs('loss-weight-kg').value),
      date: qs('loss-date').value,
      reason: qs('loss-reason').value
    };
    var entry;
    try {
      entry = AgriLoss().recordLoss(data);
    } catch (err) {
      global.window.alert(err.message);
      return;
    }
    AgriStorage().saveLossEntry(entry).catch(function (err) {
      global.window.alert(err.message);
    });
  }

  function handleComputeLossKpiClick() {
    var productId = qs('loss-kpi-product-id').value;
    var startDate = qs('loss-kpi-start-date').value || null;
    var endDate = qs('loss-kpi-end-date').value || null;
    AgriStorage().listPurchases().then(function (purchases) {
      var kpi = AgriLoss().computePostHarvestLossKpiPromille(
        AgriLoss().listLossEntries(),
        purchases,
        productId,
        startDate,
        endDate
      );
      qs('loss-kpi-value').textContent = String(kpi);
    });
  }

  // -----------------------------------------------------------------------
  // Formular: Tages-/Saisonpreis-Pflege.
  // -----------------------------------------------------------------------

  function handlePricingSubmit(evt) {
    evt.preventDefault();
    var data = {
      productId: qs('pricing-product-id').value,
      qualityGrade: qs('pricing-quality-grade').value,
      priceType: qs('pricing-price-type').value,
      pricePerKg: parseInt(qs('pricing-price-per-kg').value, 10),
      currency: qs('pricing-currency').value,
      date: qs('pricing-date').value
    };
    var entry;
    try {
      entry = AgriPricing().recordPriceEntry(data);
    } catch (err) {
      global.window.alert(err.message);
      return;
    }
    AgriStorage().savePriceEntry(entry).then(function () {
      renderPricingTable();
    }).catch(function (err) {
      global.window.alert(err.message);
    });
  }

  // -----------------------------------------------------------------------
  // CSV-Import/-Export fuer Farmer-/Abnehmer-Stammdaten.
  // -----------------------------------------------------------------------

  function downloadTextFile(text, filename) {
    var doc = global.document;
    var blob = new global.Blob([text], { type: 'text/csv;charset=utf-8;' });
    var url = global.URL.createObjectURL(blob);
    var anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    doc.body.appendChild(anchor);
    anchor.click();
    doc.body.removeChild(anchor);
    global.URL.revokeObjectURL(url);
  }

  function handleExportFarmersCsvClick() {
    AgriStorage().listFarmers().then(function (farmers) {
      downloadTextFile(AgriCsv().exportFarmersToCsv(farmers), 'farmers.csv');
    });
  }

  function handleImportFarmersCsvClick() {
    var fileInput = qs('farmer-csv-file-input');
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    var reader = new global.FileReader();
    reader.onload = function () {
      AgriCsv().importFarmersFromCsv(String(reader.result)).then(function (farmers) {
        currentFarmers = farmers;
        refreshFarmerOptions();
      }).catch(function (err) {
        global.window.alert(err.message);
      });
    };
    reader.readAsText(file);
  }

  function handleExportBuyersCsvClick() {
    AgriStorage().listBuyers().then(function (buyers) {
      downloadTextFile(AgriCsv().exportBuyersToCsv(buyers), 'buyers.csv');
    });
  }

  function handleImportBuyersCsvClick() {
    var fileInput = qs('buyer-csv-file-input');
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    var reader = new global.FileReader();
    reader.onload = function () {
      AgriCsv().importBuyersFromCsv(String(reader.result)).then(function (buyers) {
        currentBuyers = buyers;
        refreshBuyerOptions();
      }).catch(function (err) {
        global.window.alert(err.message);
      });
    };
    reader.readAsText(file);
  }

  // -----------------------------------------------------------------------
  // Verdrahtung der Formulare/Buttons.
  // -----------------------------------------------------------------------

  function wireForms() {
    var doc = global.document;
    doc.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    doc.getElementById('btn-print-receipt').addEventListener('click', handlePrintReceiptClick);
    doc.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    doc.getElementById('loss-form').addEventListener('submit', handleLossSubmit);
    doc.getElementById('btn-compute-loss-kpi').addEventListener('click', handleComputeLossKpiClick);
    doc.getElementById('pricing-form').addEventListener('submit', handlePricingSubmit);
  }

  function wireCsvButtons() {
    var doc = global.document;
    doc.getElementById('btn-export-farmers-csv').addEventListener('click', handleExportFarmersCsvClick);
    doc.getElementById('btn-import-farmers-csv').addEventListener('click', handleImportFarmersCsvClick);
    doc.getElementById('btn-export-buyers-csv').addEventListener('click', handleExportBuyersCsvClick);
    doc.getElementById('btn-import-buyers-csv').addEventListener('click', handleImportBuyersCsvClick);
  }

  // -----------------------------------------------------------------------
  // Initialisierung.
  // -----------------------------------------------------------------------

  function loadInitialData() {
    var storage = AgriStorage();
    return ensureDefaultProducts()
      .then(function () {
        return Promise.all([storage.listFarmers(), storage.listBuyers(), storage.listProducts()]);
      })
      .then(function (results) {
        currentFarmers = results[0];
        currentBuyers = results[1];
        currentProducts = results[2];
        refreshAllSelects();
        return rebuildInventoryFromHistory();
      })
      .then(function () {
        renderInventoryTable();
        return rehydrateLossAndPricingState();
      })
      .then(function () {
        renderPricingTable();
        applyTranslations(AgriI18n().getLanguage());
      });
  }

  function init() {
    wireNav();
    wireLanguageSwitcher();
    wireForms();
    wireCsvButtons();
    loadInitialData().catch(function (err) {
      if (global.console && global.console.error) {
        global.console.error(err);
      }
    });
  }

  var AgriApp = {
    applyTranslations: applyTranslations,
    showView: showView,
    refreshAllSelects: refreshAllSelects,
    renderInventoryTable: renderInventoryTable,
    renderPricingTable: renderPricingTable,
    rebuildInventoryFromHistory: rebuildInventoryFromHistory,
    rehydrateLossAndPricingState: rehydrateLossAndPricingState,
    init: init
  };

  global.AgriApp = AgriApp;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriApp;
  }

  if (typeof global.document !== 'undefined') {
    global.document.addEventListener('DOMContentLoaded', init);
  }
})(typeof window !== 'undefined' ? window : globalThis);
