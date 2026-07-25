/**
 * csv.js
 *
 * CSV-Import/-Export fuer Farmer- und Abnehmer-Stammdaten in agri-aggregator.
 * Export-Spalten fuer Farmer (exakte Reihenfolge, siehe FARMER_CSV_COLUMNS):
 *   farmer_id, name, telefon, dorf, h3_zelle, kulturen, flaeche_ha, zahlweg
 * Fuer Abnehmer wird das gleiche CSV-Grundformat mit sinnvoll angepassten
 * Spalten verwendet (siehe BUYER_CSV_COLUMNS).
 *
 * Das generische CSV-Escaping/-Parsing (RFC4180-Prinzip: Felder mit Komma,
 * Anfuehrungszeichen oder Zeilenumbruch werden in doppelte Anfuehrungszeichen
 * gesetzt, enthaltene Anfuehrungszeichen werden zu doppelten
 * Anfuehrungszeichen ("") verdoppelt) ist nach js/shared/offline-kit.js
 * (OfflineKit.csv) ausgelagert -- identisch genutzt in 6 Rawkeep-Offline-
 * Apps. Diese Datei haelt nur das agri-aggregator-eigene Spaltenschema und
 * den Farmer-/Buyer-Export-/Import, und reicht das generische Escaping/
 * Parsing unveraendert durch. Export gefolgt von Import ergibt bei
 * identischen Rohdaten identische Datensaetze (deterministische
 * Serialisierung/Deserialisierung). Keine externen Requests, keine
 * externen Bibliotheken.
 */
(function (global) {
  'use strict';

  function resolveOfflineKit() {
    if (global.OfflineKit) {
      return global.OfflineKit;
    }
    if (typeof require === 'function') {
      return require('./shared/offline-kit.js');
    }
    throw new Error('OfflineKit (js/shared/offline-kit.js) ist nicht verfuegbar.');
  }

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

  var OfflineKit = resolveOfflineKit();

  // Exakte Spaltenreihenfolge fuer den Farmer-Export/-Import (siehe Auftrag).
  var FARMER_CSV_COLUMNS = [
    'farmer_id',
    'name',
    'telefon',
    'dorf',
    'h3_zelle',
    'kulturen',
    'flaeche_ha',
    'zahlweg'
  ];

  // Analoges CSV-Grundformat fuer Abnehmer-Stammdaten (sinnvoll angepasste
  // Spalten: buyer_id, name, typ, telefon, kontakt).
  var BUYER_CSV_COLUMNS = ['buyer_id', 'name', 'typ', 'telefon', 'kontakt'];

  /**
   * Escaped ein einzelnes CSV-Feld nach RFC4180-Prinzip (delegiert an
   * OfflineKit.csv.csvEscapeField).
   */
  function csvEscapeField(value) {
    return OfflineKit.csv.csvEscapeField(value);
  }

  /**
   * Baut eine einzelne CSV-Zeile (ohne Zeilenumbruch am Ende) aus einem
   * Array von Rohwerten (delegiert an OfflineKit.csv.toCsvRow).
   */
  function toCsvRow(fields) {
    return OfflineKit.csv.toCsvRow(fields);
  }

  /**
   * Baut einen vollstaendigen CSV-Text aus Header-Spalten und Datenzeilen
   * (delegiert an OfflineKit.csv.buildCsv).
   */
  function buildCsv(headerColumns, rows) {
    return OfflineKit.csv.buildCsv(headerColumns, rows);
  }

  /**
   * Parst einen vollstaendigen CSV-Text in ein Array von Zeilen (delegiert
   * an OfflineKit.csv.parseCsv).
   */
  function parseCsv(text) {
    return OfflineKit.csv.parseCsv(text);
  }

  function toAreaHaNumber(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return 0;
    }
    var num = Number(rawValue);
    return isFinite(num) ? num : 0;
  }

  function dataRowsOf(rows) {
    return OfflineKit.csv.dataRowsOf(rows);
  }

  // ---------------------------------------------------------------------
  // Farmer-Export/-Import
  // ---------------------------------------------------------------------

  /**
   * Exportiert eine Liste von Farmer-Stammsaetzen (siehe
   * AgriModels.createFarmer) als CSV-Text mit exakt den Spalten
   * farmer_id, name, telefon, dorf, h3_zelle, kulturen, flaeche_ha,
   * zahlweg in dieser Reihenfolge.
   */
  function exportFarmersToCsv(farmers) {
    var list = Array.isArray(farmers) ? farmers : [];
    var rows = list.map(function (farmer) {
      var f = farmer || {};
      return [
        f.id,
        f.name,
        f.phone,
        f.village,
        f.h3Cell,
        f.crops,
        f.areaHa,
        f.paymentMethod
      ];
    });
    return buildCsv(FARMER_CSV_COLUMNS, rows);
  }

  /**
   * Parst einen Farmer-CSV-Text (Spalten siehe FARMER_CSV_COLUMNS) in ein
   * Array validierter Farmer-Datensaetze (AgriModels.createFarmer), ohne
   * Storage-Seiteneffekt. Reine Funktion -- dadurch unabhaengig testbar.
   */
  function parseFarmersFromCsv(csvText) {
    var AgriModels = resolveAgriModels();
    var rows = parseCsv(csvText);
    var dataRows = dataRowsOf(rows);
    return dataRows.map(function (r) {
      return AgriModels.createFarmer({
        id: r[0],
        name: r[1],
        phone: r[2],
        village: r[3],
        h3Cell: r[4],
        crops: r[5],
        areaHa: toAreaHaNumber(r[6]),
        paymentMethod: r[7]
      });
    });
  }

  /**
   * Importiert einen Farmer-CSV-Text vollstaendig: parst die Datensaetze
   * (parseFarmersFromCsv) und persistiert jeden ueber
   * AgriStorage.saveFarmer. Liefert ein Promise mit dem Array der
   * gespeicherten Farmer-Datensaetze.
   */
  function importFarmersFromCsv(csvText) {
    return new Promise(function (resolve, reject) {
      try {
        var AgriStorage = resolveAgriStorage();
        var farmers = parseFarmersFromCsv(csvText);
        Promise.all(
          farmers.map(function (farmer) {
            return AgriStorage.saveFarmer(farmer);
          })
        )
          .then(resolve)
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Buyer-Export/-Import (gleiches CSV-Grundformat, angepasste Spalten)
  // ---------------------------------------------------------------------

  /**
   * Exportiert eine Liste von Abnehmer-Stammsaetzen (siehe
   * AgriModels.createBuyer) als CSV-Text mit den Spalten buyer_id, name,
   * typ, telefon, kontakt in dieser Reihenfolge.
   */
  function exportBuyersToCsv(buyers) {
    var list = Array.isArray(buyers) ? buyers : [];
    var rows = list.map(function (buyer) {
      var b = buyer || {};
      return [b.id, b.name, b.type, b.phone, b.contact];
    });
    return buildCsv(BUYER_CSV_COLUMNS, rows);
  }

  /**
   * Parst einen Abnehmer-CSV-Text (Spalten siehe BUYER_CSV_COLUMNS) in ein
   * Array validierter Buyer-Datensaetze (AgriModels.createBuyer), ohne
   * Storage-Seiteneffekt.
   */
  function parseBuyersFromCsv(csvText) {
    var AgriModels = resolveAgriModels();
    var rows = parseCsv(csvText);
    var dataRows = dataRowsOf(rows);
    return dataRows.map(function (r) {
      return AgriModels.createBuyer({
        id: r[0],
        name: r[1],
        type: r[2],
        phone: r[3],
        contact: r[4]
      });
    });
  }

  /**
   * Importiert einen Abnehmer-CSV-Text vollstaendig: parst die
   * Datensaetze (parseBuyersFromCsv) und persistiert jeden ueber
   * AgriStorage.saveBuyer. Liefert ein Promise mit dem Array der
   * gespeicherten Buyer-Datensaetze.
   */
  function importBuyersFromCsv(csvText) {
    return new Promise(function (resolve, reject) {
      try {
        var AgriStorage = resolveAgriStorage();
        var buyers = parseBuyersFromCsv(csvText);
        Promise.all(
          buyers.map(function (buyer) {
            return AgriStorage.saveBuyer(buyer);
          })
        )
          .then(resolve)
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  var AgriCsv = {
    FARMER_CSV_COLUMNS: FARMER_CSV_COLUMNS,
    BUYER_CSV_COLUMNS: BUYER_CSV_COLUMNS,
    csvEscapeField: csvEscapeField,
    toCsvRow: toCsvRow,
    parseCsv: parseCsv,
    exportFarmersToCsv: exportFarmersToCsv,
    parseFarmersFromCsv: parseFarmersFromCsv,
    importFarmersFromCsv: importFarmersFromCsv,
    exportBuyersToCsv: exportBuyersToCsv,
    parseBuyersFromCsv: parseBuyersFromCsv,
    importBuyersFromCsv: importBuyersFromCsv
  };

  global.AgriCsv = AgriCsv;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriCsv;
  }
})(typeof window !== 'undefined' ? window : globalThis);
