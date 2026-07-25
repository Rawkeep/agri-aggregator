/**
 * receipt.js
 *
 * Erzeugt einen druck-/PDF-faehigen Auszahlungsbeleg fuer einen Ankauf
 * (Purchase) in agri-aggregator. Es werden keine externen PDF-Bibliotheken
 * oder CDN-Ressourcen verwendet: der Beleg wird als druckoptimiertes
 * HTML/CSS-Fragment in den DOM eingehaengt, der Nutzer erzeugt die PDF-
 * Datei ueber den Browser-Druckdialog via window.print() ("Als PDF
 * speichern"). Beschriftungen sind FR/EN ueber js/i18n.js (AgriI18n). Das
 * generische HTML-Escaping, die Integer-Geldformatierung und der
 * window.print()-DOM-Mechanismus sind nach js/shared/offline-kit.js
 * (OfflineKit.receipt) ausgelagert -- identisch genutzt in 6 Rawkeep-
 * Offline-Apps. Das eigentliche Beleg-Layout (buildPayoutReceiptHtml) bleibt
 * hier, da es agri-aggregator-spezifische Felder/Labels enthaelt.
 */
(function (global) {
  'use strict';

  var RECEIPT_ROOT_ID = 'agri-payout-receipt-root';

  function resolveOfflineKit() {
    if (global.OfflineKit) {
      return global.OfflineKit;
    }
    if (typeof require === 'function') {
      return require('./shared/offline-kit.js');
    }
    throw new Error('OfflineKit (js/shared/offline-kit.js) ist nicht verfuegbar.');
  }

  function resolveAgriI18n() {
    if (global.AgriI18n) {
      return global.AgriI18n;
    }
    if (typeof require === 'function') {
      return require('./i18n.js');
    }
    throw new Error('AgriI18n (js/i18n.js) ist nicht verfuegbar.');
  }

  var OfflineKit = resolveOfflineKit();

  /**
   * HTML-Escaping fuer Beleg-Feldwerte (delegiert an
   * OfflineKit.receipt.escapeHtml).
   */
  function escapeHtml(value) {
    return OfflineKit.receipt.escapeHtml(value);
  }

  /**
   * Formatiert einen Geldbetrag (Integer, kleinste Waehrungseinheit) fuer
   * die Anzeige (delegiert an OfflineKit.receipt.formatMoney). Reine
   * Integer-/String-Operationen, kein parseFloat, kein toFixed.
   */
  function formatMoney(amount, currency) {
    return OfflineKit.receipt.formatMoney(amount, currency);
  }

  /**
   * Baut das druckoptimierte HTML-Fragment des Auszahlungsbelegs. Reine
   * String-Funktion ohne DOM-Zugriff -- dadurch unabhaengig von einer
   * Browser-Umgebung testbar (z.B. per Node-Subprocess).
   *
   * purchase: Purchase-Datensatz (farmerId, productId, qualityGrade,
   *   weightKg, pricePerKg, currency, date, totalAmount, ...).
   * farmer: Farmer-Stammsatz (mindestens { name }).
   * product: Produkt-Stammsatz (mindestens { name }).
   * lang: 'fr' | 'en' (optional, faellt auf AgriI18n.getLanguage() zurueck).
   */
  function buildPayoutReceiptHtml(purchase, farmer, product, lang) {
    var AgriI18n = resolveAgriI18n();
    var p = purchase || {};
    var f = farmer || {};
    var prod = product || {};
    var targetLang = lang || AgriI18n.getLanguage();

    var titleLabel = AgriI18n.t('payoutReceipt', targetLang);
    var farmerLabel = AgriI18n.t('farmer', targetLang);
    var productLabel = AgriI18n.t('product', targetLang);
    var weightLabel = AgriI18n.t('weight', targetLang);
    var qualityGradeLabel = AgriI18n.t('qualityGrade', targetLang);
    var priceLabel = AgriI18n.t('price', targetLang);

    var farmerName = f.name || p.farmerId || '';
    var productName = prod.name || p.productId || '';
    var weightKg = p.weightKg !== undefined ? p.weightKg : '';
    var qualityGrade = p.qualityGrade || '';
    var priceText = formatMoney(p.pricePerKg, p.currency) + ' / kg';
    var totalText = formatMoney(p.totalAmount, p.currency);

    return (
      '<div class="agri-receipt" id="' + RECEIPT_ROOT_ID + '-content">' +
      '<style>' +
      '.agri-receipt{font-family:Arial,sans-serif;color:#111;max-width:480px;margin:0 auto;padding:16px;}' +
      '.agri-receipt table{width:100%;border-collapse:collapse;margin-top:12px;}' +
      '.agri-receipt th{text-align:left;padding:4px 8px;font-weight:bold;width:40%;}' +
      '.agri-receipt td{padding:4px 8px;}' +
      '.agri-receipt .agri-receipt-total td{font-weight:bold;border-top:1px solid #111;}' +
      '@media print{' +
      'body *{visibility:hidden;}' +
      '#' + RECEIPT_ROOT_ID + ',#' + RECEIPT_ROOT_ID + ' *{visibility:visible;}' +
      '#' + RECEIPT_ROOT_ID + '{position:absolute;top:0;left:0;width:100%;}' +
      '}' +
      '</style>' +
      '<h1>' + escapeHtml(titleLabel) + '</h1>' +
      '<table>' +
      '<tr><th>' + escapeHtml(farmerLabel) + '</th><td>' + escapeHtml(farmerName) + '</td></tr>' +
      '<tr><th>' + escapeHtml(productLabel) + '</th><td>' + escapeHtml(productName) + '</td></tr>' +
      '<tr><th>' + escapeHtml(weightLabel) + '</th><td>' + escapeHtml(weightKg) + ' kg</td></tr>' +
      '<tr><th>' + escapeHtml(qualityGradeLabel) + '</th><td>' + escapeHtml(qualityGrade) + '</td></tr>' +
      '<tr><th>' + escapeHtml(priceLabel) + '</th><td>' + escapeHtml(priceText) + '</td></tr>' +
      '<tr class="agri-receipt-total"><th>' + escapeHtml(priceLabel) + ' (' + escapeHtml(weightLabel) + ' x ' + escapeHtml(priceLabel) + ')</th><td>' + escapeHtml(totalText) + '</td></tr>' +
      '</table>' +
      '</div>'
    );
  }

  /**
   * Haengt den Auszahlungsbeleg als druckoptimiertes Fragment in den DOM
   * ein und startet den Browser-Druckdialog ueber window.print(). Der
   * Nutzer kann darueber "Als PDF speichern" waehlen -- es wird keine
   * externe PDF-Bibliothek und kein CDN benoetigt. Der DOM-/
   * window.print()-Mechanismus selbst ist an OfflineKit.receipt.printReceipt
   * delegiert (js/shared/offline-kit.js): findet/erzeugt das Root-Element
   * mit id agri-payout-receipt-root und setzt dessen innerHTML.
   */
  function printPayoutReceipt(purchase, farmer, product, lang) {
    var html = buildPayoutReceiptHtml(purchase, farmer, product, lang);
    return OfflineKit.receipt.printReceipt(RECEIPT_ROOT_ID, html);
  }

  var AgriReceipt = {
    RECEIPT_ROOT_ID: RECEIPT_ROOT_ID,
    formatMoney: formatMoney,
    buildPayoutReceiptHtml: buildPayoutReceiptHtml,
    printPayoutReceipt: printPayoutReceipt
  };

  global.AgriReceipt = AgriReceipt;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriReceipt;
  }
})(typeof window !== 'undefined' ? window : globalThis);
