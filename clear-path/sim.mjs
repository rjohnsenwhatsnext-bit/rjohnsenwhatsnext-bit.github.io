// Clear Path: pure rules (Claude). No DOM, no clock, deterministic.
//
// A board is a grid of arrows. Tapping an arrow slides it off the board if
// every cell in front of it, out to the edge, is empty. Otherwise the tap is
// blocked and counts as a slip. Clear every arrow to win; more slips than the
// level allows loses. Undo is free and unlimited, but it never takes a slip back.
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
//   { type: 'slide'|'blocked'|'undo'|'none', x, y, blockers: [{x,y}] }.

export const EMPTY = 0, UP = 1, RIGHT = 2, DOWN = 3, LEFT = 4;
const DX = [0, 0, 1, 0, -1];
const DY = [0, -1, 0, 1, 0];
const GLYPH = { '^': UP, '>': RIGHT, v: DOWN, '<': LEFT };

export function newGame(level, seed = 0) {
  const w = level.w, h = level.h;
  const cells = new Array(w * h).fill(EMPTY);
  let left = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = GLYPH[level.rows[y][x]] || EMPTY;
      cells[y * w + x] = d;
      if (d) left++;
    }
  }
  return {
    w, h, cells, left, slips: 0, maxSlips: level.slips == null ? 3 : level.slips,
    ticks: 0, seed, history: [], last: { type: 'none', x: -1, y: -1, blockers: [] },
  };
}

// Cells holding an arrow in front of the arrow at (x, y), nearest first.
export function blockers(state, x, y) {
  const d = state.cells[y * state.w + x];
  const out = [];
  if (!d) return out;
  let cx = x + DX[d], cy = y + DY[d];
  while (cx >= 0 && cy >= 0 && cx < state.w && cy < state.h) {
    if (state.cells[cy * state.w + cx]) out.push({ x: cx, y: cy });
    cx += DX[d]; cy += DY[d];
  }
  return out;
}

// Every arrow that could be tapped right now, in reading order.
export function freeArrows(state) {
  const out = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (state.cells[y * state.w + x] && !blockers(state, x, y).length) out.push({ x, y });
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
      state.left++;
      state.last = { type: 'undo', x: prev.x, y: prev.y, blockers: [] };
    }
    return state;
  }
  const t = input.tap;
  if (!t || t.x < 0 || t.y < 0 || t.x >= state.w || t.y >= state.h) return state;
  const d = state.cells[t.y * state.w + t.x];
  if (!d) return state;
  const b = blockers(state, t.x, t.y);
  if (b.length) {
    state.slips++;
    state.last = { type: 'blocked', x: t.x, y: t.y, blockers: b };
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
