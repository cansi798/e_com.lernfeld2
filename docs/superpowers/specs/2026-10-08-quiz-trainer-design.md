# Quiz-Trainer Lernfeld 2 – Design

Stand: 08.10.2026 · Klausur: 12.10.2026

## Ziel

Lernende bereiten sich mit einer gemeinsamen Quiz-Webseite auf die Klausur Lernfeld 2 vor. Die Seite bündelt alle Multiple-Choice-Fragen aus den 18 Tagesquizzen (Tag 1–9, Quiz A/B), läuft auf GitHub Pages (https://cansi798.github.io/e_com.lernfeld2/) und ist für das Smartphone optimiert.

**Erfolgskriterien**

- Alle MC-Fragen der Tagesquizze sind enthalten, ohne Duplikate, jede mit genau einer korrekten Antwort laut Lösungsdatei.
- Übungsmodus mit Listen- und Slide-Ansicht, Filter nach Tag, gemischten Antwortoptionen und sofortigem Feedback.
- Prüfungssimulation: 30 zufällige Fragen, 60 Minuten, Auswertung mit IHK-Note.
- Auf einem 360 px breiten Display ohne horizontales Scrollen bedienbar.

**Nicht enthalten:** offene Fragen, Login, Server, Statistiken über mehrere Sitzungen.

## Architektur

Statische Seite ohne Build-Schritt, ausgeliefert aus `main` / Root:

| Datei | Aufgabe |
|---|---|
| `index.html` | Gerüst, Ansichten (Start, Üben, Prüfung, Ergebnis) |
| `style.css` | Mobile-first-Layout, Hell-/Dunkelmodus über `prefers-color-scheme` |
| `logic.js` | Reine Funktionen (ES-Modul): `shuffle`, `pickRandom`, `filterByTags`, `gradeExam`, `ihkNote`, `dedupe`-Normalisierung |
| `app.js` | UI, Zustand, Timer, localStorage; importiert `logic.js` |
| `questions.json` | Fragendaten |
| `tests/logic.test.mjs` | Tests für `logic.js` mit `node --test` |

Keine externen Abhängigkeiten, keine CDN-Ressourcen.

## Datenextraktion

`tools/extract_quiz.py` liegt **nur lokal** im Unterrichtspaket (nicht im Repo). Das Skript:

1. Liest `Tag_*/Quiz_*.docx` (Frage: `N. Text`, Optionen: `☐  a)  Text`) und die passende `Loesungen_Quiz_*.docx` (`N. x) Text`).
2. Übernimmt nur Fragen mit Optionen (MC); offene Fragen (mit `(n P.)`) entfallen.
3. Bestimmt die richtige Option über den Buchstaben und prüft, ob der Lösungstext mit dem Optionstext übereinstimmt (Abweichung → Fehler mit Datei und Nummer).
4. Entfernt Duplikate über den normalisierten Fragetext plus die sortierten Optionstexte (Kleinschreibung, Leerraum zusammengefasst). Das erste Vorkommen (frühester Tag) bleibt erhalten.
5. Schreibt `questions.json`:

```json
{ "id": "t01a-01", "tag": 1, "thema": "Sortiment im Onlinehandel",
  "frage": "Nischenprodukte", "optionen": ["…", "…", "…", "…"], "richtig": 0 }
```

6. Gibt eine Übersicht aus (MC-Fragen pro Quiz, Duplikate, Gesamtzahl) und bricht bei Fragen ohne genau eine richtige Antwort oder mit weniger als zwei Optionen ab.

`thema` kommt aus der Titelzeile des Quiz (`Quiz A  <Thema>`).

## Übungsmodus

- Filter-Chips „Tag 1“ … „Tag 9“ (Mehrfachauswahl, Standard: alle), jeweils mit Fragenanzahl. Die Themen der Tage stehen als Untertitel dabei.
- Ansicht umschaltbar: **Liste** (alle gefilterten Fragen untereinander) und **Slides** (eine Frage pro Bildschirm, Zurück/Weiter-Buttons am unteren Rand, Wischgesten, Pfeiltasten, Fortschrittsbalken).
- Schalter „Fragen mischen“ (Standard: aus). Die Antwortoptionen werden bei jedem Start eines Durchgangs mit Fisher-Yates gemischt.
- Beim Antippen einer Option wird die Frage gesperrt, die richtige Option grün und eine falsche Wahl rot markiert. Ein Zähler zeigt „richtig / beantwortet“.
- Button „Neu starten“ mischt die Optionen neu und setzt die Antworten zurück.

## Prüfungssimulation

- 30 zufällige Fragen aus allen Tagen (ohne Wiederholung), Optionen gemischt.
- Standardansicht Slides, Liste umschaltbar.
- 60:00-Countdown, oben fixiert. In den letzten 5 Minuten wird er farblich hervorgehoben. Bei 0 wird die Prüfung automatisch abgegeben.
- Kein Feedback während der Prüfung, Antworten sind änderbar. Eine Fragenübersicht (Raster 1–30) zeigt beantwortet/offen und erlaubt Sprünge.
- „Abgeben“ fragt nach, wenn noch Fragen offen sind („Noch 4 Fragen unbeantwortet – trotzdem abgeben?“).
- **Auswertung:** richtige Antworten / 30, Prozent, IHK-Note (≥ 92 % → 1, ≥ 81 % → 2, ≥ 67 % → 3, ≥ 50 % → 4, ≥ 30 % → 5, sonst 6), benötigte Zeit, danach die Liste aller falsch oder nicht beantworteten Fragen mit eigener und richtiger Antwort. Buttons: „Neue Simulation“, „Zur Startseite“.
- **Persistenz:** Eine laufende Prüfung (Fragen-IDs, Optionsreihenfolge, Antworten, Startzeitpunkt) wird in `localStorage` gespeichert. Beim Neuladen wird sie fortgesetzt, wobei die Restzeit aus dem Startzeitpunkt berechnet wird. Ist sie zwischenzeitlich abgelaufen, wird direkt ausgewertet. Alle Zugriffe stehen in `try/catch`; ohne Storage funktioniert die Seite normal, nur ohne Fortsetzen. Zusätzlich wird die zuletzt gewählte Ansicht gespeichert.

## Mobile first und Barrierefreiheit

- Einspaltig, maximal 720 px breit und zentriert, seitlicher Rand 16 px.
- Touch-Ziele mindestens 48 px, Navigation am unteren Rand (Daumenzone).
- Optionen als echte `<button>`-Elemente mit sichtbarem Fokus. Feedback nicht nur über Farbe, sondern zusätzlich mit ✓/✗ und Text.
- Systemschrift, Farben als CSS-Variablen, Hell-/Dunkelmodus.

## Fehlerbehandlung

- Kann `questions.json` nicht geladen werden, erscheint eine Meldung mit „Neu laden“-Button.
- Liefert der Filter keine Fragen, wird der Start-Button deaktiviert und ein Hinweis angezeigt.
- Stimmen gespeicherte Prüfungsdaten nicht mit den aktuellen Fragen-IDs überein, werden sie verworfen.

## Tests und Abnahme

- `node --test tests/` für `shuffle` (Permutation, keine Elemente verloren), `pickRandom` (30 eindeutige Fragen), `filterByTags`, `gradeExam`, `ihkNote` (Grenzwerte 92/81/67/50/30).
- Das Extraktionsskript validiert sich selbst (siehe oben). Zusätzlich werden 10 Fragen stichprobenartig gegen die Lösungs-DOCX geprüft.
- Manuelle Prüfung im Browser bei 375 px und am Desktop: beide Modi, beide Ansichten, Timer, Neuladen während der Prüfung.
- Nach dem Push wird geprüft, ob die Pages-URL die neue Seite ausliefert.

## Veröffentlichung

Commit auf `main` im Repo `cansi798/e_com.lernfeld2` und Push. Pages ist bereits auf `main` / Root konfiguriert. Die `README.md` wird um eine kurze Beschreibung und den Link ergänzt.
