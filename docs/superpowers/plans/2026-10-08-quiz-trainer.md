# Quiz-Trainer Lernfeld 2 – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine statische, mobilfreundliche Quiz-Webseite auf GitHub Pages, die alle MC-Fragen der 18 Tagesquizze bündelt, mit Übungsmodus (Liste/Slides, Filter, sofortiges Feedback) und Prüfungssimulation (30 Fragen, 60 Minuten, IHK-Note).

**Architecture:** Ein lokales Python-Skript extrahiert die Fragen einmalig aus den DOCX-Dateien in `questions.json`. Die Seite besteht aus `index.html`, `style.css`, `logic.js` (reine, getestete Funktionen) und `app.js` (UI, Timer, localStorage). Es gibt keinen Build-Schritt; GitHub Pages liefert `main` / Root direkt aus.

**Tech Stack:** Python 3.12 + python-docx + pytest (nur lokal), Vanilla JavaScript (ES-Module), CSS, `node --test` (Node 24), git + gh.

**Spec:** `docs/superpowers/specs/2026-10-08-quiz-trainer-design.md`

**Pfade:**
- `PAKET` = `C:/Users/cansi/OneDrive/PC/Desktop/Lernfeld2_Unterrichtspaket_3877` (Unterrichtspaket, kein git)
- `REPO` = `PAKET/e_com.lernfeld2` (Klon von `cansi798/e_com.lernfeld2`, Branch `main`)

## Global Constraints

- Nur Multiple-Choice-Fragen; offene Fragen (`(n P.)`) werden nicht übernommen.
- Prüfung: 30 zufällige Fragen ohne Wiederholung, 60:00 Minuten, Auto-Abgabe bei 0, kein Feedback während der Prüfung.
- IHK-Notenschlüssel: ≥ 92 % → 1, ≥ 81 % → 2, ≥ 67 % → 3, ≥ 50 % → 4, ≥ 30 % → 5, sonst 6.
- Antwortoptionen werden bei jedem Durchgang mit Fisher-Yates gemischt.
- Keine externen Abhängigkeiten oder CDN-Ressourcen auf der Seite.
- Touch-Ziele mindestens 48 px, kein horizontales Scrollen bei 360 px, maximal 720 px breit, Seitenrand 16 px.
- Alle `localStorage`-Zugriffe in `try/catch`.
- Inhalte aus `questions.json` nur über `textContent` ins DOM, niemals über `innerHTML`.
- Extraktionsskript und DOCX-Dateien kommen **nicht** ins Repo.
- UI-Texte auf Deutsch mit korrekten Umlauten.

## Review Focus

1. **Neuladen nach Ablauf der Prüfungszeit:** Die gespeicherte Prüfung wird sofort ausgewertet, nicht mit 60:00 neu gestartet → Test für `remainingSeconds` (Task 2).
2. **Gespeicherte Prüfung passt nicht mehr zu `questions.json`** (IDs fehlen, Optionsanzahl anders, kaputte Daten): Sie wird verworfen statt abzustürzen → Tests für `validateSavedExam` (Task 2).
3. **Fragetexte mit `<`, `>` oder `&`** (z. B. „< 5 %“) werden wörtlich angezeigt → Test, dass `app.js` kein `innerHTML` verwendet (Task 2/3).
4. **Kein Tag im Filter ausgewählt:** keine Fragen, Start-Button deaktiviert → Test für `filterByTags([])` (Task 2).
5. **Dieselbe Frage taucht in zwei Quizzen mit unterschiedlicher Lösung auf:** Die Extraktion bricht mit Fehler ab, statt still eine Variante zu nehmen → pytest (Task 1).

---

### Task 1: Fragen-Extraktion und `questions.json`

**Files:**
- Create: `PAKET/tools/extract_quiz.py`
- Test: `PAKET/tools/test_extract_quiz.py`
- Create (generiert): `REPO/questions.json`

**Interfaces:**
- Produces: `questions.json` = Array von `{ "id": str, "tag": int, "thema": str, "frage": str, "optionen": [str, …], "richtig": int }`. Die `id` hat das Format `t{tag:02d}{a|b}-{nr:02d}`, z. B. `t01a-01`.

- [ ] **Step 1: Failing Tests schreiben** – `PAKET/tools/test_extract_quiz.py`

```python
import pytest
from extract_quiz import parse_quiz, parse_solutions, build

QUIZ = [
    "Tag 01  Mo 14.09.2026",
    "Quiz A  Sortiment im Onlinehandel",
    "Mo 14.09.2026  |  Lernfeld 2",
    "",
    "1. Nischenprodukte",
    "☐  a)  decken nur einen kleinen Teil ab",
    "☐  b)  werden in Massen produziert",
    "☐  c)  sind unwirtschaftlich",
    "☐  d)  gehören zum Kernsortiment",
    "2. Die Rennerliste enthält",
    "☐  a)  Artikel, die gut verkauft wurden",
    "☐  b)  Artikel, die schlecht verkauft wurden",
    "☐  c)  Artikel  ohne Bestand",
    "☐  d)  neue Lieferanten",
    "3. Nennen Sie vier Bestimmungsgrößen.   (4 P.)",
    " ",
]
LOESUNG = [
    "Tag 01  Mo 14.09.2026",
    "Lösungen Quiz A  Sortiment im Onlinehandel",
    "Lösungsschlüssel. Gesamtpunktzahl 86.",
    "1. a) decken nur einen kleinen Teil ab",
    "2. a) Artikel, die gut verkauft wurden",
    "3. Mögliche Antworten: Kunden, Konkurrenz",
]


def src(name="Tag_01/Quiz_A.docx", tag=1, quiz=QUIZ, loesung=LOESUNG):
    return {"name": name, "tag": tag, "quiz": quiz, "loesung": loesung}


def test_parse_quiz_liest_titel_und_nur_mc_fragen():
    letter, thema, qs = parse_quiz(QUIZ)
    assert letter == "A"
    assert thema == "Sortiment im Onlinehandel"
    assert [q["nr"] for q in qs] == [1, 2]
    assert qs[0]["frage"] == "Nischenprodukte"
    assert qs[1]["optionen"][2] == "Artikel ohne Bestand"  # Leerraum zusammengefasst


def test_parse_quiz_ohne_titel_wirft_fehler():
    with pytest.raises(ValueError, match="Titelzeile"):
        parse_quiz(["1. Frage", "☐  a)  x"])


def test_parse_solutions():
    sols = parse_solutions(LOESUNG)
    assert sols[1] == ("a", "decken nur einen kleinen Teil ab")
    assert 3 not in sols


def test_build_erzeugt_ids_und_richtig_index():
    qs, report = build([src()])
    assert [q["id"] for q in qs] == ["t01a-01", "t01a-02"]
    assert qs[0]["richtig"] == 0
    assert qs[0]["tag"] == 1 and qs[0]["thema"] == "Sortiment im Onlinehandel"
    assert report == [("Tag_01/Quiz_A.docx", 2, 0)]


def test_build_lösung_passt_nicht_zur_option():
    bad = LOESUNG[:3] + ["1. b) decken nur einen kleinen Teil ab"] + LOESUNG[4:]
    with pytest.raises(ValueError, match="passt nicht"):
        build([src(loesung=bad)])


def test_build_fehlende_lösung():
    with pytest.raises(ValueError, match="keine Lösung"):
        build([src(loesung=LOESUNG[:3])])


def test_build_entfernt_duplikate_auch_bei_anderer_optionsreihenfolge():
    quiz2 = ["Tag 02", "Quiz A  Impressum", "",
             "1. Nischenprodukte",
             "☐  a)  gehören zum Kernsortiment",
             "☐  b)  decken nur einen kleinen Teil ab",
             "☐  c)  werden in Massen produziert",
             "☐  d)  sind unwirtschaftlich"]
    loes2 = ["Tag 02", "Lösungen Quiz A  Impressum", "1. b) decken nur einen kleinen Teil ab"]
    qs, report = build([src(), src("Tag_02/Quiz_A.docx", 2, quiz2, loes2)])
    assert len(qs) == 2
    assert report[1] == ("Tag_02/Quiz_A.docx", 1, 1)


def test_build_widersprüchliches_duplikat_wirft_fehler():
    quiz2 = ["Tag 02", "Quiz A  Impressum", "",
             "1. Nischenprodukte",
             "☐  a)  decken nur einen kleinen Teil ab",
             "☐  b)  werden in Massen produziert",
             "☐  c)  sind unwirtschaftlich",
             "☐  d)  gehören zum Kernsortiment"]
    loes2 = ["Tag 02", "Lösungen Quiz A  Impressum", "1. d) gehören zum Kernsortiment"]
    with pytest.raises(ValueError, match="widerspricht"):
        build([src(), src("Tag_02/Quiz_A.docx", 2, quiz2, loes2)])
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd PAKET && python -m pytest tools -q`
Expected: FAIL mit `ModuleNotFoundError: No module named 'extract_quiz'`

- [ ] **Step 3: Implementierung** – `PAKET/tools/extract_quiz.py`

```python
"""Extrahiert die Multiple-Choice-Fragen aller Tagesquizze in questions.json."""
import json
import re
import sys
import unicodedata
from pathlib import Path

import docx

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "e_com.lernfeld2" / "questions.json"
LETTERS = "abcde"

Q_RE = re.compile(r"^(\d+)\.\s+(.*\S)\s*$")
OPT_RE = re.compile(r"^☐\s+([a-e])\)\s*(.*?)\s*$")
SOL_RE = re.compile(r"^(\d+)\.\s+([a-e])\)\s+(.*?)\s*$")
TITLE_RE = re.compile(r"^(?:Lösungen\s+)?Quiz\s+([AB])\s+(.*\S)\s*$")
DAY_RE = re.compile(r"^Tag_(\d+)_")


def clean(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip()


def norm(text):
    return clean(text).casefold()


def parse_quiz(paragraphs):
    """Liefert (Buchstabe, Thema, Fragen) – nur Fragen mit Antwortoptionen."""
    letter = thema = None
    for p in paragraphs[:4]:
        m = TITLE_RE.match(p.strip())
        if m:
            letter, thema = m.group(1), clean(m.group(2))
            break
    if letter is None:
        raise ValueError("Titelzeile 'Quiz A/B …' nicht gefunden")
    questions, current = [], None
    for p in paragraphs:
        t = p.strip()
        m = OPT_RE.match(t)
        if m and current is not None:
            expected = LETTERS[len(current["optionen"])]
            if m.group(1) != expected:
                raise ValueError(f"Frage {current['nr']}: Option {m.group(1)}) statt {expected})")
            current["optionen"].append(clean(m.group(2)))
            continue
        m = Q_RE.match(t)
        if m:
            current = {"nr": int(m.group(1)), "frage": clean(m.group(2)), "optionen": []}
            questions.append(current)
    return letter, thema, [q for q in questions if q["optionen"]]


def parse_solutions(paragraphs):
    sols = {}
    for p in paragraphs:
        m = SOL_RE.match(p.strip())
        if m:
            sols[int(m.group(1))] = (m.group(2), clean(m.group(3)))
    return sols


def build(sources):
    seen, out, report = {}, [], []
    for src in sources:
        letter, thema, qs = parse_quiz(src["quiz"])
        sols = parse_solutions(src["loesung"])
        dup = 0
        for q in qs:
            where = f"{src['name']} Frage {q['nr']}"
            if len(q["optionen"]) < 2:
                raise ValueError(f"{where}: weniger als zwei Optionen")
            if any(not o for o in q["optionen"]):
                raise ValueError(f"{where}: leere Option")
            if q["nr"] not in sols:
                raise ValueError(f"{where}: keine Lösung gefunden")
            sol_letter, sol_text = sols[q["nr"]]
            idx = LETTERS.index(sol_letter)
            if idx >= len(q["optionen"]) or norm(q["optionen"][idx]) != norm(sol_text):
                given = q["optionen"][idx] if idx < len(q["optionen"]) else "—"
                raise ValueError(f"{where}: Lösung '{sol_text}' passt nicht zu Option {sol_letter}) '{given}'")
            key = norm(q["frage"]) + "||" + "|".join(sorted(norm(o) for o in q["optionen"]))
            if key in seen:
                first = seen[key]
                if norm(first["optionen"][first["richtig"]]) != norm(q["optionen"][idx]):
                    raise ValueError(f"{where}: widerspricht {first['id']}")
                dup += 1
                continue
            item = {
                "id": f"t{src['tag']:02d}{letter.lower()}-{q['nr']:02d}",
                "tag": src["tag"],
                "thema": thema,
                "frage": q["frage"],
                "optionen": q["optionen"],
                "richtig": idx,
            }
            seen[key] = item
            out.append(item)
        report.append((src["name"], len(qs), dup))
    return out, report


def load(path):
    return [p.text for p in docx.Document(path).paragraphs]


def collect_sources(root):
    sources = []
    for day_dir in sorted(root.glob("Tag_*")):
        tag = int(DAY_RE.match(day_dir.name).group(1))
        for quiz in sorted(day_dir.glob("Quiz_*.docx")):
            loesung = day_dir / ("Loesungen_" + quiz.name)
            if not loesung.exists():
                raise FileNotFoundError(loesung)
            sources.append({"name": f"{day_dir.name}/{quiz.name}", "tag": tag,
                            "quiz": load(quiz), "loesung": load(loesung)})
    return sources


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    questions, report = build(collect_sources(ROOT))
    for name, n, dup in report:
        print(f"{name}: {n} MC, {dup} Duplikate")
    print(f"Gesamt: {len(questions)} eindeutige Fragen")
    OUT.write_text(json.dumps(questions, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"geschrieben: {OUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Tests laufen lassen**

Run: `cd PAKET && python -m pytest tools -q`
Expected: `8 passed`

- [ ] **Step 5: Extraktion ausführen**

Run: `cd PAKET && python tools/extract_quiz.py`
Expected: 18 Zeilen „… MC, … Duplikate“ (vorher gezählt: 602 MC-Fragen insgesamt), eine Zeile „Gesamt: N eindeutige Fragen“ und „geschrieben: …questions.json“. Bricht das Skript mit „passt nicht“ ab, die genannte Stelle in beiden DOCX ansehen. Bei einem echten Fehler im Material den Benutzer informieren. Ist es nur ein Formatunterschied (z. B. Anführungszeichen), `norm` gezielt erweitern und dazu einen Test ergänzen.

- [ ] **Step 6: Stichprobe gegen die Lösungsdateien**

Run:
```bash
cd PAKET && PYTHONIOENCODING=utf-8 python -c "import json,random;qs=json.load(open('e_com.lernfeld2/questions.json',encoding='utf-8'));random.seed(7);[print(q['id'],'|',q['frage'][:60],'->',q['optionen'][q['richtig']][:60]) for q in random.sample(qs,10)]"
```
Expected: Für jede der 10 Zeilen in der passenden `Loesungen_Quiz_*.docx` nachsehen, ob die angezeigte Antwort die richtige ist. Alle 10 müssen stimmen.

- [ ] **Step 7: Commit (nur `questions.json`)**

```bash
cd REPO && git add questions.json && git commit -m "Fragen aus allen Tagesquizzen extrahiert"
```

---

### Task 2: Logikmodul `logic.js` mit Tests

**Files:**
- Create: `REPO/logic.js`
- Test: `REPO/tests/logic.test.mjs`
- Create: `REPO/package.json` (nur `"type": "module"` und Testskript)

**Interfaces:**
- Consumes: Frageobjekte aus Task 1.
- Produces (alle `export` aus `logic.js`):
  - `shuffle(items: T[], rng?: () => number): T[]` – neue Liste, Fisher-Yates
  - `pickRandom(items: T[], n: number, rng?): T[]` – n eindeutige Elemente (höchstens `items.length`)
  - `filterByTags(questions, tags: number[]): Frage[]`
  - `shuffledOrder(n: number, rng?): number[]` – Permutation von `0..n-1`
  - `applyOrder(q, order: number[]): PrepFrage` – `{...q, order, optionen (umsortiert), richtig (neuer Index)}`
  - `ihkNote(prozent: number): 1|2|3|4|5|6`
  - `noteText(note: number): string`
  - `gradeExam(items: PrepFrage[], answers: (number|null)[]): { richtig, gesamt, prozent, note, falsch: [{ index, tag, frage, gewaehlt: string|null, korrekt: string }] }`
  - `remainingSeconds(startMs: number, nowMs: number, durationSec: number): number` – zwischen 0 und `durationSec`
  - `formatTime(sec: number): string` – `"MM:SS"`
  - `validateSavedExam(saved, byId: Map<string, Frage>, size: number): boolean`

- [ ] **Step 1: `package.json` anlegen**

```json
{
  "name": "e_com.lernfeld2",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

- [ ] **Step 2: Failing Tests schreiben** – `REPO/tests/logic.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  shuffle, pickRandom, filterByTags, shuffledOrder, applyOrder, ihkNote, noteText,
  gradeExam, remainingSeconds, formatTime, validateSavedExam,
} from '../logic.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const Q = (id, tag, richtig = 0) => ({ id, tag, thema: 'T', frage: `F ${id}`, optionen: ['a', 'b', 'c', 'd'], richtig });

test('shuffle liefert eine Permutation und verändert das Original nicht', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(src, seeded(1));
  assert.deepEqual([...out].sort((a, b) => a - b), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notDeepEqual(out, src);
});

test('pickRandom liefert n eindeutige Elemente', () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const out = pickRandom(items, 30, seeded(2));
  assert.equal(out.length, 30);
  assert.equal(new Set(out).size, 30);
  assert.equal(pickRandom([1, 2], 30).length, 2);
});

test('filterByTags', () => {
  const qs = [Q('a', 1), Q('b', 2), Q('c', 3)];
  assert.deepEqual(filterByTags(qs, [1, 3]).map((q) => q.id), ['a', 'c']);
  assert.deepEqual(filterByTags(qs, []), []);
});

test('applyOrder sortiert Optionen um und verschiebt den richtigen Index mit', () => {
  const q = { ...Q('x', 1, 2), optionen: ['A', 'B', 'C', 'D'] };
  const p = applyOrder(q, [2, 0, 3, 1]);
  assert.deepEqual(p.optionen, ['C', 'A', 'D', 'B']);
  assert.equal(p.richtig, 0);
  assert.deepEqual(p.order, [2, 0, 3, 1]);
  assert.deepEqual(q.optionen, ['A', 'B', 'C', 'D']);
  assert.deepEqual([...shuffledOrder(4, seeded(3))].sort(), [0, 1, 2, 3]);
});

test('ihkNote an den Grenzwerten', () => {
  const cases = [[100, 1], [92, 1], [91.99, 2], [81, 2], [80.99, 3], [67, 3], [66.99, 4],
    [50, 4], [49.99, 5], [30, 5], [29.99, 6], [0, 6]];
  for (const [p, n] of cases) assert.equal(ihkNote(p), n, `${p} %`);
  assert.equal(noteText(1), 'sehr gut');
  assert.equal(noteText(6), 'ungenügend');
});

test('gradeExam zählt richtige und listet falsche und offene Antworten', () => {
  const items = [Q('a', 1, 0), Q('b', 2, 1), Q('c', 3, 2)];
  const r = gradeExam(items, [0, 3, null]);
  assert.equal(r.richtig, 1);
  assert.equal(r.gesamt, 3);
  assert.ok(Math.abs(r.prozent - 33.333) < 0.01);
  assert.equal(r.note, 5);
  assert.deepEqual(r.falsch, [
    { index: 1, tag: 2, frage: 'F b', gewaehlt: 'd', korrekt: 'b' },
    { index: 2, tag: 3, frage: 'F c', gewaehlt: null, korrekt: 'c' },
  ]);
});

test('remainingSeconds und formatTime', () => {
  const start = 1_000_000;
  assert.equal(remainingSeconds(start, start, 3600), 3600);
  assert.equal(remainingSeconds(start, start + 61_500, 3600), 3539);
  assert.equal(remainingSeconds(start, start + 7_200_000, 3600), 0); // Zeit abgelaufen → 0
  assert.equal(remainingSeconds(start, start - 5_000, 3600), 3600); // Uhr zurückgestellt
  assert.equal(formatTime(3600), '60:00');
  assert.equal(formatTime(299), '04:59');
  assert.equal(formatTime(0), '00:00');
});

test('validateSavedExam akzeptiert gültige und verwirft kaputte Daten', () => {
  const byId = new Map([Q('a', 1), Q('b', 2)].map((q) => [q.id, q]));
  const ok = { ids: ['a', 'b'], orders: [[0, 1, 2, 3], [3, 2, 1, 0]], answers: [null, 2], startedAt: 5, view: 'slides' };
  assert.equal(validateSavedExam(ok, byId, 2), true);
  assert.equal(validateSavedExam(null, byId, 2), false);
  assert.equal(validateSavedExam({ ...ok, ids: ['a', 'zzz'] }, byId, 2), false);
  assert.equal(validateSavedExam({ ...ok, orders: [[0, 1, 2], [0, 1, 2, 3]] }, byId, 2), false);
  assert.equal(validateSavedExam({ ...ok, orders: [[0, 0, 2, 3], [0, 1, 2, 3]] }, byId, 2), false);
  assert.equal(validateSavedExam({ ...ok, answers: [7, null] }, byId, 2), false);
  assert.equal(validateSavedExam({ ...ok, startedAt: 'x' }, byId, 2), false);
  assert.equal(validateSavedExam(ok, byId, 30), false);
});

test('app.js setzt keine Inhalte per innerHTML', { skip: !existsSync(new URL('../app.js', import.meta.url)) }, () => {
  const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML/.test(src), false);
});
```

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd REPO && node --test tests/`
Expected: FAIL mit `Cannot find module …/logic.js`

- [ ] **Step 4: Implementierung** – `REPO/logic.js`

```js
// Reine Funktionen ohne DOM – getestet mit node --test.

export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(items, n, rng = Math.random) {
  return shuffle(items, rng).slice(0, Math.min(n, items.length));
}

export function filterByTags(questions, tags) {
  const set = new Set(tags);
  return questions.filter((q) => set.has(q.tag));
}

export function shuffledOrder(n, rng = Math.random) {
  return shuffle([...Array(n).keys()], rng);
}

export function applyOrder(q, order) {
  return {
    ...q,
    order: order.slice(),
    optionen: order.map((i) => q.optionen[i]),
    richtig: order.indexOf(q.richtig),
  };
}

export function ihkNote(prozent) {
  if (prozent >= 92) return 1;
  if (prozent >= 81) return 2;
  if (prozent >= 67) return 3;
  if (prozent >= 50) return 4;
  if (prozent >= 30) return 5;
  return 6;
}

const NOTEN = ['', 'sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];
export function noteText(note) {
  return NOTEN[note] ?? '';
}

export function gradeExam(items, answers) {
  const falsch = [];
  let richtig = 0;
  items.forEach((q, i) => {
    const a = answers[i] ?? null;
    if (a === q.richtig) { richtig++; return; }
    falsch.push({
      index: i,
      tag: q.tag,
      frage: q.frage,
      gewaehlt: a === null ? null : q.optionen[a],
      korrekt: q.optionen[q.richtig],
    });
  });
  const gesamt = items.length;
  const prozent = gesamt ? (richtig * 100) / gesamt : 0;
  return { richtig, gesamt, prozent, note: ihkNote(prozent), falsch };
}

export function remainingSeconds(startMs, nowMs, durationSec) {
  const elapsed = Math.floor((nowMs - startMs) / 1000);
  return Math.min(durationSec, Math.max(0, durationSec - elapsed));
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isPermutation(order, n) {
  if (!Array.isArray(order) || order.length !== n) return false;
  return [...order].sort((a, b) => a - b).every((v, k) => v === k);
}

export function validateSavedExam(saved, byId, size) {
  if (!saved || !Array.isArray(saved.ids) || !Array.isArray(saved.orders) || !Array.isArray(saved.answers)) return false;
  if (saved.ids.length !== size || saved.orders.length !== size || saved.answers.length !== size) return false;
  if (!Number.isFinite(saved.startedAt)) return false;
  return saved.ids.every((id, i) => {
    const q = byId.get(id);
    if (!q || !isPermutation(saved.orders[i], q.optionen.length)) return false;
    const a = saved.answers[i];
    return a === null || (Number.isInteger(a) && a >= 0 && a < q.optionen.length);
  });
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `cd REPO && node --test tests/`
Expected: alle Tests PASS, der `innerHTML`-Test als `skipped` (es gibt noch kein `app.js`).

- [ ] **Step 6: Commit**

```bash
cd REPO && git add logic.js tests/logic.test.mjs package.json && git commit -m "Logikmodul mit Tests"
```

---

### Task 3: Oberfläche – Start, Übungsmodus, Prüfungssimulation, Ergebnis

**Files:**
- Create: `REPO/index.html`, `REPO/style.css`, `REPO/app.js`

**Interfaces:**
- Consumes: alle Exporte aus `logic.js` (Task 2) und `questions.json` (Task 1).
- Produces: die fertige Seite. `localStorage`-Schlüssel: `lf2-exam` = `{ ids, orders, answers, startedAt, view }`, `lf2-view` = `"slides" | "list"`.

- [ ] **Step 1: `REPO/index.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Quiz-Trainer Lernfeld 2</title>
  <meta name="description" content="Übungsquiz und Prüfungssimulation zu Lernfeld 2: Sortimente im Onlinevertrieb gestalten und die Beschaffung unterstützen.">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>">
  <link rel="stylesheet" href="style.css">
  <script type="module" src="app.js"></script>
</head>
<body>
  <header class="topbar">
    <button id="homeBtn" class="ghost" type="button" hidden>← Start</button>
    <span class="brand">Lernfeld 2</span>
    <span id="timer" class="timer" role="timer" hidden>60:00</span>
  </header>
  <main>
    <section id="view-loading"><p class="hint">Fragen werden geladen …</p></section>

    <section id="view-error" hidden>
      <h1>Fragen nicht geladen</h1>
      <p>Die Fragen konnten nicht geladen werden. Prüfe die Internetverbindung.</p>
      <button id="reloadBtn" class="primary" type="button">Neu laden</button>
    </section>

    <section id="view-start" hidden>
      <h1>Quiz-Trainer</h1>
      <p class="lead">Sortimente im Onlinevertrieb gestalten und die Beschaffung unterstützen · <span id="totalCount">0</span> Fragen aus 9 Unterrichtstagen</p>
      <button id="startPractice" class="tile" type="button"><strong>Üben</strong><span>Tage auswählen und sofort sehen, ob es stimmt</span></button>
      <button id="startExam" class="tile accent" type="button"><strong>Prüfungssimulation</strong><span>30 zufällige Fragen · 60 Minuten · Note am Ende</span></button>
    </section>

    <section id="view-setup" hidden>
      <h1>Üben</h1>
      <div class="row">
        <button id="allTags" class="ghost" type="button">Alle</button>
        <button id="noTags" class="ghost" type="button">Keine</button>
      </div>
      <div id="tagChips" class="chips"></div>
      <label class="switch"><input id="shuffleQuestions" type="checkbox"> Fragen mischen</label>
      <p id="setupCount" class="hint" aria-live="polite"></p>
      <button id="startPracticeRun" class="primary block" type="button">Los geht's</button>
    </section>

    <section id="view-quiz" hidden>
      <div class="quizbar">
        <h1 id="quizTitle">Üben</h1>
        <div class="segmented" role="group" aria-label="Ansicht">
          <button id="viewSlides" type="button" aria-pressed="true">Slides</button>
          <button id="viewList" type="button" aria-pressed="false">Liste</button>
        </div>
      </div>
      <p id="status" class="hint" aria-live="polite"></p>
      <details id="examGridWrap" class="gridwrap"><summary>Fragenübersicht</summary><div id="examGrid" class="grid"></div></details>
      <div id="questions"></div>
      <div class="actions">
        <button id="restartBtn" class="ghost block" type="button">Neu starten</button>
        <button id="submitBtn" class="primary block" type="button">Abgeben</button>
      </div>
      <nav id="slideNav" class="slidenav" aria-label="Fragen-Navigation">
        <div class="progress"><div id="progressBar"></div></div>
        <div class="navrow">
          <button id="prevBtn" type="button">← Zurück</button>
          <span id="slidePos">1 / 1</span>
          <button id="nextBtn" class="primary" type="button">Weiter →</button>
        </div>
      </nav>
    </section>

    <section id="view-result" hidden>
      <h1>Ergebnis</h1>
      <div class="scorecard">
        <p id="resScore" class="score"></p>
        <p id="resPercent"></p>
        <p id="resNote" class="note"></p>
        <p id="resTime" class="hint"></p>
      </div>
      <h2 id="resWrongTitle"></h2>
      <ol id="resWrong" class="wronglist"></ol>
      <div class="actions">
        <button id="newExam" class="primary block" type="button">Neue Simulation</button>
        <button id="resultHome" class="ghost block" type="button">Zur Startseite</button>
      </div>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 2: `REPO/style.css`**

```css
:root {
  --bg: #f6f5f1; --surface: #ffffff; --text: #1d1f23; --muted: #5d6470; --line: #dcd9d0;
  --accent: #1f5f8b; --accent-ink: #ffffff; --sel: #dbe8f3;
  --ok: #1e7a46; --ok-bg: #e3f4ea; --bad: #b3261e; --bad-bg: #fbe7e5;
  --radius: 14px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a; --surface: #1f2228; --text: #eceae4; --muted: #a3a9b3; --line: #343841;
    --accent: #6fb1e0; --accent-ink: #0d1b26; --sel: #21384a;
    --ok: #6fd39a; --ok-bg: #163322; --bad: #ff8a80; --bad-bg: #3a1a18;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

.topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--line); }
.brand { flex: 1; font-weight: 700; }
.timer { font-variant-numeric: tabular-nums; font-weight: 700; padding: 6px 12px; border-radius: 999px; background: var(--sel); }
.timer.warn { background: var(--bad-bg); color: var(--bad); }

main { max-width: 720px; margin: 0 auto; padding: 16px 16px 140px; }
h1 { font-size: 1.6rem; line-height: 1.2; margin: 8px 0 12px; }
h2 { font-size: 1.15rem; margin: 0 0 12px; }
.lead { color: var(--muted); margin: 0 0 20px; }
.hint { color: var(--muted); font-size: .95rem; }

button { font: inherit; color: inherit; cursor: pointer; min-height: 48px; padding: 10px 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button:disabled { cursor: default; opacity: .45; }
.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
.ghost { background: transparent; }
.block { display: block; width: 100%; }

.tile { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; margin-bottom: 12px; padding: 20px; text-align: left; }
.tile strong { font-size: 1.25rem; }
.tile span { color: var(--muted); }
.tile.accent { border: 2px solid var(--accent); }

.row { display: flex; gap: 8px; margin-bottom: 12px; }
.chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px; }
.chip { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; text-align: left; }
.chip .count { font-size: .85rem; color: var(--muted); }
.chip .topics { font-size: .8rem; line-height: 1.3; color: var(--muted); }
.chip[aria-pressed="true"] { background: var(--sel); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.switch { display: flex; align-items: center; gap: 10px; min-height: 48px; }
.switch input { width: 22px; height: 22px; }

.quizbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.quizbar h1 { margin: 0; }
.segmented { display: inline-flex; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); }
.segmented button { min-width: 84px; border: 0; border-radius: 0; }
.segmented button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }

.card { margin-bottom: 14px; padding: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); scroll-margin-top: 72px; }
.card .meta { margin: 0 0 6px; font-size: .85rem; color: var(--muted); }
.card .question { margin: 0 0 14px; font-size: 1.1rem; line-height: 1.4; }
.options { display: grid; gap: 10px; }
.option { display: grid; grid-template-columns: 32px 1fr 24px; align-items: center; gap: 10px; width: 100%; padding: 12px; text-align: left; }
.option:disabled { opacity: 1; }
.letter { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--bg); font-size: .9rem; font-weight: 700; }
.mark { font-weight: 700; text-align: center; }
.option.selected { background: var(--sel); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.option.correct { background: var(--ok-bg); border-color: var(--ok); }
.option.correct .mark { color: var(--ok); }
.option.wrong { background: var(--bad-bg); border-color: var(--bad); }
.option.wrong .mark { color: var(--bad); }
.feedback { min-height: 1.5em; margin: 12px 0 0; font-weight: 600; }
.feedback.ok { color: var(--ok); }
.feedback.bad { color: var(--bad); }

.slidenav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; padding: 8px 16px calc(8px + env(safe-area-inset-bottom)); background: var(--surface); border-top: 1px solid var(--line); }
.progress { max-width: 720px; height: 4px; margin: 0 auto 8px; overflow: hidden; background: var(--line); border-radius: 2px; }
#progressBar { width: 0; height: 100%; background: var(--accent); transition: width .2s; }
.navrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 720px; margin: 0 auto; }
.navrow span { color: var(--muted); font-variant-numeric: tabular-nums; }
.navrow button { min-width: 110px; }

.gridwrap { margin: 8px 0 14px; }
.gridwrap summary { display: flex; align-items: center; min-height: 48px; cursor: pointer; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.cell { padding: 0; font-variant-numeric: tabular-nums; }
.cell.done { background: var(--sel); border-color: var(--accent); }

.actions { display: grid; gap: 10px; margin-top: 8px; }
.scorecard { margin-bottom: 20px; padding: 20px; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
.scorecard p { margin: 4px 0; }
.score { font-size: 2.4rem; font-weight: 800; }
.note { font-size: 1.2rem; font-weight: 700; }
.wronglist { padding: 0; list-style: none; }
.wrong-item { margin-bottom: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--bad); border-radius: var(--radius); }
.wrong-item p { margin: 2px 0; }
.wrong-item .meta { font-size: .85rem; color: var(--muted); }
.wrong-item .question { font-weight: 600; }
.yours { color: var(--bad); }
.right { color: var(--ok); }

@media (min-width: 600px) { .grid { grid-template-columns: repeat(10, 1fr); } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; scroll-behavior: auto !important; } }
```

- [ ] **Step 3: `REPO/app.js`**

```js
import {
  shuffle, pickRandom, filterByTags, shuffledOrder, applyOrder, gradeExam, noteText,
  remainingSeconds, formatTime, validateSavedExam,
} from './logic.js';

const EXAM_SIZE = 30;
const EXAM_SECONDS = 60 * 60;
const WARN_SECONDS = 5 * 60;
const KEY_EXAM = 'lf2-exam';
const KEY_VIEW = 'lf2-view';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const VIEWS = ['loading', 'error', 'start', 'setup', 'quiz', 'result'];

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// localStorage kann fehlen (privates Fenster, blockiert) – die Seite läuft dann ohne Speichern.
const store = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ohne Speicher weiter */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignorieren */ } },
};

let questions = [];
let byId = new Map();
let allTags = [];
let selectedTags = new Set();
const state = { mode: null, items: [], answers: [], cards: [], current: 0, view: 'slides', startedAt: 0, timerId: null };

function show(name) {
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== name;
  $('homeBtn').hidden = ['start', 'loading', 'error'].includes(name);
  $('timer').hidden = !(name === 'quiz' && state.mode === 'exam');
  window.scrollTo(0, 0);
}

async function init() {
  bindStatic();
  try {
    const res = await fetch('questions.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    questions = await res.json();
  } catch {
    show('error');
    return;
  }
  byId = new Map(questions.map((q) => [q.id, q]));
  allTags = [...new Set(questions.map((q) => q.tag))].sort((a, b) => a - b);
  selectedTags = new Set(allTags);
  $('totalCount').textContent = String(questions.length);
  buildSetup();
  const saved = store.get(KEY_EXAM);
  if (saved && validateSavedExam(saved, byId, examSize())) {
    resumeExam(saved);
  } else {
    store.remove(KEY_EXAM);
    show('start');
  }
}

function examSize() {
  return Math.min(EXAM_SIZE, questions.length);
}

function bindStatic() {
  $('reloadBtn').addEventListener('click', () => location.reload());
  $('homeBtn').addEventListener('click', goHome);
  $('resultHome').addEventListener('click', goHome);
  $('startPractice').addEventListener('click', () => show('setup'));
  $('startPracticeRun').addEventListener('click', startPracticeRun);
  $('restartBtn').addEventListener('click', startPracticeRun);
  $('startExam').addEventListener('click', startExam);
  $('newExam').addEventListener('click', startExam);
  $('submitBtn').addEventListener('click', submitExam);
  $('viewSlides').addEventListener('click', () => setView('slides'));
  $('viewList').addEventListener('click', () => setView('list'));
  $('prevBtn').addEventListener('click', () => go(state.current - 1));
  $('nextBtn').addEventListener('click', () => go(state.current + 1));
  $('allTags').addEventListener('click', () => { selectedTags = new Set(allTags); updateSetup(); });
  $('noTags').addEventListener('click', () => { selectedTags = new Set(); updateSetup(); });

  document.addEventListener('keydown', (e) => {
    if ($('view-quiz').hidden || state.view !== 'slides') return;
    if (e.key === 'ArrowRight') go(state.current + 1);
    if (e.key === 'ArrowLeft') go(state.current - 1);
  });

  let touch = null;
  const box = $('questions');
  box.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (!touch || state.view !== 'slides') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(state.current + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

// ---------- Übungsmodus ----------

function buildSetup() {
  const box = $('tagChips');
  box.replaceChildren();
  for (const tag of allTags) {
    const qs = questions.filter((q) => q.tag === tag);
    const themen = [...new Set(qs.map((q) => q.thema))].join(' · ');
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.dataset.tag = String(tag);
    chip.append(el('strong', null, `Tag ${tag}`), el('span', 'count', `${qs.length} Fragen`), el('span', 'topics', themen));
    chip.addEventListener('click', () => {
      if (selectedTags.has(tag)) selectedTags.delete(tag); else selectedTags.add(tag);
      updateSetup();
    });
    box.append(chip);
  }
  updateSetup();
}

function updateSetup() {
  for (const chip of $('tagChips').children) {
    chip.setAttribute('aria-pressed', String(selectedTags.has(Number(chip.dataset.tag))));
  }
  const n = filterByTags(questions, [...selectedTags]).length;
  $('setupCount').textContent = n ? `${n} Fragen ausgewählt` : 'Bitte mindestens einen Tag auswählen.';
  $('startPracticeRun').disabled = n === 0;
}

function startPracticeRun() {
  let pool = filterByTags(questions, [...selectedTags]);
  if (!pool.length) return;
  if ($('shuffleQuestions').checked) pool = shuffle(pool);
  state.mode = 'practice';
  state.items = pool.map((q) => applyOrder(q, shuffledOrder(q.optionen.length)));
  state.answers = state.items.map(() => null);
  state.current = 0;
  state.view = store.get(KEY_VIEW) === 'list' ? 'list' : 'slides';
  renderQuiz();
}

// ---------- Prüfungssimulation ----------

function startExam() {
  const items = pickRandom(questions, examSize()).map((q) => applyOrder(q, shuffledOrder(q.optionen.length)));
  beginExam(items, items.map(() => null), Date.now(), 'slides');
  saveExam();
}

function resumeExam(saved) {
  const items = saved.ids.map((id, i) => applyOrder(byId.get(id), saved.orders[i]));
  beginExam(items, saved.answers, saved.startedAt, saved.view === 'list' ? 'list' : 'slides');
}

function beginExam(items, answers, startedAt, view) {
  state.mode = 'exam';
  state.items = items;
  state.answers = answers.slice();
  state.startedAt = startedAt;
  state.current = 0;
  state.view = view;
  renderQuiz();
  startTimer();
}

function saveExam() {
  store.set(KEY_EXAM, {
    ids: state.items.map((q) => q.id),
    orders: state.items.map((q) => q.order),
    answers: state.answers,
    startedAt: state.startedAt,
    view: state.view,
  });
}

function startTimer() {
  stopTimer();
  const tick = () => {
    const left = remainingSeconds(state.startedAt, Date.now(), EXAM_SECONDS);
    $('timer').textContent = formatTime(left);
    $('timer').classList.toggle('warn', left <= WARN_SECONDS);
    if (left === 0) finishExam();
  };
  state.timerId = setInterval(tick, 1000);
  tick();
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function submitExam() {
  const open = state.answers.filter((a) => a === null).length;
  const msg = open
    ? `Noch ${open} ${open === 1 ? 'Frage' : 'Fragen'} unbeantwortet – trotzdem abgeben?`
    : 'Prüfung jetzt abgeben?';
  if (confirm(msg)) finishExam();
}

function finishExam() {
  stopTimer();
  store.remove(KEY_EXAM);
  const seconds = Math.min(EXAM_SECONDS, Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)));
  const result = gradeExam(state.items, state.answers);
  state.mode = null;
  renderResult(result, seconds);
}

function renderResult(r, seconds) {
  $('resScore').textContent = `${r.richtig} / ${r.gesamt}`;
  $('resPercent').textContent = `${r.prozent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
  $('resNote').textContent = `Note ${r.note} · ${noteText(r.note)}`;
  $('resTime').textContent = `Benötigte Zeit: ${formatTime(seconds)} min`;
  $('resWrongTitle').textContent = r.falsch.length ? `Falsch oder offen (${r.falsch.length})` : 'Alles richtig – stark!';
  const list = $('resWrong');
  list.replaceChildren();
  for (const f of r.falsch) {
    const item = el('li', 'wrong-item');
    item.append(
      el('p', 'meta', `Frage ${f.index + 1} · Tag ${f.tag}`),
      el('p', 'question', f.frage),
      el('p', 'yours', `Deine Antwort: ${f.gewaehlt ?? 'keine'}`),
      el('p', 'right', `Richtig: ${f.korrekt}`),
    );
    list.append(item);
  }
  show('result');
}

function goHome() {
  if (state.mode === 'exam') {
    if (!confirm('Prüfung abbrechen? Deine Antworten gehen verloren.')) return;
    stopTimer();
    store.remove(KEY_EXAM);
  }
  state.mode = null;
  show('start');
}

// ---------- Gemeinsame Quiz-Ansicht ----------

function renderQuiz() {
  const exam = state.mode === 'exam';
  $('quizTitle').textContent = exam ? 'Prüfungssimulation' : 'Üben';
  $('restartBtn').hidden = exam;
  $('submitBtn').hidden = !exam;
  $('examGridWrap').hidden = !exam;
  const box = $('questions');
  box.replaceChildren();
  state.cards = state.items.map((q, i) => {
    const card = buildCard(q, i);
    box.append(card);
    return card;
  });
  state.cards.forEach((_, i) => paintCard(i));
  if (exam) buildGrid();
  show('quiz');
  applyView();
  updateStatus();
}

function buildCard(q, i) {
  const card = el('article', 'card');
  card.append(
    el('p', 'meta', `Frage ${i + 1} von ${state.items.length} · Tag ${q.tag} · ${q.thema}`),
    el('h2', 'question', q.frage),
  );
  const opts = el('div', 'options');
  q.optionen.forEach((text, o) => {
    const b = el('button', 'option');
    b.type = 'button';
    b.append(el('span', 'letter', LETTERS[o]), el('span', 'text', text), el('span', 'mark'));
    b.addEventListener('click', () => answer(i, o));
    opts.append(b);
  });
  const fb = el('p', 'feedback');
  fb.setAttribute('aria-live', 'polite');
  card.append(opts, fb);
  return card;
}

function answer(i, o) {
  if (state.mode === 'practice' && state.answers[i] !== null) return;
  state.answers[i] = o;
  paintCard(i);
  updateStatus();
  if (state.mode === 'exam') {
    paintGridCell(i);
    saveExam();
  }
}

function paintCard(i) {
  const q = state.items[i];
  const a = state.answers[i];
  const card = state.cards[i];
  const practice = state.mode === 'practice';
  card.querySelectorAll('.option').forEach((b, o) => {
    const mark = b.querySelector('.mark');
    b.classList.remove('selected', 'correct', 'wrong');
    mark.textContent = '';
    b.setAttribute('aria-pressed', String(a === o));
    if (!practice) {
      b.classList.toggle('selected', a === o);
      return;
    }
    b.disabled = a !== null;
    if (a === null) return;
    if (o === q.richtig) { b.classList.add('correct'); mark.textContent = '✓'; }
    else if (o === a) { b.classList.add('wrong'); mark.textContent = '✗'; }
  });
  const fb = card.querySelector('.feedback');
  fb.className = 'feedback';
  fb.textContent = '';
  if (practice && a !== null) {
    const ok = a === q.richtig;
    fb.classList.add(ok ? 'ok' : 'bad');
    fb.textContent = ok ? 'Richtig!' : `Falsch – richtig ist ${LETTERS[q.richtig]}.`;
  }
}

function buildGrid() {
  const grid = $('examGrid');
  grid.replaceChildren();
  state.items.forEach((_, i) => {
    const b = el('button', 'cell', String(i + 1));
    b.type = 'button';
    b.addEventListener('click', () => go(i));
    grid.append(b);
    paintGridCell(i);
  });
}

function paintGridCell(i) {
  const cell = $('examGrid').children[i];
  const done = state.answers[i] !== null;
  cell.classList.toggle('done', done);
  cell.setAttribute('aria-label', `Frage ${i + 1}, ${done ? 'beantwortet' : 'offen'}`);
}

function updateStatus() {
  const done = state.answers.filter((a) => a !== null).length;
  if (state.mode === 'practice') {
    const ok = state.answers.filter((a, i) => a === state.items[i].richtig).length;
    $('status').textContent = `✓ ${ok} richtig · ${done} / ${state.items.length} beantwortet`;
  } else {
    $('status').textContent = `${done} / ${state.items.length} beantwortet`;
  }
}

function setView(view) {
  state.view = view;
  if (state.mode === 'practice') store.set(KEY_VIEW, view);
  else saveExam();
  applyView();
  if (view === 'list') state.cards[state.current]?.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
}

function applyView() {
  const slides = state.view === 'slides';
  state.cards.forEach((c, i) => { c.hidden = slides && i !== state.current; });
  $('slideNav').hidden = !slides;
  $('viewSlides').setAttribute('aria-pressed', String(slides));
  $('viewList').setAttribute('aria-pressed', String(!slides));
  updateNav();
}

function updateNav() {
  const n = state.items.length;
  $('slidePos').textContent = `${state.current + 1} / ${n}`;
  $('prevBtn').disabled = state.current === 0;
  $('nextBtn').disabled = state.current >= n - 1;
  $('progressBar').style.width = `${((state.current + 1) / n) * 100}%`;
}

function go(i) {
  if (i < 0 || i >= state.items.length) return;
  state.current = i;
  if (state.view === 'slides') {
    applyView();
    window.scrollTo(0, 0);
  } else {
    updateNav();
    state.cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

init();
```

- [ ] **Step 4: Tests laufen lassen (inkl. `innerHTML`-Prüfung)**

Run: `cd REPO && node --test tests/`
Expected: alle Tests PASS, keiner mehr `skipped`.

- [ ] **Step 5: Lokaler Server**

Run (im Hintergrund): `cd REPO && python -m http.server 8765`
Dann `http://localhost:8765/` im Browser öffnen (Claude in Chrome oder den eingebauten Browser), Fenster bzw. Viewport auf 375 × 812.

- [ ] **Step 6: Manuelle Abnahme (alle Punkte müssen stimmen)**

1. Die Startseite zeigt die richtige Fragenanzahl. Bei 375 px gibt es kein horizontales Scrollen.
2. Üben → Setup: 9 Chips mit Anzahl und Themen. „Keine“ deaktiviert „Los geht's“ und zeigt den Hinweis. „Alle“ aktiviert den Button wieder.
3. Slides: Antwort antippen → Grün/Rot plus ✓/✗ plus Text. Ein zweites Antippen ändert nichts. Weiter/Zurück, Pfeiltasten und Fortschrittsbalken funktionieren.
4. Liste: Alle Fragen stehen untereinander, Feedback wie oben. Die Ansicht bleibt nach dem Neuladen erhalten.
5. „Neu starten“ setzt den Zähler zurück, die Optionsreihenfolge ist neu.
6. Prüfung: 30 Fragen, Timer 60:00 läuft. Antworten lassen sich ändern, ohne Feedback. Die Fragenübersicht markiert beantwortete Fragen und springt beim Antippen.
7. Seite während der Prüfung neu laden → Die Prüfung läuft mit denselben Fragen, Antworten und der Restzeit weiter.
8. In den DevTools `localStorage` → bei `lf2-exam` `startedAt` um 3 600 000 verringern → Neuladen → sofortige Auswertung.
9. Abgeben mit offenen Fragen → Abfrage „Noch N Fragen unbeantwortet …“. Die Auswertung zeigt Punkte, Prozent, Note und die Liste falsch/offen.
10. „← Start“ während der Prüfung → Abbruchabfrage.
11. Dunkelmodus (in den DevTools `prefers-color-scheme: dark` emulieren) ist gut lesbar.
12. Die Konsole zeigt keine Fehler.

Gefundene Fehler mit superpowers:systematic-debugging beheben, danach die Abnahme wiederholen.

- [ ] **Step 7: Commit**

```bash
cd REPO && git add index.html style.css app.js && git commit -m "Quiz-Oberfläche: Übungsmodus und Prüfungssimulation"
```

---

### Task 4: README, Veröffentlichung und Prüfung auf GitHub Pages

**Files:**
- Modify: `REPO/README.md`
- Create: `REPO/.nojekyll` (leer; Pages liefert die Dateien unverändert aus)

- [ ] **Step 1: `REPO/README.md` ersetzen**

```markdown
# e_com.lernfeld2

Quiz-Trainer zu **Lernfeld 2 – Sortimente im Onlinevertrieb gestalten und die Beschaffung unterstützen**.

👉 **https://cansi798.github.io/e_com.lernfeld2/**

- **Üben:** Fragen nach Unterrichtstag filtern, als Liste oder Slide für Slide, mit sofortigem Feedback.
- **Prüfungssimulation:** 30 zufällige Fragen, 60 Minuten, Auswertung mit IHK-Note.
- Die Antwortoptionen werden bei jedem Durchgang neu gemischt.

Die Fragen stammen aus den Multiple-Choice-Teilen der Tagesquizze (Tag 1–9) und stehen in `questions.json`.

Tests: `node --test tests/`
```

- [ ] **Step 2: `.nojekyll` anlegen, Tests ein letztes Mal laufen lassen**

Run: `cd REPO && touch .nojekyll && node --test tests/`
Expected: alle PASS.

- [ ] **Step 3: Commit und Push**

```bash
cd REPO && git add README.md .nojekyll && git commit -m "README und Pages-Konfiguration" && git push origin main
```

- [ ] **Step 4: Pages-Build prüfen**

Run: `gh api repos/cansi798/e_com.lernfeld2/pages/builds/latest --jq '.status,.commit'`
Expected: `built` und der SHA aus `git rev-parse HEAD`. Bei `building` nach ca. 60 s erneut prüfen.

- [ ] **Step 5: Live-Seite prüfen**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://cansi798.github.io/e_com.lernfeld2/
curl -s https://cansi798.github.io/e_com.lernfeld2/questions.json | python -c "import json,sys;print(len(json.load(sys.stdin)))"
```
Expected: `200` und dieselbe Fragenanzahl wie in Task 1. Danach die Live-URL im Browser öffnen und die Punkte 1, 3 und 6 aus Task 3 Step 6 wiederholen.
