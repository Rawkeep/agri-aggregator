/**
 * i18n.js
 *
 * Minimale i18n-Basis fuer agri-aggregator: Woerterbuch mit Franzoesisch (fr)
 * und Englisch (en) fuer die UI-Kernbegriffe, plus Uebersetzungsfunktion
 * t(key, lang) und Sprachumschaltung setLanguage/getLanguage mit
 * Persistenz in localStorage. Keine externen Requests, keine externen
 * i18n-Bibliotheken.
 */
(function (global) {
  'use strict';

  var LANGUAGE_STORAGE_KEY = 'agri_aggregator_lang';
  var SUPPORTED_LANGUAGES = ['fr', 'en'];
  var DEFAULT_LANGUAGE = 'fr';

  // Uebersetzungen fuer alle UI-Kernbegriffe. Jeder Begriff besitzt sowohl
  // einen fr- als auch einen en-Eintrag.
  var TRANSLATIONS = {
    farmer: { fr: 'Agriculteur', en: 'Farmer' },
    product: { fr: 'Produit', en: 'Product' },
    weight: { fr: 'Poids', en: 'Weight' },
    qualityGrade: { fr: 'Qualite', en: 'Quality Grade' },
    price: { fr: 'Prix', en: 'Price' },
    stock: { fr: 'Stock', en: 'Stock' },
    sale: { fr: 'Vente', en: 'Sale' },
    margin: { fr: 'Marge', en: 'Margin' },
    loss: { fr: 'Perte / Deperdition', en: 'Loss / Shrinkage' },
    payoutReceipt: { fr: 'Recu de paiement', en: 'Payout Receipt' },
    dailyPrice: { fr: 'Prix du jour', en: 'Daily Price' },
    seasonPrice: { fr: 'Prix de saison', en: 'Season Price' },
    buyer: { fr: 'Acheteur', en: 'Buyer' },

    // Zusaetzliche UI-Kernbegriffe fuer die App-Shell (js/app.js,
    // index.html). Rein additive Ergaenzung -- die oben stehenden
    // Kernbegriffe und ihre Vertraege bleiben unveraendert (siehe
    // tests/test_core_data.py).
    appTitle: { fr: 'Agregateur de recoltes', en: 'Harvest Aggregator' },
    navPurchase: { fr: 'Achat', en: 'Purchase' },
    navInventory: { fr: 'Stock', en: 'Inventory' },
    navSales: { fr: 'Vente', en: 'Sales' },
    navLoss: { fr: 'Pertes', en: 'Losses' },
    navPricing: { fr: 'Prix', en: 'Pricing' },
    navCsv: { fr: 'Import/Export CSV', en: 'CSV Import/Export' },
    purchaseTitle: { fr: "Saisie de l'achat", en: 'Record Purchase' },
    recordPurchase: { fr: "Enregistrer l'achat", en: 'Record Purchase' },
    printReceipt: { fr: 'Imprimer le recu', en: 'Print Receipt' },
    salesTitle: { fr: 'Saisie de la vente', en: 'Record Sale' },
    recordSale: { fr: 'Enregistrer la vente', en: 'Record Sale' },
    lossTitle: { fr: 'Saisie de la perte', en: 'Record Loss' },
    recordLoss: { fr: 'Enregistrer la perte', en: 'Record Loss' },
    postHarvestLossKpi: { fr: 'KPI de perte post-recolte', en: 'Post-Harvest Loss KPI' },
    computeKpi: { fr: 'Calculer', en: 'Compute' },
    pricingTitle: { fr: 'Gestion des prix', en: 'Price Management' },
    recordPrice: { fr: 'Enregistrer le prix', en: 'Record Price' },
    csvImportExport: { fr: 'Import/Export CSV', en: 'CSV Import/Export' },
    exportCsv: { fr: 'Exporter CSV', en: 'Export CSV' },
    importCsv: { fr: 'Importer CSV', en: 'Import CSV' },
    date: { fr: 'Date', en: 'Date' },
    reason: { fr: 'Motif', en: 'Reason' },
    currency: { fr: 'Devise', en: 'Currency' },
    priceType: { fr: 'Type de prix', en: 'Price Type' }
  };

  function isSupportedLanguage(lang) {
    return SUPPORTED_LANGUAGES.indexOf(lang) !== -1;
  }

  function hasLocalStorage() {
    return typeof global.localStorage !== 'undefined' && global.localStorage !== null;
  }

  /**
   * Uebersetzt einen Schluessel in die angegebene Sprache. Ist die Sprache
   * nicht angegeben, wird die aktuell gesetzte Sprache verwendet. Fehlt der
   * Schluessel im Woerterbuch, wird der Schluessel selbst zurueckgegeben.
   */
  function t(key, lang) {
    var targetLang = isSupportedLanguage(lang) ? lang : getLanguage();
    var entry = TRANSLATIONS[key];
    if (!entry) {
      return key;
    }
    return entry[targetLang] || entry[DEFAULT_LANGUAGE] || key;
  }

  /**
   * Setzt die aktive UI-Sprache und persistiert die Wahl in localStorage.
   */
  function setLanguage(lang) {
    if (!isSupportedLanguage(lang)) {
      throw new Error('Nicht unterstuetzte Sprache: ' + lang + ' (erlaubt: fr, en).');
    }
    if (hasLocalStorage()) {
      global.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
    return lang;
  }

  /**
   * Liest die aktive UI-Sprache aus localStorage; faellt auf
   * DEFAULT_LANGUAGE zurueck, wenn nichts gespeichert oder ungueltig ist.
   */
  function getLanguage() {
    if (hasLocalStorage()) {
      var stored = global.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(stored)) {
        return stored;
      }
    }
    return DEFAULT_LANGUAGE;
  }

  var AgriI18n = {
    SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE: DEFAULT_LANGUAGE,
    TRANSLATIONS: TRANSLATIONS,
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage
  };

  global.AgriI18n = AgriI18n;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriI18n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
