// Clear Path: pure rules (Claude). No DOM, no clock, deterministic.
//
// A board is a grid of arrows. Tapping an arrow slides it off the board if
// every cell in front of it, out to the edge, is empty. Otherwise the tap is
// blocked and counts as a slip. Clear every arrow to win; more slips than the
// level allows loses. Undo is free and unlimited, but it never takes a slip back.
//
// WALLS (chapter 2): 'X' in a level's rows is a wall, stored as 5. A wall is
// never tapped, never slides, never counts towards left, and never leaves, so
// any arrow pointing at one is blocked for good, so levels are laid so every
// arrow still has a way out (the tests check it with the bot). A wall is reported
// as a blocker like any arrow, so the highlight shows it.
//
// STURDY ARROWS (chapter 3): 'U' 'R' 'D' 'L' are sturdy arrows (cell values 6 to
// 9, direction as the plain arrow). A sturdy arrow needs two taps. The first tap,
// when its path is clear, cracks it into a plain arrow (last.type 'crack', no
// slip, left unchanged); the second slides it off. A blocked tap is a slip as
// usual. Undo takes back a crack too. Solvability is unchanged, because a sturdy
// arrow blocks exactly like a plain one and is free exactly when a plain one is.
//
// GATES (chapter 4): 'G' in a level's rows is a gate (cell value 10). While more
// than level.gateAt arrows are left, a gate is closed and blocks like a wall (it is
// reported as a blocker, never tapped, never counted in left). Once left is
// gateAt or fewer, every gate is open and blocks nothing. The state is derived
// from left, so undo closes the gates again. state.gateAt is 0 on boards without
// gates; state.gateOpen(state) is not stored, use gatesOpen(state). Levels are
// only built from seeds where the bot wins and the gates matter (closed for good,
// the bot is stuck), so every gate board is solvable.
//
// GHOST ARROWS (chapter 5): 'N' 'E' 'S' 'W' are ghost arrows pointing up, right,
// down, left (cell values 11 to 14). A ghost is tapped and slides off like a plain
// arrow and is blocked like one, but it is see-through: it never blocks any other
// arrow, so it is never reported as a blocker. Because a ghost only removes
// blockers, a board that is solvable with plain arrows stays solvable.
//
// TICK: one tick is one player action (there is no clock in the rules). The
// frontend animates the slide however long it likes.
//
// INPUT to step(state, input):
//   { tap: { x, y } }   tap the cell at column x, row y
//   { undo: true }      put back the arrow that was last slid off
//   {} or null          do nothing (still one tick)
//
// STATE (plain object, JSON safe): { w, h, cells, left, slips, maxSlips,
//   ticks, seed, history, last }. cells is row major: 0 empty, 1 up, 2 right,
//   3 down, 4 left. last describes the most recent action:
//   { type: 'slide'|'blocked'|'undo'|'crack'|'none', x, y, blockers: [{x,y}] }.
//   Cells 6 to 9 are sturdy up, right, down, left.

export const EMPTY = 0, UP = 1, RIGHT = 2, DOWN = 3, LEFT = 4, WALL = 5;
export const STURDY_UP = 6, STURDY_RIGHT = 7, STURDY_DOWN = 8, STURDY_LEFT = 9;
export const GATE = 10;
export const GHOST_UP = 11, GHOST_RIGHT = 12, GHOST_DOWN = 13, GHOST_LEFT = 14;
const DX = [0, 0, 1, 0, -1];
const DY = [0, -1, 0, 1, 0];
const GLYPH = {
  '^': UP, '>': RIGHT, v: DOWN, '<': LEFT, X: WALL,
  U: STURDY_UP, R: STURDY_RIGHT, D: STURDY_DOWN, L: STURDY_LEFT, G: GATE,
  N: GHOST_UP, E: GHOST_RIGHT, S: GHOST_DOWN, W: GHOST_LEFT,
};

// Direction 1 to 4 of an arrow cell, sturdy or plain (0 for empty, wall or gate).
function dirOf(c) {
  if (c >= STURDY_UP && c <= STURDY_LEFT) return c - 5;
  if (c >= GHOST_UP && c <= GHOST_LEFT) return c - 10;
  return c === WALL || c === GATE ? 0 : c;
}

// True when a cell is an arrow, sturdy or plain.
function isArrow(c) {
  return c !== EMPTY && c !== WALL && c !== GATE;
}

// True once enough arrows are gone for the gates to be open.
export function gatesOpen(state) {
  return state.gateAt > 0 && state.left <= state.gateAt;
}

export function newGame(level, seed = 0) {
  const w = level.w, h = level.h;
  const cells = new Array(w * h).fill(EMPTY);
  let left = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = GLYPH[level.rows[y][x]] || EMPTY;
      cells[y * w + x] = d;
      if (isArrow(d)) left++;
    }
  }
  return {
    w, h, cells, left, slips: 0, maxSlips: level.slips == null ? 3 : level.slips,
    gateAt: level.gateAt || 0,
    ticks: 0, seed, history: [], last: { type: 'none', x: -1, y: -1, blockers: [] },
  };
}

// Cells holding an arrow in front of the arrow at (x, y), nearest first.
export function blockers(state, x, y) {
  const d = dirOf(state.cells[y * state.w + x]);
  const out = [];
  if (!d) return out;
  const open = gatesOpen(state);
  let cx = x + DX[d], cy = y + DY[d];
  while (cx >= 0 && cy >= 0 && cx < state.w && cy < state.h) {
    const c = state.cells[cy * state.w + cx];
    const ghost = c >= GHOST_UP && c <= GHOST_LEFT;
    if (c && !ghost && !(c === GATE && open)) out.push({ x: cx, y: cy });
    cx += DX[d]; cy += DY[d];
  }
  return out;
}

// Every arrow that could be tapped right now, in reading order.
export function freeArrows(state) {
  const out = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      const c = state.cells[y * state.w + x];
      if (isArrow(c) && !blockers(state, x, y).length) out.push({ x, y });
    }
  }
  return out;
}

// A hint is the first free arrow, or null when the board is clear.
export function hint(state) {
  return freeArrows(state)[0] || null;
}

export function step(state, input) {
  state.ticks++;
  state.last = { type: 'none', x: -1, y: -1, blockers: [] };
  if (!input || status(state) !== 'playing') return state;
  if (input.undo) {
    const prev = state.history.pop();
    if (prev) {
      state.cells[prev.y * state.w + prev.x] = prev.d;
      if (!prev.crack) state.left++;
      state.last = { type: 'undo', x: prev.x, y: prev.y, blockers: [] };
    }
    return state;
  }
  const t = input.tap;
  if (!t || t.x < 0 || t.y < 0 || t.x >= state.w || t.y >= state.h) return state;
  const d = state.cells[t.y * state.w + t.x];
  if (!isArrow(d)) return state;
  const b = blockers(state, t.x, t.y);
  if (b.length) {
    state.slips++;
    state.last = { type: 'blocked', x: t.x, y: t.y, blockers: b };
  } else if (d >= STURDY_UP && d <= STURDY_LEFT) {
    // First tap on a free sturdy arrow only cracks it: it becomes a plain arrow.
    state.cells[t.y * state.w + t.x] = d - 5;
    state.history.push({ x: t.x, y: t.y, d, crack: true });
    state.last = { type: 'crack', x: t.x, y: t.y, blockers: [] };
  } else {
    state.cells[t.y * state.w + t.x] = EMPTY;
    state.left--;
    state.history.push({ x: t.x, y: t.y, d });
    state.last = { type: 'slide', x: t.x, y: t.y, blockers: [] };
  }
  return state;
}

export function status(state) {
  if (state.left === 0) return 'won';
  if (state.slips > state.maxSlips) return 'lost';
  return 'playing';
}
