# Brief 01 — agri-aggregator

**Position in der Kette:** Aggregation. Ein Aggregator verdient an hunderten
Farmern: Er kauft kleine Erntemengen an, sortiert/gradet sie, bündelt sie zu
handelbaren Mengen und verkauft an Supermärkte, Verarbeiter und Exporteure.

## Copy-&-Paste-Auftrag (CLI/UI)

```
Eine offline-first Web-App "agri-aggregator" für Ernte-Aggregatoren in Westafrika (Togo/Nigeria): Ankauf von Kleinbauern-Ernten erfassen (Farmer-Stammsatz, Produkt, Gewicht kg, Qualitätsstufe A/B/C, Preis pro kg in XOF/NGN als Integer), Auszahlungsbeleg erzeugen (Druck/PDF), Bestände je Produkt und Qualitätsstufe führen, Verkäufe an Abnehmer (Supermarkt/Verarbeiter/Exporteur) mit Marge-Anzeige buchen, tägliche Verlust-/Schwund-Erfassung mit Post-Harvest-Loss-KPI, Tages- und Saisonpreise je Produkt pflegen, CSV-Import/-Export für Farmer- und Abnehmer-Stammdaten (Spalten: farmer_id, name, telefon, dorf, h3_zelle, kulturen, flaeche_ha, zahlweg). Vanilla JS + localStorage/IndexedDB, keine externen Requests, UI Französisch und Englisch umschaltbar, Beträge als Integer in kleinster Währungseinheit, deterministische Preis- und Margenberechnung im Code.
```

## Zielgruppe & Nutzenversprechen

- **Nutzer:** Aggregator/Kooperative mit 50–500 Zulieferer-Farmern, 1–3
  Erfassungskräfte am Sammelpunkt, oft ohne stabiles Netz oder Strom.
- **Nutzen:** Jeder Ankauf ist belegt (Vertrauen der Farmer), Bestände und
  Margen sind sichtbar, Verluste werden messbar (größter Hebel).

## Kern-Datenmodell

| Tabelle | Felder (Auszug) |
|---|---|
| `farmers` | farmer_id, name, telefon, dorf, h3_zelle, kulturen, flaeche_ha, zahlweg (cash/mobile_money), avance_saldo |
| `purchases` | id, ts, farmer_id, produkt_id, gewicht_kg, qualitaet (A/B/C), preis_pro_kg, betrag, beleg_nr |
| `products` | produkt_id, name_fr, name_en, verderblichkeit (hoch/mittel/lager), tagespreis_ankauf, tagespreis_verkauf |
| `sales` | id, ts, abnehmer_id, produkt_id, qualitaet, gewicht_kg, preis_pro_kg, betrag |
| `shrinkage` | id, datum, produkt_id, gewicht_kg, grund (verderb/transport/diebstahl/trocknung) |
| `buyers` | abnehmer_id, name, typ (supermarkt/hotel/verarbeiter/exporteur/institution), zahlungsziel_tage |

## Akzeptanzkriterien (prüfbar)

1. Ankauf mit 3 Pflichtfeldern (Farmer, Produkt, Gewicht) in < 30 Sekunden
   erfassbar; Betrag = gewicht × tagespreis[qualität] wird automatisch
   berechnet (reine Integer-Arithmetik, Rundung dokumentiert).
2. Auszahlungsbeleg mit fortlaufender Beleg-Nr. druck-/teilbar (Print-CSS).
3. Bestand je Produkt/Qualität = Σ Ankäufe − Σ Verkäufe − Σ Schwund; ein
   Verkauf über Bestand hinaus wird geblockt.
4. Dashboard zeigt: heutiger Ankauf (kg/Betrag), Bestand, Marge %,
   Post-Harvest-Loss % (Schwund ÷ Ankauf, gleitend 30 Tage).
5. CSV-Import der Kits `farmer_stammdaten.csv` und `abnehmer.csv`
   (Spaltennamen exakt wie in `daten-strategie/kits/`) funktioniert.
6. App lädt und funktioniert vollständig ohne Netzwerkzugriff (Service
   Worker optional, aber kein einziger externer Request).
7. Sprachumschalter FR/EN wirkt auf alle sichtbaren Texte.

## Ausbau-Ideen (nicht Teil des MVP)

Mobile-Money-Export (Auszahlungsliste), Avancen/Farmer-Kredit-Buch,
Sammeltouren-Übergabe an togo-logistics, Sync mehrerer Sammelpunkte.
