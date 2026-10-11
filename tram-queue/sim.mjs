// Tram Queue rules (Claude). Pure and deterministic: no DOM, no clock, no Math.random.
//
// The board is a grid of trams, each facing U, D, L or R. A tram can be sent when
// nothing sits in its way to the edge. The stop serves a queue of colours in order.
// A sent tram that matches the front of the queue is served. Any other sent tram
// waits in a holding lane (there are `lanes` of them) and is served the moment its
// colour reaches the front. You lose when the lanes are full and nothing free on
// the board matches the front, or when a level's park limit is broken.
//
// TICK: one tick is one player decision. There is no real time in the rules, so
// animation speed is the frontend's business.
// INPUT to step(state, input), one of:
//   { tap: id }      send tram `id` (ignored if blocked, or if it would not fit a lane)
//   { undo: true }   free: take back the last tap (or reshuffle), as many times as you like
//   { shuffle: true } free: only when the level can no longer be won, reorders the
//                    rest of the queue into one that can (seeded, so deterministic)
//   null or {}       nothing
// step(state, input) mutates the state and fills state.events with what happened.
//
// CHAPTER 2 RULES (both depend only on how many trams have been served, so undo restores them):
//   signals: [[x, y, n]]  a closed signal on a cell. It blocks any tram whose path crosses
//                    that cell until n trams have been served, then it is open for good.
//   locks: { id: n }  tram `id` (its index in `trams`) is asleep and cannot be sent until n
//                    trams have been served. It still sits on the board and still blocks others.
//
// CHAPTER 3 RULE (also depends only on how many trams have been served, so undo restores it):
//   shut: [[x, y, n]]  a closing gate on a cell. It is open until n trams have been served, then
//                    it is shut for good and blocks any tram whose path crosses that cell. Send
//                    (or park) the trams that need it before it closes. A tram that is already
//                    parked in a lane has passed and is never stopped by it.

const DIRS ={ U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

export const FIRST_CLEAR_TOKENS = 10;
export const CHAPTER_REWARDS = {
  1: { tokens: 50, unlock: 'livery-gold', name: 'Gold livery' },
  2: { tokens: 75, unlock: 'livery-night', name: 'Night livery' },
  3: { tokens: 100, unlock: 'livery-dawn', name: 'Dawn livery' },
};

// level: { w, h, lanes, trams: [[x, y, dir, colour]], queue: [colour], held?: [colour], maxParks?,
//          signals?: [[x, y, n]], locks?: { id: n } }
// queue has one entry per tram, parked-at-start ones included.
export function newGame(level, seed = 1) {
  const trams = level.trams.map(([x, y, d, c], id) => ({ id, x, y, d, c, where: 'board' }));
  for (const c of level.held || []) trams.push({ id: trams.length, x: -1, y: -1, d: 'U', c, where: 'held' });
  const s = {
    w: level.w, h: level.h, lanes: level.lanes, maxParks: level.maxParks, par: level.par,
    signals: (level.signals || []).map((g) => g.slice()), shut: (level.shut || []).map((g) => g.slice()), locks: { ...(level.locks || {}) },
    trams, queue: level.queue.slice(), qi: 0,
    held: trams.filter((t) => t.where === 'held').map((t) => t.id),
    parks: 0, taps: 0, undos: 0, shuffles: 0,
    rng: (seed >>> 0) || 1, history: [], events: [],
  };
  settle(s);
  s.events = [];
  return s;
}

export function isFree(s, t, ignoreGates = false) {
  if (!t || t.where !== 'board') return false;
  if (!ignoreGates && s.locks[t.id] > s.qi) return false;
  const [dx, dy] = DIRS[t.d];
  for (let x = t.x + dx, y = t.y + dy; x >= 0 && y >= 0 && x < s.w && y < s.h; x += dx, y += dy) {
    if (!ignoreGates && s.signals.some(([gx, gy, n]) => gx === x && gy === y && s.qi < n)) return false;
    if (!ignoreGates && s.shut.some(([gx, gy, n]) => gx === x && gy === y && s.qi >= n)) return false;
    if (s.trams.some((o) => o.where === 'board' && o.x === x && o.y === y)) return false;
  }
  return true;
}

export function status(s) {
  if (s.qi >= s.queue.length) return 'won';
  if (s.maxParks !== undefined && s.parks > s.maxParks) return 'lost';
  const front = s.queue[s.qi];
  const free = s.trams.filter((t) => isFree(s, t));
  if (!free.length) return 'lost';
  if (s.held.length >= s.lanes && !free.some((t) => t.c === front)) return 'lost';
  return 'playing';
}

export function step(s, input) {
  s.events = [];
  if (!input) return s;
  if (input.undo) return undo(s);
  if (status(s) === 'won') return s;
  if (input.shuffle) return shuffle(s);
  if (input.tap !== undefined) send(s, input.tap);
  return s;
}

function snap(s) {
  return { where: s.trams.map((t) => t.where), queue: s.queue.slice(), qi: s.qi, held: s.held.slice(), parks: s.parks, taps: s.taps };
}

function undo(s) {
  const h = s.history.pop();
  if (!h) { s.events.push({ type: 'nothing-to-undo' }); return s; }
  s.trams.forEach((t, i) => { t.where = h.where[i]; });
  Object.assign(s, { queue: h.queue, qi: h.qi, held: h.held, parks: h.parks, taps: h.taps });
  s.undos++;
  s.events.push({ type: 'undo' });
  return s;
}

// Held trams whose colour has reached the front of the queue go to the stop.
function settle(s) {
  for (;;) {
    const front = s.queue[s.qi];
    const id = s.held.find((i) => s.trams[i].c === front);
    if (id === undefined) return;
    s.held.splice(s.held.indexOf(id), 1);
    s.trams[id].where = 'gone';
    s.qi++;
    s.events.push({ type: 'served', id, fromLane: true });
  }
}

function send(s, id) {
  const t = s.trams[id];
  if (!isFree(s, t)) { s.events.push({ type: 'blocked', id }); return; }
  const match = t.c === s.queue[s.qi];
  if (!match && s.held.length >= s.lanes) { s.events.push({ type: 'lanes-full', id }); return; }
  s.history.push(snap(s));
  s.taps++;
  if (match) {
    t.where = 'gone';
    s.qi++;
    s.events.push({ type: 'served', id, fromLane: false });
  } else {
    t.where = 'held';
    s.held.push(id);
    s.parks++;
    s.events.push({ type: 'parked', id });
  }
  settle(s);
}

function rand(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function copy(s) {
  return { ...s, trams: s.trams.map((t) => ({ ...t })), held: s.held.slice(), history: [], events: [] };
}

// A list of tram ids that wins from here, or null. Depth first with memory.
export function solve(s) {
  const seen = new Set();
  const dfs = (c, path) => {
    const st = status(c);
    if (st === 'won') return path;
    if (st === 'lost') return null;
    const key = c.trams.map((t) => t.where[0]).join('') + c.qi + '|' + c.parks;
    if (seen.has(key)) return null;
    seen.add(key);
    const front = c.queue[c.qi];
    const free = c.trams.filter((t) => isFree(c, t)).sort((a, b) => (b.c === front) - (a.c === front));
    for (const t of free) {
      const next = copy(c);
      step(next, { tap: t.id });
      const found = dfs(next, path.concat(t.id));
      if (found) return found;
    }
    return null;
  };
  return dfs(copy(s), []);
}

// Order the rest of the queue by peeling the board: every tram then matches on exit.
function peelOrder(s) {
  const c = copy(s);
  const colours = c.held.map((i) => c.trams[i].c);
  for (let free = c.trams.find((t) => isFree(c, t, true)); free; free = c.trams.find((t) => isFree(c, t, true))) {
    colours.push(free.c);
    free.where = 'gone';
  }
  return colours;
}

function shuffle(s) {
  if (s.maxParks !== undefined && s.parks > s.maxParks) { s.events.push({ type: 'shuffle-refused', reason: 'park-limit' }); return s; }
  if (solve(s)) { s.events.push({ type: 'shuffle-refused', reason: 'still-winnable' }); return s; }
  s.history.push(snap(s));
  const rest = s.trams.filter((t) => t.where !== 'gone').map((t) => t.c);
  const head = s.queue.slice(0, s.qi);
  let next = null;
  for (let tries = 0; tries < 30 && !next; tries++) {
    const order = rest.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const trial = copy(s);
    trial.queue = head.concat(order);
    settle(trial);
    if (solve(trial)) next = order;
  }
  s.queue = head.concat(next || peelOrder(s));
  s.shuffles++;
  settle(s);
  s.events.push({ type: 'shuffle' });
  return s;
}

// ---- Progress and rewards (pure; main.mjs only stores what these return) ----

export const PROGRESS_KEY = 'tramqueue.progress.v1';

export function emptyProgress() {
  return { v: 1, cleared: {}, tokens: 0, unlocks: [], chaptersPaid: {} };
}

// 1 star for a win, 2 for a win with no undo or reshuffle, 3 for that and at most `par` parks.
export function starsFor(s) {
  if (status(s) !== 'won') return 0;
  if (s.undos || s.shuffles) return 1;
  return s.par !== undefined && s.parks > s.par ? 2 : 3;
}

export function isLevelUnlocked(p, levels, index) {
  return index === 0 || levels[index - 1].id in p.cleared;
}

export function isChapterUnlocked(p, levels, chapter) {
  if (chapter <= 1) return true;
  const before = levels.filter((l) => l.chapter === chapter - 1);
  return before.length > 0 && before.every((l) => l.id in p.cleared);
}

// Record a finished level. Tokens and chapter rewards are paid on the first clear only;
// a replay can raise the stars but never pays again.
export function recordClear(p, level, s, levels) {
  const stars = starsFor(s);
  if (!stars) return { progress: p, firstClear: false, stars: 0, tokens: 0, chapterReward: null };
  const next = { ...p, cleared: { ...p.cleared }, unlocks: p.unlocks.slice(), chaptersPaid: { ...p.chaptersPaid } };
  const firstClear = !(level.id in next.cleared);
  next.cleared[level.id] = Math.max(next.cleared[level.id] || 0, stars);
  let tokens = 0, chapterReward = null;
  if (firstClear) {
    tokens += FIRST_CLEAR_TOKENS;
    const reward = CHAPTER_REWARDS[level.chapter];
    const done = levels.filter((l) => l.chapter === level.chapter).every((l) => l.id in next.cleared);
    if (reward && done && !next.chaptersPaid[level.chapter]) {
      next.chaptersPaid[level.chapter] = true;
      tokens += reward.tokens;
      if (!next.unlocks.includes(reward.unlock)) next.unlocks.push(reward.unlock);
      chapterReward = reward;
    }
  }
  next.tokens += tokens;
  return { progress: next, firstClear, stars, tokens, chapterReward };
}

// What the player is working towards: { name, have, need } for the next chapter reward.
export function nextUnlock(p, levels) {
  for (const chapter of Object.keys(CHAPTER_REWARDS).map(Number)) {
    if (p.chaptersPaid[chapter]) continue;
    const mine = levels.filter((l) => l.chapter === chapter);
    return { name: CHAPTER_REWARDS[chapter].name, have: mine.filter((l) => l.id in p.cleared).length, need: mine.length };
  }
  return null;
}

// Saving never fails silently: the result carries the reason for the screen to show.
export function saveProgress(storage, p) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Progress could not be saved: ${err && err.message ? err.message : err}` };
  }
}

export function loadProgress(storage) {
  let raw;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch (err) {
    return { progress: emptyProgress(), error: `Saved progress could not be read: ${err && err.message ? err.message : err}` };
  }
  if (!raw) return { progress: emptyProgress(), error: null };
  try {
    const p = JSON.parse(raw);
    if (p && p.v === 1 && p.cleared && Array.isArray(p.unlocks)) return { progress: { ...emptyProgress(), ...p }, error: null };
    return { progress: emptyProgress(), error: 'Saved progress was not in a format this version knows, so it was set aside.' };
  } catch (err) {
    return { progress: emptyProgress(), error: `Saved progress was damaged and could not be read: ${err.message}` };
  }
}
