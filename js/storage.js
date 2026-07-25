/**
 * storage.js
 *
 * Persistenz-Wrapper fuer agri-aggregator. Die generische Speicher-Engine
 * (globales indexedDB als primaerer Speicher, globales localStorage als
 * transparenter Fallback, einheitliche Promise-basierte CRUD-API) ist nach
 * js/shared/offline-kit.js (OfflineKit.createOfflineStorage) ausgelagert --
 * identisch genutzt in 6 Rawkeep-Offline-Apps (agri-aggregator, agri-lease,
 * agri-trace, cold-chain-manager, feed-mill, market-link). Diese Datei
 * konfiguriert die Engine nur mit den agri-aggregator-spezifischen
 * Store-Namen/DB-Angaben und reicht die entitaetsspezifische CRUD-API
 * (saveFarmer/listFarmers/getFarmer/deleteFarmer, ... je Entitaet, jede
 * Funktion liefert ein Promise) unveraendert durch. Es werden ausschliesslich
 * Browser-eigene Storage-APIs verwendet -- keine Netzwerk-Requests (kein
 * fetch, kein XHR).
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

  // Store-Namen je Entitaet.
  var STORES = {
    farmers: 'farmers',
    buyers: 'buyers',
    products: 'products',
    purchases: 'purchases',
    sales: 'sales',
    lossEntries: 'lossEntries',
    priceEntries: 'priceEntries'
  };

  var engine = OfflineKit.createOfflineStorage({
    dbName: 'agri_aggregator_db',
    dbVersion: 1,
    stores: STORES,
    localStoragePrefix: 'agri_aggregator_store_'
  });

  // -----------------------------------------------------------------------
  // Oeffentliche, entitaetsspezifische CRUD-API -- 1:1 Durchreichung der
  // von OfflineKit.createOfflineStorage generierten Methoden.
  // -----------------------------------------------------------------------
  var AgriStorage = {
    STORES: STORES,
    saveFarmer: engine.saveFarmer,
    listFarmers: engine.listFarmers,
    getFarmer: engine.getFarmer,
    deleteFarmer: engine.deleteFarmer,
    saveBuyer: engine.saveBuyer,
    listBuyers: engine.listBuyers,
    getBuyer: engine.getBuyer,
    deleteBuyer: engine.deleteBuyer,
    saveProduct: engine.saveProduct,
    listProducts: engine.listProducts,
    getProduct: engine.getProduct,
    deleteProduct: engine.deleteProduct,
    savePurchase: engine.savePurchase,
    listPurchases: engine.listPurchases,
    getPurchase: engine.getPurchase,
    deletePurchase: engine.deletePurchase,
    saveSale: engine.saveSale,
    listSales: engine.listSales,
    getSale: engine.getSale,
    deleteSale: engine.deleteSale,
    saveLossEntry: engine.saveLossEntry,
    listLossEntries: engine.listLossEntries,
    getLossEntry: engine.getLossEntry,
    deleteLossEntry: engine.deleteLossEntry,
    savePriceEntry: engine.savePriceEntry,
    listPriceEntries: engine.listPriceEntries,
    getPriceEntry: engine.getPriceEntry,
    deletePriceEntry: engine.deletePriceEntry
  };

  global.AgriStorage = AgriStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
