# Erhebungsbogen — Kickoff beim Agrar-Kunden (Tag 1)

> Ausdrucken oder am Tablet ausfüllen. Dauer: ~60 Minuten Interview +
> Stammdaten-Aufnahme laut [`DATEN-STRATEGIE.md`](../DATEN-STRATEGIE.md) §2.
> Sprache im Gespräch: Französisch (Togo) / Englisch (Nigeria).

## Teil A — Geschäftsmodell & Engpass (Interview, 30 min)

1. Was verkaufen Sie heute, an wen, und wie oft? (Produkte, Abnehmer, Rhythmus)
2. Woher kommt die Ware? (eigene Produktion / Ankauf von wie vielen Farmern?)
3. **Wo verlieren Sie heute am meisten Geld?** (Verderb? Transport? unbezahlte
   Rechnungen? Diebstahl? Leerstand? — Engpass Nr. 1 markieren!)
4. Wie viel Ware verdirbt pro Woche, geschätzt in kg und XOF/NGN?
5. Wer sind Ihre 3 wichtigsten Abnehmer? Gibt es schriftliche Vereinbarungen?
6. Zu welchen Preisen kaufen/verkaufen Sie diese Woche? (je Produkt notieren)
7. Wie zahlen Ihre Kunden — bar, Mobile Money, auf Ziel? Wie viel steht aus?
8. Wie zahlen Sie Ihre Farmer — sofort, später, Vorschüsse (Avances)?
9. Welche Infrastruktur existiert? (Lager, Kühlraum, Fahrzeuge, Maschinen,
   Waage, Drucker, Smartphones/Tablets, Stromsituation/Délestages)
10. Wer soll täglich erfassen? (Name, Gerät, Lese-/Sprachkenntnisse)
11. Saisonkalender: Welche Monate sind Hochsaison je Produkt?
12. Was wäre in 3 Monaten ein Erfolg in einer Zahl? (z. B. „Verderb unter
    10 %", „Außenstände unter 500.000 XOF")

## Teil B — Stammdaten-Aufnahme (Checkliste, 90 min)

- [ ] **Abnehmer** → `abnehmer.csv` (alle aktiven + 3 Wunschkunden)
- [ ] **Produkte & Preise** → `produkte_kulturen.csv` (heutige Tagespreise!)
- [ ] **Top-20-Farmer** → `farmer_stammdaten.csv` (Rest rollierend im Betrieb)
- [ ] **Lager/Kühlräume** → `kuehlhaus_lager.csv` (Kapazität in Kisten zählen)
- [ ] **Fahrzeuge/Maschinen** → `fahrzeuge_equipment.csv` (Tarife festlegen)
- [ ] Belegnummern-Startwerte festlegen (z. B. Ankauf ab A-1000)
- [ ] Kassenbestand zählen (Startsaldo)
- [ ] Lagerbestand je Produkt grob zählen/wiegen (Startbestand)

## Teil C — Einwilligung Farmer (bei Aufnahme vorlesen/unterschreiben)

> « J'accepte que mes coordonnées (nom, téléphone, village) soient
> enregistrées par [Firma] uniquement pour la gestion des achats et des
> paiements. Je peux demander la correction ou la désactivation de mes
> données à tout moment. »
>
> Name: ______________  Datum: ______________  Unterschrift/Empreinte: ______

## Teil D — Abschluss Tag 1

- [ ] CSV-Import in die App erfolgreich (Zeilenzahl = aufgenommene Sätze)
- [ ] Erste 5 Echtbelege gemeinsam mit der Erfassungskraft gebucht
- [ ] Tagesabschluss gezeigt (Ankauf, Bestand, offene Posten)
- [ ] Backup-Export auf zweites Gerät durchgeführt
- [ ] Termin Woche-1-Review vereinbart (KPI-Erstauswertung)
