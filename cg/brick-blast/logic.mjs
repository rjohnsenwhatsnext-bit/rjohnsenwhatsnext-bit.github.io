// Brick Blast: the rules. Pure and seeded (the same seed gives the same
// pieces and the same miner), so the tests, a daily board and a server check
// can all use them. No drawing here.
//
// Ryan, 29 Sep 2026: "each time you get a row it counts to points, points
// that fill a thing up and when its full something pops out like a little
// old school miner and runs around a paused screen and randomly puts little
// dynamites on the pillars remaining regardless of if they line up colour
// wise it blows them up and destroys sections of the map giving the player
// more points and a cleaner plate".

export const SIZE = 8;
export const COLOURS = 6;

// Every piece shape, as cells [row, col] from its top left.
export const SHAPES = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 1], [1, 1], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
];

// the blast meter: how many points fill it, rising each time it goes off
export const METER = { first: 120, grow: 1.2 };

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

export function newGame(seed = 1) {
  const g = {
    seed,
    rand: rng(seed),
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), // 0 empty, 1..COLOURS a brick
    tray: [],
    score: 0,
    meter: 0,
    meterMax: METER.first,
    blasts: 0,
    streak: 0, // clears in a row: the combo
    moves: 0,
    over: false,
  };
  deal(g);
  return g;
}

// three new pieces; never a hand where nothing at all fits while space remains
export function deal(g) {
  g.tray = [0, 1, 2].map(() => ({ shape: Math.floor(g.rand() * SHAPES.length), colour: 1 + Math.floor(g.rand() * COLOURS) }));
  if (!g.tray.some((p) => fitsAnywhere(g.board, SHAPES[p.shape])) && emptyCount(g.board) > 0) g.tray[0] = { shape: 0, colour: g.tray[0].colour };
}

export const emptyCount = (board) => board.flat().filter((c) => !c).length;
export function fits(board, shape, r, c) {
  return shape.every(([dr, dc]) => r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE && !board[r + dr][c + dc]);
}
export function fitsAnywhere(board, shape) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(board, shape, r, c)) return true;
  return false;
}

// Place tray piece i at (r, c). Returns what happened, for the screen to show:
// the rows and columns cleared, points, whether the meter filled.
export function place(g, i, r, c) {
  const piece = g.tray[i];
  if (g.over || !piece) throw new Error('No such piece');
  const shape = SHAPES[piece.shape];
  if (!fits(g.board, shape, r, c)) throw new Error('It does not fit there');
  for (const [dr, dc] of shape) g.board[r + dr][c + dc] = piece.colour;
  g.tray[i] = null;
  g.moves++;
  let points = shape.length; // a point a brick placed
  const rows = [];
  const cols = [];
  for (let k = 0; k < SIZE; k++) {
    if (g.board[k].every(Boolean)) rows.push(k);
    if (g.board.every((row) => row[k])) cols.push(k);
  }
  const lines = rows.length + cols.length;
  const cleared = [];
  for (const k of rows) for (let j = 0; j < SIZE; j++) cleared.push([k, j]);
  for (const k of cols) for (let j = 0; j < SIZE; j++) cleared.push([j, k]);
  for (const [a, b] of cleared) g.board[a][b] = 0;
  if (lines) {
    g.streak++;
    // more lines at once pays far more, and a combo streak multiplies it
    points += 10 * lines * lines * Math.min(g.streak, 10);
  } else g.streak = 0;
  g.score += points;
  // only clears feed the meter: the feature is earned by clearing
  const feed = lines ? points : 0;
  g.meter = Math.min(g.meterMax, g.meter + feed);
  const blastReady = g.meter >= g.meterMax;
  if (g.tray.every((p) => !p)) deal(g);
  if (!blastReady) checkOver(g);
  return { rows, cols, lines, points, streak: g.streak, blastReady };
}

export function checkOver(g) {
  g.over = !g.tray.some((p) => p && fitsAnywhere(g.board, SHAPES[p.shape]));
  return g.over;
}

// ---- the miner's blast
// He drops dynamite on random bricks, colour does not matter. Usually a few
// sticks; sometimes he goes mad (the pokie variable: you never know which).
// Each stick blows a plus-shaped hole (its brick and the four around it),
// with a bigger 3x3 hole for the rare big sticks.
export const BLAST_TIERS = [
  { name: 'Blast', sticks: [3, 5], big: 0, weight: 70 },
  { name: 'Big Blast', sticks: [6, 8], big: 1, weight: 22 },
  { name: 'Mega Blast', sticks: [10, 14], big: 3, weight: 7 },
  { name: 'Mother Lode', sticks: [18, 24], big: 6, weight: 1 },
];

export function planBlast(g) {
  const r = g.rand;
  let roll = r() * BLAST_TIERS.reduce((s, t) => s + t.weight, 0);
  let tier = BLAST_TIERS[0];
  for (const t of BLAST_TIERS) {
    if (roll < t.weight) {
      tier = t;
      break;
    }
    roll -= t.weight;
  }
  const bricks = [];
  for (let a = 0; a < SIZE; a++) for (let b = 0; b < SIZE; b++) if (g.board[a][b]) bricks.push([a, b]);
  const n = Math.min(bricks.length, tier.sticks[0] + Math.floor(r() * (tier.sticks[1] - tier.sticks[0] + 1)));
  // shuffle and take n: each stick on its own brick
  for (let i = bricks.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [bricks[i], bricks[j]] = [bricks[j], bricks[i]];
  }
  const sticks = bricks.slice(0, n).map(([a, b], i) => ({ r: a, c: b, big: i < tier.big }));
  return { tier: tier.name, sticks };
}

// Set off the plan one stick at a time; each result is one explosion for the
// screen (the bricks it took and the points). Points climb stick by stick.
export function detonate(g, plan) {
  const booms = [];
  let chain = 0;
  for (const s of plan.sticks) {
    const hit = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!s.big && dr && dc) continue; // small stick: a plus; big stick: the full square
        const a = s.r + dr;
        const b = s.c + dc;
        if (a >= 0 && a < SIZE && b >= 0 && b < SIZE && g.board[a][b]) {
          g.board[a][b] = 0;
          hit.push([a, b]);
        }
      }
    chain++;
    const points = hit.length * 15 * chain; // each stick in the chain pays more than the last
    g.score += points;
    booms.push({ ...s, hit, points });
  }
  const total = booms.reduce((s, b) => s + b.points, 0);
  g.blasts++;
  g.meter = 0;
  g.meterMax = Math.round(METER.first * METER.grow ** g.blasts);
  checkOver(g);
  return { booms, total };
}

// A revive (a rewarded ad): the miner blows a hole in the middle of the board.
export function reviveBlast(g) {
  const booms = [];
  const mid = SIZE / 2;
  for (const [a, b] of [[mid - 2, mid - 2], [mid - 2, mid + 1], [mid + 1, mid - 2], [mid + 1, mid + 1]]) {
    const hit = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const x = a + dr;
        const y = b + dc;
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && g.board[x][y]) {
          g.board[x][y] = 0;
          hit.push([x, y]);
        }
      }
    booms.push({ r: a, c: b, big: true, hit, points: 0 });
  }
  g.over = false;
  checkOver(g);
  return { booms };
}

// Big win tiers for a feature's total, by how it compares with the meter size.
export function winTier(total, meterMax) {
  const x = total / meterMax;
  // a small blast is its own reward; the big win words have to be earned
  return x >= 12 ? 'Legendary' : x >= 6 ? 'Epic' : x >= 3 ? 'Mega' : x >= 1.5 ? 'Big' : null;
}
