/**
 * bridge.js — agri-aggregator als Hofkette-SENDER (Datenbruecke, hofkette-v1).
 *
 * Exportiert die Warenbewegungen des Aggregators als Hofkette-Belege:
 *   - ANKAUF: jeder Ankauf beim Farmer als eigene Charge AGG-<id>
 *     (Herkunft partner:<farmerId>, Qualitaet A/B/C, Betrag = Auszahlung)
 *   - VERKAUF: Verkaeufe aus dem gepoolten Bestand als Pool-Charge
 *     POOL-<produkt>-<qualitaet> (der Aggregator lagert je Produkt/Qualitaet
 *     gepoolt — die Ankaufs-Chargen bleiben fuer die Herkunft nachvollziehbar)
 *
 * event_ids deterministisch (agg-ank-/agg-sale-<id>) -> idempotenter
 * Re-Import in agri-trace. Spezifikation: docs/DATENBRUECKE.md.
 */
(function (global) {
  'use strict';

  var STATION = 'agri-aggregator';

  function hk() {
    return global.Hofkette || require('./hofkette.js');
  }

  function dayTs(date) {
    // date ist im Bestand YYYY-MM-DD; volle Zeitstempel bleiben unveraendert.
    return date.length === 10 ? date + 'T00:00:00Z' : date;
  }

  function productKey(products, productId) {
    var list = Array.isArray(products) ? products : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === productId) {
        return list[i].nameFr || list[i].nameEn || list[i].name || productId;
      }
    }
    return productId;
  }

  /**
   * ANKAUF-Belege aus den Ankaeufen (eine Charge je Ankauf).
   */
  function buildPurchaseEvents(purchases, products) {
    var H = hk();
    return (Array.isArray(purchases) ? purchases : []).map(function (p) {
      return H.createChainEvent({
        event_id: 'agg-ank-' + p.id,
        ts: dayTs(p.date),
        station: STATION,
        event_type: 'ANKAUF',
        lot_id: 'AGG-' + p.id,
        product: productKey(products, p.productId),
        qty_x10: p.weightKg * 10,
        unit: 'kg',
        quality: p.qualityGrade,
        origin: 'partner:' + p.farmerId,
        amount_minor: p.totalAmount,
        currency: p.currency
      });
    });
  }

  /**
   * VERKAUF-Belege aus den Verkaeufen (Pool-Charge je Produkt/Qualitaet).
   */
  function buildSaleEvents(sales, products) {
    var H = hk();
    return (Array.isArray(sales) ? sales : []).map(function (s) {
      var product = productKey(products, s.productId);
      return H.createChainEvent({
        event_id: 'agg-sale-' + s.id,
        ts: dayTs(s.date),
        station: STATION,
        event_type: 'VERKAUF',
        lot_id: 'POOL-' + s.productId + '-' + s.qualityGrade,
        product: product,
        qty_x10: s.weightKg * 10,
        unit: 'kg',
        quality: s.qualityGrade,
        origin: 'farm',
        amount_minor: s.totalAmount,
        currency: s.currency,
        note: s.buyerId
      });
    });
  }

  function buildAllEvents(state) {
    var s = state || {};
    var events = buildPurchaseEvents(s.purchases, s.products)
      .concat(buildSaleEvents(s.sales, s.products));
    events.sort(function (a, b) {
      if (a.ts !== b.ts) { return a.ts < b.ts ? -1 : 1; }
      return a.event_id < b.event_id ? -1 : (a.event_id > b.event_id ? 1 : 0);
    });
    return events;
  }

  function exportCsv(state) {
    return hk().toCsv(buildAllEvents(state));
  }

  var AgriBridge = {
    STATION: STATION,
    buildPurchaseEvents: buildPurchaseEvents,
    buildSaleEvents: buildSaleEvents,
    buildAllEvents: buildAllEvents,
    exportCsv: exportCsv
  };

  global.AgriBridge = AgriBridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriBridge;
  }
})(typeof window !== 'undefined' ? window : globalThis);
