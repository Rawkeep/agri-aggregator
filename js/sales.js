/**
 * sales.js
 *
 * Verkaufserfassung fuer agri-aggregator: bucht einen Verkauf einer Charge
 * (Produkt/Qualitaetsstufe) an einen Abnehmer (Supermarkt/Verarbeiter/
 * Exporteur), reduziert den Bestand der gewaehlten Qualitaetsstufe ueber
 * js/inventory.js und berechnet die Marge deterministisch als Integer:
 *   margin = saleAmount - (weightSold * weightedAverageCost)
 * Alle Geldbetraege sind Integer in kleinster Waehrungseinheit. Keine
 * externen Requests.
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

  function resolveAgriInventory() {
    if (global.AgriInventory) {
      return global.AgriInventory;
    }
    if (typeof require === 'function') {
      return require('./inventory.js');
    }
    throw new Error('AgriInventory (js/inventory.js) ist nicht verfuegbar.');
  }

  function resolveAgriStorage() {
    if (global.AgriStorage) {
      return global.AgriStorage;
    }
    if (typeof require === 'function') {
      try {
        return require('./storage.js');
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  /**
   * Sucht einen Abnehmer anhand seiner id im uebergebenen Stammsatz-Array.
   * Gibt null zurueck, wenn kein Treffer gefunden wird.
   */
  function findBuyerById(buyers, buyerId) {
    if (!Array.isArray(buyers)) {
      return null;
    }
    for (var i = 0; i < buyers.length; i += 1) {
      if (buyers[i] && buyers[i].id === buyerId) {
        return buyers[i];
      }
    }
    return null;
  }

  /**
   * Erstellt und bucht einen Verkauf aus Rohdaten (input): prueft den
   * verfuegbaren Bestand der Qualitaetsstufe (js/inventory.js), berechnet
   * saleAmount sowie die Marge deterministisch als Integer ueber den
   * aktuellen gewichteten Durchschnitts-Einstandspreis und reduziert
   * anschliessend den Bestand. Ein Verkauf, der den verfuegbaren Bestand
   * der Qualitaetsstufe uebersteigt, wird mit einer Exception abgelehnt.
   *
   * Erwartete Felder in input: buyerId, productId, qualityGrade, weightKg,
   * pricePerKg, currency, date. buyers (optional): Abnehmer-Stammsatz-
   * Array zur Validierung der buyerId-Referenz.
   */
  function createSaleFromInput(input, buyers) {
    var AgriModels = resolveAgriModels();
    var AgriInventory = resolveAgriInventory();
    var data = input || {};

    if (Array.isArray(buyers)) {
      var buyer = findBuyerById(buyers, data.buyerId);
      if (!buyer) {
        throw new Error(
          'Unbekannter Abnehmer: buyerId "' + data.buyerId + '" ist nicht im Stammsatz vorhanden.'
        );
      }
    }

    if (!AgriModels.isValidQualityGrade(data.qualityGrade)) {
      throw new Error('Ungueltige Qualitaetsstufe (qualityGrade): erlaubt sind A, B, C.');
    }

    var stock = AgriInventory.getStock(data.productId, data.qualityGrade);
    if (!(typeof data.weightKg === 'number') || data.weightKg > stock.weightKg) {
      throw new Error(
        'Verkaufsmenge uebersteigt verfuegbaren Bestand fuer ' + data.productId + '/' + data.qualityGrade +
        ' (verfuegbar: ' + stock.weightKg + ' kg).'
      );
    }

    var weightedAverageCost = AgriInventory.getWeightedAverageCost(data.productId, data.qualityGrade);

    var sale = AgriModels.createSale({
      id: data.id,
      buyerId: data.buyerId,
      productId: data.productId,
      qualityGrade: data.qualityGrade,
      weightKg: data.weightKg,
      pricePerKg: data.pricePerKg,
      costPerKg: weightedAverageCost,
      currency: data.currency,
      date: data.date
    });

    var saleAmount = sale.totalAmount;
    // Deterministische Margen-Berechnung (Integer-Arithmetik):
    // margin = saleAmount - (weightSold * weightedAverageCost)
    var margin = saleAmount - Math.round(data.weightKg * weightedAverageCost);
    sale.margin = margin;

    // Bestand der Qualitaetsstufe erst nach erfolgreicher Berechnung
    // reduzieren; AgriInventory ist die verbindliche Quelle und wirft bei
    // unzureichendem Bestand ebenfalls eine Exception.
    AgriInventory.updateStockOnSale(data.productId, data.qualityGrade, data.weightKg);

    return sale;
  }

  /**
   * Bucht einen Verkauf vollstaendig (analog zu AgriPurchase.recordPurchase)
   * und persistiert den Datensatz ueber AgriStorage, sofern verfuegbar.
   * Liefert ein Promise mit dem gebuchten Sale-Datensatz.
   */
  function recordSale(input, buyers) {
    return new Promise(function (resolve, reject) {
      try {
        var sale = createSaleFromInput(input, buyers);
        var AgriStorage = resolveAgriStorage();
        if (AgriStorage && typeof AgriStorage.saveSale === 'function') {
          resolve(AgriStorage.saveSale(sale));
        } else {
          resolve(sale);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  var AgriSales = {
    findBuyerById: findBuyerById,
    createSaleFromInput: createSaleFromInput,
    recordSale: recordSale
  };

  global.AgriSales = AgriSales;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriSales;
  }
})(typeof window !== 'undefined' ? window : globalThis);
