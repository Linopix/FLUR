# FLUR

Tagesübersicht für den Flur, das Handy und den Mac. WebUntis-Stundenplan, Vertretungen, Prüfungen, Hausaufgaben, Fehlzeiten, Ferien, der Hinweg knapp zur ersten Stunde, die nicht ausfällt, und der Heimweg mit dem Weg vom Schulhaus zur frühesten Zugverbindung.

Eine offizielle Untis-App für den Mac gibt es nicht. FLUR ist der Ersatz: dieselbe Schule, lokal auf dem Gerät, ohne Messenger und ohne Noten.

## Was die Tafel kann

| Untis Mobile | FLUR |
| --- | --- |
| Heute, mit laufender Stunde | Heute, Uhr und nächste Stunde. Der Countdown auf der Startseite läuft auch über Tage, abschaltbar unter Mehr. Uhrzeit und Countdown lassen sich getrennt als Ziffern oder Zeiger einstellen, mit Design, kleinster Einheit und Größe. Solange „Countdown separat“ aus ist, bleibt der Countdown wie die Uhrzeit. Auto wählt Größe und Einheit nach Bildschirm und Restdauer. |
| Woche | Woche, diese und die nächsten. Fach antippen zeigt die anderen Termine dazu, auch Prüfungen. Am Mac und am breiten Bildschirm als Spalten. |
| Vertretungen und Entfall | Änderungen aus dem eigenen Plan, sechs Wochen voraus. Fremde Klassen bleiben draußen. |
| Prüfungen | Prüfungen, wenn die Schule sie über die Schnittstelle freigibt. |
| Hausaufgaben | Hausaufgaben. Abhaken gilt nur auf diesem Gerät. |
| Fehlzeiten | Fehlzeiten, entschuldigt oder nicht, wenn die Schule das erlaubt. |
| Ferien | Ferien und unterrichtsfreie Tage. |
| Pinnwand / Mitteilung des Tages | Pinnwand, meist nur mit dem Schul-Login aus den Freigaben. |
| Mehrere Kinder | Bis zu sechs Konten, nur auf diesem Gerät. |
| Kalender | Stunden und Prüfungen als Kalenderdatei. |
| Offline | Der letzte Stundenplan und die Schuldaten liegen auf dem Gerät und sind sofort wieder da, noch während FLUR neu lädt. „Offline“ steht erst dabei, wenn der nächste Abruf am Netz scheitert. Eine abgelehnte Anmeldung ist kein Offline: dann heißt es „Anmeldung abgelehnt“, und der alte Plan wird nicht als aktueller Stand gezeigt. |
| Schulweg | Hinweg und Heimweg. Anschluss vergleicht Bus, Rad und Fuß an beiden Enden. Bahn+Auto fährt nur zum Bahnhof. Nur Auto fährt den ganzen Weg. Mit Deutschlandticket bleiben ICE, IC, EC, Nachtzug und Fernbus draußen. Zug und Bus lassen sich antippen und öffnen DB Navigator oder die MVG-App. |
| Flur-Bildschirm | Automatischer Wechsel zwischen Heute, Hinweg und Heimweg. Gegen Einbrennen rückt die Tafel langsam ein paar Pixel. In der Einrichtung lässt sich das Gerät als Infobildschirm markieren: dann sind Wechsel und Einbrennschutz an, und die Menüpunkte werden etwas größer. |

Die Morgenpost bleibt unter Mehr: ein Text zum Kopieren. Automatischer Versand braucht ein Postfach und ist nicht angeschlossen.

Fächer und Lehrkräfte stehen unter Mehr auf Auto, Kürzel, Ganz oder Laufen. Auto kürzt auf dem schmalen Bildschirm und schreibt auf dem breiten aus. Laufen schiebt einen zu langen Namen hin und her. Größe und kleinste Einheit der Uhr haben ebenfalls Auto. Der Countdown kann unter Mehr eine eigene Darstellung bekommen. Erscheinung ist Kreide oder Glas. Glas lässt den Goldton durchscheinend durch. Gegen Einbrennen steht unter Mehr und auf der letzten Seite der Einrichtung. Platzoptimierung rückt Heute enger zusammen, damit mehr Stunden auf die Tafel passen. Das Deutschlandticket steht in der Einrichtung und unter Mehr. Erscheinung, Namen und Uhr sind in Mehr zugeklappt, die Schalter darunter stehen in einer Liste.

## Was nicht geht

Untis Mobile spricht mit einer anderen, nicht öffentlichen Schnittstelle. Ohne einen bei Untis registrierten Partner-Zugang kann FLUR das nicht nachbauen:

- **Mit SSO anmelden** als Knopf, der Microsoft, IServ oder Office 365 öffnet. Dafür gibt es keine Client-ID. Der Weg führt über den Code aus den Freigaben, siehe unten.
- **Messenger** und Kurs-Chats.
- **Push-Mitteilungen.**
- **Noten.**
- **Freie Räume** für die ganze Schule.
- **Klassenbuch schreiben**, Entschuldigungen einreichen, Krankmeldungen abschicken.
- **Eigenes FLUR-Konto** und Better Auth. Die Schule bleibt auf dem Gerät. Es gibt keine Anmeldung bei FLUR.
- **Live-Stau.** Öffentliche Kartendienste ohne Schlüssel kennen die Straßenzeit, nicht die aktuelle Schlange. Nur Auto zeigt deshalb „Fahrzeit“, nicht „Stau“.
- **Mitteilungszentrale-Widgets** auf dem Mac. Die brauchen eine signierte App aus Xcode. Stattdessen liegt ein Symbol in der Menüleiste: Stunde, Vertretung und Zugverspätung, ohne das Fenster zu öffnen.

Fehlt einer Schule das Recht für Prüfungen, Hausaufgaben oder Fehlzeiten, bleibt der Stundenplan stehen. Die betroffene Karte sagt das in einem Satz.

## Einrichtung

Beim ersten Öffnen fragt FLUR der Reihe nach:

1. **Schule.** Name oder Ort tippen. Die Adresse des Servers wird nicht mehr von Hand eingetragen.
2. **Anmeldung.** Entweder das WebUntis-Passwort oder Schul-Login.
3. **Für wen.** Ich, eine Klasse oder eine Lehrkraft. Klasse und Kürzel lassen sich suchen.
4. **Weg.** Verkehrsmittel, Zuhause, Bahnhof, Halt an der Schule. Anschluss und Nur Auto fragen zusätzlich nach der Adresse der Schule, wenn der Halt nicht direkt davor liegt. Wer will, überspringt das und behält den Beispielweg.
5. **Deutschlandticket.** Ja oder nein. Bei Ja sucht FLUR nur Regionalzug, S-Bahn, U-Bahn, Tram und Bus. ICE, IC, EC, Nachtzug und Fernbus fallen weg. Das ist die Produktklasse, keine vollständige Tarifauskunft: einzelne örtliche Ausnahmen kennt FLUR nicht.
6. **Gerät.** Infobildschirm oder Handy und Rechner. Beim Infobildschirm gehen Wechsel und Einbrennschutz an, die Menüpunkte werden etwas größer.

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

Die App spricht nur mit der Schule und mit dem Fahrplandienst. Sie enthält keinen eigenen Account. Die aktuelle Ausgabe ist **1.0.4**: Deutschlandticket in der Einrichtung, nur noch passende Nahverkehrsverbindungen, und antippen öffnet DB Navigator oder die MVG-App. Dazu bleibt, was 1.0.3 schon konnte: Platzoptimierung, der gespeicherte Plan, Glas, Infobildschirm, getrennte Uhren und die Menüleiste.

Oben in der Menüleiste bleibt ein FLUR-Symbol, auch wenn das Fenster zu ist. Daneben stehen die laufende oder nächste Stunde und der nächste Zug, zum Beispiel `Mathe 08:15–09:00 · RB 24 +6`. Ein Klick auf das Symbol zeigt Vertretung oder Entfall und öffnet die Tafel. Beenden geht über dasselbe Menü, nicht über das Schließen des Fensters.

Ein Widget in der Mitteilungszentrale gibt es nicht. Dafür müsste die App auf einem Mac signiert und von Apple notarisiert werden. Das geht aus dieser Ausgabe nicht.

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
| `FLUR_SCHOOL_STOP` | Halt an der Schule, zum Beispiel Bahnhof Traunstein |
| `FLUR_SCHOOL_ADDRESS` | Straße der Schule, nur für Anschluss und Nur Auto |
| `FLUR_MODE` | `link`, `bus`, `bike`, `walk`, `car` oder `drive` |

Zugdaten kommen über [Transitous](https://transitous.org) (Fahrplandaten, unter anderem DB). Der Hinweg sucht die späteste Verbindung, die noch vor der ersten nicht ausgefallenen Stunde ankommt, mit acht Minuten für den Weg vom Halt ins Schulhaus. Der Heimweg rechnet dieselben acht Minuten vom Schulhaus zur Haltestelle und nimmt danach die früheste Zugverbindung. Wege zu Fuß, mit dem Rad und mit dem Auto über den öffentlichen OSRM-Dienst. „Pünktlich“ heißt: keine Ausfallmeldung und höchstens zwei Minuten Abweichung vom Fahrplan.

Wer das Deutschlandticket ankreuzt, lässt FLUR ICE, IC, EC, Nachtzug und Fernbus weg. Gezeigt werden Regionalzug, S-Bahn, U-Bahn, Tram und Bus. Das folgt der Produktklasse, nicht einem Tarifrechner. Jede Zug- und Busfahrt lässt sich antippen. DB Navigator öffnet die Fahrplansuche der Bahn, die MVG-App die aktuelle MVGO-Suche. Beide Links stehen immer da, auch außerhalb von München. Dort ist DB Navigator der sinnvollere. Liegt die App nicht auf dem Gerät, öffnet sich die Webseite. Nur Auto bleibt ungefiltert, weil kein Ticket nötig ist.

**Anschluss** rechnet an beiden Enden Bus, Rad und zu Fuß, nimmt bis zu zwei passende Züge und behält die kürzere Tür-zu-Tür-Zeit, sofern sie noch vor der Stunde ankommt. Liegt eine Schuladresse vor, vergleicht das letzte Stück Bus und Fußweg bis vor die Tür, sonst bleiben es acht Minuten ins Schulhaus. **Nur Auto** fährt von zu Hause direkt zur Schuladresse, ohne Zug. Die Minute ist die Straßenzeit, nicht der Live-Stau. **Bahn+Auto** bleibt der alte Weg: Auto nur bis zum Bahnhof, danach Zug.

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
