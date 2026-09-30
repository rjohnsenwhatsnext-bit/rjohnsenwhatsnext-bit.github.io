// Target: the screen (Claude's placeholder; Codex owns the look).
// The rules and the daily puzzles are logic.mjs.
import * as T from './logic.mjs';
import { initAds, bannerOnScreens, adsAvailable, showRewarded, maybeInterstitial } from './arcade-ads.js';
import { renderMoreGames } from './arcade-promo.js';
import { remindersAvailable, remindersOn, enableReminders, disableReminders, remindTomorrow, askForRating } from './arcade-engage.js';

const $ = (id) => document.getElementById(id);
const day = T.dayNumber();
const KEY = 'target.v1';
const track = (name, props) => window.arcade?.track(name, { mode: 'daily', day, ...props });


function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
let S = { level: 'easy', boards: {}, stats: {}, seenRules: false, ...load() };
let saveWarned = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    if (!saveWarned) toast('Progress is not being saved on this phone: ' + e.message, 3000);
    saveWarned = true;
  }
}
let toastTimer = 0;
function toast(msg, ms = 1600) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

// the solver runs once per level per day, only when that level is opened
const puzzles = {};
const puzzle = () => (puzzles[S.level] ??= T.makePuzzle(S.level, day));
function state() {
  const b = S.boards[S.level];
  if (b && b.day === day) return b;
  S.boards[S.level] = { day, board: T.newBoard(puzzle()), seconds: 0, started: false, finished: false, won: false, gaveUp: false, best: null };
  return S.boards[S.level];
}

let pickA = null;
let pickOp = null;
function render() {
  const p = puzzle();
  const st = state();
  $('date').textContent = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' }) + ` · #${day}`;
  $('levels').innerHTML = Object.entries(T.LEVELS)
    .map(([id, L]) => `<button data-level="${id}" class="${id === S.level ? 'on' : ''} ${S.boards[id]?.day === day && S.boards[id].won ? 'done' : ''}">${L.name}</button>`)
    .join('');
  $('target').textContent = p.target;
  $('tiles').innerHTML = st.board.tiles
    .map((t) => `<button class="tile${t.made ? ' made' : ''}${t.id === pickA ? ' sel' : ''}${t.v === p.target ? ' hit' : ''}" data-id="${t.id}">${t.v}</button>`)
    .join('');
  for (const b of document.querySelectorAll('#ops button')) b.classList.toggle('sel', b.dataset.op === pickOp);
  $('steps').innerHTML = st.gaveUp
    ? p.solution.map((l) => `<li>${l}</li>`).join('')
    : st.board.steps.map((s) => `<li>${s.a.v} ${s.op} ${s.b.v} = ${s.c.v}</li>`).join('');
  $('undo').disabled = st.finished || !st.board.steps.length;
  $('reset').disabled = st.finished || !st.board.steps.length;
  $('giveUp').disabled = st.finished;
  renderHint();
  tick();
}
function tick() {
  const s = state().seconds;
  $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
setInterval(() => {
  const st = state();
  if (st.started && !st.finished && !document.hidden) {
    st.seconds++;
    tick();
    if (st.seconds % 5 === 0) save();
  }
}, 1000);

$('tiles').addEventListener('click', (e) => {
  const btn = e.target.closest('.tile');
  const st = state();
  if (!btn || st.finished) return;
  const id = Number(btn.dataset.id);
  if (!st.started) track('level_start', { level: S.level });
  st.started = true;
  if (pickA === null || pickOp === null) {
    pickA = pickA === id ? null : id; // tap again to put it down
    return render();
  }
  if (id === pickA) {
    pickA = null;
    pickOp = null;
    return render();
  }
  const r = T.combine(st.board, pickA, pickOp, id, puzzle().target);
  if (!r.ok) {
    toast(r.reason);
    pickOp = null;
    return render();
  }
  pickA = null;
  pickOp = null;
  const gap = T.closest(st.board, puzzle().target);
  st.best = st.best === null ? gap : Math.min(st.best, gap);
  if (r.done) win(st);
  save();
  render();
});
$('ops').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-op]');
  if (!b || state().finished) return;
  if (pickA === null) return toast('Pick a number first');
  pickOp = pickOp === b.dataset.op ? null : b.dataset.op;
  render();
});
$('undo').onclick = () => {
  T.undo(state().board);
  pickA = pickOp = null;
  save();
  render();
};
$('reset').onclick = () => {
  const st = state();
  while (T.undo(st.board));
  pickA = pickOp = null;
  save();
  render();
};
$('giveUp').onclick = () => {
  const st = state();
  if (!confirm('Show one way to make it? Today counts as a miss for this level.')) return;
  st.finished = true;
  st.gaveUp = true;
  track('level_fail', { level: S.level, seconds: st.seconds, reason: 'gave up', closest: st.best });
  S.stats[S.level] = T.record(S.stats[S.level], { day, won: false });
  save();
  render();
};
$('levels').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-level]');
  if (!btn) return;
  S.level = btn.dataset.level;
  pickA = pickOp = null;
  save();
  render();
});

function win(st) {
  st.finished = true;
  st.won = true;
  track('level_complete', { level: S.level, seconds: st.seconds, steps: st.board.steps.length, shortest: puzzle().steps });
  S.stats[S.level] = T.record(S.stats[S.level], { day, won: true, seconds: st.seconds });
  setTimeout(() => {
    showDone();
    askForRating({ wins: Object.values(S.stats).reduce((n, s) => n + (s.won || 0), 0) }).catch((e) => console.warn('Rating prompt:', e?.message || e));
  }, 600);
}
// ---- reminders (opt in, one a day at 8 am) and the rating prompt
const REMINDER = { title: "Today's Target is ready", body: 'Six new numbers and a new target.' };
function renderRemind() {
  const b = $('remind');
  b.classList.toggle('hidden', !remindersAvailable());
  b.textContent = remindersOn() ? 'Daily reminder on · turn off' : 'Remind me tomorrow';
}
$('remind').onclick = async () => {
  const note = $('remindNote');
  try {
    if (remindersOn()) {
      await disableReminders();
      note.textContent = 'No more reminders.';
    } else {
      const r = await enableReminders();
      if (r.on) await remindTomorrow(REMINDER);
      note.textContent = r.on ? 'See you tomorrow at 8.' : r.reason;
    }
  } catch (e) {
    note.textContent = 'Reminders could not be set: ' + (e.message || e);
  }
  note.classList.remove('hidden');
  renderRemind();
};
remindTomorrow(REMINDER).catch((e) => console.warn('Reminder not set:', e?.message || e));
function showDone() {
  renderRemind();
  renderMoreGames($('moreGames'));
  const st = state();
  const p = puzzle();
  const stats = S.stats[S.level] || {};
  $('doneTitle').textContent = st.won ? 'Bullseye!' : 'Not today';
  $('doneLine').textContent = st.won ? `${p.target} in ${st.board.steps.length} steps, ${Math.floor(st.seconds / 60)}:${String(st.seconds % 60).padStart(2, '0')}` : '';
  $('doneBest').textContent = st.won && st.board.steps.length > p.steps ? `It can be done in ${p.steps}.` : st.won ? 'As short as it gets.' : '';
  $('doneStats').textContent = `Streak ${stats.streak || 0} · best ${stats.best || 0}`;
  const next = Object.keys(T.LEVELS).find((l) => !(S.boards[l]?.day === day && S.boards[l].finished));
  $('nextLevel').classList.toggle('hidden', !next);
  $('nextLevel').onclick = () => {
    S.level = next;
    save();
    $('done').close();
    render();
  };
  $('done').showModal();
}
// the between-puzzles ad: when the finish card is closed, never mid-puzzle
$('closeDone').onclick = () => {
  $('done').close();
  maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e));
};

// ---- a hint for a watched ad: the first step of a shortest way, one per level a day
let hintBusy = false;
function renderHint() {
  const st = state();
  $('hint').classList.toggle('hidden', !adsAvailable() || st.finished || Boolean(st.hints));
  $('hint').disabled = hintBusy;
  $('hintLine').classList.toggle('hidden', !st.hints || st.finished);
  $('hintLine').textContent = st.hints ? `Hint: one shortest way starts ${T.hintFor(puzzle())}` : '';
}
$('hint').onclick = async () => {
  if (hintBusy) return;
  hintBusy = true;
  renderHint();
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  hintBusy = false;
  const st = state();
  if (r.rewarded && !st.hints) {
    st.hints = 1; // once: a second callback finds it already given
    track('hint', { level: S.level });
    save();
  } else if (!r.rewarded) toast(r.reason ? 'No hint: ' + r.reason : 'The ad did not finish, so no hint.', 2200);
  render();
};
$('share').onclick = async () => {
  const st = state();
  const text = T.shareText(S.level, day, { seconds: st.seconds, steps: st.board.steps.length, gaveUp: st.gaveUp, hints: st.hints || 0 });
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Could not share: ' + (e.message || e));
  }
};
$('statsBtn').onclick = () => (state().finished ? showDone() : toast(`Streak ${S.stats[S.level]?.streak || 0} · best ${S.stats[S.level]?.best || 0}`));
$('help').onclick = () => $('rules').showModal();
$('closeRules').onclick = () => {
  $('rules').close();
  S.seenRules = true;
  save();
};

render();
if (!S.seenRules) $('rules').showModal();
bannerOnScreens('view', ['play']);
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
Object.defineProperty(window, '__targetQA', { get: () => ({ level: S.level, day, state: JSON.parse(JSON.stringify(state())), puzzle: puzzle() }) });
