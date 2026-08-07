# SENSORIK-KIT — Stall, Getreidelager, Kameras (Bauplan-Stufen 5–6)

> Umsetzungs-Kit zu [HOFPLATTFORM.md](../HOFPLATTFORM.md) §4. Alles läuft
> **lokal auf einem Mini-Server** (Raspberry Pi 4/5 oder NUC), null Cloud.
> Die Konfigurationen hier sind einsatzfertig — nur WLAN-Zugangsdaten und
> IP-Adressen anpassen. Vor dem Hardware-Kauf: die 10 Prüffragen aus
> [AGRI-PORTFOLIO.md](../AGRI-PORTFOLIO.md) §5.

## Stufe 5a — Stallklima (ESP32 + ESPHome)

**Hardware je Stall (~15 €):** ESP32-DevKit (~5 €), DHT22-Sensor für
Temperatur/Feuchte (~4 €), Netzteil, Gehäuse. Optional MQ-137 für NH₃
(Ammoniak) — Kalibrierung nötig, erst in Stufe 2.

**Konfiguration:** [`esphome-stall.yaml`](./esphome-stall.yaml) —
Temperatur/Feuchte alle 60 s per MQTT, Alarm-Schwellen laufen im
Home-Assistant/Node-RED auf dem Mini-Server (nicht im Sensor — der Knoten
misst nur, die Regeln liegen zentral, wie überall im Portfolio).

## Stufe 5b — Getreidelager/Silo (der wichtigste Sensor!)

Bei saisonaler Lagerung entsteht der Verlust durch **Erwärmung und Feuchte**
— nachts und am Wochenende, genau wenn niemand misst.

**Hardware (~20 €):** ESP32 + DS18B20-Temperaturfühler als wasserdichte
Kabelversion (mehrere Fühler an einem Bus = Messkette in verschiedenen
Schütttiefen) + DHT22 für die Luftfeuchte im Lagerraum.

**Konfiguration:** [`esphome-silo.yaml`](./esphome-silo.yaml) — drei
Messpunkte im Schüttkegel + Raumklima. Faustregeln für die Alarm-Schwellen
(im Server konfigurieren): Getreidetemperatur > 30 °C = Warnung,
Anstieg > 3 °C/Woche = Alarm (Hotspot!), Kornfeuchte-Leitwert über
Lagerstandard = prüfen.

## Stufe 6 — Kameras (Frigate NVR)

**Hardware:** RTSP/PoE-Kameras (z. B. Reolink, 40–80 €/Stück — **keine
Cloud-Kameras**), Mini-Server mit 8–16 GB RAM, optional Google-Coral-USB
(~60 €) für flüssige Objekterkennung.

**Konfiguration:** [`frigate-config.yml`](./frigate-config.yml) — vier
Kameras (Laden, Futterlager, Hofeinfahrt, Stall außen), Erkennung
Person/Fahrzeug/Tier, Aufzeichnung nur bei Ereignis, automatische Löschung
nach 10 Tagen (Datenschutz), Alarme per MQTT.

**Ehrliche Grenze:** Kameras *im* Stall zur Krankheitserkennung/Zählung sind
Stand 2026 Forschungscode — nicht einplanen. Tiergesundheit überwacht
`agri-flock` über die Zahlen (Legeleistung, Futter/Wasser, Mortalität).

## Architektur auf dem Mini-Server

```
ESP32-Knoten ──MQTT──►┐
Frigate (Kameras) ──► │  Mosquitto (Broker)
                      ▼
        Home Assistant ODER Node-RED
        (Alarm-Regeln, Handy-Push, Verlauf)
```

- **Mosquitto** (MQTT-Broker), **Home Assistant** (Einsteiger-freundlich)
  oder **Node-RED** (flexibler) — alle drei laufen als Docker-Container auf
  demselben Mini-Server, komplett offline.
- Alarme erreichen das Handy über die Home-Assistant-App (lokal/VPN) oder
  per WhatsApp-Gateway (togo-logistics hat die Twilio-Anbindung bereits als
  Stub — wiederverwendbar).
- Das **hof-dashboard** bleibt die Beleg-Wahrheit (Hofkette); die
  Sensor-Schicht ist die Echtzeit-Wache daneben. Zusammenführung (Sensor-
  Ereignisse als Hofkette-Belege, z. B. Temperatur-Verletzung als Ereignis
  auf der Lager-Charge) ist die nächste Ausbaustufe.

## Datenschutz (Kameras)

Beschilderung („Videoüberwacht"), kurze Speicherfristen (Frigate löscht
automatisch, hier 10 Tage), Kameras nur aufs eigene Gelände, keine
Dauerüberwachung von Arbeitsplätzen. Alles bleibt lokal — kein Cloud-Upload.

## Einkaufsliste Stufe 1 (minimal, ~100–150 €)

| Posten | Stück | ca. |
|---|---|---|
| ESP32-DevKit | 2 | 10 € |
| DHT22 (Stall + Lagerraum) | 2 | 8 € |
| DS18B20 wasserdicht, 3er-Kette (Silo) | 1 | 10 € |
| Netzteile/Gehäuse/Kabel | — | 20 € |
| Raspberry Pi 4 (8 GB) o. gebrauchter Mini-PC | 1 | 60–100 € |

Kameras (Stufe 6) kommen dazu, sobald Stufe 5 läuft — erst messen, dann sehen.
