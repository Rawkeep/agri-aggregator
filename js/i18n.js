/**
 * i18n.js
 *
 * Minimale i18n-Basis fuer agri-aggregator: Woerterbuch mit Franzoesisch (fr)
 * und Englisch (en) fuer die UI-Kernbegriffe. Die generische i18n-Engine
 * (Uebersetzungsfunktion t(key, lang), Sprachumschaltung setLanguage/
 * getLanguage mit Persistenz in localStorage) ist nach js/shared/
 * offline-kit.js (OfflineKit.createI18n) ausgelagert -- identisch genutzt in
 * 6 Rawkeep-Offline-Apps. Diese Datei haelt nur das agri-aggregator-eigene
 * Woerterbuch (TRANSLATIONS) und reicht t/setLanguage/getLanguage
 * unveraendert durch. Keine externen Requests, keine externen
 * i18n-Bibliotheken.
 */
(function (global) {
  'use strict';

  function resolveOfflineKit() {
    if (global.OfflineKit) {
      return global.OfflineKit;
    }
    if (typeof require === 'function') {
      return require('./shared/offline-kit.js');
    }
    throw new Error('OfflineKit (js/shared/offline-kit.js) ist nicht verfuegbar.');
  }

  var OfflineKit = resolveOfflineKit();

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

  var engine = OfflineKit.createI18n({
    languageStorageKey: LANGUAGE_STORAGE_KEY,
    supportedLanguages: SUPPORTED_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE,
    translations: TRANSLATIONS
  });

  /**
   * Uebersetzt einen Schluessel in die angegebene Sprache (delegiert an
   * OfflineKit.createI18n(...).t). Ist die Sprache nicht angegeben, wird die
   * aktuell gesetzte Sprache verwendet. Fehlt der Schluessel im Woerterbuch,
   * wird der Schluessel selbst zurueckgegeben.
   */
  function t(key, lang) {
    return engine.t(key, lang);
  }

  /**
   * Setzt die aktive UI-Sprache und persistiert die Wahl in localStorage
   * (delegiert an OfflineKit.createI18n(...).setLanguage).
   */
  function setLanguage(lang) {
    return engine.setLanguage(lang);
  }

  /**
   * Liest die aktive UI-Sprache aus localStorage; faellt auf
   * DEFAULT_LANGUAGE zurueck, wenn nichts gespeichert oder ungueltig ist
   * (delegiert an OfflineKit.createI18n(...).getLanguage).
   */
  function getLanguage() {
    return engine.getLanguage();
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
