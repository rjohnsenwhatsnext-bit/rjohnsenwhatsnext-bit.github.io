// The Line: the rules (Claude, 6 Oct 2026). A glowing dot moves on its own and
// draws a line behind it. Touch any line, from this run or any run before, and
// the run is over, and its line stays. Every time you play, you make the game
// harder. (Ryan's brief, 6 Oct 2026.)
//
// Pure: no drawing, no storage, no clock. Codex owns the look; the page owns
// saving (serialiseBoard / loadBoard give a compact string). There is no
// randomness at all: the same board and the same inputs give the same run, so
// a run can be replayed, checked by a server or raced as a ghost.
// sqrt, never Math.hypot (not identical across engines).
//
// Units: the arena is W by H (portrait), origin at its centre, y up. A run
// holds `steer`: -1 turn left, 0 straight, +1 turn right.

export const DT = 1 / 60;
export const W = 9;
export const H = 16;
export const R = 0.13; // the dot
export const LINE = 0.05; // half the width of a line
export const TURN = (210 * Math.PI) / 180; // turning speed, rad/s
export const SPACING = 0.1; // a point is laid every this far
export const SELF_GAP = 0.6; // the newest stretch of your own line cannot kill you (you are drawing it)
export const ERASE_R = 1.15; // erase clears old line inside this circle...
export const ERASE_AHEAD = 1.2; // ...centred this far ahead of the dot
export const CELL = 0.5; // collision grid

// speed eases up over a run, from 3 to 6 per second over about 75 seconds
export const speedAt = (t) => 3 + 3 * Math.min(1, t / 75);
// the edge closes in only on very long runs: from 300 travelled, up to a quarter
export const insetAt = (dist) => Math.min(0.25, Math.max(0, (dist - 300) / 1200)) * Math.min(W, H) / 2;
export const scoreOf = (dist) => Math.floor(dist * 10);

// ---- the board: every run's line, kept between runs
// mode: 'personal' (lines stay for ever), 'daily' (cleared each day), 'global' (later: lines from many players)
export function newBoard(mode = 'personal', day = null) {
  return { mode, day, runs: [], best: 0, totalRuns: 0, totalDistance: 0 };
}
// Today's board: a daily board from another day starts again empty.
export function boardFor(board, day) {
  if (board.mode === 'daily' && board.day !== day) return { ...newBoard('daily', day), best: 0, totalRuns: board.totalRuns, totalDistance: board.totalDistance };
  return board;
}
// a run's line: { pts: [x0, y0, x1, y1, ...], gone: Set of point indexes whose segment to the next was erased,
// retired: true once it has faded to a harmless ghost }
export function lineOf(pts) { return { pts, gone: new Set(), retired: false }; }

// How full the board may get. Every run's line stays, but once the live lines
// pass this density the oldest fades to a ghost: still drawn, no longer
// deadly. Without it the board filled in about fifteen bot runs and every
// run after died at the start (6 Oct 2026); with it the maze stays hard and
// playable for ever. Tuned by the bot test.
export const MAX_DENSITY = 0.6;

// ---- collision grid over every segment of the old lines
function cellsOn(ax, ay, bx, by, pad) {
  const x0 = Math.floor((Math.min(ax, bx) - pad + W / 2) / CELL), x1 = Math.floor((Math.max(ax, bx) + pad + W / 2) / CELL);
  const y0 = Math.floor((Math.min(ay, by) - pad + H / 2) / CELL), y1 = Math.floor((Math.max(ay, by) + pad + H / 2) / CELL);
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(x * 1000 + y);
  return out;
}
export function buildGrid(board) {
  const grid = new Map();
  board.runs.forEach((line, r) => {
    if (line.retired) return;
    const p = line.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (line.gone.has(i / 2)) continue;
      for (const c of cellsOn(p[i], p[i + 1], p[i + 2], p[i + 3], 0)) {
        let list = grid.get(c);
        if (!list) grid.set(c, (list = []));
        list.push(r, i);
      }
    }
  });
  return grid;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const ex = px - (ax + k * dx), ey = py - (ay + k * dy);
  return Math.sqrt(ex * ex + ey * ey);
}
// nearest old line to (x, y): { d, run } (run is which earlier run it was), within `reach`
function nearestOld(board, grid, x, y, reach) {
  let best = { d: Infinity, run: -1 };
  for (const c of cellsOn(x, y, x, y, reach)) {
    const list = grid.get(c);
    if (!list) continue;
    for (let k = 0; k < list.length; k += 2) {
      const r = list[k], i = list[k + 1], p = board.runs[r].pts;
      if (board.runs[r].gone.has(i / 2)) continue;
      const d = segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]);
      if (d < best.d) best = { d, run: r };
    }
  }
  return best;
}
// nearest point of this run's own line, leaving out the stretch being drawn
function nearestOwn(run, x, y) {
  const p = run.pts;
  let drawn = 0, end = p.length - 2;
  // walk back from the dot until SELF_GAP of line is behind it
  while (end >= 2 && drawn < SELF_GAP) {
    const dx = p[end] - p[end - 2], dy = p[end + 1] - p[end - 1];
    drawn += Math.sqrt(dx * dx + dy * dy);
    end -= 2;
  }
  let d = Infinity;
  for (let i = 0; i + 2 <= end; i += 2) d = Math.min(d, segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]));
  return d;
}

// How far the dot could go straight from (x, y) on heading a before touching anything old or the edge.
export function clearRay(board, grid, x, y, a, max = 12, inset = 0) {
  const cx = Math.cos(a), cy = Math.sin(a);
  for (let s = 0; s < max; s += 0.15) {
    const px = x + cx * s, py = y + cy * s;
    if (Math.abs(px) > W / 2 - inset - R || Math.abs(py) > H / 2 - inset - R) return s;
    if (nearestOld(board, grid, px, py, R + LINE + 0.05).d < R + LINE + 0.05) return s;
  }
  return max;
}

// Where a run starts: the open spot with the longest clear way ahead, so a
// crowded board never starts you facing a line. Searched over a fixed grid, so
// it is the same for the same board.
export function spawn(board, grid = buildGrid(board)) {
  if (!board.runs.length) return { x: 0, y: -H / 2 + 2.5, a: Math.PI / 2 };
  let best = null;
  for (let gx = -3; gx <= 3; gx++) for (let gy = -6; gy <= 6; gy++) {
    const x = gx * 1.15, y = gy * 1.15;
    const room = nearestOld(board, grid, x, y, 1.5).d;
    if (room < R + LINE + 0.2) continue; // never start on or against a line
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ray = clearRay(board, grid, x, y, a);
      const score = ray + Math.min(room, 1.5) * 2;
      if (!best || score > best.score) best = { x, y, a, score };
    }
  }
  return best || { x: 0, y: 0, a: Math.PI / 2 };
}

// ---- a run
export function newRun(board) {
  const grid = buildGrid(board);
  const s = spawn(board, grid);
  return {
    board, grid, x: s.x, y: s.y, a: s.a, t: 0, dist: 0, pts: [s.x, s.y], since: 0,
    over: false, cause: null, hitRun: -1, erases: 1, erased: 0, revived: false, events: [],
    trailsAtStart: board.runs.length, density: densityOf(board),
  };
}
// how full the board is: metres of live line per square metre of arena
export function densityOf(board) {
  let len = 0;
  for (const line of board.runs) {
    if (line.retired) continue;
    const p = line.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (line.gone.has(i / 2)) continue;
      const dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1];
      len += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return len / (W * H);
}

// One tick. input.steer: -1, 0, +1. input.erase: true on the tick the button is pressed.
// events: 'erase' { cx, cy, r, removed: [[run, pointIndex], ...] }, 'death' { cause, hitRun, x, y }
export function step(run, input = {}) {
  run.events = [];
  if (run.over) return run;
  if (input.erase) erase(run);
  run.a -= (input.steer || 0) * TURN * DT; // -1 turns left (anticlockwise), +1 right
  const v = speedAt(run.t);
  run.x += Math.cos(run.a) * v * DT;
  run.y += Math.sin(run.a) * v * DT;
  run.t += DT;
  run.dist += v * DT;
  run.since += v * DT;
  if (run.since >= SPACING) { run.pts.push(run.x, run.y); run.since = 0; }
  // the edge
  const inset = insetAt(run.dist);
  if (Math.abs(run.x) > W / 2 - inset - R || Math.abs(run.y) > H / 2 - inset - R) return die(run, 'edge', -1);
  // an old line
  const old = nearestOld(run.board, run.grid, run.x, run.y, R + LINE);
  if (old.d < R + LINE) return die(run, 'old-line', old.run);
  // your own line
  if (nearestOwn(run, run.x, run.y) < R + LINE) return die(run, 'own-line', -1);
  return run;
}
function die(run, cause, hitRun) {
  run.over = true;
  run.cause = cause;
  run.hitRun = hitRun;
  run.pts.push(run.x, run.y);
  run.events.push({ type: 'death', cause, hitRun, x: run.x, y: run.y });
  return run;
}

// Erase: the old line inside a small circle just ahead of the dot goes.
// Never your current line, so it cannot undo the mistake you are making now.
export function erase(run, free = false) {
  if (run.over || (!free && run.erases < 1)) return false;
  if (!free) run.erases--;
  const cx = run.x + Math.cos(run.a) * ERASE_AHEAD, cy = run.y + Math.sin(run.a) * ERASE_AHEAD;
  const removed = [];
  run.board.runs.forEach((line, r) => {
    if (line.retired) return;
    const p = line.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (line.gone.has(i / 2)) continue;
      if (segDist(cx, cy, p[i], p[i + 1], p[i + 2], p[i + 3]) < ERASE_R) { line.gone.add(i / 2); removed.push([r, i / 2]); }
    }
  });
  run.grid = buildGrid(run.board);
  run.erased += removed.length;
  run.events.push({ type: 'erase', cx, cy, r: ERASE_R, removed });
  return true;
}
// A rewarded ad's second erase, for this run only.
export const grantErase = (run) => { run.erases++; };

// Continue once after death (a rewarded ad): back 1.5 seconds along the line,
// turned to the clearest way out. The line drawn since is taken back too.
export function revive(run) {
  if (!run.over || run.revived) return false;
  const back = Math.max(4, Math.round((1.5 * speedAt(run.t)) / SPACING));
  const keep = Math.max(2, run.pts.length - back * 2);
  run.pts.length = keep - (keep % 2);
  run.x = run.pts[run.pts.length - 2];
  run.y = run.pts[run.pts.length - 1];
  // each way out is flown for a second through the real step, so the run's own
  // line counts too (a plain look at old lines turned it back into itself)
  let best = run.a, far = -1;
  run.over = false;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const q = { ...run, a, pts: run.pts.slice(), events: [] };
    let ticks = 0;
    for (; ticks < 60 && !q.over; ticks++) step(q, {});
    const score = q.over ? ticks : 60 + clearRay(run.board, run.grid, q.x, q.y, a, 12, insetAt(q.dist));
    if (score > far) { far = score; best = a; }
  }
  run.a = best;
  run.over = false;
  run.cause = null;
  run.revived = true;
  run.since = 0;
  return true;
}

// The run is over: its line joins the board for good, and the totals move.
export function finish(board, run) {
  board.runs.push(lineOf(run.pts.slice()));
  // the oldest live lines fade to ghosts while the board is too full
  const faded = [];
  for (let r = 0; r < board.runs.length - 1 && densityOf(board) > MAX_DENSITY; r++) {
    if (!board.runs[r].retired) { board.runs[r].retired = true; faded.push(r); }
  }
  board.totalRuns += 1;
  board.totalDistance += run.dist;
  const score = scoreOf(run.dist);
  const isBest = score > board.best;
  board.best = Math.max(board.best, score);
  return { score, isBest, distance: run.dist, seconds: run.t, cause: run.cause, trails: run.trailsAtStart, density: run.density, erased: run.erased, faded };
}

// ---- saving: lines as centimetres, packed, so hundreds of runs fit in local storage
export function serialiseBoard(board) {
  const runs = board.runs.map((l) => {
    const live = [];
    for (let i = 0; i < l.pts.length; i++) live.push(Math.round(l.pts[i] * 100));
    return { p: live.join(','), g: [...l.gone].join(','), ...(l.retired ? { r: 1 } : {}) };
  });
  return JSON.stringify({ v: 1, mode: board.mode, day: board.day, best: board.best, totalRuns: board.totalRuns, totalDistance: Math.round(board.totalDistance), runs });
}
export function loadBoard(text) {
  const o = JSON.parse(text);
  if (o.v !== 1) throw new Error('This saved board is from a newer version of the game.');
  const b = newBoard(o.mode, o.day);
  b.best = o.best || 0;
  b.totalRuns = o.totalRuns || 0;
  b.totalDistance = o.totalDistance || 0;
  b.runs = o.runs.map((r) => ({ pts: r.p ? r.p.split(',').map((n) => Number(n) / 100) : [], gone: new Set(r.g ? r.g.split(',').map(Number) : []), retired: Boolean(r.r) }));
  return b;
}

// ---- cosmetic unlocks, from totals only (nothing makes the game easier)
export const MILESTONES = [
  { id: 'runs10', kind: 'runs', at: 10, unlock: 'trail-pulse', name: 'Pulse trail' },
  { id: 'runs50', kind: 'runs', at: 50, unlock: 'dot-ring', name: 'Ring dot' },
  { id: 'runs200', kind: 'runs', at: 200, unlock: 'death-shatter', name: 'Shatter death' },
  { id: 'dist1k', kind: 'distance', at: 1000, unlock: 'trail-dashed', name: 'Dashed trail' },
  { id: 'dist5k', kind: 'distance', at: 5000, unlock: 'dot-star', name: 'Star dot' },
  { id: 'dist20k', kind: 'distance', at: 20000, unlock: 'death-ripple', name: 'Ripple death' },
  { id: 'best500', kind: 'best', at: 500, unlock: 'trail-gold', name: 'Gold trail' },
  { id: 'best2000', kind: 'best', at: 2000, unlock: 'dot-comet', name: 'Comet dot' },
];
export const unlocked = (board) => MILESTONES.filter((m) => (m.kind === 'runs' ? board.totalRuns : m.kind === 'distance' ? board.totalDistance : board.best) >= m.at);
