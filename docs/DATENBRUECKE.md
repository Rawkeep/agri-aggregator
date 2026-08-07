# DATENBRÜCKE — das Hofkette-Belegformat (v1)

> Umsetzung von [HOFPLATTFORM.md](./HOFPLATTFORM.md) §7: Die agri-Apps teilen
> Schemata, waren aber Daten-Silos. Diese Brücke verbindet sie über ein
> gemeinsames, versioniertes **Beleg-/Ereignisformat (CSV)** — jede Station
> exportiert ihre Warenbewegungen, `agri-trace` importiert sie in die
> append-only-Kette. Kein Server nötig: Datei raus, Datei rein
> (USB/WhatsApp/Ordner), idempotent.

## Kanonisches Modul (Kit-Prinzip)

Quelle: [`daten-strategie/kits/hofkette/hofkette.js`](./daten-strategie/kits/hofkette/hofkette.js)
— Kopien liegen in den Apps (`agri-flock`, `feed-mill`, `agri-trace`) und
werden **von hier aus** aktualisiert, nie per Hand divergiert (wie die
CSV-Kits der Daten-Strategie).

## Das Format `hofkette-v1`

Eine CSV, erste Zeile Header, feste Spaltenreihenfolge:

| Spalte | Pflicht | Bedeutung |
|---|---|---|
| `schema` | ✓ | immer `hofkette-v1` (Guard beim Import) |
| `event_id` | ✓ | global eindeutig, **deterministisch aus den Daten** (z. B. `af-prod-<herde>-<datum>`) → Re-Import ist idempotent |
| `ts` | ✓ | ISO-8601-Zeitstempel |
| `station` | ✓ | sendende App/Ort (`agri-flock`, `feed-mill`, …) |
| `event_type` | ✓ | siehe Typen unten |
| `lot_id` | ✓ | betroffene Charge |
| `parent_lot_ids` | bei `VERARBEITUNG_OUT` | Eltern-Chargen, `\|`-getrennt |
| `ref_event_id` | bei `STORNO` / `VERARBEITUNG_IN` | referenziertes Ereignis (IN-Zeilen zeigen auf ihre OUT-Zeile) |
| `product` | ✓ | Produktschlüssel (`mais`, `soja`, `aliment_ponte`, `oeufs`, …) |
| `qty_x10` | ✓ | Menge als **Integer ×10** in `unit` |
| `unit` | ✓ | `kg` \| `stk` \| `tray` \| `sack` \| `l` |
| `quality` | – | `A`/`B`/`C` |
| `origin` | – | `farm` oder `partner:<id>` (Zukauf-Herkunftstrennung!) |
| `amount_minor` | – | Betrag als Integer in kleinster Währungseinheit |
| `currency` | – | `XOF`/`NGN` |
| `actor` | – | Erfasser |
| `note` | – | Freitext |

**Ereignistypen:** `ERNTE`, `ANKAUF`, `GRADING`, `EINLAGERUNG`,
`AUSLAGERUNG`, `VERARBEITUNG_IN`, `VERARBEITUNG_OUT`, `PRODUKTION`,
`VERBRAUCH`, `VERPACKUNG`, `TRANSPORT`, `VERKAUF`, `STORNO`.

**Verarbeitung (Mühle):** je Input-Charge eine `VERARBEITUNG_IN`-Zeile mit
`ref_event_id` auf die `VERARBEITUNG_OUT`-Zeile der Kind-Charge; die
OUT-Zeile trägt `parent_lot_ids`. `checkMassBalance()` erzwingt
Σ Input ≥ Output (gleiche Einheit) — derselbe Grundsatz wie in `agri-trace`.

**Konvention Mengen:** Chargenmengen werden in der Einheit des Belegs geführt
(`qty_x10` + `unit`). Es gibt **keine automatische Umrechnung** (kein
„1 Ei = 60 g") — das wäre eine versteckte Schätzung.

## Wer sendet, wer empfängt (Stand heute)

| App | Rolle | Was |
|---|---|---|
| `agri-flock` | **Sender** (`js/bridge.js`, Export-Knopf im CSV-Tab) | `PRODUKTION` Eier-Tagescharge je Herde/Tag (`EI-<herde>-<datum>`), `VERBRAUCH` Futter, `VERKAUF` aus Erlösen |
| `feed-mill` | **Sender** (`js/bridge.js`) | `ANKAUF` Rohstoff-Zukäufe, `VERARBEITUNG_IN/OUT` je Produktionscharge (Rezeptur-Bedarfsliste → Inputs, `FEED-<batch>` → Output) |
| `agri-trace` | **Empfänger** (`js/bridge.js`, Import im Export-Tab) | legt Produkte/Chargen/Links an, hängt Ereignisse **append-only** an; doppelte `event_id`s werden übersprungen (idempotent) |
| `agri-aggregator`, Kasse, `togo-logistics` | nächste Ausbaustufe | `ANKAUF`/`GRADING`/`EINLAGERUNG`/`VERKAUF`/`TRANSPORT` |

Damit steht die Kette: **Futtercharge M-2026-14 (Mühle) → verfüttert an
Herde „Pondeuses A" → Eier-Tagescharge EI-…-2026-08-07 → Verkauf** — in
`agri-trace` rückverfolgbar ohne Doppelerfassung, inkl. Herkunftstrennung
`farm` vs. `partner:<id>` beim Eier-Zukauf.

## Ablauf im Alltag

1. In `agri-flock`/`feed-mill`: „Hofkette exportieren" → CSV-Datei.
2. Datei zu `agri-trace` bringen (gleicher Rechner: Ordner; sonst USB/Messenger).
3. In `agri-trace` (Tab Export): „Hofkette importieren" → Datei wählen.
   Ergebnis zeigt: importiert / übersprungen (Duplikate) / Fehler mit Zeile.
4. Wiederholter Import derselben Datei ändert nichts (idempotent).

## Invarianten

1. **Append-only bleibt append-only** — der Import erzeugt nie Updates;
   Korrekturen sind `STORNO`-Belege.
2. **Deterministische `event_id`s** beim Sender — sonst bricht die Idempotenz.
3. **Keine stillen Umrechnungen** zwischen Einheiten.
4. **Integer-Regel** gilt auch hier: `qty_x10`, `amount_minor`.
5. Schema-Änderungen ⇒ neue Version (`hofkette-v2`), nie stilles Umdeuten.
