/**
 * receipt.js
 *
 * Erzeugt einen druck-/PDF-faehigen Auszahlungsbeleg fuer einen Ankauf
 * (Purchase) in agri-aggregator. Es werden keine externen PDF-Bibliotheken
 * oder CDN-Ressourcen verwendet: der Beleg wird als druckoptimiertes
 * HTML/CSS-Fragment in den DOM eingehaengt, der Nutzer erzeugt die PDF-
 * Datei ueber den Browser-Druckdialog via window.print() ("Als PDF
 * speichern"). Beschriftungen sind FR/EN ueber js/i18n.js (AgriI18n).
 */
(function (global) {
  'use strict';

  var RECEIPT_ROOT_ID = 'agri-payout-receipt-root';

  function resolveAgriI18n() {
    if (global.AgriI18n) {
      return global.AgriI18n;
    }
    if (typeof require === 'function') {
      return require('./i18n.js');
    }
    throw new Error('AgriI18n (js/i18n.js) ist nicht verfuegbar.');
  }

  function escapeHtml(value) {
    var str = value === undefined || value === null ? '' : String(value);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formatiert einen Geldbetrag (Integer, kleinste Waehrungseinheit) fuer
   * die Anzeige. Reine Integer-/String-Operationen, kein parseFloat, kein
   * toFixed.
   */
  function formatMoney(amount, currency) {
    var safeAmount = Number.isInteger(amount) ? amount : 0;
    return String(safeAmount) + ' ' + String(currency || '');
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
   * externe PDF-Bibliothek und kein CDN benoetigt.
   */
  function printPayoutReceipt(purchase, farmer, product, lang) {
    if (typeof global.document === 'undefined') {
      throw new Error('printPayoutReceipt benoetigt eine Browser-Umgebung mit document.');
    }
    var doc = global.document;
    var root = doc.getElementById(RECEIPT_ROOT_ID);
    if (!root) {
      root = doc.createElement('div');
      root.id = RECEIPT_ROOT_ID;
      doc.body.appendChild(root);
    }
    root.innerHTML = buildPayoutReceiptHtml(purchase, farmer, product, lang);

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }

    return root;
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
