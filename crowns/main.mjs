// Crowns: the screen (Claude's placeholder; Codex owns the look).
// The rules and the daily puzzles are logic.mjs.
import * as C from './logic.mjs';
import { initAds, bannerOnScreens, adsAvailable, showRewarded, maybeInterstitial } from './arcade-ads.js';
import { renderMoreGames } from './arcade-promo.js';
import { remindersAvailable, remindersOn, enableReminders, disableReminders, remindTomorrow, askForRating } from './arcade-engage.js';

const $ = (id) => document.getElementById(id);
const day = C.dayNumber();
const KEY = 'crowns.v1';
const track = (name, props) => window.arcade?.track(name, { mode: 'daily', day, ...props });


// saved: per level, today's marks and time; stats per level; settings
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
let S = { level: 'easy', boards: {}, stats: {}, auto: false, seenRules: false, ...load() };
let saveNote = '';
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    if (!saveNote) toast('Progress is not being saved on this phone: ' + e.message, 3000);
    saveNote = e.message;
  }
}

let toastTimer = 0;
function toast(msg, ms = 1600) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

// ---- today's board for the chosen level
const puzzles = {};
const puzzle = () => (puzzles[S.level] ??= C.makePuzzle(S.level, day));
function board() {
  const b = S.boards[S.level];
  if (b && b.day === day) return b;
  S.boards[S.level] = { day, marks: {}, seconds: 0, started: false, done: false, slips: 0, history: [] };
  return S.boards[S.level];
}
const key = (r, c) => `${r},${c}`;
const crownsOf = (b) => Object.entries(b.marks).filter(([, v]) => v === 'crown').map(([k]) => k.split(',').map(Number));

// ---- drawing
function render() {
  const p = puzzle();
  const b = board();
  $('date').textContent = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' }) + ` · #${day}`;
  $('levels').innerHTML = Object.entries(C.LEVELS)
    .map(([id, L]) => `<button data-level="${id}" class="${id === S.level ? 'on' : ''} ${S.boards[id]?.day === day && S.boards[id].done ? 'done' : ''}">${L.name}<br><small>${L.n}×${L.n}</small></button>`)
    .join('');
  const grid = $('grid');
  grid.style.gridTemplateColumns = `repeat(${p.n}, 1fr)`;
  const crowns = crownsOf(b);
  const bad = badCells(p, crowns);
  grid.innerHTML = '';
  for (let r = 0; r < p.n; r++)
    for (let c = 0; c < p.n; c++) {
      const cell = document.createElement('div');
      const g = p.regions[r][c];
      const m = b.marks[key(r, c)];
      cell.className = `cell r${g}` + (m ? ` ${m}` : '') + (c < p.n - 1 && p.regions[r][c + 1] !== g ? ' wr' : '') + (r < p.n - 1 && p.regions[r + 1][c] !== g ? ' wb' : '') + (bad.has(key(r, c)) ? ' bad' : '');
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}${m === 'crown' ? ', crown' : m === 'x' ? ', marked' : ''}`);
      grid.append(cell);
    }
  grid.classList.toggle('win', b.done);
  $('status').textContent = b.done ? 'Solved' : `${crowns.length} of ${p.n} crowns`;
  $('auto').checked = S.auto;
  renderHint();
  tick();
}
// every crown that breaks a rule, so mistakes show straight away
function badCells(p, crowns) {
  const bad = new Set();
  for (let a = 0; a < crowns.length; a++)
    for (let z = a + 1; z < crowns.length; z++) {
      const [r1, c1] = crowns[a];
      const [r2, c2] = crowns[z];
      if (r1 === r2 || c1 === c2 || p.regions[r1][c1] === p.regions[r2][c2] || (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1)) {
        bad.add(key(r1, c1));
        bad.add(key(r2, c2));
      }
    }
  return bad;
}
function tick() {
  const s = board().seconds;
  $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
setInterval(() => {
  const b = board();
  if (b.started && !b.done && !document.hidden && document.body.dataset.view === 'play') {
    b.seconds++;
    tick();
    if (b.seconds % 5 === 0) save();
  }
}, 1000);

// ---- playing: tap cycles empty -> x -> crown -> empty
$('grid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  const b = board();
  if (!cell || b.done) return;
  const p = puzzle();
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  const k = key(r, c);
  const next = { undefined: 'x', x: 'crown', crown: undefined }[b.marks[k]];
  b.history.push(JSON.stringify(b.marks));
  if (b.history.length > 200) b.history.shift();
  if (next) b.marks[k] = next;
  else delete b.marks[k];
  if (!b.started) track('level_start', { level: S.level });
  b.started = true;
  if (next === 'crown') {
    const bad = badCells(p, crownsOf(b));
    if (bad.has(k)) b.slips++;
    else if (S.auto) autoX(p, b, r, c);
  }
  const done = C.solved(p, crownsOf(b));
  if (done) finish(b);
  save();
  render();
});
function autoX(p, b, r, c) {
  for (let a = 0; a < p.n; a++)
    for (let z = 0; z < p.n; z++) {
      if (a === r && z === c) continue;
      if ((a === r || z === c || p.regions[a][z] === p.regions[r][c] || (Math.abs(a - r) <= 1 && Math.abs(z - c) <= 1)) && !b.marks[key(a, z)]) b.marks[key(a, z)] = 'x';
    }
}
$('undo').onclick = () => {
  const b = board();
  if (b.done || !b.history.length) return;
  b.marks = JSON.parse(b.history.pop());
  save();
  render();
};
$('clear').onclick = () => {
  const b = board();
  if (b.done || !Object.keys(b.marks).length) return;
  b.history.push(JSON.stringify(b.marks));
  b.marks = {};
  save();
  render();
};
$('auto').onchange = () => {
  S.auto = $('auto').checked;
  save();
};
$('levels').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-level]');
  if (!btn) return;
  S.level = btn.dataset.level;
  save();
  render();
});

// ---- finishing
function finish(b) {
  b.done = true;
  track('level_complete', { level: S.level, seconds: b.seconds, slips: b.slips });
  S.stats[S.level] = C.record(S.stats[S.level], { day, seconds: b.seconds });
  setTimeout(() => {
    showDone();
    askForRating({ wins: Object.values(S.stats).reduce((n, s) => n + (s.played || 0), 0) }).catch((e) => console.warn('Rating prompt:', e?.message || e));
  }, 700);
}
// ---- reminders (opt in, one a day at 8 am) and the rating prompt
const REMINDER = { title: "Today's Crowns is ready", body: 'A new puzzle: one crown per row, column and colour.' };
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
  const b = board();
  const st = S.stats[S.level] || {};
  const m = Math.floor(b.seconds / 60);
  $('doneTime').textContent = `${C.LEVELS[S.level].name} in ${m}:${String(b.seconds % 60).padStart(2, '0')}${b.slips ? ` with ${b.slips} slip${b.slips > 1 ? 's' : ''}` : ', clean'}`;
  $('doneStats').textContent = `Streak ${st.streak || 0} · best ${st.best || 0} · fastest ${st.fastest != null ? `${Math.floor(st.fastest / 60)}:${String(st.fastest % 60).padStart(2, '0')}` : '-'}`;
  const order = Object.keys(C.LEVELS);
  const next = order.find((l) => !(S.boards[l]?.day === day && S.boards[l].done));
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

// ---- a hint for a watched ad: one right crown placed for you, one per level a day
let hintBusy = false;
function renderHint() {
  const b = board();
  $('hint').classList.toggle('hidden', !adsAvailable() || b.done || Boolean(b.hints));
  $('hint').disabled = hintBusy;
}
$('hint').onclick = async () => {
  if (hintBusy) return;
  hintBusy = true;
  renderHint();
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  hintBusy = false;
  const b = board();
  if (r.rewarded && !b.hints && !b.done) {
    const p = puzzle();
    const cell = C.hintFor(p, crownsOf(b).filter(([r2, c2]) => p.answer.some(([ar, ac]) => ar === r2 && ac === c2)));
    b.hints = 1; // once: a second callback finds it already given
    if (cell) {
      // placed over whatever mark was there; other crowns are left as they are
      b.history.push(JSON.stringify(b.marks));
      b.marks[key(cell[0], cell[1])] = 'crown';
      b.started = true;
      toast(`A crown goes in row ${cell[0] + 1}, column ${cell[1] + 1}`, 2200);
      if (C.solved(p, crownsOf(b))) finish(b);
    }
    track('hint', { level: S.level });
    save();
  } else if (!r.rewarded) toast(r.reason ? 'No hint: ' + r.reason : 'The ad did not finish, so no hint.', 2200);
  render();
};
$('share').onclick = async () => {
  const b = board();
  const text = C.shareText(S.level, day, b.seconds, b.slips, b.hints || 0);
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
$('statsBtn').onclick = () => (board().done ? showDone() : toast(`Streak ${S.stats[S.level]?.streak || 0} · best ${S.stats[S.level]?.best || 0}`));
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
Object.defineProperty(window, '__crownsQA', { get: () => ({ level: S.level, day, board: JSON.parse(JSON.stringify(board())), answer: puzzle().answer }) });
