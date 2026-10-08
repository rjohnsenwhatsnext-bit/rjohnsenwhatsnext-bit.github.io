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
//
// Chapter 2 mechanics (all optional level fields, absent means off):
//   rocks: N        N fixed rocks (state.rocks = [[x, y]], state.rockAt[y * w + x]). A rock is never
//                   cleared and blocks any line whose path crosses it. Boards are still built so every
//                   line's path avoids the rocks. A tap on a rock does nothing. blockedBy(state, line)
//                   returns {line, rock} for what is in the way (line id or -1, rock [x, y] or null),
//                   or null when clear. blockerOf still reports only the nearest line.
//                   A blocked tap sets state.flash = {line, blocker, rock, ttl}: rock is the [x, y] of
//                   the rock when a rock is nearer than any line (blocker is then -1), otherwise null.
//   frozen: N       N lines start frozen (line.frozen = true). The first tap on a frozen line whose path
//                   is clear thaws it: it counts as a tap, costs no life, sets state.thawed to its id,
//                   and the line stays put. The next tap slides it out. A frozen line that is blocked
//                   flashes as a normal blocked tap. Undo does not refreeze a line.
//   timeLimit: T    ticks (60 per second) before the level is lost, counted from the first tick.

// Chapter 3 mechanics (optional level fields, absent means off):
//   numbered: N     N lines carry a number 1..N (line.num) and must be cleared in number order. Numbers
//                   follow the reverse build order, so a valid order always exists. Tapping a numbered line
//                   whose path is clear but whose turn has not come is a mistake (costs a life, counts as a
//                   tap). orderNext(state) is the id of the numbered line whose turn it is, or -1.
//   locked: N       N lines start locked (line.keyId = id of its key line). A locked line cannot be tapped
//                   until its key line has slid out (undoing the key locks it again). Keys always come later
//                   in the build, so they can always be cleared first. A tap on a locked line with a clear
//                   path is a mistake.
//                   Both rules set state.flash = {line, blocker, rock: null, ttl, reason}: reason is 'order'
//                   or 'lock' and blocker is the line the player should clear first (next number or the key).
//                   A physical block always wins over these, and flash.reason is then absent.
//   lineRestriction(state, line) returns null or {reason, by} for these two rules. freeLines respects them.

// Chapter 4 mechanic (optional level field, absent means off):
//   linked: N       N pairs of linked lines (line.link = id of its partner, on both). A pair slides out
//                   together on one tap, but only when BOTH lines have a clear path. Each line ignores its
//                   partner's body when checking its own path. If either line is blocked the tap is a normal
//                   blocked tap: the tapped line flashes and so does whatever blocks it (or blocks the partner),
//                   and a life is lost. A pair is always the line with id i and the line with id i + 1, so when
//                   every later line is out both are free and a valid order always exists. A tap that slides a
//                   pair sets state.slid = [ids] (one id for an ordinary line). Undo puts the pair back together.
//                   Linked lines are never also numbered, locked or frozen, so linked levels leave those fields out.
//                   blockedBy(state, line) reports the first obstacle for the line or its partner.

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

// Rock cells for a level, from their own random stream so lines are unaffected when rocks are 0.
export function placeRocks(level, seed) {
  const { w, h, rocks = 0 } = level;
  const rand = rng((seed ^ 0x9e3779b9) >>> 0);
  const out = [];
  const seen = new Set();
  for (let attempt = 0; attempt < rocks * 40 && out.length < rocks; attempt++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h);
    if (seen.has(y * w + x)) continue;
    seen.add(y * w + x);
    out.push([x, y]);
  }
  return out;
}

// What is in the way of a line: {line, rock} or null when its path is clear.
function rayBlock(state, line, ignore) {
  for (const [x, y] of ray(state, line)) {
    const i = y * state.w + x;
    if (state.rockAt && state.rockAt[i]) return { line: -1, rock: [x, y] };
    if (state.grid[i] !== -1 && state.grid[i] !== ignore) return { line: state.grid[i], rock: null };
  }
  return null;
}

export function blockedBy(state, line) {
  const link = line.link;
  if (link === undefined) return rayBlock(state, line, -2);
  return rayBlock(state, line, link) || (state.lines[link].out ? null : rayBlock(state, state.lines[link], line.id));
}

// Id of the numbered line whose turn it is, or -1 when none are left.
export function orderNext(state) {
  let best = null;
  for (const l of state.lines) if (l.num !== undefined && !l.out && (best === null || l.num < best.num)) best = l;
  return best ? best.id : -1;
}

// Why a line with a clear path still cannot slide: {reason: 'lock'|'order', by} or null.
export function lineRestriction(state, line) {
  if (line.keyId !== undefined && !state.lines[line.keyId].out) return { reason: 'lock', by: line.keyId };
  if (line.num !== undefined) {
    const next = orderNext(state);
    if (next !== line.id) return { reason: 'order', by: next };
  }
  return null;
}

export function generate(level, seed, rocks = []) {
  const { w, h, count, minLen = 2, maxLen = 5 } = level;
  const rand = rng(seed);
  const grid = new Array(w * h).fill(-1);
  const rockSet = new Set(rocks.map(([x, y]) => y * w + x));
  const lines = [];
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === -1 && !rockSet.has(y * w + x);
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
    const clear = ray({ w, h }, line).every(([x, y]) => grid[y * w + x] === -1 && !rockSet.has(y * w + x) && !taken.has(y * w + x));
    if (!clear) continue;
    for (const [x, y] of cells) grid[y * w + x] = line.id;
    lines.push(line);
  }
  return lines;
}

// level: {w, h, count, minLen, maxLen, seed, lives (null = unlimited), maxTaps (null = unlimited)}
export function newGame(level, seed = 0) {
  const lineSeed = (level.seed + seed * 7919) >>> 0;
  const rocks = placeRocks(level, lineSeed);
  const lines = generate(level, lineSeed, rocks);
  const grid = new Array(level.w * level.h).fill(-1);
  for (const l of lines) for (const [x, y] of l.cells) grid[y * level.w + x] = l.id;
  const rockAt = new Array(level.w * level.h).fill(false);
  for (const [x, y] of rocks) rockAt[y * level.w + x] = true;
  // Frozen lines are picked from their own random stream.
  const frand = rng((lineSeed ^ 0x85ebca6b) >>> 0);
  let toFreeze = Math.min(level.frozen ?? 0, lines.length);
  for (let guard = 0; toFreeze > 0 && guard < lines.length * 40; guard++) {
    const l = lines[Math.floor(frand() * lines.length)];
    if (!l.frozen) { l.frozen = true; toFreeze--; }
  }
  // Numbers and locks come from their own random stream. Later-built lines clear first, so numbers rise as
  // ids fall and every key has a higher id than the line it locks.
  const orand = rng((lineSeed ^ 0xc2b2ae35) >>> 0);
  const pick = (n, pool) => {
    const left = pool.slice(), out = [];
    while (out.length < n && left.length) out.push(left.splice(Math.floor(orand() * left.length), 1)[0]);
    return out;
  };
  const numbered = pick(level.numbered ?? 0, lines.map((l) => l.id)).sort((a, b) => b - a);
  numbered.forEach((id, i) => { lines[id].num = i + 1; });
  for (const id of pick(level.locked ?? 0, lines.slice(0, -1).map((l) => l.id))) {
    lines[id].keyId = id + 1 + Math.floor(orand() * (lines.length - 1 - id));
  }
  // Linked pairs (id i with id i + 1) come from their own random stream.
  const lrand = rng((lineSeed ^ 0x27d4eb2f) >>> 0);
  const used = new Set();
  const starts = lines.slice(0, -1).map((l) => l.id);
  for (let n = 0; n < (level.linked ?? 0) && starts.length; n++) {
    for (let guard = 0; guard < starts.length * 4; guard++) {
      const i = starts[Math.floor(lrand() * starts.length)];
      if (used.has(i) || used.has(i + 1)) continue;
      used.add(i);
      used.add(i + 1);
      lines[i].link = i + 1;
      lines[i + 1].link = i;
      break;
    }
  }
  return {
    w: level.w, h: level.h, grid, lines, tick: 0, slid: null,
    lives: level.lives ?? null, maxTaps: level.maxTaps ?? null, timeLimit: level.timeLimit ?? null,
    rocks, rockAt, thawed: null,
    taps: 0, cleared: [], flash: null, hint: null, hintsUsed: 0, mistakes: 0,
  };
}

export function freeLines(state) {
  return state.lines.filter((l) => !l.out && blockedBy(state, l) === null && lineRestriction(state, l) === null);
}

export function status(state) {
  if (state.lines.every((l) => l.out)) return 'won';
  if (state.lives !== null && state.lives <= 0) return 'lost';
  if (state.maxTaps !== null && state.taps >= state.maxTaps) return 'lost';
  if (state.timeLimit != null && state.tick >= state.timeLimit) return 'lost';
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
    if (line.link !== undefined && state.cleared[state.cleared.length - 1] === line.link) {
      const mate = state.lines[state.cleared.pop()];
      mate.out = false;
      setLine(state, mate, mate.id);
    }
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
    const by = blockedBy(state, line);
    const why = by === null ? lineRestriction(state, line) : null;
    if (why) {
      state.mistakes++;
      if (state.lives !== null) state.lives--;
      state.flash = { line: id, blocker: why.by, rock: null, ttl: FLASH_TICKS, reason: why.reason };
    } else if (by === null && line.frozen) {
      line.frozen = false;
      state.thawed = id;
      state.hint = null;
    } else if (by === null) {
      line.out = true;
      setLine(state, line, -1);
      state.slid = [id];
      if (line.link !== undefined) {
        const mate = state.lines[line.link];
        mate.out = true;
        setLine(state, mate, -1);
        state.cleared.push(mate.id);
        state.slid.push(mate.id);
      }
      state.cleared.push(id);
      state.hint = null;
      state.flash = null;
    } else {
      state.mistakes++;
      if (state.lives !== null) state.lives--;
      state.flash = { line: id, blocker: by.line, rock: by.rock, ttl: FLASH_TICKS };
    }
  }
  return state;
}
