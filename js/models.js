/**
 * models.js
 *
 * Datenmodell fuer agri-aggregator: reine JS-Objekte/Factory-Funktionen mit Validierung.
 * Entitaeten: Farmer, Buyer, Product, Purchase, Sale, LossEntry, PriceEntry.
 *
 * Wichtige Regel: Geldbetraege (pricePerKg, totalAmount, margin, ...) werden IMMER als
 * Integer in der kleinsten Waehrungseinheit gespeichert (z.B. Centimes/Kobo), niemals
 * als Float. Preis- und Margenberechnung erfolgt deterministisch (Math.round auf
 * Integer-Ebene, keine Gleitkomma-Rundungsfehler in Folgeberechnungen).
 */
(function (global) {
  'use strict';

  // Erlaubte Qualitaetsstufen fuer Ernteware.
  var QUALITY_GRADES = ['A', 'B', 'C'];

  // Unterstuetzte Waehrungen (kleinste Einheit: XOF hat keine Nachkommastellen,
  // NGN wird hier ebenfalls als ganzzahlige kleinste Einheit gefuehrt).
  var CURRENCIES = ['XOF', 'NGN'];

  // Abnehmer-Typen (Supermarkt/Verarbeiter/Exporteur).
  var BUYER_TYPES = ['supermarket', 'processor', 'exporter'];

  // Preistyp fuer PriceEntry (Tages- oder Saisonpreis).
  var PRICE_TYPES = ['daily', 'season'];

  var idCounter = 0;

  /**
   * Erzeugt eine eindeutige ID pro Prozess (Praefix + Zeitstempel + Zaehler).
   */
  function generateId(prefix) {
    idCounter += 1;
    var ts = Date.now().toString(36);
    return (prefix || 'id') + '_' + ts + '_' + idCounter.toString(36);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function requireString(value, fieldName) {
    if (!isNonEmptyString(value)) {
      throw new Error('Pflichtfeld fehlt oder ungueltig: ' + fieldName);
    }
    return value;
  }

  function isPositiveNumber(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function requireWeightKg(value) {
    if (!isPositiveNumber(value)) {
      throw new Error('Ungueltiges Gewicht (kg): muss eine positive Zahl sein.');
    }
    return value;
  }

  /**
   * Prueft, ob ein Betrag als Integer in kleinster Waehrungseinheit vorliegt.
   * Floats fuer Geldbetraege sind nicht zulaessig.
   */
  function isMoneyInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function requireMoneyInteger(value, fieldName) {
    if (!isMoneyInteger(value)) {
      throw new Error(
        'Ungueltiger Geldbetrag fuer ' + fieldName + ': muss ein nicht-negativer Integer (kleinste Waehrungseinheit) sein.'
      );
    }
    return value;
  }

  function isValidQualityGrade(value) {
    return QUALITY_GRADES.indexOf(value) !== -1;
  }

  function requireQualityGrade(value) {
    if (!isValidQualityGrade(value)) {
      throw new Error('Ungueltige Qualitaetsstufe: erlaubt sind A, B, C.');
    }
    return value;
  }

  function isValidCurrency(value) {
    return CURRENCIES.indexOf(value) !== -1;
  }

  function requireCurrency(value) {
    if (!isValidCurrency(value)) {
      throw new Error('Ungueltige Waehrung: erlaubt sind XOF, NGN.');
    }
    return value;
  }

  function requireDateString(value, fieldName) {
    if (!isNonEmptyString(value)) {
      throw new Error('Pflichtfeld fehlt oder ungueltig: ' + fieldName);
    }
    return value;
  }

  /**
   * Deterministische Multiplikation Gewicht x Preis/kg (Integer, kleinste Einheit).
   * Rundung erfolgt einheitlich mit Math.round, damit alle Aufrufer identische
   * Ergebnisse erhalten (keine Bank-Rundung, keine Float-Drift).
   */
  function computeAmount(weightKg, pricePerKg) {
    requireWeightKg(weightKg);
    requireMoneyInteger(pricePerKg, 'pricePerKg');
    return Math.round(weightKg * pricePerKg);
  }

  // ---------------------------------------------------------------------
  // Farmer: Kleinbauer-Stammsatz (CSV-Spalten: farmer_id, name, telefon,
  // dorf, h3_zelle, kulturen, flaeche_ha, zahlweg -- werden beim CSV-Import
  // auf die englischen Feldnamen unten gemappt).
  // ---------------------------------------------------------------------
  function createFarmer(data) {
    data = data || {};
    var farmer = {
      id: isNonEmptyString(data.id) ? data.id : generateId('farmer'),
      name: requireString(data.name, 'name'),
      phone: typeof data.phone === 'string' ? data.phone : '',
      village: typeof data.village === 'string' ? data.village : '',
      h3Cell: typeof data.h3Cell === 'string' ? data.h3Cell : '',
      crops: typeof data.crops === 'string' ? data.crops : '',
      areaHa: typeof data.areaHa === 'number' && isFinite(data.areaHa) ? data.areaHa : 0,
      paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : ''
    };
    return farmer;
  }

  // ---------------------------------------------------------------------
  // Buyer: Abnehmer (Supermarkt/Verarbeiter/Exporteur).
  // ---------------------------------------------------------------------
  function createBuyer(data) {
    data = data || {};
    if (BUYER_TYPES.indexOf(data.type) === -1) {
      throw new Error('Ungueltiger Abnehmer-Typ: erlaubt sind supermarket, processor, exporter.');
    }
    var buyer = {
      id: isNonEmptyString(data.id) ? data.id : generateId('buyer'),
      name: requireString(data.name, 'name'),
      type: data.type,
      phone: typeof data.phone === 'string' ? data.phone : '',
      contact: typeof data.contact === 'string' ? data.contact : ''
    };
    return buyer;
  }

  // ---------------------------------------------------------------------
  // Product: Erntegut/Produkt (z.B. Kakao, Cashew, Mais).
  // ---------------------------------------------------------------------
  function createProduct(data) {
    data = data || {};
    var product = {
      id: isNonEmptyString(data.id) ? data.id : generateId('product'),
      name: requireString(data.name, 'name'),
      unit: isNonEmptyString(data.unit) ? data.unit : 'kg'
    };
    return product;
  }

  // ---------------------------------------------------------------------
  // Purchase: Ankauf einer Ernte-Charge von einem Farmer.
  // ---------------------------------------------------------------------
  function createPurchase(data) {
    data = data || {};
    var farmerId = requireString(data.farmerId, 'farmerId');
    var productId = requireString(data.productId, 'productId');
    var qualityGrade = requireQualityGrade(data.qualityGrade);
    var weightKg = requireWeightKg(data.weightKg);
    var pricePerKg = requireMoneyInteger(data.pricePerKg, 'pricePerKg');
    var currency = requireCurrency(data.currency);
    var date = requireDateString(data.date, 'date');

    var purchase = {
      id: isNonEmptyString(data.id) ? data.id : generateId('purchase'),
      farmerId: farmerId,
      productId: productId,
      qualityGrade: qualityGrade,
      weightKg: weightKg,
      pricePerKg: pricePerKg,
      currency: currency,
      date: date,
      totalAmount: computeAmount(weightKg, pricePerKg)
    };
    return purchase;
  }

  // ---------------------------------------------------------------------
  // Sale: Verkauf einer Charge an einen Abnehmer, inkl. Margen-Berechnung.
  // costPerKg ist optional und dient als Kostenbasis (z.B. gewichteter
  // Einkaufspreis) fuer die Margenberechnung.
  // ---------------------------------------------------------------------
  function createSale(data) {
    data = data || {};
    var buyerId = requireString(data.buyerId, 'buyerId');
    var productId = requireString(data.productId, 'productId');
    var qualityGrade = requireQualityGrade(data.qualityGrade);
    var weightKg = requireWeightKg(data.weightKg);
    var pricePerKg = requireMoneyInteger(data.pricePerKg, 'pricePerKg');
    var currency = requireCurrency(data.currency);
    var date = requireDateString(data.date, 'date');

    var hasCostBasis = data.costPerKg !== undefined && data.costPerKg !== null;
    var costPerKg = hasCostBasis ? requireMoneyInteger(data.costPerKg, 'costPerKg') : null;

    var totalAmount = computeAmount(weightKg, pricePerKg);
    var costAmount = hasCostBasis ? computeAmount(weightKg, costPerKg) : null;
    var margin = hasCostBasis ? totalAmount - costAmount : null;

    var sale = {
      id: isNonEmptyString(data.id) ? data.id : generateId('sale'),
      buyerId: buyerId,
      productId: productId,
      qualityGrade: qualityGrade,
      weightKg: weightKg,
      pricePerKg: pricePerKg,
      costPerKg: costPerKg,
      currency: currency,
      date: date,
      totalAmount: totalAmount,
      costAmount: costAmount,
      margin: margin
    };
    return sale;
  }

  // ---------------------------------------------------------------------
  // LossEntry: taegliche Verlust-/Schwund-Erfassung (Post-Harvest-Loss).
  // ---------------------------------------------------------------------
  function createLossEntry(data) {
    data = data || {};
    var productId = requireString(data.productId, 'productId');
    var qualityGrade = requireQualityGrade(data.qualityGrade);
    var weightKg = requireWeightKg(data.weightKg);
    var date = requireDateString(data.date, 'date');

    var lossEntry = {
      id: isNonEmptyString(data.id) ? data.id : generateId('loss'),
      productId: productId,
      qualityGrade: qualityGrade,
      weightKg: weightKg,
      date: date,
      reason: typeof data.reason === 'string' ? data.reason : ''
    };
    return lossEntry;
  }

  // ---------------------------------------------------------------------
  // PriceEntry: Tages- oder Saisonpreis je Produkt/Qualitaetsstufe.
  // ---------------------------------------------------------------------
  function createPriceEntry(data) {
    data = data || {};
    var productId = requireString(data.productId, 'productId');
    var qualityGrade = requireQualityGrade(data.qualityGrade);
    var pricePerKg = requireMoneyInteger(data.pricePerKg, 'pricePerKg');
    var currency = requireCurrency(data.currency);
    var date = requireDateString(data.date, 'date');

    if (PRICE_TYPES.indexOf(data.priceType) === -1) {
      throw new Error('Ungueltiger Preistyp: erlaubt sind daily, season.');
    }

    var priceEntry = {
      id: isNonEmptyString(data.id) ? data.id : generateId('price'),
      productId: productId,
      qualityGrade: qualityGrade,
      priceType: data.priceType,
      pricePerKg: pricePerKg,
      currency: currency,
      date: date
    };
    return priceEntry;
  }

  var AgriModels = {
    QUALITY_GRADES: QUALITY_GRADES,
    CURRENCIES: CURRENCIES,
    BUYER_TYPES: BUYER_TYPES,
    PRICE_TYPES: PRICE_TYPES,
    generateId: generateId,
    isValidQualityGrade: isValidQualityGrade,
    isValidCurrency: isValidCurrency,
    isMoneyInteger: isMoneyInteger,
    computeAmount: computeAmount,
    createFarmer: createFarmer,
    createBuyer: createBuyer,
    createProduct: createProduct,
    createPurchase: createPurchase,
    createSale: createSale,
    createLossEntry: createLossEntry,
    createPriceEntry: createPriceEntry
  };

  // Im Browser als window.AgriModels verfuegbar, in Node/Tests ueber globalThis.
  global.AgriModels = AgriModels;

  // Zusaetzlicher CommonJS-Export fuer Node-basierte Tests, sofern vorhanden.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriModels;
  }
})(typeof window !== 'undefined' ? window : globalThis);
