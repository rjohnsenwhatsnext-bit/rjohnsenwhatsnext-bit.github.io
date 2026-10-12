// Depot Rush: pure rules (Claude). No DOM, no clock, deterministic for a seed.
//
// TICK: one step() is one fixed tick of 50 ms (20 ticks a second).
// INPUT: step(state, input) takes one of
//   { tap: laneIndex }  send that lane's front bus to the first free bay
//   { undo: true }      take back the last tap (free, unlimited, also after a jam)
//   {} or null          let time pass (passengers board)
// A bus boards one passenger a tick, only when the passenger at the front of the
// waiting line matches its colour. A full bus leaves and frees its bay.
// The level is won when the line is empty, and lost when the front passenger has
// no matching bus in a bay and no tap can bring one (no free bay, no buses left,
// or the tap limit is reached). state.events lists what the last tick did, for
// the frontend: board, depart, tap, refused, undo.
//
// Level shape: { bays, seats, lanes: [[bus...]...], queue, par, maxTaps? }
// A bus is a colour letter with optional seats ('r', 'b3'). queue is a string of
// colour letters; spaces are ignored.

export const TICK_MS = 50;

const mulberry = (a) => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { next: a, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};

const parseBus = (text, seats) => ({
  colour: text[0],
  seats: text.length > 1 ? Number(text.slice(1)) : seats,
  load: 0,
});

export function newGame(level, seed = 1) {
  return {
    levelId: level.id,
    seed,
    rng: seed >>> 0,
    tick: 0,
    lanes: level.lanes.map((lane) => lane.map((b) => parseBus(b, level.seats))),
    bays: Array.from({ length: level.bays }, () => null),
    queue: level.queue.replace(/\s/g, '').split(''),
    taps: 0,
    maxTaps: level.maxTaps ?? Infinity,
    history: [],
    lost: false,
    events: [],
  };
}

export const cloneState = (s) => ({
  ...s,
  lanes: s.lanes.map((l) => l.map((b) => ({ ...b }))),
  bays: s.bays.map((b) => (b ? { ...b } : null)),
  queue: s.queue.slice(),
  history: [],
  events: [],
});

export function status(state) {
  if (state.queue.length === 0) return 'won';
  return state.lost ? 'lost' : 'playing';
}

const snapshot = (s) => {
  const c = cloneState(s);
  return { lanes: c.lanes, bays: c.bays, queue: c.queue, taps: c.taps, rng: c.rng };
};

function canTap(s) {
  return s.taps < s.maxTaps && s.bays.some((b) => !b) && s.lanes.some((l) => l.length > 0);
}

function board(s) {
  const want = s.queue[0];
  if (want === undefined) return;
  const bay = s.bays.findIndex((b) => b && b.colour === want && b.load < b.seats);
  if (bay < 0) return;
  const bus = s.bays[bay];
  s.queue.shift();
  bus.load++;
  const r = mulberry(s.rng);
  s.rng = r.next;
  s.events.push({ type: 'board', bay, colour: want, jitter: r.value });
  if (bus.load >= bus.seats) {
    s.bays[bay] = null;
    s.events.push({ type: 'depart', bay, colour: bus.colour });
  }
}

export function step(state, input) {
  state.events = [];
  const inp = input || {};
  const st = status(state);
  if (st === 'won') return state;
  state.tick++;
  if (inp.undo) {
    const prev = state.history.pop();
    if (prev) {
      Object.assign(state, prev);
      state.lost = false;
      state.events.push({ type: 'undo' });
    }
    return state;
  }
  if (inp.tap !== undefined && inp.tap !== null) {
    const lane = state.lanes[inp.tap];
    const bay = state.bays.findIndex((b) => !b);
    if (st !== 'playing' || !lane || lane.length === 0 || bay < 0 || state.taps >= state.maxTaps) {
      state.events.push({ type: 'refused', lane: inp.tap });
    } else {
      state.history.push(snapshot(state));
      state.bays[bay] = lane.shift();
      state.taps++;
      state.events.push({ type: 'tap', lane: inp.tap, bay });
    }
  }
  board(state);
  if (state.queue.length > 0) {
    const want = state.queue[0];
    const waiting = state.bays.some((b) => b && b.colour === want && b.load < b.seats);
    if (!waiting && !canTap(state)) state.lost = true;
  }
  return state;
}

// ---- progression (pure; the frontend passes a storage object) ----

export const PROGRESS_KEY = 'depotrush.progress.v1';
export const CLEAR_COINS = 10;
export const CHAPTER_COINS = 50;
export const AD_REWARD_COINS = 20;
export const CHAPTER_SKIN = 'skin-depot-gold';

export const emptyProgress = () => ({ v: 1, stars: {}, coins: 0, unlocks: [] });

export function starsFor(level, taps) {
  if (taps <= level.par) return 3;
  return taps <= level.par + 2 ? 2 : 1;
}

export const isUnlocked = (progress, levels, index) =>
  index === 0 || (progress.stars[levels[index - 1].id] || 0) > 0;

// First clear pays CLEAR_COINS once. A replay may raise stars but pays nothing.
// Clearing the last level of a chapter once pays the chapter reward and unlocks
// the next chapter. Returns a new progress plus what was granted.
export function completeLevel(progress, levels, level, taps) {
  const stars = starsFor(level, taps);
  const prev = progress.stars[level.id] || 0;
  const next = { ...progress, stars: { ...progress.stars }, unlocks: progress.unlocks.slice() };
  const result = { stars, firstClear: prev === 0, coins: 0, unlocks: [], chapterComplete: false };
  next.stars[level.id] = Math.max(prev, stars);
  if (prev === 0) {
    result.coins += CLEAR_COINS;
    const inChapter = levels.filter((l) => l.chapter === level.chapter);
    const done = inChapter.every((l) => (next.stars[l.id] || 0) > 0);
    const chapterKey = `chapter-${level.chapter}`;
    if (done && !next.unlocks.includes(chapterKey)) {
      next.unlocks.push(chapterKey, `chapter-${level.chapter + 1}`);
      result.unlocks.push(chapterKey);
      result.chapterComplete = true;
      result.coins += CHAPTER_COINS;
      if (level.chapter === 1 && !next.unlocks.includes(CHAPTER_SKIN)) {
        next.unlocks.push(CHAPTER_SKIN);
        result.unlocks.push(CHAPTER_SKIN);
      }
    }
  }
  next.coins += result.coins;
  return { progress: next, ...result };
}

// outcome 'completed' pays; 'declined', 'failed' or anything else pays nothing
export function grantRewardedAd(progress, outcome) {
  if (outcome !== 'completed') return { progress, coins: 0 };
  return { progress: { ...progress, coins: progress.coins + AD_REWARD_COINS }, coins: AD_REWARD_COINS };
}

// what to show as "next unlock": progress through the chapter towards its reward
export function nextUnlock(progress, levels, chapter = 1) {
  const inChapter = levels.filter((l) => l.chapter === chapter);
  const done = inChapter.filter((l) => (progress.stars[l.id] || 0) > 0).length;
  const got = progress.unlocks.includes(`chapter-${chapter}`);
  return {
    done,
    total: inChapter.length,
    complete: got,
    text: got
      ? `Chapter ${chapter} complete`
      : `Clear ${inChapter.length - done} more to finish chapter ${chapter} and win the Gold Depot bus skin`,
  };
}

function valid(p) {
  return p && p.v === 1 && p.stars && typeof p.stars === 'object' && typeof p.coins === 'number' && Array.isArray(p.unlocks);
}

export function loadProgress(storage, key = PROGRESS_KEY) {
  let raw;
  try {
    raw = storage.getItem(key);
  } catch (e) {
    return { progress: emptyProgress(), error: `Could not read saved progress: ${e.message}` };
  }
  if (raw === null || raw === undefined) return { progress: emptyProgress(), error: null };
  try {
    const p = JSON.parse(raw);
    if (valid(p)) return { progress: p, error: null };
    return { progress: emptyProgress(), error: 'Saved progress was not in a format this version knows.' };
  } catch (e) {
    return { progress: emptyProgress(), error: `Saved progress was damaged: ${e.message}` };
  }
}

export function saveProgress(storage, progress, key = PROGRESS_KEY) {
  try {
    storage.setItem(key, JSON.stringify(progress));
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: `Could not save your progress: ${e.message}` };
  }
}
