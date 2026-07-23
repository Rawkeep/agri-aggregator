/**
 * pricing.js
 *
 * Pflege von Tages- und Saisonpreisen je Produkt/Qualitaetsstufe fuer
 * agri-aggregator. Ein Preiseintrag (Datum/Saison, Produkt, Qualitaetsstufe,
 * Preis pro kg als Integer in kleinster Waehrungseinheit) wird ueber
 * AgriModels.createPriceEntry validiert (priceType 'daily' | 'season') und
 * in einem In-Memory-Zustand gehalten (analog zu js/loss.js).
 *
 * getValidPriceEntry(productId, qualityGrade, dateString) liefert den an
 * einem gegebenen Datum gueltigen Preiseintrag: ein Tagespreis mit exakt
 * passendem Datum hat Vorrang; andernfalls gilt der zuletzt begonnene
 * Saisonpreis (juengster Saisonpreis-Eintrag mit date <= dateString).
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

  // Interner Zustand der erfassten Tages-/Saisonpreise (In-Memory).
  var priceEntries = [];

  /**
   * Erfasst einen Tages- oder Saisonpreis. Validierung und Erzeugung des
   * Datensatzes erfolgen ueber AgriModels.createPriceEntry -- keine
   * Duplikation der Validierungslogik (priceType, Integer-Preis, Waehrung,
   * Qualitaetsstufe).
   */
  function recordPriceEntry(data) {
    var AgriModels = resolveAgriModels();
    var entry = AgriModels.createPriceEntry(data);
    priceEntries.push(entry);
    return entry;
  }

  /**
   * Liefert eine Kopie aller bisher erfassten Preiseintraege.
   */
  function listPriceEntries() {
    return priceEntries.slice();
  }

  /**
   * Setzt den In-Memory-Zustand der Preiseintraege zurueck (v.a. fuer
   * Tests nuetzlich).
   */
  function resetPriceEntries() {
    priceEntries = [];
  }

  /**
   * Sucht einen Tagespreis-Eintrag mit exakt passendem Datum fuer
   * Produkt/Qualitaetsstufe.
   */
  function findDailyPriceEntry(entries, productId, qualityGrade, dateString) {
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (
        entry &&
        entry.priceType === 'daily' &&
        entry.productId === productId &&
        entry.qualityGrade === qualityGrade &&
        entry.date === dateString
      ) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Sucht den zuletzt gueltigen Saisonpreis-Eintrag (juengstes Datum
   * <= dateString) fuer Produkt/Qualitaetsstufe. ISO-Datumsstrings
   * (YYYY-MM-DD) sind lexikographisch vergleichbar, daher genuegt ein
   * String-Vergleich fuer eine deterministische Ermittlung.
   */
  function findSeasonPriceEntry(entries, productId, qualityGrade, dateString) {
    var best = null;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (
        entry &&
        entry.priceType === 'season' &&
        entry.productId === productId &&
        entry.qualityGrade === qualityGrade &&
        entry.date <= dateString
      ) {
        if (!best || entry.date > best.date) {
          best = entry;
        }
      }
    }
    return best;
  }

  /**
   * Ermittelt den an einem gegebenen Datum gueltigen Preiseintrag fuer
   * Produkt/Qualitaetsstufe: ein exakt passender Tagespreis hat Vorrang
   * vor dem zuletzt gueltigen Saisonpreis. entries ist optional (Standard:
   * der interne Zustand aus recordPriceEntry); es kann eine beliebige
   * Liste von Preiseintraegen uebergeben werden (z.B. aus
   * AgriStorage.listPriceEntries()). Liefert null, wenn kein passender
   * Eintrag existiert.
   */
  function getValidPriceEntry(productId, qualityGrade, dateString, entries) {
    var pool = Array.isArray(entries) ? entries : priceEntries;
    var daily = findDailyPriceEntry(pool, productId, qualityGrade, dateString);
    if (daily) {
      return daily;
    }
    return findSeasonPriceEntry(pool, productId, qualityGrade, dateString);
  }

  /**
   * Liefert den an einem gegebenen Datum gueltigen Preis pro kg (Integer,
   * kleinste Waehrungseinheit) fuer Produkt/Qualitaetsstufe, oder null,
   * wenn kein gueltiger Preiseintrag existiert.
   */
  function getCurrentPricePerKg(productId, qualityGrade, dateString, entries) {
    var entry = getValidPriceEntry(productId, qualityGrade, dateString, entries);
    return entry ? entry.pricePerKg : null;
  }

  var AgriPricing = {
    recordPriceEntry: recordPriceEntry,
    listPriceEntries: listPriceEntries,
    resetPriceEntries: resetPriceEntries,
    getValidPriceEntry: getValidPriceEntry,
    getCurrentPricePerKg: getCurrentPricePerKg
  };

  global.AgriPricing = AgriPricing;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriPricing;
  }
})(typeof window !== 'undefined' ? window : globalThis);
