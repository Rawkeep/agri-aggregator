# agri-aggregator

Offline-first Web-App für Ernte-Aggregatoren in Togo/Nigeria. Bildet den Alltag eines Zwischenhändlers ab, der Ernten von Kleinbauern ankauft, lagert und an Abnehmer (Supermarkt/Verarbeiter/Exporteur) weiterverkauft.

## Was ist das

- Vanilla JS, **kein Build-Schritt**, keine externen Requests, kein CDN
- UI umschaltbar FR/EN (`index.html` ist `lang="fr"`; Code-Kommentare und Doku sind Deutsch)
- Datenhaltung lokal im Browser: IndexedDB als primärer Speicher, mit transparentem Fallback auf `localStorage`, falls IndexedDB nicht verfügbar ist (`js/storage.js`)
- Beträge werden intern **immer als Integer in der kleinsten Währungseinheit** geführt (z. B. Centimes/Kobo), nie als Float. Alle Preis-, Margen- und KPI-Berechnungen runden einheitlich (`Math.round`) und laufen deterministisch im Code, nicht im Backend
- Unterstützte Währungen: `XOF`, `NGN`; Qualitätsstufen für Ernteware: `A`, `B`, `C`

## Funktionsumfang

- **Ankauf**: Erfassung von Kleinbauern-Ernten (Farmer, Produkt, Qualitätsstufe, Gewicht, Preis/kg) und Erzeugung eines Auszahlungsbelegs. Der Beleg wird als HTML/CSS-Fragment gerendert und über den Browser-Druckdialog (`window.print()`) als PDF gespeichert — keine externe PDF-Bibliothek (`js/receipt.js`)
- **Bestand**: Lagerführung je Produkt und Qualitätsstufe; bucht Zu-/Abgänge bei Ankauf/Verkauf und berechnet den **gewichteten Durchschnitts-Einstandspreis** (weighted average cost) je Produkt/Qualitätsstufe (`js/inventory.js`)
- **Verkauf**: Abgabe an Abnehmer, bucht die verkaufte Menge gegen den Bestand und zeigt die Marge deterministisch als `margin = saleAmount - (weightSold * weightedAverageCost)` (`js/sales.js`)
- **Verlust/Schwund**: tägliche Erfassung von Schwund je Produkt; berechnet den Post-Harvest-Loss-KPI als `KPI = round(Summe Schwund-kg / Summe Ankaufsvolumen-kg * 1000)` (Promille, `js/loss.js`)
- **Preise**: Tages- und Saisonpreise je Produkt/Qualitätsstufe, mit Auflösung "welcher Preis gilt an Datum X" (`js/pricing.js`)
- **Stammdaten**: CSV-Import/-Export für Farmer (`farmer_id, name, telefon, dorf, h3_zelle, kulturen, flaeche_ha, zahlweg` — inkl. H3-Geozelle des Dorfs) und Abnehmer (`buyer_id, name, typ, telefon, kontakt`). RFC4180-Escaping (Kommas/Anführungszeichen/Zeilenumbrüche) ist selbst implementiert, ohne externe Bibliothek (`js/csv.js`)

Ablauf in der App: Ankauf erfassen → Beleg wird als PDF erzeugt → Ware landet im Bestand → Verkauf gegen Bestand bucht Menge und zeigt Marge → Verluste werden separat pro Tag erfasst und fließen in den Post-Harvest-Loss-KPI ein. Stammdaten (Farmer, Abnehmer) lassen sich als CSV importieren und exportieren.

## Tech-Stack

- **Frontend**: statisches HTML (`index.html`) + Vanilla JS (`js/*.js`, IIFE-Module über klassische `<script>`-Tags, kein Bundler/Framework) + reines CSS (`css/style.css`)
- **Persistenz**: Browser-nativ (IndexedDB / `localStorage`-Fallback), kein Backend, keine Datenbank, keine externen API-Calls
- **Tests**: Python + `pytest` — prüfen die JS/HTML-Artefakte statisch (Dateiexistenz, Pflichtinhalte/Kommentare, Struktur, Syntaxmuster), kein Browser-/DOM-Runtime-Test und kein JS-Test-Runner
- Kein `package.json`/npm-Toolchain im Projekt — die App braucht keinen Build-Schritt

## Quickstart

Kein Build, kein Package-Manager nötig. Die App läuft direkt im Browser.

```bash
# im Projektverzeichnis
python3 -m http.server 8000
```

Danach `index.html` unter `http://localhost:8000` öffnen. Direktes Öffnen der Datei per `file://` funktioniert je nach Browser eingeschränkt (IndexedDB/Module-Loading) — ein lokaler HTTP-Server ist der zuverlässige Weg.

## Architektur

Module unter `js/`, jedes mit klar abgegrenzter Verantwortung:

| Datei | Zweck |
|---|---|
| `js/models.js` | Datenmodell + Validierung (Farmer, Buyer, Product, Purchase, Sale, LossEntry, PriceEntry); zentrale Geldbetrag-/Rundungslogik |
| `js/storage.js` | Persistenz-Layer: IndexedDB primär, `localStorage`-Fallback, einheitliche Promise-API |
| `js/i18n.js` | Sprachumschaltung FR/EN, Wörterbuch, Persistenz der Sprachwahl in `localStorage` |
| `js/purchase.js` | Ankaufserfassung |
| `js/receipt.js` | Auszahlungsbeleg als HTML/CSS-Fragment, Ausgabe als PDF über `window.print()` |
| `js/inventory.js` | Bestandsführung je Produkt/Qualitätsstufe, gewichteter Durchschnitts-Einstandspreis |
| `js/sales.js` | Verkauf an Abnehmer, Bestandsabbuchung, Margen-Berechnung |
| `js/loss.js` | Verlust-/Schwunderfassung, Post-Harvest-Loss-KPI |
| `js/pricing.js` | Tages-/Saisonpreise je Produkt/Qualitätsstufe |
| `js/csv.js` | CSV-Import/-Export für Farmer-/Abnehmer-Stammdaten (RFC4180) |
| `js/app.js` | App-Shell/Orchestrierung, verdrahtet die Fachmodule mit `index.html` |
| `css/style.css` | Styling |

`js/app.js` enthält selbst keine Fachlogik (keine Validierung, keine Betrags-/Margen-/KPI-Berechnung) — die lebt ausschließlich in den jeweiligen Fachmodulen und wird von der App-Shell nur aufgerufen. Besonderheiten der Orchestrierung:

- `js/inventory.js` hält den Bestand rein In-Memory. Beim App-Start wird der Bestand deshalb deterministisch aus der in `AgriStorage` persistierten Ankaufs-/Verkaufshistorie rekonstruiert (chronologische Wiedergabe nach Datum).
- `js/loss.js` und `js/pricing.js` persistieren ihre Einträge nicht selbst; `js/app.js` speichert jeden neuen Eintrag zusätzlich über `AgriStorage` und spielt vorhandene Einträge beim Start in den jeweiligen In-Memory-Zustand zurück (IDs bleiben erhalten).
- Sprachwechsel: alle Elemente mit `[data-i18n]` (Textinhalt) bzw. `[data-i18n-placeholder]` (Platzhalter) werden über `AgriI18n.t()` aktualisiert, ausgelöst durch `AgriI18n.setLanguage()` im Sprachumschalter (`#language-switcher`).

Jedes Modul hängt sich als globales Objekt an (`window.AgriModels`, `AgriStorage`, `AgriI18n`, ...) und ist gleichzeitig über `require()` in Node ansprechbar — so laufen dieselben Dateien unverändert im Browser und in den `pytest`-Tests.

## Tests

Tests liegen unter `tests/` und laufen mit pytest. Sie prüfen die JS/HTML-Artefakte statisch (Existenz der Dateien, Pflichtinhalte, Struktur, Syntax) — kein Browser-/DOM-Runtime-Test.

```bash
pytest
```

Zuordnung Test → Bereich:

- `test_core_data.py` — Datenmodell, Storage-Layer, i18n-Basis
- `test_purchase_payout.py` — Ankaufserfassung, Auszahlungsbeleg
- `test_inventory_sales.py` — Bestandsführung, Verkauf, Margen-Anzeige
- `test_loss_pricing.py` — Verlust-/Schwunderfassung, KPI, Tages-/Saisonpreise
- `test_csv_master.py` — CSV-Import/-Export für Farmer-/Abnehmer-Stammdaten
- `test_ui_integration.py` — `index.html`, App-Shell, Styling

Jeder Task ist erst abgeschlossen, wenn der zugehörige Test grün ist.
