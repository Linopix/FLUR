# FLUR

Tagesübersicht für einen Bildschirm an der Wand. WebUntis-Stundenplan, der Hinweg knapp zur ersten Stunde, die nicht ausfällt, und der Heimweg mit dem Weg vom Schulhaus zur frühesten Zugverbindung.

## Docker

```bash
cp flur.env.example flur.env
# Zugangsdaten in flur.env eintragen
docker compose --env-file flur.env up -d --build
```

Die Tafel liegt dann auf Port 8080. Vollbild im Browser, oder auf einem Linux-Rechner mit X11 und HDMI:

```bash
xhost +local:docker
docker compose --env-file flur.env --profile hdmi up -d
```

Ohne `flur.env` läuft die Tafel mit einem Beispieltag und einer live gerechneten Beispielstrecke Köln Süd → Köln Hbf.

## Variablen

| Variable | Bedeutung |
| --- | --- |
| `FLUR_WEBUNTIS_SERVER` | z. B. `mese.webuntis.com` |
| `FLUR_WEBUNTIS_SCHOOL` | Schulname wie in WebUntis |
| `FLUR_WEBUNTIS_USER` / `FLUR_WEBUNTIS_PASSWORD` | Zugang |
| `FLUR_WEBUNTIS_WHO` | `student`, `class` oder `teacher` |
| `FLUR_WEBUNTIS_NAME` | Klasse oder Kürzel, nur wenn nicht `student` |
| `FLUR_HOME` | Heimatadresse |
| `FLUR_STATION` | Bahnhof für die Abfahrt |
| `FLUR_SCHOOL_STOP` | Halt an der Schule |
| `FLUR_MODE` | `bus`, `car`, `bike` oder `walk` |

Dieselben Felder gibt es in den Einstellungen auf dem Bildschirm. Was dort steht, gilt nur für dieses Gerät und ersetzt die Server-Variablen.

Zugdaten kommen über [Transitous](https://transitous.org) (Fahrplandaten, unter anderem DB). Der Hinweg sucht die späteste Verbindung, die noch vor der ersten nicht ausgefallenen Stunde ankommt, mit acht Minuten für den Weg vom Halt ins Schulhaus. Der Heimweg rechnet dieselben acht Minuten vom Schulhaus zur Haltestelle und nimmt danach die früheste Zugverbindung. Wege zu Fuß, mit dem Rad und mit dem Auto über den öffentlichen OSRM-Dienst. „Pünktlich“ heißt: keine Ausfallmeldung und höchstens zwei Minuten Abweichung vom Fahrplan.

## Schon da, später richtig

- **Telefon:** dieselbe Oberfläche, unten die Navigation.
- **Post:** die Morgenpost lässt sich kopieren. Automatischer Mailversand braucht noch ein Postfach.
- **Apple Watch:** `/uhr` ist die Vorlage für ein Widget, noch keine Complication.

Zugangsdaten nicht committen.
