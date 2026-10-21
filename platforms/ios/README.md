# FLUR für iPhone und Apple Watch

Dieser Ordner enthält die native SwiftUI-App für iPhone, iPhone-Widgets, Apple Watch und Watch-Komplikationen. Die native App ist eine optionale Ergänzung zum bestehenden FLUR-Webprojekt. Sie verwendet keine Web-App-Buildschritte und ändert das Web-Frontend nicht.

## Projektaufbau

| Datei / Target | Zweck |
| --- | --- |
| `FLURApp.swift` / `FLUR` | iPhone-App mit den Bereichen Aktuell, Wege und Mehr; WebUntis-Anmeldung, Stundenplan, Countdown und Einstellungen |
| `FLURShared.swift` | Gemeinsame Modelle, Countdown-/Terminlogik, lokaler App-Group-Speicher und Keychain-Hilfen |
| `WatchScheduleSender.swift` | Überträgt den aktuellen Stundenplan über Watch Connectivity vom iPhone an die gekoppelte Watch |
| `FLURWidgets.swift` / `FLURWidget` | iPhone-Home-Screen- und Lock-Screen-Widgets |
| `FLURWatchApp.swift` / `FLURWatch` | Watch-App mit aktuellem Termin und Countdown |
| `FLURWatchWidget.swift` / `FLURWatchWidget` | Watch-Smart-Stack-Widgets und Zifferblatt-Komplikationen |
| `Assets.xcassets` | App- und Watch-App-Icons |
| `FLUR.xcodeproj` | Xcode-Projekt mit vier Targets und dem Schema `FLUR` |

## Verhalten und Datenfluss

- Die App lädt WebUntis-Stundenplandaten direkt vom iPhone. Es gibt keinen FLUR-Backendserver als Vermittler.
- Verbindungen zu WebUntis müssen über HTTPS erfolgen. Verbindungen zu Transitous liefern Fahrplandaten für die Wege.
- Das WebUntis-Passwort wird im iOS-Schlüsselbund gespeichert. Konfiguration und Stundenplan-Snapshot liegen lokal in der gemeinsamen App Group `group.de.linopix.flur`.
- Beim Aktualisieren bzw. geeigneten App-Lebenszyklus-Ereignissen überträgt das iPhone den Stundenplan-Snapshot mit Watch Connectivity zur Watch. Die Watch fragt WebUntis nicht selbst mit den iPhone-Zugangsdaten ab.
- iPhone-Widget und Watch-Widget lesen den lokalen Snapshot. WidgetKit steuert die Aktualisierung der Widgets; ein Widget kann daher nach einer Änderung kurzzeitig noch den vorherigen Snapshot anzeigen. Öffne und aktualisiere die iPhone-App, um den lokalen Stand zu erneuern.
- „Ohne Server“ bedeutet ohne eigenen FLUR-Server. Für Live-Stundenplan und Live-Fahrplandaten werden weiterhin Internetverbindung sowie WebUntis und Transitous benötigt. Bereits synchronisierte Daten können lokal angezeigt werden.

## Voraussetzungen

- Xcode mit iOS- und watchOS-SDK
- iOS 17 oder neuer für die iPhone-App und iPhone-Widgets
- watchOS 10 oder neuer für Watch-App und Watch-Widgets (watchOS 10.6.2 liegt innerhalb dieses Bereichs)
- Apple-ID/Personal Team oder ein Apple-Developer-Team zum Signieren und Installieren
- Ein gekoppeltes, von Xcode erkanntes iPhone; für die echte Watch zusätzlich die passende Kopplung und Watch-Erreichbarkeit

## Öffnen, Signieren und Installieren

1. Öffne `FLUR.xcodeproj` in diesem Ordner und wähle das Schema **FLUR**.
2. Wähle im Signing-Bereich bei allen vier Targets dasselbe Team und aktiviere automatische Signierung.
3. Prüfe, dass die App Group `group.de.linopix.flur` für das Team verfügbar und bei den Targets eingetragen ist. Eine Personal Team-Konfiguration kann die App Group eventuell nicht für alle Targets provisionieren. In diesem Fall die konkrete Signing-Meldung beheben; die App Group nicht durch eine beliebige Gruppe ersetzen, denn iPhone-App, Widget und Watch müssen dieselbe Gruppe verwenden.
4. Wähle das physische iPhone als Run Destination und starte das Schema `FLUR`. Der iPhone-Run baut und signiert die eingebetteten iPhone- und Watch-Komponenten. Ein erfolgreicher Build allein beweist noch nicht, dass die Watch-App auf der Uhr installiert ist.
5. Starte FLUR auf dem iPhone, öffne **Mehr → Daten & Verbindung**, trage WebUntis-Server, Schulkennung, Benutzername und Passwort ein und aktualisiere den Stundenplan. Haltestellen bzw. Wege werden dort ebenfalls konfiguriert.
6. Füge das iPhone-Widget über die Widget-Galerie hinzu. Die Watch-App wird als Companion-App über das gekoppelte iPhone installiert; prüfe den Installationsstatus in der Watch-App auf dem iPhone bzw. in Xcode unter **Window → Devices and Simulators**. Füge Watch-Komplikationen anschließend über die Zifferblatt-Anpassung hinzu.

Zugangsdaten, persönliche Provisioning-Profile und lokale Geräteeinstellungen dürfen nicht committet werden. Automatische Signierung kann Xcode- bzw. Team-spezifische Änderungen im Projekt erzeugen; prüfe `git status` nach einem Geräte-Build und übernimm nur nachvollziehbare, für alle Entwickler benötigte Projektänderungen.

## Build und Prüfung

Im Repository-Root lässt sich das iOS-Projekt mit Xcode bzw. `xcodebuild` bauen. Für einen lokalen, unsignierten Compile-Check kann `CODE_SIGNING_ALLOWED=NO` verwendet werden; dieser Check installiert nichts auf Geräten. Für einen Geräte-Run muss Xcode mit dem eigenen Team signieren.

Empfohlene Reihenfolge:

1. iPhone-App und Widgets im iOS-Simulator auf Layout und Navigation prüfen.
2. Watch-App und Komplikationen in einem passenden Watch-Simulator prüfen.
3. Auf dem physischen iPhone WebUntis-Anmeldung, Aktualisierung und Widget-Snapshot prüfen.
4. Auf der echten gekoppelten Watch die Installation, Snapshot-Übertragung, Countdown und Komplikation prüfen.

Ein iPhone-Simulator wie **iPhone Duo** ist kein Ersatz für das physische iPhone und sagt nichts über die Installation auf einer echten Watch aus. Für die Watch-Abnahme wird ein Watch-Simulator oder eine gekoppelte echte Watch benötigt.

## Bekannter Stand dieser Änderung

- Das Xcode-Projekt enthält die vier Targets `FLUR`, `FLURWidget`, `FLURWatch` und `FLURWatchWidget`.
- Der zuletzt in Xcode ausgeführte Build des Schemas `FLUR` endete mit **Build Succeeded** für das ausgewählte physische iPhone. Xcode zeigte danach **Configuring Debugger Actions / Waiting to attach**. Der Build-Erfolg allein ist kein separater Nachweis, dass die App auf dem iPhone sichtbar gestartet oder die Watch-App auf die Uhr übertragen wurde.
- Xcode meldete Warnungen, dass `CFBundleVersion` und `CFBundleShortVersionString` der Watch-App-Erweiterung nicht mit den Werten der Eltern-App übereinstimmen, weil bei den generierten Eltern-Info.plists `(null)` angezeigt wurde. Das sollte vor einer stabilen Release-/Distributionskonfiguration bereinigt werden; es waren Build-Warnungen, keine Build-Fehler.
- Die Watch wurde in der Xcode-Run-Destination-Liste nicht als eigenständiges Ziel angezeigt. Die Installation und Darstellung auf der echten Watch ist daher noch **nicht verifiziert**.
- Die erfolgreiche Build-Beobachtung gehört zu einer lokalen Xcode-Konfiguration. Bitte auf einem frischen Checkout die vier Targets und Signing-Einstellungen prüfen, bevor daraus eine erfolgreiche Installation abgeleitet wird.

## GitHub und Schutz der Web-Version

Der iOS-Code bleibt unter `platforms/ios/`, damit Web- und iOS-Änderungen im selben Repository klar getrennt reviewbar sind. Änderungen werden auf einem eigenen Feature-Branch und über einen Pull Request eingebracht. Die Web-App wird dadurch nicht automatisch verändert oder veröffentlicht; Web-Dateien und bestehende Web-Buildschritte sollten in einem iOS-Pull-Request unangetastet bleiben.

Für Review und Merge:

1. Nur iOS-Code, iOS-Assets und diese iOS-Dokumentation in den iOS-PR aufnehmen.
2. Den Xcode-Build auf einem frischen Checkout nachvollziehen und tatsächliche Geräteinstallation separat dokumentieren.
3. Signing- und Bundle-Version-Warnungen klären.
4. Den PR nach Review in den gewünschten Standardbranch mergen. Ein Merge speichert den iOS-Code im Repository; er installiert oder veröffentlicht die App nicht im App Store.
