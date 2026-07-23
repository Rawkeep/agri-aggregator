/**
 * storage.js
 *
 * Persistenz-Wrapper fuer agri-aggregator. Nutzt IndexedDB als primaeren
 * Speicher; steht IndexedDB nicht zur Verfuegung (z.B. sehr alter Browser
 * oder eingeschraenkter Kontext), wird transparent auf localStorage
 * zurueckgefallen. Es werden ausschliesslich Browser-eigene Storage-APIs
 * verwendet -- keine Netzwerk-Requests (kein fetch, kein XHR).
 *
 * Alle Funktionen liefern Promises zurueck, damit Aufrufer unabhaengig vom
 * tatsaechlich genutzten Backend (IndexedDB oder localStorage) einheitlich
 * arbeiten koennen.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'agri_aggregator_db';
  var DB_VERSION = 1;

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

  var LOCAL_STORAGE_PREFIX = 'agri_aggregator_store_';

  var dbPromise = null;

  function hasIndexedDb() {
    return typeof global.indexedDB !== 'undefined' && global.indexedDB !== null;
  }

  function hasLocalStorage() {
    return typeof global.localStorage !== 'undefined' && global.localStorage !== null;
  }

  /**
   * Oeffnet (und initialisiert bei Bedarf) die IndexedDB-Datenbank mit
   * einem Object Store pro Entitaet (keyPath: id).
   */
  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }
    dbPromise = new Promise(function (resolve, reject) {
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        Object.keys(STORES).forEach(function (key) {
          var storeName = STORES[key];
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(event.target.error || new Error('IndexedDB konnte nicht geoeffnet werden.'));
      };
    });
    return dbPromise;
  }

  // -----------------------------------------------------------------------
  // localStorage-Fallback: jede Entitaet wird als JSON-Array unter einem
  // eigenen Key abgelegt.
  // -----------------------------------------------------------------------
  function localStorageKey(storeName) {
    return LOCAL_STORAGE_PREFIX + storeName;
  }

  function localStorageReadAll(storeName) {
    var raw = global.localStorage.getItem(localStorageKey(storeName));
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function localStorageWriteAll(storeName, items) {
    global.localStorage.setItem(localStorageKey(storeName), JSON.stringify(items));
  }

  function localStorageSave(storeName, record) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var index = items.findIndex(function (item) {
          return item.id === record.id;
        });
        if (index === -1) {
          items.push(record);
        } else {
          items[index] = record;
        }
        localStorageWriteAll(storeName, items);
        resolve(record);
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageList(storeName) {
    return new Promise(function (resolve, reject) {
      try {
        resolve(localStorageReadAll(storeName));
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageGet(storeName, id) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var found = items.find(function (item) {
          return item.id === id;
        });
        resolve(found || null);
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageRemove(storeName, id) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var filtered = items.filter(function (item) {
          return item.id !== id;
        });
        localStorageWriteAll(storeName, filtered);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  }

  // -----------------------------------------------------------------------
  // IndexedDB-Backend.
  // -----------------------------------------------------------------------
  function indexedDbSave(storeName, record) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.put(record);
        request.onsuccess = function () {
          resolve(record);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Speichern fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbList(storeName) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.getAll();
        request.onsuccess = function (event) {
          resolve(event.target.result || []);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Lesen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbGet(storeName, id) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.get(id);
        request.onsuccess = function (event) {
          resolve(event.target.result || null);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Lesen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbRemove(storeName, id) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.delete(id);
        request.onsuccess = function () {
          resolve(true);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Loeschen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  // -----------------------------------------------------------------------
  // Backend-Auswahl: IndexedDB bevorzugt, sonst localStorage-Fallback.
  // -----------------------------------------------------------------------
  function saveRecord(storeName, record) {
    if (!record || typeof record.id === 'undefined' || record.id === null) {
      return Promise.reject(new Error('Datensatz benoetigt ein id-Feld: ' + storeName));
    }
    if (hasIndexedDb()) {
      return indexedDbSave(storeName, record);
    }
    if (hasLocalStorage()) {
      return localStorageSave(storeName, record);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function listRecords(storeName) {
    if (hasIndexedDb()) {
      return indexedDbList(storeName);
    }
    if (hasLocalStorage()) {
      return localStorageList(storeName);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function getRecord(storeName, id) {
    if (hasIndexedDb()) {
      return indexedDbGet(storeName, id);
    }
    if (hasLocalStorage()) {
      return localStorageGet(storeName, id);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function removeRecord(storeName, id) {
    if (hasIndexedDb()) {
      return indexedDbRemove(storeName, id);
    }
    if (hasLocalStorage()) {
      return localStorageRemove(storeName, id);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  // -----------------------------------------------------------------------
  // Oeffentliche, entitaetsspezifische CRUD-API.
  // -----------------------------------------------------------------------
  function saveFarmer(farmer) {
    return saveRecord(STORES.farmers, farmer);
  }
  function listFarmers() {
    return listRecords(STORES.farmers);
  }
  function getFarmer(id) {
    return getRecord(STORES.farmers, id);
  }
  function deleteFarmer(id) {
    return removeRecord(STORES.farmers, id);
  }

  function saveBuyer(buyer) {
    return saveRecord(STORES.buyers, buyer);
  }
  function listBuyers() {
    return listRecords(STORES.buyers);
  }
  function getBuyer(id) {
    return getRecord(STORES.buyers, id);
  }
  function deleteBuyer(id) {
    return removeRecord(STORES.buyers, id);
  }

  function saveProduct(product) {
    return saveRecord(STORES.products, product);
  }
  function listProducts() {
    return listRecords(STORES.products);
  }
  function getProduct(id) {
    return getRecord(STORES.products, id);
  }
  function deleteProduct(id) {
    return removeRecord(STORES.products, id);
  }

  function savePurchase(purchase) {
    return saveRecord(STORES.purchases, purchase);
  }
  function listPurchases() {
    return listRecords(STORES.purchases);
  }
  function getPurchase(id) {
    return getRecord(STORES.purchases, id);
  }
  function deletePurchase(id) {
    return removeRecord(STORES.purchases, id);
  }

  function saveSale(sale) {
    return saveRecord(STORES.sales, sale);
  }
  function listSales() {
    return listRecords(STORES.sales);
  }
  function getSale(id) {
    return getRecord(STORES.sales, id);
  }
  function deleteSale(id) {
    return removeRecord(STORES.sales, id);
  }

  function saveLossEntry(lossEntry) {
    return saveRecord(STORES.lossEntries, lossEntry);
  }
  function listLossEntries() {
    return listRecords(STORES.lossEntries);
  }
  function getLossEntry(id) {
    return getRecord(STORES.lossEntries, id);
  }
  function deleteLossEntry(id) {
    return removeRecord(STORES.lossEntries, id);
  }

  function savePriceEntry(priceEntry) {
    return saveRecord(STORES.priceEntries, priceEntry);
  }
  function listPriceEntries() {
    return listRecords(STORES.priceEntries);
  }
  function getPriceEntry(id) {
    return getRecord(STORES.priceEntries, id);
  }
  function deletePriceEntry(id) {
    return removeRecord(STORES.priceEntries, id);
  }

  var AgriStorage = {
    STORES: STORES,
    saveFarmer: saveFarmer,
    listFarmers: listFarmers,
    getFarmer: getFarmer,
    deleteFarmer: deleteFarmer,
    saveBuyer: saveBuyer,
    listBuyers: listBuyers,
    getBuyer: getBuyer,
    deleteBuyer: deleteBuyer,
    saveProduct: saveProduct,
    listProducts: listProducts,
    getProduct: getProduct,
    deleteProduct: deleteProduct,
    savePurchase: savePurchase,
    listPurchases: listPurchases,
    getPurchase: getPurchase,
    deletePurchase: deletePurchase,
    saveSale: saveSale,
    listSales: listSales,
    getSale: getSale,
    deleteSale: deleteSale,
    saveLossEntry: saveLossEntry,
    listLossEntries: listLossEntries,
    getLossEntry: getLossEntry,
    deleteLossEntry: deleteLossEntry,
    savePriceEntry: savePriceEntry,
    listPriceEntries: listPriceEntries,
    getPriceEntry: getPriceEntry,
    deletePriceEntry: deletePriceEntry
  };

  global.AgriStorage = AgriStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
