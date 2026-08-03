GETRÄNKEKASSE 4.0.1 – DARSTELLUNGS- UND DATENSCHUTZFIX

Behobene Fehler
- Login- und Mitgliederbereich wurden gleichzeitig angezeigt.
- Der Buchungsbereich rutschte dadurch in eine schmale linke Spalte.
- Nach der Abmeldung blieben Name, Mitglieder-ID und Monatsbetrag sichtbar.

Technische Korrekturen
- Das HTML-Attribut hidden wird nun immer mit display:none umgesetzt.
- Login- und Mitgliederbereich verwenden denselben festen Grid-Bereich.
- Der Buchungsbereich besitzt einen festen, vollständigen Inhaltsbereich.
- Bei Abmeldung werden alle personenbezogenen Felder, Buchungen und Summen geleert.
- Auch beim erneuten Laden startet die Anwendung garantiert im neutralen Abmeldezustand.
- Offline-Cache auf Version v7 erhöht.

Update über GitHub Pages
1. ZIP-Datei entpacken.
2. Alle Dateien im bestehenden Repository ersetzen.
3. Commit changes ausführen.
4. Warten, bis GitHub Pages aktualisiert wurde.
5. Auf dem iPad die Adresse einmal online in Safari öffnen und neu laden.
6. Falls die alte Darstellung bleibt:
   - App vom Home-Bildschirm entfernen.
   - Safari öffnen und die Seite neu laden.
   - Erneut „Zum Home-Bildschirm“ hinzufügen.

Bestehende lokale Daten bleiben erhalten, solange die Websitedaten nicht gelöscht werden.
