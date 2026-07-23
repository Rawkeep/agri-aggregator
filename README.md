# agri-aggregator

Offline-first Web-App für Ernte-Aggregatoren in Togo/Nigeria. Bildet den Alltag eines Zwischenhändlers ab, der Ernten von Kleinbauern ankauft, lagert und an Abnehmer weiterverkauft.

## Was ist das

- Vanilla JS, kein Build-Schritt, keine externen Requests
- Datenhaltung lokal im Browser (localStorage/IndexedDB)
- UI umschaltbar FR/EN
- Beträge werden intern als Integer in der kleinsten Währungseinheit geführt (keine Floats), alle Berechnungen sind deterministisch und laufen im Code, nicht im Backend

Funktionsumfang:

- **Ankauf**: Erfassung von Kleinbauern-Ernten, Erzeugung eines PDF-Auszahlungsbelegs
- **Bestand**: Lagerführung je Produkt und Qualitätsstufe
- **Verkauf**: Abgabe an Abnehmer inkl. Margen-Anzeige (Ankaufspreis vs. Verkaufspreis)
- **Verlust/Schwund**: tägliche Erfassung, Post-Harvest-Loss-KPI
- **Preise**: Tages- und Saisonpreise je Produkt
- **Stammdaten**: CSV-Import/-Export für Farmer und Abnehmer

## Quickstart

Kein Build, kein Package-Manager nötig. Die App läuft direkt im Browser.

```bash
# im Projektverzeichnis
python3 -m http.server 8000
```

Danach `index.html` unter `http://localhost:8000` öffnen. Direktes Öffnen der Datei per `file://` funktioniert je nach Browser eingeschränkt (IndexedDB/Module-Loading) — ein lokaler HTTP-Server ist der zuverlässige Weg.

## Nutzung

Module unter `js/`, jedes mit klar abgegrenzter Verantwortung:

| Datei | Zweck |
|---|---|
| `js/models.js` | Datenmodell (Farmer, Abnehmer, Produkt, Charge, Preis, Verlust) |
| `js/storage.js` | Persistenz-Layer über localStorage/IndexedDB |
| `js/i18n.js` | Sprachumschaltung FR/EN, Textbausteine |
| `js/purchase.js` | Ankaufserfassung |
| `js/receipt.js` | Erzeugung des PDF-Auszahlungsbelegs |
| `js/inventory.js` | Bestandsführung je Produkt/Qualitätsstufe |
| `js/sales.js` | Verkauf an Abnehmer, Margen-Berechnung |
| `js/loss.js` | Verlust-/Schwunderfassung, Post-Harvest-Loss-KPI |
| `js/pricing.js` | Tages-/Saisonpreise |
| `js/csv.js` | CSV-Import/-Export für Farmer-/Abnehmer-Stammdaten |
| `js/app.js` | App-Shell, verdrahtet die Module mit `index.html` |
| `css/style.css` | Styling |

Ablauf in der App: Ankauf erfassen → Beleg wird als PDF erzeugt → Ware landet im Bestand → Verkauf gegen Bestand bucht Menge und zeigt Marge → Verluste werden separat pro Tag erfasst und fließen in den Post-Harvest-Loss-KPI ein. Stammdaten (Farmer, Abnehmer) lassen sich als CSV importieren und exportieren.

## Tests

Tests liegen unter `tests/` und laufen mit pytest. Sie prüfen die JS/HTML-Artefakte statisch (Existenz der Dateien, Pflichtinhalte, Struktur, Syntax) — kein Browser-/DOM-Runtime-Test.

```bash
pytest
```

Zuordnung Test → Bereich:

- `test_core_data.py` — Datenmodell, Storage-Layer, i18n-Basis
- `test_purchase_payout.py` — Ankaufserfassung, PDF-Auszahlungsbeleg
- `test_inventory_sales.py` — Bestandsführung, Verkauf, Margen-Anzeige
- `test_loss_pricing.py` — Verlust-/Schwunderfassung, KPI, Tages-/Saisonpreise
- `test_csv_master.py` — CSV-Import/-Export für Farmer-/Abnehmer-Stammdaten
- `test_ui_integration.py` — `index.html`, App-Shell, Styling

Jeder Task ist erst abgeschlossen, wenn der zugehörige Test grün ist.
