/**
 * inventory.js
 *
 * Bestandsfuehrung je Produkt und Qualitaetsstufe fuer agri-aggregator.
 * Fuehrt Zu-/Abgaenge bei Ankauf/Verkauf und berechnet den gewichteten
 * Durchschnitts-Einstandspreis (weighted average cost) je Produkt/
 * Qualitaetsstufe deterministisch als Integer-Berechnung (Math.round,
 * analog zu AgriModels.computeAmount). Reiner In-Memory-Zustand pro
 * Prozess/Modul-Instanz -- keine externen Requests.
 */
(function (global) {
  'use strict';

  function resolveAgriModels() {
    if (global.AgriModels) {
      return global.AgriModels;
    }
    if (typeof require === 'function') {
      return require('./models.js');
    }
    throw new Error('AgriModels (js/models.js) ist nicht verfuegbar.');
  }

  // Interner Bestandszustand: "productId::qualityGrade" -> { weightKg, costAmount }.
  // costAmount ist der Gesamteinstandswert (Integer, kleinste Waehrungseinheit).
  var stockState = {};

  function stockKey(productId, qualityGrade) {
    return String(productId) + '::' + String(qualityGrade);
  }

  function ensureEntry(productId, qualityGrade) {
    var key = stockKey(productId, qualityGrade);
    if (!stockState[key]) {
      stockState[key] = { weightKg: 0, costAmount: 0 };
    }
    return stockState[key];
  }

  function isPositiveNumber(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  /**
   * Bucht einen Zugang bei Ankauf: erhoeht Gewicht und Gesamteinstandswert
   * (Integer, kleinste Waehrungseinheit) der Qualitaetsstufe deterministisch
   * ueber AgriModels.computeAmount (Math.round(weightKg * pricePerKg)).
   */
  function updateStockOnPurchase(productId, qualityGrade, weightKg, pricePerKg) {
    var AgriModels = resolveAgriModels();
    if (!isPositiveNumber(weightKg)) {
      throw new Error('Ungueltiges Gewicht (kg) fuer Bestandszugang.');
    }
    if (!AgriModels.isMoneyInteger(pricePerKg)) {
      throw new Error('pricePerKg muss ein nicht-negativer Integer (kleinste Waehrungseinheit) sein.');
    }
    var entry = ensureEntry(productId, qualityGrade);
    var addedCost = AgriModels.computeAmount(weightKg, pricePerKg);
    entry.weightKg += weightKg;
    entry.costAmount += addedCost;
    return getStock(productId, qualityGrade);
  }

  /**
   * Bucht einen Abgang bei Verkauf: reduziert Gewicht und den anteiligen
   * Gesamteinstandswert (auf Basis des aktuellen gewichteten Durchschnitts-
   * Einstandspreises, Integer-Arithmetik) der Qualitaetsstufe. Wirft eine
   * Exception, wenn die Verkaufsmenge den verfuegbaren Bestand uebersteigt.
   */
  function updateStockOnSale(productId, qualityGrade, weightKg) {
    if (!isPositiveNumber(weightKg)) {
      throw new Error('Ungueltiges Gewicht (kg) fuer Bestandsabgang.');
    }
    var entry = ensureEntry(productId, qualityGrade);
    if (weightKg > entry.weightKg) {
      throw new Error(
        'Verkaufsmenge (' + weightKg + ' kg) uebersteigt verfuegbaren Bestand (' +
        entry.weightKg + ' kg) fuer ' + productId + '/' + qualityGrade + '.'
      );
    }
    var averageCost = getWeightedAverageCost(productId, qualityGrade);
    var removedCost = Math.round(weightKg * averageCost);
    entry.weightKg -= weightKg;
    entry.costAmount -= removedCost;
    if (entry.costAmount < 0) {
      entry.costAmount = 0;
    }
    if (entry.weightKg <= 0) {
      entry.weightKg = 0;
      entry.costAmount = 0;
    }
    return getStock(productId, qualityGrade);
  }

  /**
   * Liefert den aktuellen Bestand (Gewicht in kg und Gesamteinstandswert,
   * Integer) je Produkt/Qualitaetsstufe.
   */
  function getStock(productId, qualityGrade) {
    var entry = ensureEntry(productId, qualityGrade);
    return {
      productId: productId,
      qualityGrade: qualityGrade,
      weightKg: entry.weightKg,
      costAmount: entry.costAmount
    };
  }

  /**
   * Deterministische Berechnung des gewichteten Durchschnitts-Einstands-
   * preises je kg (Integer, kleinste Waehrungseinheit). Math.round auf
   * Integer-Ebene, damit alle Aufrufer bei gleichem Zustand identische
   * Ergebnisse erhalten (keine Float-Drift).
   */
  function getWeightedAverageCost(productId, qualityGrade) {
    var entry = ensureEntry(productId, qualityGrade);
    if (entry.weightKg <= 0) {
      return 0;
    }
    return Math.round(entry.costAmount / entry.weightKg);
  }

  /**
   * Setzt den gesamten Bestandszustand zurueck (v.a. fuer Tests nuetzlich).
   */
  function resetStock() {
    stockState = {};
  }

  var AgriInventory = {
    updateStockOnPurchase: updateStockOnPurchase,
    updateStockOnSale: updateStockOnSale,
    getStock: getStock,
    getWeightedAverageCost: getWeightedAverageCost,
    resetStock: resetStock
  };

  global.AgriInventory = AgriInventory;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriInventory;
  }
})(typeof window !== 'undefined' ? window : globalThis);
