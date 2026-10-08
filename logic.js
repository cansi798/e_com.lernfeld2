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
      erklaerung: q.erklaerung,
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
