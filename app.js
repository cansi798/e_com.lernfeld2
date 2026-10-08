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
  // Nach dem Aufwachen aus dem Standby kann die Zeit abgelaufen sein, bevor der nächste Tick läuft.
  if (state.mode === 'exam' && remainingSeconds(state.startedAt, Date.now(), EXAM_SECONDS) === 0) {
    finishExam();
    return;
  }
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
