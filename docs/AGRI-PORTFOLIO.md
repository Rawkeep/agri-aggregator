# AGRI-PORTFOLIO — Die Wertschöpfungskette zwischen Farm und Teller

> Strategie-Dokument: Wie das Rawkeep-Portfolio die Chancen der
> Agrar-Wertschöpfungskette (Westafrika, Fokus Togo/Nigeria) besetzt.
> Kernthese: **Das größte Geld in der Landwirtschaft liegt oft nicht auf dem
> Feld** — sondern in Lagerung, Kühlung, Verarbeitung, Verpackung, Logistik,
> Maschinen und Marktzugang. Wer eine dieser Positionen wiederholbar und
> profitabel besetzt, verdient an hunderten Farmern statt an einer Ernte.

## 1. Die Chancen-Landkarte (Value-Chain-Gaps)

| # | Gap in der Kette | Warum es Geld wert ist | Geschäftsmodell |
|---|------------------|------------------------|-----------------|
| 1 | **Aggregation** — viele Kleinbauern, kein verlässlicher Abnehmer | Bündelung schafft handelbare Mengen + Qualität | Marge Ankauf/Verkauf, Servicegebühr |
| 2 | **Kühlkette/Lagerung** — Tomaten/Gemüse verderben in Tagen | Post-Harvest-Losses 30–50 % bei Frischware | Miete pro Kiste/Tag, Solar-Kühlraum |
| 3 | **Verarbeitung** — Maniok roh vs. Gari/Stärke, Mais vs. Futter | Value Addition = 2–5× Rohwarenpreis | Verarbeitungsmarge, Lohnverarbeitung |
| 4 | **Verpackung/Grading** — ohne geht kein Supermarkt/Export | Eintrittskarte in Premium-Kanäle | Gebühr pro Einheit, Materialverkauf |
| 5 | **Farm-to-Market-Logistik** — Feld → Stadt/Hafen | Transport ist der Engpass, nicht die Produktion | Fracht pro kg/Kiste, Sammeltouren |
| 6 | **Maschinen-Leasing** — Traktor steht 300 Tage/Jahr still | Ein Traktor, viele Farmer, volle Auslastung | Miete pro Stunde/Hektar |
| 7 | **Traceability/Qualität** — Export verlangt Nachweise | Rückverfolgbarkeit = Exportfähigkeit | SaaS, Zertifizierungs-Service |
| 8 | **Marktzugang digital** — Farmer ↔ verifizierte Käufer | Erst der Markt, dann die Produktion | Vermittlungsgebühr, Abo |

**Die goldene Regel (aus jedem Gap ableitbar):** Erst bestätigte Nachfrage
(Supermärkte, Hotels, Verarbeiter, Exporteure, Schulen/Kliniken,
Großabnehmer), dann Produktions- und Liefersystem darum bauen. Produzieren
und dann Käufer suchen ist keine Strategie, sondern Spekulation.

## 2. Mapping auf das bestehende Rawkeep-Portfolio

| Bestehende App | Übernimmt aus der Kette | Ausbau (auf diesem Branch begonnen) |
|----------------|-------------------------|--------------------------------------|
| **tcha-agro** (Website) | Positionierung als Full-Chain-Anbieter | Neue Sektion „Agrar-Wertschöpfungskette" (DE/EN/FR) |
| **TchaAgro** (Offline-App Caisse/Stock) | Ankauf, Lager, Verlust-Tracking | `ROADMAP-WERTSCHOEPFUNG.md` (4 Phasen) |
| **togo-logistics** | Farm-to-Market, Kühltransport | `docs/AGRAR-MODUL.md` (Sammeltouren, Cold-Chain-Log) |
| **togo-pos** | Wiege-Verkauf, Ankauf-Modus, Grading | `docs/AGRAR-MODUS.md` |
| **RAQ / export-africa-pro** | Export-Execution, Dokumente, Compliance | bereits Kern-Kompetenz (Form M, 32-Doku-Bundle, SONCAP) |
| **sap-agent** | Traceability + Dokumentenprüfung deterministisch | Belegketten, Trade-Compliance vorhanden |
| **grounded-rag** | Wissensbasis für Agrar-Kunden (Preise, Normen) | einsetzbar ohne Änderung |
| **devteam** | baut die neuen Apps unten | `briefs/agri/` — 6 baubereite Aufträge |

## 3. Neue Apps (vom Dev-Team zu bauen)

Sechs baubereite Briefs liegen in [`briefs/agri/`](../briefs/agri/) — jeder
mit Copy-&-Paste-Auftrag für `python3 -m devteam.cli build "…"`, Zielgruppe,
Akzeptanzkriterien und Datenmodell:

1. **agri-aggregator** — Ankauf/Aggregation von Kleinbauern-Ernten mit Grading & Auszahlung
2. **cold-chain-manager** — Kühlraum-Verwaltung: Belegung, Temperatur-Log, Abrechnung pro Kiste/Tag
3. **agri-lease** — Maschinen-/Geräteverleih: Buchung, Auslastung, Wartung, Abrechnung pro Stunde/Hektar
4. **agri-trace** — Chargen-Rückverfolgbarkeit vom Feld bis zum Export-Container
5. **feed-mill** — Futtermittel-Produktion: Rezepturen, Ausbeute, Chargen, Rohstoff-Einkauf
6. **market-link** — Farmer↔Abnehmer-Matching mit bestätigter Nachfrage zuerst (Bedarfsmeldungen der Käufer)

Alle sechs folgen den Portfolio-Invarianten: **offline-first, lokal-first,
deterministische Entscheidungslogik (LLM schlägt höchstens vor), XOF/NGN-fähig,
daten- und akkusparend, keine Pflicht-Cloud.**

## 4. Daten-Strategie

Um **beim Kunden am Tag 1 direkt loszulegen**, liegt in
[`daten-strategie/`](../daten-strategie/) ein komplettes Playbook +
Starter-Kits (CSV-Schemata, Erhebungsbogen, KPI-Katalog). Kurzfassung:

1. **Markt zuerst erheben** (Abnehmer, Preise, Zahlungsziele) — nicht die Farm.
2. **Minimale Stammdaten, sofort nutzbar** — 5 Kern-Tabellen, per Papier/WhatsApp/CSV erfassbar.
3. **Jede Bewegung als Beleg** — Ankauf, Einlagerung, Verarbeitung, Verkauf, Verlust.
4. **Verluste messen** ist der schnellste ROI-Hebel (Post-Harvest-Loss-KPI).
5. **Lokal speichern, DSGVO-/NDPR-bewusst teilen** — Datenhoheit beim Kunden.

## 5. Vor jedem Invest: die 10 Prüffragen

Wer kauft? · Zu welchem Preis? · Transportkosten? · Haltbarkeit? ·
Saisonpreise? · Lageranforderungen? · Sicherheitsrisiken? · Qualitätsnormen?
· Regulatorik (NAFDAC/SONCAP/OTR …)? · Working Capital bis zum ersten Geld?

Ein Brief, der diese Fragen nicht beantwortet, ist noch kein Auftrag —
der Analyst (`--produkt`) fragt sie ab.
