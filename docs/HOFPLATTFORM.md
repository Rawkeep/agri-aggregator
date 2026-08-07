# HOFPLATTFORM — Kompletter Farm-Ablauf end-to-end

> Konzept-Dokument (Ergänzung zu [AGRI-PORTFOLIO.md](./AGRI-PORTFOLIO.md)).
> Während das Portfolio-Papier die Kette **zwischen** Farm und Teller besetzt,
> beschreibt dieses Dokument den Kreislauf **auf** der Farm selbst — end-to-end,
> mit Automation, Kontrolle und Überwachung. Referenzbetrieb: Mischbetrieb nach
> dem Muster TCHA AGRO (Mais, Soja, Schafe, Legehennen/Masthähnchen, eigene
> Futtermühle, Hofladen, Lieferung, Getreidelager mit Saisonverkauf).
>
> Grundlage ist ein Deep-Search (08/2026) über Open-Source-Farm-Software auf
> GitHub (Abschnitt 6): **Kein existierendes Projekt deckt diese Kette
> durchgängig ab, keines ist offline-first.** Die Bausteine dafür liegen aber
> zu großen Teilen bereits im Rawkeep-Portfolio.

## 1. Der Kreislauf des Betriebs

Der Betrieb ist ein geschlossener Kreislauf — das ist der Konzeptkern:

```
Mais/Soja (Feld) ──► Getreidelager ──► Saisonverkauf (Preis gut = verkaufen)
                          │
                          ▼
                     Futtermühle ──► Futtersäcke ──► Hofladen + eigene Ställe
                                                          │
                                    Hühner/Schafe ◄───────┘
                                          │
                              Eier + Fleisch ──► Hofladen + Lieferung
                                          ▲
                        Zukauf von Partner-Farmen (bei Deckungslücke)
```

## 2. Die Stationen und ihre Bausteine

| # | Station | Was passiert | Baustein |
|---|---------|--------------|----------|
| 1 | **Feld** (Mais/Soja) | Parzellen, Aussaat, Düngung, Ernte je Schlag | 🔨 `agri-field` (neu, schlank) |
| 2 | **Getreidelager** | Einlagerung nach Ernte, Bestand, Temperatur/Feuchte | `agri-aggregator` (Bestand) + Sensorik (§4) |
| 3 | **Futtermühle** | Rezeptur, Produktion, Herstellkosten, Sackpreis | ✅ `feed-mill` |
| 4 | **Ställe** (Hühner, Schafe) | Herden/Durchgänge, Legeleistung, Futter, Mortalität, **Kosten je Ei** | 🔨 **`agri-flock`** (neu — das fehlende Herzstück, siehe §3) |
| 5 | **Eier & Fleisch** | Chargen, Sortierung, Rückverfolgung Stall→Kunde | ✅ `agri-trace` |
| 6 | **Hofladen** | Verkauf Eier + Futtersäcke, Kasse, Tagesabschluss | ✅ `togo-pos` / `TchaAgro` |
| 7 | **Lieferung** | Bestellungen, Touren, Mobile Money | ✅ `togo-logistics` |
| 8 | **Saisonverkauf Getreide** | Preisboard, Kontrakte, Verkauf zum guten Preis | ✅ `market-link` |

### Station 9: Das Zukauf-Netzwerk (Eier von Partner-Farmen)

Deckt die eigene Legeleistung die Nachfrage von Laden + Lieferkunden nicht,
wird bei Partner-Farmen („Konkurrenz") zugekauft — mit denselben Bausteinen,
nur gedrehten Rollen:

- **Bedarfsmeldung** („200 Trays für KW 34") → Partner zeichnen dagegen:
  exakt die „Nachfrage-zuerst"-Kernlogik von `market-link`, diesmal mit dem
  eigenen Betrieb als Abnehmer. Zuverlässigkeits-Score (70 % Erfüllung /
  30 % Pünktlichkeit) entscheidet, wer zuerst Zuschlag bekommt.
- **Ankauf mit Beleg und Qualitätsstufe** → `agri-aggregator`.
- **Sammeltour** zu den Partner-Farmen, Zahlung bei Übergabe → `togo-logistics`.
- **Herkunftstrennung ist Pflicht, nicht Buchhaltungs-Kür**: Zukaufware läuft
  als eigene Charge mit Herkunft „Farm X" durch `agri-trace`. Dadurch (a) ist
  bei Reklamation/Rückruf sofort klar, wessen Ware betroffen ist, (b) die
  Marge Eigenproduktion vs. Zukauf bleibt getrennt sichtbar, (c) die
  Auslobung im Laden bleibt ehrlich („eigene Eier" vs. „aus Partnerfarmen").
- **Doppelter Handelskanal**: dieselben Partner sind Abnehmer für Futter aus
  der Mühle — Zukauf Eier rein, Verkauf Futter raus, ggf. verrechnet.

## 3. `agri-flock` — Stall, Herde und die starke Buchhaltungskontrolle

Die Produktionsseite fehlt im Portfolio komplett (alle bisherigen Apps setzen
am Warenausgang an). `agri-flock` schließt die Lücke — und trägt zugleich die
**Finanz-Kontrolle**, die bisher über Kassen und offene Posten fragmentiert
war. Vier Säulen:

1. **Herden & Tageserfassung** — Durchgänge (Legehennen, Broiler, Schafe),
   tägliche Erfassung: Eier, Futter, Wasser, Abgänge. Kennzahlen
   deterministisch: Legeleistung (Eier je Henne und Tag), Futter je Ei,
   kumulierte Mortalität.
2. **Investitionsregister mit Abschreibung** — jede Anschaffung (Stall,
   Mühle, Maschine, Herden-Aufbau) mit Kaufpreis, Nutzungsdauer, Restwert;
   lineare Monats-AfA, Buchwert jederzeit abrufbar. Investitionen sind einer
   Herde oder dem Betrieb zugeordnet — die AfA fließt in die Kostenrechnung.
3. **Ausgabenjournal + Budget-Kontrolle** — jede Ausgabe mit Kategorie
   (Küken/Tiere, Futter, Medikamente/Tierarzt, Löhne, Energie, Transport,
   Sonstiges), zugeordnet zu Herde oder Betrieb. Monatsbudgets je Kategorie;
   Warnung ab 80 %, Alarm ab 100 % — deterministisch, keine Ermessensspielräume.
4. **Kostenrechnung je Durchgang** — direkte Ausgaben + anteilige AfA +
   Erlöse (Eier/Fleisch/Tierverkauf) ⇒ **Kosten je Ei**, Deckungsbeitrag je
   Durchgang. Damit ist der Zukauf-Entscheid rechenbar: Liegt der
   Partner-Preis unter den eigenen Vollkosten je Ei, ist Zukauf auch bei
   freier Stallkapazität rational.

Hausstil wie die agri-Sechs: vanilla JS ohne Build, IIFE-Module mit
Dual-Export, IndexedDB mit localStorage-Fallback, **alle Beträge Integer in
der kleinsten Währungseinheit (XOF/NGN)**, Quoten als Basispunkte-Integer,
FR/EN umschaltbar, null externe Requests, `node --test`.

## 4. Überwachung: drei Schichten, ein Alarmkanal

Alles auf einem lokalen Mini-Server (NUC/Raspberry Pi), alles offline:

| Schicht | Werkzeug | Überwacht |
|---------|----------|-----------|
| **Sensorik** | ESPHome (ESP32-Knoten ~5 €) + optional ChirpStack (LoRaWAN für weite Flächen) | Stallklima (Temp/Feuchte), **Silo-Temperatur/-Feuchte im Getreidelager** (der Verlustbringer bei Saisonlagerung), Füllstände, Stromausfall |
| **Kameras** | Frigate NVR (MIT, lokale Objekterkennung — Bilder verlassen den Hof nie) | Laden/Kasse, Futter- und Getreidelager (Diebstahl), Hofeinfahrt, Stall außen (Fuchs/Marder/Greifvogel), Ablammbereich; Feldrand über Batterie-Wildkameras + MegaDetector/AddaxAI |
| **Betriebszahlen** | die Apps (§2, §3) | Legeleistung fällt 3 Tage in Folge, Mortalitäts-Spitze, Budget überschritten, Eier-Deckungslücke → Zukauf-Vorschlag, Futter-Mindestbestand |

Ehrliche Grenze (Deep-Search-Befund): Kameras **im** Stall zur
Krankheitserkennung/Zählung sind Stand 2026 Forschungscode — wird nicht
versprochen. Tiergesundheit wird über die Zahlen in `agri-flock` überwacht
(Legeleistung, Futter-/Wasserverbrauch, Mortalität reagieren früher als jedes
Kamerabild). Datenschutz bei Kameras: Beschilderung, kurze Speicherfristen
(Frigate löscht automatisch), keine Dauerüberwachung von Arbeitsplätzen.

## 5. Das Dashboard — die Klammer

Eine Übersicht, eine Alarmliste (Push aufs Handy), gespeist per MQTT aus
Sensorik + Frigate und aus den Betriebszahlen der Apps:

- Legeleistung heute / 7-Tage-Trend · Futterreichweite in Tagen
- Lagerbestand Mais/Soja + aktueller Marktpreis (**Verkaufssignal** Saison)
- Ladenumsatz, offene Lieferungen
- **Deckungslücke Eier** (Prognose eigene Produktion vs. Bestellungen 7 Tage
  → automatischer Zukauf-Vorschlag, Freigabe per Klick) · Zukauf-Anteil %
- Budget-Ampeln je Kategorie · Kosten je Ei (rollierend)
- Alarme: „Silo 31 °C", „Person am Futterlager 23:40", „Fuchs am Stall",
  „Legeleistung 3 Tage fallend"

Invariante wie im ganzen Portfolio: **Deterministische Regeln entscheiden und
alarmieren; ein LLM darf höchstens beschreiben und vorschlagen.** Der Mensch
gibt frei.

## 6. Deep-Search-Befund: Was es auf GitHub schon gibt (und was nicht)

**Farm-Management (als Referenz, nicht als Basis):**

| Projekt | Nutzen für uns | Warum nicht als Basis |
|---------|----------------|------------------------|
| [farmOS](https://github.com/farmOS/farmOS) (~1 300★, GPL-2.0, aktiv) | Bestes offenes **Datenmodell** (Asset → Log → Quantity), inkl. Tierhaltung; Blaupause für `agri-flock`/`agri-field` | PHP/Drupal; kein Laden/Verkauf/Finanzen |
| [Ekylibre](https://github.com/ekylibre/ekylibre) (AGPL-3.0) | Einziges Farm-**ERP** Produktion→Buchhaltung; **Feature-Landkarte** | Rails-Monolith, FR-Kontenrahmen, kein Offline |
| [LiteFarm](https://github.com/LiteFarmOrg/LiteFarm) (GPL-3.0, sehr aktiv) | Modernstes Tier-/Finanzmodul, UX-Vorlage | Kein Lager/Verkauf, kein Offline |

**Automation/Überwachung (produktionsreif, lokal betreibbar):**
[Frigate](https://github.com/blakeblackshear/frigate) (Kameras + lokale
Objekterkennung), [Home Assistant](https://github.com/home-assistant/core) +
[ESPHome](https://github.com/esphome/esphome) (Sensorknoten),
[ChirpStack](https://github.com/chirpstack/chirpstack) (eigenes
LoRaWAN-Netz), [ThingsBoard CE](https://github.com/thingsboard/thingsboard)
oder Grafana/InfluxDB/Node-RED (Dashboards/Alarme),
[OpenSprinkler](https://github.com/OpenSprinkler/OpenSprinkler-Firmware)
(Bewässerung), [WebODM](https://github.com/WebODM/WebODM) (Drohnen-NDVI),
[AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS)
(RTK-Lenksystem, community-reif), [MegaDetector /
AddaxAI](https://github.com/PetervanLunteren/AddaxAI) (Wildkamera-Auswertung).

**Die Lücke, die dieses Konzept besetzt:** Kein Projekt kann die Kette
*Feld → Ernte-Charge → Lager → Verarbeitung → Stall → Verkauf →
Rückverfolgung* durchgängig; keines ist local-first als Designprinzip;
keines rechnet Kosten je Ei/kg über den ganzen Kreislauf. Genau das ist die
Rawkeep-Nische — und fast alle Bausteine existieren schon.

## 7. Die Datenbrücke — höchster Hebel des Portfolios

Die agri-Apps teilen Schemata, sind aber Daten-Silos (je ein eigenes
IndexedDB). Die Plattform entsteht nicht durch eine neue Mega-App, sondern
durch ein **gemeinsames Chargen-/Ereignisformat** (CSV/JSON-Round-Trip im
Stil der bestehenden `daten-strategie/kits/`): Jede Station exportiert ihre
Bewegungen als Belege, die nächste importiert sie. Dann füllt sich
`agri-trace` automatisch statt per Doppelerfassung, und die Kette „dieses Ei
kam aus Stall 2, gefüttert mit Charge M-2026-14 aus eigenem Mais" steht.

## 8. Bauplan (Reihenfolge nach Hebel) — Stand

1. ✅ **`agri-flock`** — Stall/Herde + Investitionen/Ausgaben/Budget/Kosten
   je Ei (§3). *Werkstück in `devteam/apps/agri-flock` bis zum eigenen Repo.*
2. ✅ **Datenbrücke** — Hofkette-v1 ([DATENBRUECKE.md](./DATENBRUECKE.md)):
   Sender `agri-field`, `feed-mill`, `agri-flock`, `agri-aggregator`;
   Empfänger `agri-trace` (append-only, idempotent). Offen: Kasse
   (`togo-pos`/`TchaAgro`) und `togo-logistics` als Sender.
3. ✅ **Dashboard** — `devteam/apps/hof-dashboard`: Kacheln (Eier,
   Futterreichweite, Getreidelager, Umsatz, Zukauf-Anteil, Deckungslücke)
   + Alarmliste, gerechnet auf importierten Hofkette-Belegen. Offen:
   MQTT-Ingest (Sensor-Ereignisse) — läuft bis dahin über die
   Home-Assistant-/Node-RED-Schicht des Sensorik-Kits.
4. ✅ **`agri-field`** — schlankes Feldjournal in `devteam/apps/agri-field`
   (Parzelle → Ernte-Charge als `ERNTE`-Beleg).
5. 🔩 **Sensorik-Stufe 1** — Software fertig als Kit
   ([sensorik-kit/](./sensorik-kit/)): ESPHome-Konfigurationen für Stall +
   Getreidelager-Messkette. Offen: Hardware kaufen und flashen
   (~100–150 €, Einkaufsliste im Kit).
6. 🔩 **Kamera-Stufe** — Frigate-Konfiguration fertig im selben Kit
   (4 Kameras, Ereignis-Aufzeichnung, 10-Tage-Löschung). Offen: Kameras +
   Mini-Server anschaffen.

Vor jedem Hardware-Invest gelten die 10 Prüffragen aus
[AGRI-PORTFOLIO.md](./AGRI-PORTFOLIO.md) §5.
