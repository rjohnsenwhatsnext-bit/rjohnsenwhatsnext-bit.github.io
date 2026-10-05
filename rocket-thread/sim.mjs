// Rocket Thread: the rules (Claude). A rocket climbs on its own. Hold and it
// curves right, let go and it curves left; thread it up through gaps that keep
// getting tighter, for as long as you last. (Ryan, 5 Oct 2026: "rocket flies
// upward automatically. Holding makes it curve one direction, releasing curves
// the other. Thread through increasingly tiny gaps." Then: "it shouldnt have
// stages these games are made to go for ever like flappy bird".)
//
// One endless climb. The score is how many things you thread. New kinds of
// obstacle arrive as the score climbs, the gaps close in and the rocket speeds
// up, so a good run keeps changing. Every go is a fresh course from a new seed;
// the daily course is one seed everybody shares.
//
// Pure and seeded: the same seed and the same holds give the same flight, so a
// run can be replayed, checked by the server or raced as a ghost. sqrt, never
// Math.hypot (not identical across engines). Nothing is drawn here; Codex owns
// the look.
//
// Units are metres and seconds. The shaft is SHAFT wide, x from -SHAFT/2 to
// +SHAFT/2, and the rocket climbs in +y. Touching anything ends the run,
// including the shaft walls.

export const DT = 1 / 60;
export const SHAFT = 9;
export const R = 0.35; // rocket radius
export const MAX_TILT = (55 * Math.PI) / 180; // furthest from straight up
export const TURN = (165 * Math.PI) / 180; // how fast the nose swings, per second
export const NEAR = 0.45; // closer than this without touching is a near miss
export const AHEAD = 70; // metres of course kept built above the rocket

// When each kind of obstacle starts turning up, by score. The first ten are
// plain gates so the hold and let go rhythm is learnt before anything moves.
export const ARRIVES = { slide: 10, tunnel: 22, pinch: 35, spinner: 45, wind: 60 };
// Altitude bands for the look and the moment a new one is reached (score).
export const ZONES = [
  { from: 0, id: 'pad', name: 'Launch Pad' },
  { from: 10, id: 'rigging', name: 'Night Rigging' },
  { from: 22, id: 'canyon', name: 'Canyon' },
  { from: 35, id: 'gantry', name: 'The Gantry' },
  { from: 60, id: 'upper', name: 'Upper Air' },
  { from: 100, id: 'orbit', name: 'Edge of Space' },
];
export const zoneFor = (score) => ZONES.filter((z) => score >= z.from).pop();

// ---- seeded randomness (mulberry32)
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
export const dailySeed = (dayKey) => [...String(dayKey)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 0x811c9dc5);

// ---- obstacles, each a pure function of time
//
// gate     a wall across the shaft with one gap: { y, x, w, thick, sway?, swayT?, pinch?, pinchT?, phase? }
//          sway slides the gap side to side, pinch opens and closes it
// spinner  a bar turning about a point: { y, x, len, thick, spin (rad/s), phase }
// tunnel   the shaft narrows to a winding channel: { y0, y1, pts: [[y, centreX, width], ...] }
// wind     a crosswind band that pushes sideways: { y0, y1, push (m/s, + is right) }
// cell     a fuel cell off the safe line, for the brave: { x, y }
const TAU = Math.PI * 2;
export function gateAt(o, t) {
  const sway = o.sway ? o.sway * Math.sin((TAU * t) / (o.swayT || 3) + (o.phase || 0)) : 0;
  const pinch = o.pinch ? o.pinch * (0.5 + 0.5 * Math.sin((TAU * t) / (o.pinchT || 2.5) + (o.phase || 0))) : 0;
  const w = Math.max(2 * R + 0.12, o.w - pinch);
  const x = Math.max(-SHAFT / 2 + w / 2, Math.min(SHAFT / 2 - w / 2, o.x + sway));
  return { x, w };
}
export function spinnerAt(o, t) {
  const a = o.phase + o.spin * t;
  const hx = (Math.cos(a) * o.len) / 2, hy = (Math.sin(a) * o.len) / 2;
  return { ax: o.x - hx, ay: o.y - hy, bx: o.x + hx, by: o.y + hy };
}
export function tunnelAt(o, y) {
  const p = o.pts;
  if (y <= p[0][0]) return { c: p[0][1], w: p[0][2] };
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const k = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      const s = k * k * (3 - 2 * k); // smooth between points
      return { c: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * s, w: p[i - 1][2] + (p[i][2] - p[i - 1][2]) * s };
    }
  }
  const l = p[p.length - 1];
  return { c: l[1], w: l[2] };
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const ex = px - (ax + k * dx), ey = py - (ay + k * dy);
  return Math.sqrt(ex * ex + ey * ey);
}
function boxDist(px, py, x0, y0, x1, y1) {
  const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- the course, built as the rocket climbs
//
// Fair by construction: the next gap is never further across than the rocket
// can swing in the room it is given at the speed it will be going. The bot test
// (tests/rocket-thread.test.mjs) holds this with room to spare.
export function newCourse(seed) {
  return { seed, g: rng(seed), gates: [], spinners: [], tunnels: [], winds: [], cells: [], items: [], nextY: 14, lastX: 0, count: 0, cellCount: 0 };
}
// how hard the course is at the n-th obstacle: 0 at the start, 1 by about 90
const hardness = (n) => Math.min(1, n / 90);
// 3.3 m down to 1.45 m (the rocket is 0.7). 1.3 with noise went to 1.18 m by
// 100 and the bot could not keep room to spare through it (5 Oct 2026).
export const gapFor = (n) => 3.3 - 1.85 * hardness(n);
export const speedFor = (n) => 6 + 4 * hardness(n);

function addOne(c) {
  const g = c.g, n = c.count, h = hardness(n);
  let y = c.nextY;
  const w = gapFor(n) + g() * 0.2; // never under gapFor
  // metres to the next thing. After something that can leave the rocket out
  // of position (a spinner, a crosswind, a tunnel exit, a moving gap) the next
  // one gets more room and sits closer: a 7 m dash out of a crosswind into a
  // pinching gap was found impossible by the bot at about 90 (5 Oct 2026).
  const shaken = ['spinner', 'wind', 'tunnel', 'slide', 'pinch'].includes(c.prevKind);
  const room = 11 - 3.5 * h + g() * 2 + (shaken ? 3 : 0);
  const gapX = (width) => {
    // never more than about 3 m across from the last gap, and never tight against a wall
    const reach = Math.min(3.1, shaken ? 1.4 + room * 0.18 : 1.6 + room * 0.3);
    const edge = SHAFT / 2 - width / 2 - 0.6;
    const x = Math.max(-edge, Math.min(edge, c.lastX + (g() * 2 - 1) * reach));
    c.lastX = x;
    return x;
  };
  // which kind: the newest kinds turn up most often just after they arrive
  const open = Object.entries(ARRIVES).filter(([, at]) => n >= at).map(([k]) => k);
  let kind = 'gate';
  if (open.length && g() < 0.55 + 0.25 * h) kind = open[Math.floor(g() * open.length)];
  // something new is introduced on its own, with room either side
  for (const [k, at] of Object.entries(ARRIVES)) if (n === at) kind = k;
  let end = y + 0.6;
  if (kind === 'gate') {
    c.gates.push({ y, x: gapX(w), w, thick: 0.6 });
  } else if (kind === 'slide') {
    // a sliding gap sweeps at most 1.8 m each way, and not too quickly
    c.gates.push({ y, x: gapX(w + 1.4) * 0.6, w: w + 0.15, thick: 0.6, sway: 1 + 0.8 * h, swayT: 3.4 - 0.6 * h, phase: g() * TAU });
  } else if (kind === 'pinch') {
    c.gates.push({ y, x: gapX(w + 0.8), w: w + 0.9, thick: 0.6, pinch: 0.9, pinchT: 2.4 - 0.6 * h, phase: g() * TAU });
  } else if (kind === 'spinner') {
    const len = 3 + 1.6 * h;
    c.spinners.push({ y: y + 1.5, x: (g() * 2 - 1) * 1.8, len, thick: 0.35, spin: (g() < 0.5 ? -1 : 1) * (1.4 + 1.2 * h), phase: g() * TAU });
    end = y + 1.5 + len / 2;
  } else if (kind === 'tunnel') {
    const len = 14 + 8 * h, tw = Math.max(1.8, w + 0.6);
    const pts = [[y, 0, SHAFT]];
    let cx = c.lastX * 0.5;
    for (let yy = y + 3; yy <= y + len; yy += 4) {
      // bends gentle enough to follow at top speed
      cx = Math.max(-SHAFT / 2 + tw / 2 + 0.6, Math.min(SHAFT / 2 - tw / 2 - 0.6, cx + (g() * 2 - 1) * 1.3));
      pts.push([yy, cx, tw]);
    }
    pts.push([y + len + 3, 0, SHAFT]);
    c.tunnels.push({ y0: y, y1: y + len + 3, pts });
    c.lastX = cx;
    end = y + len;
  } else if (kind === 'wind') {
    c.winds.push({ y0: y - 4, y1: y + 6, push: (g() < 0.5 ? -1 : 1) * (1.2 + 1.6 * h) });
    c.gates.push({ y, x: gapX(w + 0.3), w: w + 0.3, thick: 0.6 });
  }
  c.items.push({ n, kind, y, end, isNew: ARRIVES[kind] === n });
  c.prevKind = kind;
  // a fuel cell off the safe line every so often, worth a risk
  if (n > 3 && g() < 0.22) c.cells.push({ id: c.cellCount++, x: Math.max(-3.6, Math.min(3.6, c.lastX + (c.lastX > 0 ? -1 : 1) * (1.4 + g() * 1.2))), y: end + room * 0.45 });
  c.nextY = end + room;
  c.count++;
}
// build ahead, and forget what is well behind (an endless run must not grow forever)
export function extend(c, y) {
  while (c.nextY < y + AHEAD) addOne(c);
  const behind = y - 12;
  if (c.gates.length > 40) c.gates = c.gates.filter((o) => o.y > behind);
  if (c.spinners.length > 20) c.spinners = c.spinners.filter((o) => o.y > behind);
  if (c.tunnels.length > 10) c.tunnels = c.tunnels.filter((o) => o.y1 > behind);
  if (c.winds.length > 10) c.winds = c.winds.filter((o) => o.y1 > behind);
  if (c.cells.length > 20) c.cells = c.cells.filter((o) => o.y > behind);
  if (c.items.length > 60) c.items = c.items.filter((o) => o.end > behind);
}

// How far the rocket's centre is from the nearest solid thing. Less than R is a crash.
export function clearance(c, x, y, t) {
  let d = Math.min(x + SHAFT / 2, SHAFT / 2 - x);
  for (const o of c.gates) {
    if (o.y > y + 3 || o.y + o.thick < y - 3) continue;
    const gt = gateAt(o, t);
    d = Math.min(d, boxDist(x, y, -SHAFT / 2 - 1, o.y, gt.x - gt.w / 2, o.y + o.thick), boxDist(x, y, gt.x + gt.w / 2, o.y, SHAFT / 2 + 1, o.y + o.thick));
  }
  for (const o of c.spinners) {
    if (Math.abs(o.y - y) > o.len / 2 + 3) continue;
    const s = spinnerAt(o, t);
    d = Math.min(d, segDist(x, y, s.ax, s.ay, s.bx, s.by) - o.thick / 2);
  }
  for (const o of c.tunnels) {
    if (y < o.y0 || y > o.y1) continue;
    const tc = tunnelAt(o, y);
    d = Math.min(d, tc.w / 2 - Math.abs(x - tc.c));
  }
  return d;
}
const windAt = (c, y) => c.winds.reduce((p, o) => (y >= o.y0 && y <= o.y1 ? p + o.push : p), 0);

// ---- a run. seed: any number; a new one each go, or dailySeed(day) for the daily.
export function newRun(seed, course = newCourse(seed)) {
  extend(course, 0);
  return {
    seed, course, t: 0, x: 0, y: 0, tilt: 0, speed: speedFor(0), holding: false,
    over: false, crashed: false, score: 0, passed: 0, cells: 0, gotCells: [],
    nearMisses: 0, zone: ZONES[0].id, events: [], closest: Infinity, inNear: false, announced: [],
  };
}

// One tick. input.hold: true while the finger is down.
// events: 'score' (threaded one), 'near', 'cell', 'zone' (a new altitude band), 'new' (a new kind of obstacle ahead), 'crash'
export function step(run, input = {}) {
  run.events = [];
  if (run.over) return run;
  const c = run.course;
  run.holding = Boolean(input.hold);
  run.tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, run.tilt + (run.holding ? TURN : -TURN) * DT));
  // speed follows the score, eased so it never jumps
  run.speed += (speedFor(run.passed) - run.speed) * 0.02;
  run.x += (Math.sin(run.tilt) * run.speed + windAt(c, run.y)) * DT;
  run.y += Math.cos(run.tilt) * run.speed * DT;
  run.t += DT;
  extend(c, run.y);
  const d = clearance(c, run.x, run.y, run.t);
  run.closest = Math.min(run.closest, d - R);
  if (d < R) {
    run.over = true;
    run.crashed = true;
    run.events.push({ type: 'crash', x: run.x, y: run.y });
    return run;
  }
  if (d < R + NEAR && !run.inNear) { run.inNear = true; run.nearMisses++; run.events.push({ type: 'near' }); }
  if (d > R + NEAR * 1.6) run.inNear = false;
  // threaded: every obstacle whose far edge is now below the rocket
  for (const it of c.items) {
    if (it.n >= run.passed && it.end < run.y - R) {
      run.passed = it.n + 1;
      run.score = run.passed;
      run.events.push({ type: 'score', score: run.score });
      const z = zoneFor(run.score);
      if (z.id !== run.zone) { run.zone = z.id; run.events.push({ type: 'zone', zone: z }); }
    }
    if (it.isNew && !run.announced.includes(it.n) && it.y - run.y < 30) { run.announced.push(it.n); run.events.push({ type: 'new', kind: it.kind }); }
  }
  // the course is shared (a replay, a ghost, the bot), so what this run took is kept on the run
  for (const cell of c.cells) {
    if (run.gotCells.includes(cell.id)) continue;
    const dx = cell.x - run.x, dy = cell.y - run.y;
    if (dx * dx + dy * dy < 0.6 * 0.6) { run.gotCells.push(cell.id); run.cells++; run.events.push({ type: 'cell' }); }
  }
  return run;
}
