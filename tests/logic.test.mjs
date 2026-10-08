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

const Q = (id, tag, richtig = 0) => ({ id, tag, thema: 'T', frage: `F ${id}`, optionen: ['a', 'b', 'c', 'd'], richtig, erklaerung: `E ${id}` });

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
    { index: 1, tag: 2, frage: 'F b', gewaehlt: 'd', korrekt: 'b', erklaerung: 'E b' },
    { index: 2, tag: 3, frage: 'F c', gewaehlt: null, korrekt: 'c', erklaerung: 'E c' },
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

test('questions.json: jede Frage hat eine Erklärung', () => {
  const qs = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
  const ohne = qs.filter((q) => typeof q.erklaerung !== 'string' || q.erklaerung.trim().length < 20).map((q) => q.id);
  assert.deepEqual(ohne, []);
});
