# DATEN-STRATEGIE — Beim Kunden am Tag 1 loslegen

> Playbook für den Projektstart bei Agrar-Kunden (Aggregatoren, Kühlhaus-,
> Mühlen-, Leasing- und Logistik-Betreiber in Westafrika). Ziel: **innerhalb
> eines Tages arbeitsfähige Daten**, innerhalb einer Woche belastbare KPIs —
> ohne Cloud-Zwang, ohne teure Erhebungsprojekte. Die zugehörigen
> Starter-Kits (CSV-Schemata, Erhebungsbogen, KPI-Katalog) liegen in
> [`kits/`](kits/).

---

## 1. Grundprinzipien

1. **Markt vor Farm.** Die erste Datenerhebung gilt den **Abnehmern**
   (wer kauft, was, wieviel, zu welchem Preis, mit welchem Zahlungsziel) —
   nicht den Produktionsflächen. Produktion ohne bestätigte Nachfrage ist
   Spekulation; Daten ohne Nachfragebezug sind Dekoration.
2. **Minimal starten, sofort buchen.** 5 Kern-Stammtabellen (siehe Kits)
   genügen für den Start. Alles, was am Tag 1 nicht gebucht wird, wird
   auch am Tag 30 nicht gebucht.
3. **Jede Bewegung ist ein Beleg.** Ankauf, Einlagerung, Verarbeitung,
   Transport, Verkauf, Verlust — append-only, mit Zeitstempel, Erfasser und
   fortlaufender Belegnummer. Korrekturen per Storno, nie per Überschreiben.
4. **Verluste zuerst messen.** Post-Harvest-Losses (30–50 % bei Frischware)
   sind der schnellste ROI-Hebel. Der Schwund-Beleg ist deshalb
   Pflichtbestandteil ab Tag 1, nicht „Phase 2".
5. **Erfassung passt sich der Realität an, nicht umgekehrt.** Papier +
   tägliche Nacherfassung, WhatsApp-Fotos von Wiegescheinen, CSV vom
   Feature-Phone-Betreiber — alles legitim, solange es im selben Schema
   landet. Offline-first, Délestage-tolerant.
6. **Ganzzahlen, eindeutige IDs, ISO-Daten.** Beträge in kleinster
   Währungseinheit (XOF ohne Dezimalen!), Gewichte in kg (bzw. ×10 für
   eine Nachkommastelle), Datum `YYYY-MM-DD`, IDs mit Präfix
   (`F-0001` Farmer, `B-0001` Abnehmer, `L-0001` Lager …).
7. **Datenhoheit beim Kunden.** Lokal-first (SQLite/IndexedDB), Backup als
   CSV/JSON auf ein Gerät des Kunden. Personenbezogene Daten (Farmer-Telefon,
   Zahlwege) nur zweckgebunden, Weitergabe nur mit Einwilligung — DSGVO als
   Haltung, NDPR (Nigeria) / Loi n° 2019-014 (Togo) als lokale Pflicht.

---

## 2. Der Tag-1-Ablauf beim Kunden (halber Tag Erhebung, halber Tag Betrieb)

| Zeit | Schritt | Werkzeug |
|------|---------|----------|
| 08:00 | **Kickoff-Interview** (60 min): Geschäftsmodell, Geldflüsse, Engpass Nr. 1 | [`kits/erhebungsbogen.md`](kits/erhebungsbogen.md) Teil A |
| 09:00 | **Abnehmer-Liste** aufnehmen: alle bestehenden + gewünschten Käufer mit Mengen/Preisen/Zahlungszielen | `abnehmer.csv` |
| 10:00 | **Produkt-/Preisliste**: gehandelte Produkte, aktuelle Ankaufs-/Verkaufspreise, Verderblichkeitsklasse | `produkte_kulturen.csv` |
| 10:30 | **Lieferanten/Farmer**: Top-20 zuerst (80/20 — nicht alle 300 am Tag 1), Rest rollierend im Betrieb | `farmer_stammdaten.csv` |
| 11:30 | **Infrastruktur**: Lager/Kühlräume, Fahrzeuge, Maschinen mit Kapazitäten und Tarifen | `kuehlhaus_lager.csv`, `fahrzeuge_equipment.csv` |
| 12:00 | **CSV-Import in die App**, Kurzschulung Erfassungskraft (Belegfluss: Ankauf → Lager → Verkauf → Schwund) | jeweilige App |
| 14:00 | **Echtbetrieb**: Die Nachmittags-Vorgänge werden bereits im System gebucht. Papier-Rückstände der letzten 7 Tage optional nacherfassen — nicht mehr. | App |
| 17:00 | **Tagesabschluss**: erste Auswertung (Ankauf kg/Betrag, Bestand, offene Posten) gemeinsam ansehen — der Kunde sieht am Abend von Tag 1 seinen Tag in Zahlen. | Dashboard |

**Regel:** Historische Daten maximal 7 Tage rückwirkend erfassen. Alles
Ältere ist für KPIs wertlos und frisst die Motivation der ersten Woche.

---

## 3. Die 5 Kern-Stammtabellen (Kits)

Alle Apps aus `briefs/agri/` importieren exakt diese Spaltennamen:

| Kit-Datei | Inhalt | Pflichtfelder |
|---|---|---|
| [`kits/farmer_stammdaten.csv`](kits/farmer_stammdaten.csv) | Lieferanten/Farmer | farmer_id, name, telefon, dorf |
| [`kits/abnehmer.csv`](kits/abnehmer.csv) | Käufer inkl. Zahlungsziel | abnehmer_id, name, typ |
| [`kits/produkte_kulturen.csv`](kits/produkte_kulturen.csv) | Produkte + Verderblichkeit + Preise | produkt_id, name_fr, verderblichkeit |
| [`kits/kuehlhaus_lager.csv`](kits/kuehlhaus_lager.csv) | Lager/Kühlräume + Kapazität + Soll-Temperatur | lager_id, name, kapazitaet_kisten |
| [`kits/fahrzeuge_equipment.csv`](kits/fahrzeuge_equipment.csv) | Fahrzeuge/Maschinen + Tarife + Wartung | geraet_id, name, typ |

Konventionen: UTF-8, Komma-getrennt, Kopfzeile Pflicht, keine Leerzeilen,
Telefon im Format `+228…`/`+234…`, `h3_zelle` optional (wird nachgetragen,
sobald ein Standort-Pin vorliegt — WhatsApp-Standort genügt).

---

## 4. Bewegungsdaten: das Beleggerüst

Fünf Belegarten decken jede App der Kette ab — gleiche Grundstruktur
(`beleg_nr, ts, erfasser, partner_id, produkt_id, menge_kg, betrag`):

1. **Ankauf** (von Farmer) — plus Qualitätsstufe A/B/C
2. **Einlagerung/Auslagerung** (Lager/Kühlraum) — plus Kisten, Tarif
3. **Verarbeitung** (Charge) — Input-Chargen → Output-Chargen, Ausbeute
4. **Verkauf/Lieferung** (an Abnehmer) — plus Zahlungsziel, bezahlt-Status
5. **Schwund/Verlust** — plus Grund (verderb/transport/diebstahl/trocknung)

Damit sind Massenbilanz (rein = raus + Bestand + Verlust), offene Posten
und alle KPIs ableitbar — ohne je eine sechste Belegart zu brauchen.

---

## 5. KPI-Katalog (Woche 1 → Monat 1)

Details und Formeln: [`kits/kpi-katalog.md`](kits/kpi-katalog.md). Die
wichtigsten fünf, die ab Woche 1 täglich sichtbar sein müssen:

| KPI | Formel | Zielrichtung |
|---|---|---|
| **Post-Harvest-Loss %** | Schwund-kg ÷ Ankauf-kg (30 Tage gleitend) | ↓ unter 10 % |
| **Rohmarge %** | (Verkauf − Ankauf) ÷ Verkauf | stabil > 20 % |
| **Lagerumschlag (Tage)** | Ø Bestand ÷ Ø Tagesabsatz | ↓ (Frischware < 3) |
| **DSO / Außenstände** | offene Posten ÷ Ø Tagesumsatz | ↓ unter Zahlungsziel |
| **Auslastung %** (Lager/Maschine) | belegte ÷ verfügbare Kapazität | ↑ > 70 % |

---

## 6. Datenqualität im laufenden Betrieb (die 4 täglichen Checks)

1. **Belegnummern lückenlos?** (fortlaufend, keine Löcher = nichts „am
   System vorbei")
2. **Massenbilanz je Produkt plausibel?** (Bestand rechnerisch = gezählt ±
   Toleranz; wöchentliche Stichprobenzählung)
3. **Kasse = Belege?** (Bargeld-Ist vs. Σ Bar-Belege am Tagesabschluss)
4. **Stammdaten-Neuzugänge vollständig?** (jeder neue Farmer/Abnehmer mit
   Pflichtfeldern, keine „Divers"-Sammelkonten)

---

## 7. Datenschutz & Compliance-Kurzcheck

- **Einwilligung** der Farmer bei Aufnahme (ein Satz auf dem Erhebungsbogen,
  Unterschrift/Daumen): Zweck = Abwicklung Ankauf/Auszahlung.
- **Zweckbindung:** Telefonnummern nicht für Werbung Dritter; Score-Werte
  (Zuverlässigkeit) bleiben intern.
- **Rechtsrahmen:** Togo Loi n° 2019-014 (IPDCP), Nigeria NDPR/NDPA,
  EU-Bezug (Export nach EU) → DSGVO-Grundsätze ohnehin einhalten.
- **Löschkonzept:** Stammsatz inaktiv setzen statt löschen (Belegbezug!),
  personenbezogene Felder nach Ablauf gesetzlicher Fristen anonymisieren.
- **Backups:** wöchentlich CSV/JSON-Export auf ein zweites Gerät des
  Kunden; kein automatischer Cloud-Upload ohne ausdrücklichen Wunsch.

---

## 8. Vom Datenbestand zum Verkaufsargument

Nach 4–8 Wochen sauberer Erfassung besitzt der Kunde Daten, die selbst
Geld wert sind — als Argumente, nie als Rohdaten-Weitergabe:

- **Gegenüber Abnehmern:** nachweisbare Qualität (Grading-Quoten,
  Kühlketten-Log, Chargen-Pass) → Premium-Preise, Supermarkt-Listung.
- **Gegenüber Banken/Mikrofinanz:** Umsatz- und Margenhistorie →
  Betriebsmittelkredit für die Saison (Working Capital ist der häufigste
  Engpass der Kette).
- **Gegenüber Farmern:** transparente Tagespreise und pünktliche, belegte
  Auszahlung → Lieferanten-Bindung, mehr Menge, bessere Aggregation.
- **Intern:** Saison-Preiskurven je Produkt → Einlagern, wenn billig;
  verkaufen, wenn knapp. Das ist der eigentliche Gewinnhebel der Lagerung.
