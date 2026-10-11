// Burrow Count: the rules (Claude). Pure, no DOM, deterministic.
//
// Place one critter in every region of the grid. A clue cell (a number, no critter
// of its own) counts the critters in the up to 8 cells touching it, corners included.
// Win: every region has a critter and every clue matches. Every level has exactly
// one solution, so no guessing is needed.
//
// WIDE CLUE (chapter 2): a clue with reach 2 counts every critter within 2 steps of it
// (up to 24 cells, corners included) instead of the 8 touching cells. Its drawing mark
// is '*'. Ordinary clues have no reach field (treated as 1). Every rule, the solver and
// "show me why" read a clue's cells through clueNear(), so wide clues need nothing else.
//
// LINE CLUE (chapter 3): a clue with `line: true` counts every critter in its whole row and
// whole column (the clue cell itself holds none), however far away. Its drawing mark is '+'.
// Other clues have no line field. clueNear() handles it, so the solver, mistakes and
// "show me why" need nothing else.
//
// TICK: step() advances the game by one fixed tick of 1/60 s. Nothing is timed;
// state.tick only paces animation and stats.
// INPUT to step(state, input), one per tick, or null/undefined to idle:
//   { place: [row, col] }  put a critter there; a critter already there is lifted;
//                          a different cell in the same region moves the region's critter
//   { undo: true }         free undo of the last placement (mistakes already made stay counted)
//   { hint: true }         "show me why": state.hint = hint(state), counted in state.hints
// A placement that makes any clue count more than its number is a mistake. The level
// gives `lives` mistakes before the level is lost; retry is free.
// state.events lists what happened this tick: {type: 'place'|'lift'|'undo'|'hint'|
// 'reject'|'mistake'|'won'|'lost'} for sound, particles and privacy-light analytics.

export const TICK = 1 / 60;

export function neighbours(level, idx, reach = 1) {
  const r = (idx / level.cols) | 0, c = idx % level.cols, out = [];
  for (let dr = -reach; dr <= reach; dr++) {
    for (let dc = -reach; dc <= reach; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < level.rows && cc >= 0 && cc < level.cols) out.push(rr * level.cols + cc);
    }
  }
  return out;
}

// every other cell in a clue's row and column (the cells a line clue counts)
export function lineCells(level, r, c) {
  const out = [];
  for (let i = 0; i < level.rows * level.cols; i++) {
    const rr = (i / level.cols) | 0, cc = i % level.cols;
    if ((rr === r) !== (cc === c)) out.push(i);
  }
  return out;
}

// the cells a clue counts: its 8 neighbours, for a wide clue (reach 2) every cell within 2 steps,
// for a line clue every cell in its row and column
export function clueNear(level, k) { return k.line ? lineCells(level, k.r, k.c) : neighbours(level, k.r * level.cols + k.c, k.reach || 1); }

// how many placed critters touch each clue, in level.clues order
export function clueCounts(level, placed) {
  const set = new Set(placed.filter((i) => i >= 0));
  return level.clues.map((k) => clueNear(level, k).filter((i) => set.has(i)).length);
}

// Every way to place one critter per region that satisfies all clues, up to `limit`.
// Each answer is an array indexed by region holding the cell index.
export function solve(level, limit = 2) {
  const cand = Array.from({ length: level.regionCount }, () => []);
  level.region.forEach((g, i) => { if (g >= 0) cand[g].push(i); });
  const order = [...cand.keys()].sort((a, b) => cand[a].length - cand[b].length);
  const near = level.clues.map((k) => new Set(clueNear(level, k)));
  const touch = level.region.map((_, i) => level.clues.map((_, k) => k).filter((k) => near[k].has(i)));
  // rem[k][d]: regions still to place from depth d that could reach clue k
  const rem = near.map((n) => Array.from({ length: order.length + 1 }, (_, d) => order.slice(d).filter((g) => cand[g].some((i) => n.has(i))).length));
  const have = level.clues.map(() => 0), placed = Array(level.regionCount).fill(-1), out = [];
  const ok = (d) => level.clues.every((k, j) => have[j] <= k.n && have[j] + rem[j][d] >= k.n);
  const go = (d) => {
    if (out.length >= limit) return;
    if (d === order.length) { out.push(placed.slice()); return; }
    const g = order[d];
    for (const i of cand[g]) {
      placed[g] = i;
      touch[i].forEach((k) => have[k]++);
      if (ok(d + 1)) go(d + 1);
      touch[i].forEach((k) => have[k]--);
      placed[g] = -1;
    }
  };
  if (ok(0)) go(0);
  return out;
}

export function newGame(level, seed = 1) {
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    level, seed, tick: 0, result: 'playing',
    placed: Array(level.regionCount).fill(-1),
    skins: Array.from({ length: level.regionCount }, () => Math.floor(rand() * 4)), // critter look per region
    history: [], mistakes: 0, hints: 0, undos: 0, hint: null, events: [],
  };
}

export function status(state) { return state.result; }

export function livesLeft(state) { return Math.max(0, state.level.lives - state.mistakes); }

// 1 star for a clear, +1 with no mistakes, +1 with no hints
export function stars(state) { return state.result === 'won' ? 1 + (state.mistakes === 0 ? 1 : 0) + (state.hints === 0 ? 1 : 0) : 0; }

function place(s, r, c) {
  const L = s.level, i = r * L.cols + c;
  if (!(r >= 0 && r < L.rows && c >= 0 && c < L.cols) || L.region[i] < 0) { s.events.push({ type: 'reject' }); return; }
  const g = L.region[i];
  s.history.push(s.placed.slice());
  s.hint = null;
  if (s.placed[g] === i) { s.placed[g] = -1; s.events.push({ type: 'lift' }); return; }
  s.placed[g] = i;
  s.events.push({ type: 'place', region: g });
  const counts = clueCounts(L, s.placed);
  if (L.clues.some((k, j) => counts[j] > k.n)) { s.mistakes++; s.events.push({ type: 'mistake' }); }
  if (s.mistakes >= L.lives) { s.result = 'lost'; s.events.push({ type: 'lost' }); return; }
  if (s.placed.every((p) => p >= 0) && L.clues.every((k, j) => counts[j] === k.n)) { s.result = 'won'; s.events.push({ type: 'won' }); }
}

export function step(state, input) {
  state.events = [];
  if (state.result !== 'playing') return state;
  state.tick++;
  if (!input) return state;
  if (input.place) place(state, input.place[0], input.place[1]);
  else if (input.undo && state.history.length) { state.placed = state.history.pop(); state.undos++; state.hint = null; state.events.push({ type: 'undo' }); }
  else if (input.hint) { state.hint = hint(state); state.hints++; state.events.push({ type: 'hint' }); }
  return state;
}

// "Show me why": the next forced cell and the clue behind it.
// -> {cell:[r,c], clue:[r,c]|null, n, kind, text}. kind: 'conflict' (a placed critter breaks a clue),
// 'full' (a clue already has all its critters), 'needs' (a clue needs every region that can reach it),
// 'only' (a region has one cell left), 'fit' (the one place that fits every clue).
export function hint(state) {
  const L = state.level, pos = (i) => [(i / L.cols) | 0, i % L.cols];
  const at = (k) => `the ${L.clues[k].reach > 1 ? 'wide ' : L.clues[k].line ? 'line ' : ''}${L.clues[k].n} at row ${L.clues[k].r + 1}, column ${L.clues[k].c + 1}`;
  const counts = clueCounts(L, state.placed);
  const bad = L.clues.findIndex((k, j) => counts[j] > k.n);
  if (bad >= 0) {
    const cell = clueNear(L, L.clues[bad]).find((i) => state.placed.includes(i));
    return { cell: pos(cell), clue: [L.clues[bad].r, L.clues[bad].c], n: L.clues[bad].n, kind: 'conflict', text: `Too many critters touch ${at(bad)}. Lift one of them.` };
  }
  const cand = Array.from({ length: L.regionCount }, () => new Set());
  L.region.forEach((g, i) => { if (g >= 0) cand[g].add(i); });
  state.placed.forEach((p, g) => { if (p >= 0) cand[g] = new Set([p]); });
  const near = L.clues.map((k) => new Set(clueNear(L, k)));
  const why = Array(L.regionCount).fill(null);
  for (let changed = true; changed;) {
    changed = false;
    L.clues.forEach((k, j) => {
      const fixed = cand.filter((s) => s.size === 1 && near[j].has([...s][0])).length;
      const open = cand.map((s, g) => g).filter((g) => cand[g].size > 1 && [...cand[g]].some((i) => near[j].has(i)));
      const trim = (g, keep, kind) => {
        const next = new Set([...cand[g]].filter((i) => near[j].has(i) === keep));
        if (next.size && next.size < cand[g].size) { cand[g] = next; why[g] = { j, kind }; changed = true; }
      };
      if (fixed === k.n) open.forEach((g) => trim(g, false, 'full'));
      else if (fixed + open.length === k.n) open.forEach((g) => trim(g, true, 'needs'));
    });
    cand.forEach((s, g) => { if (s.size === 1 && !why[g]) why[g] = { j: -1, kind: 'only' }; });
  }
  const g = cand.findIndex((s, g) => s.size === 1 && state.placed[g] < 0);
  if (g >= 0) {
    const w = why[g], cell = [...cand[g]][0], j = w.j >= 0 ? w.j : L.clues.findIndex((k, q) => near[q].has(cell));
    const text = w.kind === 'full' ? `${at(w.j)} already has all its critters, so the other cells touching it stay empty. That leaves this one.`
      : w.kind === 'needs' ? `${at(w.j)} needs a critter from every region that can reach it, so this region must use a cell touching it.`
      : `This region has only one cell left.`;
    return { cell: pos(cell), clue: j >= 0 ? [L.clues[j].r, L.clues[j].c] : null, n: j >= 0 ? L.clues[j].n : 0, kind: w.kind, text };
  }
  // deduction by single clues ran dry: name the one cell that fits everything
  const sol = solve(L, 1)[0] || [];
  const left = sol.findIndex((p, g) => state.placed[g] < 0);
  if (left < 0) return null;
  const j = L.clues.findIndex((k, q) => near[q].has(sol[left]));
  return { cell: pos(sol[left]), clue: j >= 0 ? [L.clues[j].r, L.clues[j].c] : null, n: j >= 0 ? L.clues[j].n : 0, kind: 'fit', text: j >= 0 ? `This is the only cell in its region that fits every clue, starting with ${at(j)}.` : 'This is the only cell in its region that fits every clue.' };
}

// ---- progression: stars, rewards, unlocks, saving ----

export const SAVE_KEY = 'burrowcount.progress.v1';
export const FIRST_CLEAR_COINS = 10, STAR_COINS = 5, REWARDED_COINS = 10;
// cosmetic critter looks, unlocked by total stars; the next one is always shown with progress
export const UNLOCKS = [
  { id: 'sunset', name: 'Sunset critters', stars: 6 },
  { id: 'moonlit', name: 'Moonlit critters', stars: 15 },
  { id: 'golden', name: 'Golden critters', stars: 24 },
  { id: 'starlit', name: 'Starlit critters', stars: 40 },
];
// chapter completion rewards, issued once when every level of the chapter is cleared
export const CHAPTER_REWARDS = { 1: { coins: 50, unlock: 'keeper-hat', name: 'Burrow Keeper hat' },
  2: { coins: 75, unlock: 'tunnel-lantern', name: 'Tunnel lantern' },
  3: { coins: 100, unlock: 'crossroads-signpost', name: 'Crossroads signpost' } };

export const newProgress = () => ({ v: 1, levels: {}, coins: 0, unlocks: [], chapters: {}, bonus: {} });

export function totalStars(p) { return Object.values(p.levels).reduce((n, l) => n + l.stars, 0); }

export function isUnlocked(p, levels, index) { return index === 0 || !!p.levels[levels[index - 1].id]; }

export function nextUnlock(p) {
  const have = totalStars(p), next = UNLOCKS.find((u) => u.stars > have);
  return next ? { id: next.id, name: next.name, need: next.stars, have, left: next.stars - have } : null;
}

// Record a finished level. Pure: returns {progress, reward}. Coins come only from a
// first clear (10 + 5 a star) or from earning extra stars on a replay (5 each), so a
// replay with nothing new pays nothing. chapterIds: the ids of every level in this chapter.
export function recordClear(progress, level, state, chapterIds = []) {
  const p = JSON.parse(JSON.stringify(progress));
  const reward = { firstClear: false, stars: 0, newStars: 0, coins: 0, unlocks: [], chapter: null };
  if (state.result !== 'won') return { progress: p, reward };
  const earned = stars(state), prev = p.levels[level.id];
  reward.stars = earned;
  if (!prev) { reward.firstClear = true; reward.newStars = earned; reward.coins = FIRST_CLEAR_COINS + STAR_COINS * earned; p.levels[level.id] = { stars: earned }; }
  else if (earned > prev.stars) { reward.newStars = earned - prev.stars; reward.coins = STAR_COINS * reward.newStars; prev.stars = earned; }
  for (const u of UNLOCKS) if (totalStars(p) >= u.stars && !p.unlocks.includes(u.id)) { p.unlocks.push(u.id); reward.unlocks.push(u.id); }
  const cr = CHAPTER_REWARDS[level.chapter];
  if (cr && !p.chapters[level.chapter] && chapterIds.length && chapterIds.every((id) => p.levels[id])) {
    p.chapters[level.chapter] = true;
    p.unlocks.push(cr.unlock);
    reward.coins += cr.coins;
    reward.chapter = { chapter: level.chapter, coins: cr.coins, unlock: cr.unlock, name: cr.name };
  }
  p.coins += reward.coins;
  return { progress: p, reward };
}

// Optional rewarded ad: only a completed view pays, once per level, and nothing else changes.
export function rewardedBonus(progress, levelId, result) {
  const p = JSON.parse(JSON.stringify(progress));
  if (result !== 'rewarded' || p.bonus[levelId]) return { progress: p, granted: 0 };
  p.bonus[levelId] = true;
  p.coins += REWARDED_COINS;
  return { progress: p, granted: REWARDED_COINS };
}

export function saveProgress(storage, progress) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(progress)); return { ok: true, error: null }; }
  catch (e) { return { ok: false, error: `Could not save your progress (${e.message}). It will be lost when you close the game.` }; }
}

export function loadProgress(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); }
  catch (e) { return { progress: newProgress(), error: `Could not read your saved progress (${e.message}). Starting fresh.` }; }
  if (raw == null) return { progress: newProgress(), error: null };
  try {
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || typeof p.levels !== 'object' || typeof p.coins !== 'number' || !Array.isArray(p.unlocks)) throw new Error('unexpected shape');
    return { progress: { ...newProgress(), ...p }, error: null };
  } catch (e) { return { progress: newProgress(), error: `Your saved progress could not be read (${e.message}). Starting fresh.` }; }
}
