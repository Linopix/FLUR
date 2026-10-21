# FLUR für iPhone und Apple Watch

Dieser Ordner enthält die native SwiftUI-App, ein Widget für iPhone und WatchKit-App samt Zifferblatt-/Smart-Stack-Widget. Die bestehende Web-App, ihre Abhängigkeiten und ihre Startbefehle bleiben außerhalb dieses Ordners und werden von dieser App nicht verändert.

## Funktionen

- **Aktuell:** laufende Stunde mit verbleibender Zeit, nächste Stunde oder Aufbruch zur passenden Verbindung; nach dem Unterricht Heimfahrt und Abfahrt.
- **Wege:** Hin- und Heimweg gemeinsam in einem Bereich.
- **Mehr:** Stundenplan, Mitteilungen und Daten & Verbindung.
- **iPhone-Widget:** kleine und mittlere Home-Screen-Kachel sowie rechteckige und Inline-Lock-Screen-Widgets.
- **Apple Watch:** kompakter Stunden-/Countdown-Bildschirm mit einzeiligem FLUR-Namen sowie rechteckige, Inline- und runde Komplikationen.
- **Ohne FLUR-Server:** WebUntis- und Transitous-Daten werden direkt abgerufen. Das Passwort bleibt im iOS-Schlüsselbund; der Stundenplan liegt lokal in einer App Group und wird mit Watch Connectivity zur Uhr übertragen.
- Der Watch-Datentransfer ist bewusst nur Teil des iPhone-App-Targets. Das iPhone-Widget verwendet dieselben gemeinsamen Daten, bindet aber `WatchConnectivity` nicht ein.
- Das iPhone-Widget ist in Xcode explizit auf `iphoneos` und `iphonesimulator` beschränkt, damit macOS keine iPhone-spezifischen Widget-Familien baut.

Die Widget-Uhr zählt dynamisch herunter. WidgetKit bestimmt selbst, wann es den angezeigten Stundenplan erneut lädt; Änderungen in WebUntis erscheinen daher nach dem nächsten App-Abruf und der nächsten Widget-Aktualisierung.

## Voraussetzungen und Xcode

- Xcode mit iOS-SDK und watchOS-SDK
- iOS 17 oder neuer
- watchOS 10 oder neuer (damit läuft die Watch-App auch unter watchOS 10.6.2)
- Apple-Signing-Team für die Installation auf eigenen Geräten

1. `FLUR.xcodeproj` in diesem Ordner öffnen und das Schema **FLUR** wählen.
2. Für die iPhone-App sowie die Widget- und Watch-Ziele dasselbe Signing-Team auswählen.
3. Die App Group `group.de.linopix.flur` muss für dieses Team verfügbar sein und bei App, iPhone-Widget, Watch-App und Watch-Widget aktiviert sein. Falls das Team diese Gruppe noch nicht kennt, muss sie einmalig im Apple Developer Portal registriert werden.
4. Die App auf dem physischen iPhone starten, in **Daten** WebUntis und Haltestellen einrichten und einmal aktualisieren. Xcode bettet die iPhone- und Watch-Erweiterungen in die App ein.
5. Das iPhone-Widget über die Widget-Galerie zum Home-Bildschirm oder Sperrbildschirm hinzufügen. Die Watch-App wird über das gekoppelte iPhone installiert; Komplikationen lassen sich anschließend über die Zifferblatt-Anpassung hinzufügen.

Die nativen Ziele sind unter `platforms/ios/` gebündelt. Sie verwenden keine Dateien, Skripte oder Build-Schritte aus der Web-App.

## Testempfehlung

Für die Entwicklung zuerst den **Apple-Watch-Simulator** verwenden: Er lässt sich schnell starten und erlaubt Layout- und Widget-Prüfungen, ohne die gekoppelte Uhr für jeden Build zu benötigen. Danach auf der echten Uhr eine kurze Abnahme machen, weil Kopplung, Datenübergabe, Widget-Refresh und Zifferblatt-Komplikationen dort maßgeblich sind. Die iPhone-App und ihre Widgets sollten auf dem physischen iPhone geprüft werden.

In der aktuellen Xcode-Sitzung ist ein iPhone 15 und der iPhone-Duo-Simulator sichtbar, aber keine Apple Watch. Außerdem meldet Xcode derzeit keine verfügbaren Simulator-Runtimes. Der native Build wurde erfolgreich für iOS und watchOS kompiliert; Installation auf der Uhr und sichtbare Widget-Darstellung müssen noch mit einer verfügbaren Watch bzw. einem eingerichteten Watch-Simulator abgenommen werden.

## GitHub-Ablage

Diese App ist bewusst als eigener Ordner `platforms/ios/` innerhalb von FLUR abgelegt. Sie kann über einen Branch und Pull Request eingebracht werden, der ausschließlich diesen Ordner enthält. Damit bleiben Web-App-Dateien, die Web-README und deren Build unverändert. Erst nach Review wird der Pull Request in den Standardbranch übernommen.
