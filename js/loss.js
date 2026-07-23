/**
 * loss.js
 *
 * Taegliche Verlust-/Schwund-Erfassung je Produkt fuer agri-aggregator
 * sowie Berechnung des Post-Harvest-Loss-KPI. Ein Verlust-/Schwund-Eintrag
 * (Datum, Produkt, Menge kg, optionaler Grund) wird ueber
 * AgriModels.createLossEntry validiert und in einem In-Memory-Zustand
 * gehalten (analog zu js/inventory.js). Der Post-Harvest-Loss-KPI wird
 * deterministisch als Integer-Promille berechnet:
 *   KPI = round(Summe Schwund-kg / Summe Ankaufsvolumen-kg * 1000)
 * Ein Promille-Wert (statt Prozent) vermeidet Float-Rundungsfehler bei
 * kleinen Prozentwerten und wird ueber Math.round als Integer geliefert.
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

  // Interner Zustand der erfassten Verlust-/Schwund-Eintraege (In-Memory,
  // analog zum Bestandszustand in js/inventory.js).
  var lossEntries = [];

  /**
   * Erfasst einen Verlust-/Schwund-Eintrag mit den Feldern productId,
   * qualityGrade, weightKg, date und optional reason (Grund des Schwunds,
   * z.B. "Transportschaden" oder "Schaedlingsbefall"). Validierung und
   * Erzeugung des Datensatzes erfolgen ueber AgriModels.createLossEntry --
   * keine Duplikation der Validierungslogik. Das optionale reason-Feld
   * wird unveraendert an AgriModels.createLossEntry durchgereicht, das den
   * Default (leerer String) fuer ein fehlendes reason setzt.
   */
  function recordLoss(data) {
    var AgriModels = resolveAgriModels();
    var input = data || {};
    var payload = {
      id: input.id,
      productId: input.productId,
      qualityGrade: input.qualityGrade,
      weightKg: input.weightKg,
      date: input.date,
      reason: input.reason
    };
    var entry = AgriModels.createLossEntry(payload);
    lossEntries.push(entry);
    return entry;
  }

  /**
   * Liefert eine Kopie aller bisher erfassten Verlust-/Schwund-Eintraege.
   */
  function listLossEntries() {
    return lossEntries.slice();
  }

  /**
   * Setzt den In-Memory-Zustand der Verlust-/Schwund-Eintraege zurueck
   * (v.a. fuer Tests nuetzlich).
   */
  function resetLossEntries() {
    lossEntries = [];
  }

  /**
   * Prueft, ob ein Datum (ISO-Format YYYY-MM-DD, lexikographisch
   * vergleichbar) innerhalb eines optionalen Zeitraums liegt. Fehlende
   * Grenzen (startDate/endDate) werden als "offen" behandelt.
   */
  function isWithinPeriod(dateStr, startDate, endDate) {
    if (startDate && dateStr < startDate) {
      return false;
    }
    if (endDate && dateStr > endDate) {
      return false;
    }
    return true;
  }

  /**
   * Summiert die Schwund-Menge (kg) eines Produkts innerhalb eines
   * optionalen Zeitraums ueber eine uebergebene Liste von Verlust-/
   * Schwund-Eintraegen (entkoppelt von einem festen Storage-Backend, damit
   * die KPI-Berechnung unabhaengig testbar ist).
   */
  function sumLossWeightKg(entries, productId, startDate, endDate) {
    var list = Array.isArray(entries) ? entries : [];
    var total = 0;
    for (var i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (entry && entry.productId === productId && isWithinPeriod(entry.date, startDate, endDate)) {
        total += entry.weightKg;
      }
    }
    return total;
  }

  /**
   * Summiert das Ankaufsvolumen (kg) eines Produkts innerhalb eines
   * optionalen Zeitraums ueber eine uebergebene Liste von Purchase-
   * Datensaetzen (z.B. aus AgriStorage.listPurchases()).
   */
  function sumPurchaseWeightKg(purchases, productId, startDate, endDate) {
    var list = Array.isArray(purchases) ? purchases : [];
    var total = 0;
    for (var i = 0; i < list.length; i += 1) {
      var purchase = list[i];
      if (purchase && purchase.productId === productId && isWithinPeriod(purchase.date, startDate, endDate)) {
        total += purchase.weightKg;
      }
    }
    return total;
  }

  /**
   * Deterministische Berechnung des Post-Harvest-Loss-KPI als Integer-
   * Promille (Tausendstel) je Produkt und Zeitraum:
   *   KPI = round(Summe Schwund-kg / Summe Ankaufsvolumen-kg * 1000)
   * Liefert 0, wenn im Zeitraum kein Ankaufsvolumen vorliegt (Division
   * durch 0 wird vermieden). Reine Integer-Rundung ueber Math.round, damit
   * alle Aufrufer bei gleicher Eingabe identische Ergebnisse erhalten.
   */
  function computePostHarvestLossKpiPromille(lossEntriesInput, purchases, productId, startDate, endDate) {
    var totalLossKg = sumLossWeightKg(lossEntriesInput, productId, startDate, endDate);
    var totalPurchaseKg = sumPurchaseWeightKg(purchases, productId, startDate, endDate);
    if (totalPurchaseKg <= 0) {
      return 0;
    }
    return Math.round((totalLossKg * 1000) / totalPurchaseKg);
  }

  var AgriLoss = {
    recordLoss: recordLoss,
    listLossEntries: listLossEntries,
    resetLossEntries: resetLossEntries,
    sumLossWeightKg: sumLossWeightKg,
    sumPurchaseWeightKg: sumPurchaseWeightKg,
    computePostHarvestLossKpiPromille: computePostHarvestLossKpiPromille
  };

  global.AgriLoss = AgriLoss;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriLoss;
  }
})(typeof window !== 'undefined' ? window : globalThis);
