# FLUR

Tagesübersicht für den Flur, das Handy und den Mac. WebUntis-Stundenplan, Vertretungen, Prüfungen, Hausaufgaben, Fehlzeiten, Ferien, der Hinweg knapp zur ersten Stunde, die nicht ausfällt, und der Heimweg mit dem Weg vom Schulhaus zur frühesten Zugverbindung.

Eine offizielle Untis-App für den Mac gibt es nicht. FLUR ist der Ersatz: dieselbe Schule, lokal auf dem Gerät, ohne Messenger und ohne Noten.

## Was die Tafel kann

| Untis Mobile | FLUR |
| --- | --- |
| Heute, mit laufender Stunde | Heute, Uhr und nächste Stunde. Pfeile blättern durch die Tage. |
| Woche | Woche, diese und die nächste. Am Mac und am breiten Bildschirm als Spalten. |
| Vertretungen und Entfall | Änderungen aus dem eigenen Plan, zwei Wochen voraus. Fremde Klassen bleiben draußen. |
| Prüfungen | Prüfungen, wenn die Schule sie über die Schnittstelle freigibt. |
| Hausaufgaben | Hausaufgaben. Abhaken gilt nur auf diesem Gerät. |
| Fehlzeiten | Fehlzeiten, entschuldigt oder nicht, wenn die Schule das erlaubt. |
| Ferien | Ferien und unterrichtsfreie Tage. |
| Pinnwand / Mitteilung des Tages | Pinnwand, meist nur mit dem Schul-Login aus den Freigaben. |
| Mehrere Kinder | Bis zu sechs Konten, nur auf diesem Gerät. |
| Kalender | Stunden und Prüfungen als Kalenderdatei. |
| Offline | Der letzte erfolgreiche Abruf bleibt auf dem Gerät. |
| Schulweg | Hinweg und Heimweg, Bus, Auto, Fahrrad, zu Fuß. |
| Flur-Bildschirm | Automatischer Wechsel zwischen Heute, Hinweg und Heimweg. |

Die Morgenpost bleibt unter Mehr: ein Text zum Kopieren. Automatischer Versand braucht ein Postfach und ist nicht angeschlossen.

## Was nicht geht

Untis Mobile spricht mit einer anderen, nicht öffentlichen Schnittstelle. Ohne einen bei Untis registrierten Partner-Zugang kann FLUR das nicht nachbauen:

- **Mit SSO anmelden** als Knopf, der Microsoft, IServ oder Office 365 öffnet. Dafür gibt es keine Client-ID. Der Weg führt über den Code aus den Freigaben, siehe unten.
- **Messenger** und Kurs-Chats.
- **Push-Mitteilungen.**
- **Noten.**
- **Freie Räume** für die ganze Schule.
- **Klassenbuch schreiben**, Entschuldigungen einreichen, Krankmeldungen abschicken.

Fehlt einer Schule das Recht für Prüfungen, Hausaufgaben oder Fehlzeiten, bleibt der Stundenplan stehen. Die betroffene Karte sagt das in einem Satz.

## Einrichtung

Beim ersten Öffnen fragt FLUR der Reihe nach:

1. **Schule.** Name oder Ort tippen. Die Adresse des Servers wird nicht mehr von Hand eingetragen.
2. **Anmeldung.** Entweder das WebUntis-Passwort oder Schul-Login.
3. **Für wen.** Ich, eine Klasse oder eine Lehrkraft. Klasse und Kürzel lassen sich suchen.
4. **Weg.** Zuhause, Bahnhof, Halt an der Schule, Verkehrsmittel. Wer will, überspringt das und behält den Beispielweg.

**Beispiel ansehen** zeigt einen fertigen Tag, ohne etwas zu speichern, was schon da war.

Zugangsdaten, Konten und der letzte Plan liegen im Speicher des Geräts. Es gibt kein FLUR-Konto. Was in den Einstellungen steht, gilt nur für dieses Gerät und ersetzt die Server-Variablen unten.

### Freund mit Schul-Login

Wer sich in Untis nur über Microsoft, IServ oder Office 365 anmeldet, hat oft kein JSON-RPC-Passwort. Das Microsoft-Passwort gehört nicht in FLUR.

1. In der Untis-App oder im Browser an der Schule anmelden.
2. Profil, dann **Freigaben** (nicht „Zugang“).
3. Den QR-Code fotografieren oder den Link bzw. den Code kopieren und in FLUR unter Schul-Login einfügen.

FLUR macht daraus ein kurzlebiges Einmalpasswort und meldet sich damit an. Der Code bleibt auf dem Gerät.

### Klasse suchen

Die Liste kommt, wenn die Schule sie öffentlich lässt, schon ohne Anmeldung. Sonst nach dem Login. Wer keine Liste bekommt, tippt den Namen trotzdem, zum Beispiel `10b`.

## Mac

Es gibt keine signierte App-Store-Version. Die Ausgabe auf GitHub ist eine App für den Schreibtisch, unsigniert, weil sie nicht auf einem Mac gebaut und nicht von Apple notarisiert wurde.

1. Release öffnen: [github.com/Linopix/FLUR/releases](https://github.com/Linopix/FLUR/releases)
2. **Apple Silicon** (M1 und neuer): `FLUR-mac-apple-silicon.zip`. **Intel:** `FLUR-mac-intel.zip`.
3. Entpacken. `FLUR` nach Programme ziehen.
4. Beim ersten Start blockt macOS die App. Im Finder rechtsklicken, **Öffnen**, dann noch einmal **Öffnen**.
5. Wer die Meldung schon weggeklickt hat: Systemeinstellungen, Datenschutz & Sicherheit, **Dennoch öffnen**.

Die App spricht nur mit der Schule und mit dem Fahrplandienst. Sie enthält keinen eigenen Account.

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

Zugdaten kommen über [Transitous](https://transitous.org) (Fahrplandaten, unter anderem DB). Der Hinweg sucht die späteste Verbindung, die noch vor der ersten nicht ausgefallenen Stunde ankommt, mit acht Minuten für den Weg vom Halt ins Schulhaus. Der Heimweg rechnet dieselben acht Minuten vom Schulhaus zur Haltestelle und nimmt danach die früheste Zugverbindung. Wege zu Fuß, mit dem Rad und mit dem Auto über den öffentlichen OSRM-Dienst. „Pünktlich“ heißt: keine Ausfallmeldung und höchstens zwei Minuten Abweichung vom Fahrplan.

## Schon da, später richtig

- **Telefon:** dieselbe Oberfläche, unten die Navigation.
- **Post:** die Morgenpost lässt sich kopieren. Automatischer Mailversand braucht noch ein Postfach.
- **Apple Watch:** `/uhr` ist die Vorlage für ein Widget, noch keine Complication.

Zugangsdaten nicht committen.

## Native iOS-, Widget- und Watch-App

Die native SwiftUI-App liegt in [`platforms/ios/`](platforms/ios/README.md). Sie ist eine eigenständige Ergänzung zur bestehenden Web-App und verändert weder deren Laufzeit noch deren Build. Web- und iOS-Version verwenden dieselben fachlichen Datenquellen, die native App ruft WebUntis und Transitous direkt vom iPhone ab und benötigt keinen FLUR-Server.

Der native Projektordner enthält:

- die iPhone-App mit den Bereichen **Aktuell**, **Wege** und **Mehr**;
- ein iPhone-Widget für den aktuellen Termin bzw. den Countdown zur nächsten Abfahrt;
- eine eigenständige Apple-Watch-App samt Watch-Widget/Komplikationen;
- gemeinsame Datenmodelle und lokale Synchronisierung zwischen iPhone und Watch.

**Wichtig für Entwickler:** Einrichtung, Targets, Bundle-IDs, App Group, Signing und der Weg zur IPA stehen in [`platforms/ios/README.md`](platforms/ios/README.md). Zugangsdaten gehören nicht ins Repository. Die Web-App baut und läuft ohne den Ordner `platforms/`.

Die Mac-App ist kein zweites Swift-Projekt. Sie startet dieselbe Web-Tafel in einem eigenen Fenster. Der Quelltext des Fensters liegt in [`desktop/`](desktop/).

## Android

Eine Android-App ist machbar, aber noch nicht sinnvoll. Dieselbe Aufteilung ginge mit Jetpack Compose, Widgets über Glance. Liquid Glass gibt es auf Android nicht. Stattdessen Material 3 in derselben Tinte, mit demselben Stundenplan. Das wäre eine dritte Kopie der Fahrplanregeln neben Web und Swift. Erst bauen, wenn die iPhone-IPA im Alltag sitzt.
