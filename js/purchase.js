/**
 * purchase.js
 *
 * Ankaufserfassung fuer agri-aggregator: nimmt einen Ankauf einer Kleinbauern-
 * Ernte entgegen (Referenz auf Farmer aus dem Stammsatz, Produkt, Gewicht in
 * kg, Qualitaetsstufe A/B/C ueber das Feld qualityGrade, Preis pro kg als
 * Integer in kleinster Waehrungseinheit) und berechnet den Gesamtbetrag
 * deterministisch.
 *
 * Die eigentliche Integer-Multiplikation (weightKg * pricePerKg, Ergebnis
 * als Integer in kleinster Waehrungseinheit) lebt in js/models.js
 * (AgriModels.computeAmount) und wird hier lediglich wiederverwendet --
 * keine Duplikation der Rundungslogik. Geldbetraege werden ausschliesslich
 * ueber Integer-Multiplikation berechnet, niemals ueber eine String-zu-Zahl-
 * Konvertierung mit Nachkommastellen oder eine Nachkommastellen-Formatierung.
 * Keine externen Requests.
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

  function resolveAgriStorage() {
    if (global.AgriStorage) {
      return global.AgriStorage;
    }
    if (typeof require === 'function') {
      return require('./storage.js');
    }
    throw new Error('AgriStorage (js/storage.js) ist nicht verfuegbar.');
  }

  /**
   * Deterministische Berechnung des Gesamtbetrags eines Ankaufs.
   * weightKg: positive Zahl (Gewicht in kg).
   * pricePerKg: Integer in kleinster Waehrungseinheit (z.B. Centimes/Kobo).
   * Rueckgabe: Integer-Gesamtbetrag in kleinster Waehrungseinheit.
   *
   * Reine Integer-Multiplikation ueber AgriModels.computeAmount -- keine
   * String-zu-Zahl-Konvertierung mit Nachkommastellen und keine
   * Nachkommastellen-Formatierung auf dem Geldbetrag.
   */
  function computeTotalAmount(weightKg, pricePerKg) {
    var AgriModels = resolveAgriModels();
    return AgriModels.computeAmount(weightKg, pricePerKg);
  }

  /**
   * Sucht einen Farmer anhand seiner id im uebergebenen Stammsatz-Array.
   * Gibt null zurueck, wenn kein Treffer gefunden wird.
   */
  function findFarmerById(farmers, farmerId) {
    if (!Array.isArray(farmers)) {
      return null;
    }
    for (var i = 0; i < farmers.length; i += 1) {
      if (farmers[i] && farmers[i].id === farmerId) {
        return farmers[i];
      }
    }
    return null;
  }

  /**
   * Erstellt einen Purchase-Datensatz aus Rohdaten (input) und validiert
   * dabei, dass die referenzierte farmerId im Farmer-Stammsatz existiert
   * sowie dass qualityGrade eine gueltige Qualitaetsstufe (A/B/C) ist.
   * Erwartete Felder in input: farmerId, productId, qualityGrade, weightKg,
   * pricePerKg, currency, date. Delegiert die eigentliche Feldvalidierung
   * und die deterministische Betragsberechnung an AgriModels.createPurchase
   * (das intern computeAmount nutzt).
   */
  function createPurchaseFromInput(input, farmers) {
    var AgriModels = resolveAgriModels();
    var data = input || {};

    var farmer = findFarmerById(farmers, data.farmerId);
    if (!farmer) {
      throw new Error(
        'Unbekannter Farmer: farmerId "' + data.farmerId + '" ist nicht im Stammsatz vorhanden.'
      );
    }

    if (!AgriModels.isValidQualityGrade(data.qualityGrade)) {
      throw new Error('Ungueltige Qualitaetsstufe (qualityGrade): erlaubt sind A, B, C.');
    }

    return AgriModels.createPurchase(data);
  }

  /**
   * Erfasst einen Ankauf vollstaendig: validiert die Farmer-Referenz gegen
   * den uebergebenen Stammsatz, berechnet den Gesamtbetrag deterministisch
   * und persistiert den Datensatz ueber AgriStorage. Liefert ein Promise
   * mit dem gespeicherten Purchase-Datensatz.
   */
  function recordPurchase(input, farmers) {
    return new Promise(function (resolve, reject) {
      try {
        var purchase = createPurchaseFromInput(input, farmers);
        var AgriStorage = resolveAgriStorage();
        resolve(AgriStorage.savePurchase(purchase));
      } catch (err) {
        reject(err);
      }
    });
  }

  var AgriPurchase = {
    computeTotalAmount: computeTotalAmount,
    findFarmerById: findFarmerById,
    createPurchaseFromInput: createPurchaseFromInput,
    recordPurchase: recordPurchase
  };

  global.AgriPurchase = AgriPurchase;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriPurchase;
  }
})(typeof window !== 'undefined' ? window : globalThis);
