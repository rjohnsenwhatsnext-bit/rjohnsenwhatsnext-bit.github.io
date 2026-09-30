// Sinkhole: the rules (Claude). A hole in the ground roams an old mining town
// and swallows anything smaller than itself; the more it eats the bigger it
// gets, until it can take the pub, the water tower and the headframe, and the
// other, smaller holes. Two minute rounds against seven other holes; most
// swallowed wins. (Ryan, 29 Sep 2026: "yeah lets build the sink hole one".)
//
// Pure and seeded: the same seed and the same inputs give the same round, so
// a round can be replayed, checked by a server, or raced as a ghost later.
// sqrt, never Math.hypot (it is not identical across engines). No drawing here.

// Tuned 29 Sep 2026 over six bot rounds each (tests/sinkhole.test.mjs keeps
// it there): the biggest hole is shed sized at 30 s, house sized by 60 s, and
// takes the headframe in about half of rounds, only near the end. Most of the
// town goes by the final whistle, as in the genre; the end is a hunt for holes.
export let WORLD = 270; // metres across, square
export const DT = 1 / 30;
export const ROUND = 120; // seconds
export const START_R = 1.3;
export const RESPAWN = 3; // seconds out after being swallowed
export const HOLES = 8; // the player is hole 0

// Everything in town, smallest first. r is the size it takes to swallow it.
export const KINDS = {
  rock: { r: 0.25, name: 'Rock' },
  tyre: { r: 0.32, name: 'Old tyre' },
  crate: { r: 0.4, name: 'Crate' },
  cone: { r: 0.35, name: 'Witches hat' },
  bin: { r: 0.45, name: 'Wheelie bin' },
  sign: { r: 0.5, name: 'Sign' },
  bush: { r: 0.6, name: 'Saltbush' },
  lamp: { r: 0.55, name: 'Street light' },
  bench: { r: 0.8, name: 'Bench' },
  dunny: { r: 1.0, name: 'Dunny' },
  tree: { r: 1.25, name: 'Gum tree' },
  car: { r: 1.7, name: 'Car' },
  ute: { r: 2.0, name: 'Ute' },
  tank: { r: 2.3, name: 'Water tank' },
  shed: { r: 3.0, name: 'Shed' },
  house: { r: 4.0, name: 'House' },
  truck: { r: 4.8, name: 'Haul truck' },
  pub: { r: 6.0, name: 'Pub' },
  church: { r: 6.4, name: 'Church' },
  tower: { r: 7.2, name: 'Water tower' },
  headframe: { r: 9.0, name: 'Headframe' },
};
// Same-size content variants: the seeded town layout and economy stay identical.
export const CONTENT_VARIANTS = {
 rock:['bricks'],tyre:['rope'],crate:['toolbox'],bin:['barrel'],bench:['pallet'],
 dunny:['barrow'],lamp:['pump'],car:['minecart'],ute:['caravan','van'],tank:['excavator'],shed:['stall'],
};
const variantNames={bricks:'Brick stack',rope:'Rope coil',toolbox:'Toolbox',barrel:'Oil barrel',pallet:'Timber pallet',barrow:'Wheelbarrow',pump:'Petrol pump',minecart:'Ore cart',caravan:'Caravan',van:'Delivery van',excavator:'Excavator',stall:'Market stall'};
for(const [base,list] of Object.entries(CONTENT_VARIANTS))for(const k of list)KINDS[k]={r:KINDS[base].r,name:variantNames[k]};
export const points = (r) => Math.round(r * r * 10);
export const NAMES = ['Dusty', 'Macca', 'Shazza', 'Robbo', 'Tex', 'Blue', 'Gazza', 'Bazza', 'Kez', 'Jonesy', 'Davo', 'Chook'];

// ---- random from the round's own counter
function rand(g) {
  let a = (g.seed + Math.imul(g.draws++, 0x9e3779b1)) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b) >>> 0;
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35) >>> 0;
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
const pick = (g, list) => list[Math.floor(rand(g) * list.length)];
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

// ---- the town: a street grid, blocks of houses and yards, one big thing in
// the middle of some blocks, cars and bins along the kerbs
export let CLUTTER = 40; // small things per block
export const BLOCK = 30; // street to street
export const ROAD = 6;
function buildTown(g) {
  const objs = [];
  const add = (k, x, y) => {
    if (x < 1 || y < 1 || x > WORLD - 1 || y > WORLD - 1) return;
    objs.push({ k, x, y, r: KINDS[k].r, alive: true });
  };
  const n = Math.floor(WORLD / BLOCK);
  const bigs = ['pub', 'church', 'tower', 'headframe', 'truck', 'truck'];
  for (let bx = 0; bx < n; bx++)
    for (let by = 0; by < n; by++) {
      const x0 = bx * BLOCK + ROAD;
      const y0 = by * BLOCK + ROAD;
      const inner = BLOCK - ROAD;
      // the kerb: parked cars and utes, bins, lights, cones, signs
      for (let s = 2; s < inner - 1; s += 3.2) {
        const r = rand(g);
        if (r < 0.22) add(rand(g) < 0.6 ? 'car' : 'ute', x0 + s, y0 - ROAD / 2 + 1.5);
        else if (r < 0.45) add(pick(g, ['bin', 'bin', 'lamp', 'sign', 'cone']), x0 + s, y0 - 0.6);
        if (rand(g) < 0.35) add(pick(g, ['bin', 'lamp', 'cone', 'sign']), x0 - 0.6, y0 + s);
      }
      // the clutter: small stuff everywhere, so a new hole always has a snack
      // in reach (the first browser run went 11 s eating almost nothing)
      for (let t = 0; t < CLUTTER; t++) add(pick(g, ['rock', 'rock', 'tyre', 'crate', 'cone', 'bin']), x0 - ROAD + rand(g) * BLOCK, y0 - ROAD + rand(g) * BLOCK);
      // the block: one big landmark in some, houses and yards in the rest
      if (rand(g) < 0.2 && bigs.length) {
        const k = bigs.splice(Math.floor(rand(g) * bigs.length), 1)[0];
        add(k, x0 + inner / 2, y0 + inner / 2);
        for (let t = 0; t < 6; t++) add(pick(g, ['bush', 'tree', 'bench', 'bin']), x0 + 2 + rand(g) * (inner - 4), y0 + 2 + rand(g) * (inner - 4));
        continue;
      }
      for (const [hx, hy] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
        const cx = x0 + hx * inner;
        const cy = y0 + hy * inner;
        const r = rand(g);
        if (r < 0.55) add('house', cx, cy);
        else if (r < 0.75) add('shed', cx, cy);
        else if (r < 0.88) add('tank', cx, cy);
        // the yard around it
        for (let t = 0; t < 4; t++) {
          const a = rand(g) * Math.PI * 2;
          const d = 4.5 + rand(g) * 2.2;
          add(pick(g, ['tree', 'bush', 'bush', 'dunny', 'bench', 'bin', 'car']), cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        }
      }
    }
  for(let i=0;i<objs.length;i++){
    const o=objs[i],list=CONTENT_VARIANTS[o.k],h=(Math.imul(i+1,2654435761)^g.seed)>>>0;
    if(list&&h%4<2)o.k=list[Math.floor(h/4)%list.length];
  }
  return objs;
}

// a bucket grid so each hole only looks at what is near it
const CELL = 10;
let GN = Math.ceil(WORLD / CELL);
function grid(objs) {
  GN = Math.ceil(WORLD / CELL);
  const cells = Array.from({ length: GN * GN }, () => []);
  objs.forEach((o, i) => cells[Math.min(GN - 1, Math.floor(o.y / CELL)) * GN + Math.min(GN - 1, Math.floor(o.x / CELL))].push(i));
  return cells;
}
function near(g, x, y, r) {
  const out = [];
  const c0 = Math.max(0, Math.floor((x - r) / CELL));
  const c1 = Math.min(GN - 1, Math.floor((x + r) / CELL));
  const r0 = Math.max(0, Math.floor((y - r) / CELL));
  const r1 = Math.min(GN - 1, Math.floor((y + r) / CELL));
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) for (const i of g.cells[row * GN + col]) out.push(i);
  return out;
}

// ---- a new round
// startR: the player's starting size (a rewarded ad gives a head start)
export function newRound(seed = 1, { name = 'You', startR = START_R } = {}) {
  const g = { seed: seed >>> 0, draws: 0, tick: 0, t: 0, over: false, objs: [], holes: [], events: [] };
  g.objs = buildTown(g);
  g.cells = grid(g.objs);
  const names = NAMES.slice();
  for (let i = 0; i < HOLES; i++) {
    const [x, y] = spawnPoint(g);
    g.holes.push({
      id: i,
      name: i === 0 ? name : names.splice(Math.floor(rand(g) * names.length), 1)[0],
      bot: i > 0,
      skill: i === 0 ? 1 : 0.55 + rand(g) * 0.4, // how well a bot aims
      x,
      y,
      r: i === 0 ? startR : START_R,
      score: 0,
      eaten: 0,
      out: 0, // seconds until back after being swallowed
      vx: 0,
      vy: 0,
      aim: null,
      think: 0,
    });
  }
  return g;
}
function spawnPoint(g) {
  // on a street, away from everyone
  for (let tries = 0; tries < 30; tries++) {
    const x = Math.floor(rand(g) * (WORLD / BLOCK)) * BLOCK + ROAD / 2;
    const y = 10 + rand(g) * (WORLD - 20);
    const [a, b] = rand(g) < 0.5 ? [x, y] : [y, x];
    if (g.holes.every((h) => dist2(h.x, h.y, a, b) > 900)) return [a, b];
  }
  return [WORLD / 2, WORLD / 2];
}

export const speed = (r) => 9 + r * 1.1;
// grow by a share of what went in: area is what counts
export let GROW = 0.1;
function grow(h, r) {
  h.r = Math.sqrt(h.r * h.r + r * r * GROW);
}
// for tuning runs only
export function tune(o) {
  if (o.WORLD) WORLD = o.WORLD;
  if (o.GROW) GROW = o.GROW;
  if (o.CLUTTER !== undefined) CLUTTER = o.CLUTTER;
}
// does the hole take it? It has to be smaller, and mostly over the hole
export const fits = (h, o) => o.r < h.r * 0.92 && dist2(h.x, h.y, o.x, o.y) < (h.r - o.r * 0.45) ** 2;

// ---- one step. input: { dx, dy } for the player, a direction of length 0..1
// Optional per-player directions for private friend rounds; solo behaviour is unchanged.
export function step(g, input = { dx: 0, dy: 0 }, controls = {}) {
  if (g.over) return g;
  g.events = [];
  // whole steps, not added up seconds: 3600 lots of 1/30 comes out short
  g.tick++;
  g.t = g.tick * DT;
  for (const h of g.holes) {
    if (h.out > 0) {
      h.out -= DT;
      if (h.out <= 0) {
        [h.x, h.y] = spawnPoint(g);
        g.events.push({ type: 'back', hole: h.id });
      }
      continue;
    }
    const dir = h.bot ? steer(g, h) : (controls[h.id] || input);
    let dx = dir.dx || 0;
    let dy = dir.dy || 0;
    const m = Math.sqrt(dx * dx + dy * dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    // a little weight to it: turns take a moment
    const sp = speed(h.r);
    h.vx += (dx * sp - h.vx) * 0.25;
    h.vy += (dy * sp - h.vy) * 0.25;
    h.x = Math.min(WORLD - h.r * 0.5, Math.max(h.r * 0.5, h.x + h.vx * DT));
    h.y = Math.min(WORLD - h.r * 0.5, Math.max(h.r * 0.5, h.y + h.vy * DT));
    // what falls in
    for (const i of near(g, h.x, h.y, h.r)) {
      const o = g.objs[i];
      if (o.alive && fits(h, o)) {
        o.alive = false;
        grow(h, o.r);
        const p = points(o.r);
        h.score += p;
        h.eaten++;
        g.events.push({ type: 'eat', hole: h.id, obj: i, points: p });
      }
    }
  }
  // holes swallow smaller holes
  for (const a of g.holes)
    for (const b of g.holes) {
      if (a === b || a.out > 0 || b.out > 0) continue;
      if (b.r < a.r * 0.8 && dist2(a.x, a.y, b.x, b.y) < (a.r - b.r * 0.3) ** 2) {
        const p = Math.round(points(b.r) * 2 + b.score * 0.1);
        a.score += p;
        grow(a, b.r);
        b.out = RESPAWN;
        b.r = Math.max(START_R, b.r * 0.55); // back smaller, not from scratch
        b.vx = b.vy = 0;
        g.events.push({ type: 'swallow', hole: a.id, victim: b.id, points: p });
      }
    }
  if (g.tick >= Math.round(ROUND / DT)) {
    g.over = true;
    g.events.push({ type: 'over' });
  }
  return g;
}

// ---- the other holes: run from bigger holes, chase smaller ones, otherwise
// go for the best thing they can eat nearby. They think a few times a second.
function steer(g, h) {
  h.think -= DT;
  if (h.think <= 0 || !h.aim) {
    h.think = 0.35 + rand(g) * 0.3;
    h.aim = decide(g, h);
  }
  const dx = h.aim.x - h.x;
  const dy = h.aim.y - h.y;
  const m = Math.sqrt(dx * dx + dy * dy) || 1;
  // a bot is never perfectly on line
  const wob = (1 - h.skill) * 0.6;
  return { dx: dx / m + (rand(g) - 0.5) * wob, dy: dy / m + (rand(g) - 0.5) * wob };
}
function decide(g, h) {
  let fx = 0;
  let fy = 0;
  let danger = false;
  for (const o of g.holes) {
    if (o === h || o.out > 0) continue;
    const d2 = dist2(h.x, h.y, o.x, o.y);
    if (o.r * 0.8 > h.r && d2 < (o.r + 14) ** 2) {
      const d = Math.sqrt(d2) || 1;
      fx += (h.x - o.x) / d;
      fy += (h.y - o.y) / d;
      danger = true;
    }
  }
  if (danger) return { x: h.x + fx * 20, y: h.y + fy * 20 };
  // a smaller hole close by is worth more than anything else
  for (const o of g.holes) if (o !== h && o.out <= 0 && o.r < h.r * 0.75 && dist2(h.x, h.y, o.x, o.y) < 15 * 15) return { x: o.x, y: o.y };
  let best = null;
  let bestV = 0;
  const reach = 22 + h.r * 2;
  for (const i of near(g, h.x, h.y, reach)) {
    const o = g.objs[i];
    if (!o.alive || o.r >= h.r * 0.92) continue;
    const d = Math.sqrt(dist2(h.x, h.y, o.x, o.y));
    const v = points(o.r) / (d + 4);
    if (v > bestV) {
      bestV = v;
      best = o;
    }
  }
  if (best) return { x: best.x, y: best.y };
  return { x: 10 + rand(g) * (WORLD - 20), y: 10 + rand(g) * (WORLD - 20) };
}

// ---- the board
export function standings(g) {
  return g.holes
    .map((h) => ({ id: h.id, name: h.name, score: h.score, r: h.r, you: !h.bot }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
}
export const place = (g, id = 0) => standings(g).findIndex((s) => s.id === id) + 1;
export const timeLeft = (g) => Math.max(0, ROUND - g.t);
