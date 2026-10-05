// Don't Touch Red: the rules (Claude). A little ball ricochets around a box on
// its own. A tap bends its path slightly; red things keep appearing; touch red
// and it is over. Endless, like Flappy Bird. (Ryan, 5 Oct 2026: "little ball
// continuously ricochets around a box. Tap changes its trajectory slightly.
// Survive obstacles spawning endlessly. Sounds dumb, which is almost the point")
//
// Score: a point a second, and gold dots are worth five. Every go is a new
// seed; the daily is one seed everybody shares.
//
// Fair by construction: a red thing never appears on top of the ball or across
// the next stretch of its path, and it flashes as a warning before it becomes
// solid. The bot test (tests/dont-touch-red.test.mjs) holds this.
//
// Pure and seeded, the random state kept in the world itself, so the same seed
// and taps give the same game and any moment can be copied (the bot, ghosts).
// sqrt, never Math.hypot. Nothing is drawn here; Codex owns the look.
//
// Units are metres and seconds. The box is W by H, origin at its centre, y up.

export const DT = 1 / 60;
export const W = 9;
export const H = 15;
export const R = 0.35; // the ball
export const NUDGE = (24 * Math.PI) / 180; // how far one tap bends the path
export const WARN = 0.9; // seconds a red thing flashes before it is solid
export const GOLD_R = 0.3;

// What arrives when (seconds survived). Plain blocks first, while the tap is learnt.
export const ARRIVES = { block: 0, bar: 15, laser: 30, chaser: 45, wall: 60 };
export const speedAt = (t) => 5 + 4 * Math.min(1, t / 120); // 5 to 9 m/s over two minutes
export const spawnEvery = (t) => 2.2 - 1.4 * Math.min(1, t / 150); // seconds between new reds
export const maxRed = (t) => 3 + Math.floor(6 * Math.min(1, t / 150));

// ---- seeded randomness kept in the world (mulberry32 on w.r)
function rand(w) {
  w.r = (w.r + 0x6d2b79f5) >>> 0;
  let t = w.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const dailySeed = (dayKey) => [...String(dayKey)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 0x811c9dc5);

// ---- geometry
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const ex = px - (ax + k * dx), ey = py - (ay + k * dy);
  return Math.sqrt(ex * ex + ey * ey);
}
function boxDist(px, py, cx, cy, hw, hh) {
  const dx = Math.max(Math.abs(px - cx) - hw, 0), dy = Math.max(Math.abs(py - cy) - hh, 0);
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- the red things. Each is a pure function of its own age.
// block  { x, y, hw, hh }                       sits still
// bar    { x, y, hw, hh, vx, vy }               slides, bouncing off the box
// laser  { x, y, len, spin, phase }             a thin beam turning about a point
// chaser { x, y, speed }                        a red dot that drifts after the ball, slower than it
// wall   { side, a, b }                         a stretch of the box wall turns red (side 0 bottom, 1 right, 2 top, 3 left)
export function laserEnds(o, age) {
  const a = o.phase + o.spin * age, hx = (Math.cos(a) * o.len) / 2, hy = (Math.sin(a) * o.len) / 2;
  return [o.x - hx, o.y - hy, o.x + hx, o.y + hy];
}
function wallEnds(o) {
  const hw = W / 2, hh = H / 2;
  if (o.side === 0) return [o.a, -hh, o.b, -hh];
  if (o.side === 1) return [hw, o.a, hw, o.b];
  if (o.side === 2) return [o.a, hh, o.b, hh];
  return [-hw, o.a, -hw, o.b];
}
// distance from (x, y) to the red thing's edge; < R is a touch
export function redDist(o, x, y) {
  if (o.kind === 'block' || o.kind === 'bar') return boxDist(x, y, o.x, o.y, o.hw, o.hh);
  if (o.kind === 'laser') { const [ax, ay, bx, by] = laserEnds(o, o.age); return segDist(x, y, ax, ay, bx, by) - 0.08; }
  if (o.kind === 'chaser') { const dx = x - o.x, dy = y - o.y; return Math.sqrt(dx * dx + dy * dy) - 0.4; }
  const [ax, ay, bx, by] = wallEnds(o);
  return segDist(x, y, ax, ay, bx, by);
}

// ---- a game
export function newGame(seed) {
  const w = {
    seed, r: seed >>> 0, t: 0,
    x: 0, y: -H / 4, vx: 0, vy: 0,
    reds: [], golds: [], nextRed: 1.5, nextGold: 3, nextId: 1,
    score: 0, golds_taken: 0, over: false, events: [], closest: Infinity,
  };
  const a = Math.PI / 4 + rand(w) * (Math.PI / 2); // somewhere up and across
  w.vx = Math.cos(a) * speedAt(0);
  w.vy = Math.sin(a) * speedAt(0);
  return w;
}
export const copy = (w) => ({ ...w, reds: w.reds.map((o) => ({ ...o })), golds: w.golds.map((o) => ({ ...o })), events: [] });

// Where the ball will be over the next `secs` seconds if nobody taps, bouncing
// off the walls: the stretch a new red thing must stay out of.
function pathAhead(w, secs) {
  const pts = [];
  let x = w.x, y = w.y, vx = w.vx, vy = w.vy;
  const hw = W / 2 - R, hh = H / 2 - R;
  for (let s = 0; s < secs; s += 0.05) {
    x += vx * 0.05; y += vy * 0.05;
    if (x > hw || x < -hw) { vx = -vx; x = Math.max(-hw, Math.min(hw, x)); }
    if (y > hh || y < -hh) { vy = -vy; y = Math.max(-hh, Math.min(hh, y)); }
    pts.push([x, y]);
  }
  return pts;
}

function spawnRed(w) {
  const kinds = Object.entries(ARRIVES).filter(([, at]) => w.t >= at).map(([k]) => k);
  // the newest kind turns up first, then the mix
  const fresh = Object.entries(ARRIVES).find(([k, at]) => w.t >= at && !w[`seen_${k}`]);
  const kind = fresh ? fresh[0] : kinds[Math.floor(rand(w) * kinds.length)];
  const path = pathAhead(w, 1.6);
  // where a red thing will be `s` seconds after it appears: bars slide once
  // solid, so they are checked where they will be when the ball gets there,
  // not where they appear. Bars were most of the bot's deaths (5 Oct 2026).
  const at = (o, s) => {
    if (o.kind !== 'bar' || s < WARN) return { ...o, age: s };
    const m = s - WARN;
    return { ...o, age: s, x: o.x + o.vx * m, y: o.y + o.vy * m };
  };
  const clearOf = (o) => {
    if (redDist(at(o, 0), w.x, w.y) < (o.kind === 'chaser' ? 4.5 : 2.4)) return false;
    return path.every(([x, y], i) => redDist(at(o, (i + 1) * 0.05), x, y) > R + 0.5);
  };
  const hw = W / 2, hh = H / 2;
  for (let attempt = 0; attempt < 30; attempt++) {
    let o;
    const x = (rand(w) * 2 - 1) * (hw - 1), y = (rand(w) * 2 - 1) * (hh - 1);
    if (kind === 'block') {
      o = { kind, x, y, hw: 0.4 + rand(w) * 0.9, hh: 0.4 + rand(w) * 0.9, life: 6 + rand(w) * 4 };
    } else if (kind === 'bar') {
      const across = rand(w) < 0.5;
      o = { kind, x, y, hw: across ? 1.4 : 0.25, hh: across ? 0.25 : 1.4, vx: across ? 0 : (rand(w) < 0.5 ? -1 : 1) * 1.25, vy: across ? (rand(w) < 0.5 ? -1 : 1) * 1.25 : 0, life: 7 + rand(w) * 3 };
    } else if (kind === 'laser') {
      o = { kind, x: x * 0.6, y: y * 0.6, len: 3 + rand(w) * 1.5, spin: (rand(w) < 0.5 ? -1 : 1) * (0.9 + rand(w) * 0.6), phase: rand(w) * Math.PI, life: 8 };
    } else if (kind === 'chaser') {
      o = { kind, x, y, speed: 1.3, life: 8 };
    } else {
      const side = Math.floor(rand(w) * 4), long = side % 2 ? hh : hw, len = 2 + rand(w) * 2, a = (rand(w) * 2 - 1) * (long - len / 2);
      o = { kind, side, a: a - len / 2, b: a + len / 2, life: 6 + rand(w) * 3 };
    }
    o.age = 0;
    if (!clearOf(o)) continue;
    o.id = w.nextId++;
    w.reds.push(o);
    w[`seen_${kind}`] = true;
    w.events.push({ type: 'warn', id: o.id, kind });
    return;
  }
  // nowhere fair this time: try again shortly rather than force one in
  w.nextRed = w.t + 0.3;
}

function spawnGold(w) {
  for (let i = 0; i < 20; i++) {
    const x = (rand(w) * 2 - 1) * (W / 2 - 0.8), y = (rand(w) * 2 - 1) * (H / 2 - 0.8);
    if (w.reds.some((o) => redDist(o, x, y) < 1)) continue;
    w.golds.push({ x, y, life: 6 });
    return;
  }
}

// One tick. input.tap: -1 bends the path left (anticlockwise), +1 right, 0 or nothing leaves it.
// events: 'warn' (a red thing is coming), 'solid', 'gold', 'bounce', 'second', 'new' (first of a kind), 'hit'
export function step(w, input = {}) {
  w.events = [];
  if (w.over) return w;
  const sp = speedAt(w.t);
  let a = Math.atan2(w.vy, w.vx);
  if (input.tap) a += input.tap > 0 ? -NUDGE : NUDGE;
  w.vx = Math.cos(a) * sp;
  w.vy = Math.sin(a) * sp;
  w.x += w.vx * DT;
  w.y += w.vy * DT;
  const hw = W / 2 - R, hh = H / 2 - R;
  if (w.x > hw || w.x < -hw) { w.vx = -w.vx; w.x = Math.max(-hw, Math.min(hw, w.x)); w.events.push({ type: 'bounce' }); }
  if (w.y > hh || w.y < -hh) { w.vy = -w.vy; w.y = Math.max(-hh, Math.min(hh, w.y)); w.events.push({ type: 'bounce' }); }
  const before = Math.floor(w.t);
  w.t += DT;
  if (Math.floor(w.t) > before) { w.score += 1; w.events.push({ type: 'second' }); }

  // the red things age, move, harden and go
  for (const o of w.reds) {
    const wasWarning = o.age < WARN;
    o.age += DT;
    if (wasWarning && o.age >= WARN) w.events.push({ type: 'solid', id: o.id });
    if (o.kind === 'bar' && o.age >= WARN) {
      o.x += o.vx * DT; o.y += o.vy * DT;
      // a bar turns back before the wall, always leaving a lane the ball fits
      // through: one that ran into the ceiling pinned the ball there (5 Oct 2026)
      const LANE = 2 * R + 0.8;
      if (Math.abs(o.x) > W / 2 - o.hw - LANE) { o.vx = -o.vx; o.x = Math.sign(o.x) * (W / 2 - o.hw - LANE); }
      if (Math.abs(o.y) > H / 2 - o.hh - LANE) { o.vy = -o.vy; o.y = Math.sign(o.y) * (H / 2 - o.hh - LANE); }
    }
    if (o.kind === 'chaser' && o.age >= WARN) {
      const dx = w.x - o.x, dy = w.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      o.x += (dx / d) * o.speed * DT; o.y += (dy / d) * o.speed * DT;
    }
  }
  w.reds = w.reds.filter((o) => o.age < o.life + WARN);
  // only solid red counts, and a touch is the end
  let near = Infinity;
  for (const o of w.reds) {
    if (o.age < WARN) continue;
    near = Math.min(near, redDist(o, w.x, w.y));
  }
  w.closest = Math.min(w.closest, near - R);
  if (near < R) { w.over = true; w.events.push({ type: 'hit' }); return w; }

  for (const gd of w.golds) {
    gd.life -= DT;
    const dx = gd.x - w.x, dy = gd.y - w.y;
    if (!gd.taken && dx * dx + dy * dy < (R + GOLD_R) * (R + GOLD_R)) { gd.taken = true; w.score += 5; w.golds_taken++; w.events.push({ type: 'gold' }); }
  }
  w.golds = w.golds.filter((gd) => !gd.taken && gd.life > 0);

  if (w.t >= w.nextRed) {
    w.nextRed = w.t + spawnEvery(w.t);
    if (w.reds.length < maxRed(w.t)) {
      const had = new Set(Object.keys(w).filter((k) => k.startsWith('seen_')));
      spawnRed(w);
      for (const k of Object.keys(w)) if (k.startsWith('seen_') && !had.has(k)) w.events.push({ type: 'new', kind: k.slice(5) });
    }
  }
  if (w.t >= w.nextGold) { w.nextGold = w.t + 3 + rand(w) * 2; if (w.golds.length < 2) spawnGold(w); }
  return w;
}
