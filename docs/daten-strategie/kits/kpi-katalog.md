# KPI-Katalog — Agrar-Wertschöpfungskette

> Alle Kennzahlen sind aus den 5 Belegarten ableitbar
> (Ankauf, Ein-/Auslagerung, Verarbeitung, Verkauf, Schwund — siehe
> [`DATEN-STRATEGIE.md`](../DATEN-STRATEGIE.md) §4). Formeln deterministisch,
> Beträge Integer in kleinster Währungseinheit, Gewichte in kg.

## Stufe 1 — ab Woche 1 (täglich aufs Dashboard)

| KPI | Formel | Ziel | Warum zuerst |
|---|---|---|---|
| Post-Harvest-Loss % | `Σ schwund_kg ÷ Σ ankauf_kg` (30 Tage gleitend, je Produkt) | < 10 % | größter Geldhebel der Kette |
| Rohmarge % | `(Σ verkauf − Σ ankauf_anteilig) ÷ Σ verkauf` | > 20 % | zeigt, ob das Geschäft trägt |
| Tagesankauf | `Σ ankauf_kg`, `Σ ankauf_betrag` je Tag | wachsend | Aggregations-Volumen = Marktmacht |
| Bestand je Produkt | `Σ ankauf − Σ verkauf − Σ schwund (± Verarbeitung)` | plausibel vs. Zählung | Basis jeder anderen Zahl |
| Offene Posten (DSO) | `Σ unbezahlte Verkäufe ÷ Ø Tagesumsatz` | < Zahlungsziel | Liquidität ist der häufigste Killer |

## Stufe 2 — ab Monat 1

| KPI | Formel | Ziel |
|---|---|---|
| Lagerumschlag (Tage) | `Ø bestand_kg ÷ Ø tagesabsatz_kg` | Frischware < 3, Lagerware < 60 |
| Auslastung Kühlraum % | `Ø belegte kisten ÷ kapazitaet` | > 70 % |
| Auslastung Maschine % | `gebuchte Tage ÷ verfügbare Saisontage` | > 60 % |
| Ausbeute Verarbeitung % | `Σ output_kg ÷ Σ input_kg` je Rezeptur | rezeptur-spezifisch, stabil |
| Deckungsbeitrag je Gerät | `umsatz − kraftstoff − fahrerlohn − wartung` | positiv je Gerät |
| Grading-Quote | `Σ kg qualität A ÷ Σ ankauf_kg` | steigend (Schulungseffekt) |
| Lieferanten-Konzentration | Anteil Top-5-Farmer am Ankauf | < 50 % (Risikostreuung) |
| Abnehmer-Konzentration | Anteil Top-Abnehmer am Umsatz | < 40 % |

## Stufe 3 — ab Quartal (strategisch)

| KPI | Formel / Quelle | Nutzen |
|---|---|---|
| Saison-Preisspanne | `max(median_wochenpreis) ÷ min(…)` je Produkt | Einlagerungs-Strategie: kaufen, wenn billig |
| Zuverlässigkeits-Score Lieferant | gewichtete Quote geliefert/zugeteilt + Pünktlichkeit (letzte 10) | Zuteilung & Avancen-Vergabe |
| Zahlungs-Score Abnehmer | Ø Verzugstage + Ausfallquote | Kontrahierungs-Entscheidung |
| Verlust nach Ursache | Schwund gruppiert nach Grund | gezielte Investition (Kühlung? Transport? Sicherheit?) |
| Working-Capital-Bedarf | `Ø bestand_wert + Ø offene posten − Ø lieferantenziel` | Kreditgespräch mit Bank/MFI |
| Umsatz je H3-Zelle/Region | Verkäufe gruppiert nach Herkunftszelle | Wo lohnt der nächste Sammelpunkt/Kühlraum? |

## Konventionen

- Gleitende Fenster: 7 Tage (operativ), 30 Tage (Trend), Kalenderwoche für
  Preisboards (Median, nicht Mittelwert — Ausreißer-robust).
- Jede KPI-Zahl muss per Klick auf die zugrunde liegenden Belege
  aufreißbar sein (Drill-down), sonst glaubt ihr niemand.
- Keine KPI ohne Gegenprobe: Bestands-KPIs wöchentlich gegen physische
  Stichprobenzählung, Kassen-KPIs gegen Bargeld-Ist.
