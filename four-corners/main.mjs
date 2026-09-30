// Four Corners: the screen (Claude's placeholder; Codex owns the look).
// The rules, the bank and the daily puzzle are logic.mjs and bank.mjs.
import * as F from './logic.mjs';
import { initAds, bannerOnScreens, adsAvailable, showRewarded, maybeInterstitial } from './arcade-ads.js';
import { renderMoreGames } from './arcade-promo.js';
import { remindersAvailable, remindersOn, enableReminders, disableReminders, remindTomorrow, askForRating } from './arcade-engage.js';

const $ = (id) => document.getElementById(id);
const day = F.dayNumber();
const KEY = 'fourcorners.v1';
const track = (name, props) => window.arcade?.track(name, { mode: 'daily', day, ...props });

const p = F.makePuzzle(day);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
let S = { stats: {}, seenRules: false, ...load() };
if (!S.game || S.game.day !== day) S.game = { day, ...F.newGame(p), order: p.tiles.slice() };
const G = S.game;
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
function toast(msg, ms = 1500) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

let picked = [];
function render() {
  $('date').textContent = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' }) + ` · #${day}`;
  // found groups first, in the order found; at the end, the rest too
  const shown = G.over ? [...G.found, ...p.groups.map((g) => g.name).filter((n) => !G.found.includes(n))] : G.found;
  $('found').innerHTML = shown
    .map((name) => {
      const g = p.groups.find((x) => x.name === name);
      return `<div class="group ${g.colour}"><b>${g.name}</b><span>${g.words.join(', ')}</span></div>`;
    })
    .join('');
  const left = G.order.filter((w) => F.remaining(p, G).includes(w));
  $('grid').innerHTML = G.over ? '' : left.map((w) => `<button class="tile${picked.includes(w) ? ' sel' : ''}${w.length >= 10 ? ' xlong' : w.length > 7 ? ' long' : ''}" data-w="${w}">${w}</button>`).join('');
  $('dots').innerHTML = Array.from({ length: F.MISTAKES }, (_, i) => `<i class="${i < G.mistakes ? 'gone' : ''}"></i>`).join('');
  $('submit').disabled = picked.length !== 4 || G.over;
  $('deselect').disabled = !picked.length || G.over;
  $('shuffle').disabled = G.over;
  renderHint();
  $('prompt').textContent = G.over ? (G.won ? 'All four found.' : 'Here is how they went.') : 'Make four groups of four.';
}

$('grid').addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (!t || G.over) return;
  const w = t.dataset.w;
  if (!G.started) {
    G.started = true;
    track('level_start', { level: 'daily' });
    save();
  }
  if (picked.includes(w)) picked = picked.filter((x) => x !== w);
  else if (picked.length < 4) picked.push(w);
  render();
});
$('deselect').onclick = () => {
  picked = [];
  render();
};
$('shuffle').onclick = () => {
  const left = G.order.filter((w) => F.remaining(p, G).includes(w));
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  G.order = left;
  save();
  render();
};
$('submit').onclick = () => {
  const r = F.guess(p, G, picked);
  if (r.repeat) return toast('Already tried that one');
  if (r.ok) {
    picked = [];
    if (G.won) finish();
  } else {
    for (const w of picked) document.querySelector(`.tile[data-w="${w}"]`)?.classList.add('shake');
    toast(G.over ? 'Out of guesses' : r.oneAway ? 'One away…' : 'Not quite');
    if (G.over) {
      picked = [];
      finish();
    }
  }
  save();
  setTimeout(render, r.ok ? 0 : 380);
};

function finish() {
  track(G.won ? 'level_complete' : 'level_fail', { level: 'daily', mistakes: G.mistakes, found: G.found.length });
  S.stats = F.record(S.stats, { day, won: G.won, mistakes: G.mistakes, hints: G.hints || 0 });
  save();
  setTimeout(() => {
    showDone();
    // never after a loss
    if (G.won) askForRating({ wins: S.stats.won || 0 }).catch((e) => console.warn('Rating prompt:', e?.message || e));
  }, 900);
}
// ---- reminders (opt in, one a day at 8 am) and the rating prompt
const REMINDER = { title: "Today's Four Corners is ready", body: 'Sixteen new words, four hidden groups.' };
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
  const st = S.stats;
  $('doneTitle').textContent = G.won ? (G.mistakes ? 'Nailed it' : 'Perfect') : 'Next time';
  $('doneLine').textContent = G.won ? `${G.mistakes} mistake${G.mistakes === 1 ? '' : 's'}` : 'The groups are on the board.';
  $('doneGrid').textContent = F.shareText(p, G).split('\n').slice(1).join('\n');
  $('doneStats').textContent = `Streak ${st.streak || 0} · best ${st.best || 0} · perfect ${st.perfect || 0}`;
  $('done').showModal();
}
// the between-puzzles ad: when the finish card is closed, never mid-puzzle
$('closeDone').onclick = () => {
  $('done').close();
  maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e));
};

// ---- a hint for a watched ad: one group's name, one a day
let hintBusy = false;
function renderHint() {
  const can = adsAvailable() && !G.over && !(G.hints >= F.HINTS);
  $('hint').classList.toggle('hidden', !can);
  $('hint').disabled = hintBusy;
  $('hintLine').classList.toggle('hidden', !G.hinted || G.found.includes(G.hinted));
  $('hintLine').textContent = G.hinted ? `Hint: one group is "${G.hinted}"` : '';
}
$('hint').onclick = async () => {
  if (hintBusy) return;
  hintBusy = true;
  renderHint();
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  hintBusy = false;
  if (r.rewarded) {
    const h = F.hint(p, G); // grants once: a second callback finds the day's hint used
    if (h.ok) {
      track('hint', { level: 'daily' });
      save();
    }
  } else toast(r.reason ? 'No hint: ' + r.reason : 'The ad did not finish, so no hint.', 2200);
  render();
};
$('share').onclick = async () => {
  const text = F.shareText(p, G);
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
$('statsBtn').onclick = () => (G.over ? showDone() : toast(`Streak ${S.stats.streak || 0} · best ${S.stats.best || 0}`));
$('help').onclick = () => $('rules').showModal();
$('closeRules').onclick = () => {
  $('rules').close();
  S.seenRules = true;
  save();
};

save();
render();
if (!S.seenRules) $('rules').showModal();
bannerOnScreens('view', ['play']);
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
Object.defineProperty(window, '__cornersQA', { get: () => ({ day, game: JSON.parse(JSON.stringify(G)), groups: p.groups }) });
