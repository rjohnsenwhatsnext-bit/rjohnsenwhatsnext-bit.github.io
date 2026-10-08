// Tangle Out rules. Pure and deterministic: no DOM, no clock, no Math.random.
//
// Tick length: one step() is 1/60 of a second. Ticks only run the blocked-line flash timer;
// every rule change happens on the tick that carries an input.
//
// Input shape passed to step(state, input) (input may be null or {} for a plain tick):
//   { tap: {x, y} }   tap the board cell (x, y). A line under the cell slides out if its
//                     straight path to the edge is clear, otherwise it flashes and the line
//                     in its way flashes too (state.flash), and a life is lost.
//   { undo: true }    put back the most recently cleared line (taps and lives are not refunded)
//   { hint: true }    set state.hint to the id of a line that can slide out now
//
// A line is a run of cells, tail first. Its head is the last cell and it points the way
// its last segment goes (a single cell line points where level data says, from the generator).
// Boards are built in reverse: each new line is only placed if its path out is clear of
// every line already placed, so clearing lines in the reverse order always works.

export const TICK = 1 / 60;
export const FLASH_TICKS = 50;
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cells from just past the head to the board edge.
export function ray(state, line) {
  const [hx, hy] = line.cells[line.cells.length - 1];
  const [dx, dy] = DIRS[line.dir];
  const out = [];
  for (let x = hx + dx, y = hy + dy; x >= 0 && y >= 0 && x < state.w && y < state.h; x += dx, y += dy) out.push([x, y]);
  return out;
}

// Id of the nearest line in the way, or -1 when the path is clear.
export function blockerOf(state, line) {
  for (const [x, y] of ray(state, line)) {
    const id = state.grid[y * state.w + x];
    if (id !== -1) return id;
  }
  return -1;
}

export function generate(level, seed) {
  const { w, h, count, minLen = 2, maxLen = 5 } = level;
  const rand = rng(seed);
  const grid = new Array(w * h).fill(-1);
  const lines = [];
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === -1;
  for (let attempt = 0; attempt < count * 80 && lines.length < count; attempt++) {
    const sx = Math.floor(rand() * w), sy = Math.floor(rand() * h);
    if (!free(sx, sy)) continue;
    const want = minLen + Math.floor(rand() * (maxLen - minLen + 1));
    const cells = [[sx, sy]];
    let dir = Math.floor(rand() * 4);
    const taken = new Set([sy * w + sx]);
    while (cells.length < want) {
      const [cx, cy] = cells[cells.length - 1];
      const order = [0, 1, 2, 3].sort(() => rand() - 0.5);
      if (rand() < 0.55) order.unshift(dir);
      const pick = order.find((d) => free(cx + DIRS[d][0], cy + DIRS[d][1]) && !taken.has((cy + DIRS[d][1]) * w + cx + DIRS[d][0]));
      if (pick === undefined) break;
      dir = pick;
      const nx = cx + DIRS[dir][0], ny = cy + DIRS[dir][1];
      cells.push([nx, ny]);
      taken.add(ny * w + nx);
    }
    if (cells.length < minLen) continue;
    const line = { id: lines.length, cells, dir, out: false };
    // The path out must be clear of every placed line and of this line's own body.
    const clear = ray({ w, h }, line).every(([x, y]) => grid[y * w + x] === -1 && !taken.has(y * w + x));
    if (!clear) continue;
    for (const [x, y] of cells) grid[y * w + x] = line.id;
    lines.push(line);
  }
  return lines;
}

// level: {w, h, count, minLen, maxLen, seed, lives (null = unlimited), maxTaps (null = unlimited)}
export function newGame(level, seed = 0) {
  const lines = generate(level, (level.seed + seed * 7919) >>> 0);
  const grid = new Array(level.w * level.h).fill(-1);
  for (const l of lines) for (const [x, y] of l.cells) grid[y * level.w + x] = l.id;
  return {
    w: level.w, h: level.h, grid, lines, tick: 0,
    lives: level.lives ?? null, maxTaps: level.maxTaps ?? null,
    taps: 0, cleared: [], flash: null, hint: null, hintsUsed: 0, mistakes: 0,
  };
}

export function freeLines(state) {
  return state.lines.filter((l) => !l.out && blockerOf(state, l) === -1);
}

export function status(state) {
  if (state.lines.every((l) => l.out)) return 'won';
  if (state.lives !== null && state.lives <= 0) return 'lost';
  if (state.maxTaps !== null && state.taps >= state.maxTaps) return 'lost';
  return 'playing';
}

function setLine(state, line, id) {
  for (const [x, y] of line.cells) state.grid[y * state.w + x] = id;
}

export function step(state, input) {
  state.tick++;
  if (state.flash && --state.flash.ttl <= 0) state.flash = null;
  if (!input || status(state) !== 'playing') return state;
  if (input.undo && state.cleared.length) {
    const line = state.lines[state.cleared.pop()];
    line.out = false;
    setLine(state, line, line.id);
    state.hint = null;
  } else if (input.hint) {
    const free = freeLines(state);
    state.hint = free.length ? free[0].id : null;
    state.hintsUsed++;
  } else if (input.tap) {
    const { x, y } = input.tap;
    const id = x >= 0 && y >= 0 && x < state.w && y < state.h ? state.grid[y * state.w + x] : -1;
    if (id === -1) return state;
    const line = state.lines[id];
    state.taps++;
    const by = blockerOf(state, line);
    if (by === -1) {
      line.out = true;
      setLine(state, line, -1);
      state.cleared.push(id);
      state.hint = null;
      state.flash = null;
    } else {
      state.mistakes++;
      if (state.lives !== null) state.lives--;
      state.flash = { line: id, blocker: by, ttl: FLASH_TICKS };
    }
  }
  return state;
}
