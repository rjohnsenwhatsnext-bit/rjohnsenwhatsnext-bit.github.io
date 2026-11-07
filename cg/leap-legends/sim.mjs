// Leap Legends: the run itself, pure and seeded, so the same seed and inputs
// always play out the same (tests, replays, and later, checking a leaderboard
// score was really played). No drawing and no DOM here.
//
// World units: the screen is 10 wide; up is +y. The player bounces on every
// platform they land on from above; holding left or right steers, and the
// screen wraps side to side. Height climbed is the score.

export const WIDTH = 10;
export const GRAVITY = 30;
export const JUMP = 15; // take-off speed off a normal platform: 3.75 up
export const SPRING = 1.65; // a spring throws you this much faster
export const ROCKET = { speed: 26, time: 2.2 };
export const MOVE = { accel: 45, max: 9, drag: 7 };
// The bottom of the screen climbs on its own after a moment, faster higher up
// (units a second). It ramps with the platforms to 1500 m, then keeps
// speeding up past what anyone can climb (a steady climb is about 3.5 a
// second, more with gear), so every run ends: longer and harder, never
// endless (Ryan: "increasingly harder but achievable so they eventually die").
export const RAMP = 1500;
export const CHASE = { after: 4, base: 0.9, extra: 2.0, beyond: 0.0015 };
export const chaseSpeed = (y) => CHASE.base + CHASE.extra * difficulty(y) + CHASE.beyond * Math.max(0, y - RAMP);
const PLAYER_R = 0.35;

// a small seeded random: mulberry32
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

// How hard the platforms are at a height: 0 at the start, 1 by RAMP.
export const difficulty = (y) => Math.min(1, Math.max(0, y / RAMP));

// Gear bought in the shop changes the run (pay to win, on purpose). Each is a
// level 0 to 5.
export function gearEffects(gear = {}) {
  const l = (k) => Math.max(0, Math.min(5, gear[k] || 0));
  return {
    jump: 1 + 0.05 * l('boots'), // spring boots: 5% higher take-off a level
    magnet: l('magnet') ? 1 + 0.6 * l('magnet') : 0, // pulls coins in from this far
    rocketStart: l('rocket') * 0.5, // seconds of rocket at the start of a run
    shields: l('shield') ? Math.ceil(l('shield') / 2) : 0, // hits it can take
  };
}

// The highest a take-off can carry you, for spacing platforms fairly.
export const reach = (jumpScale = 1) => ((JUMP * jumpScale) ** 2) / (2 * GRAVITY);

export function createRun({ seed = 1, gear = {} } = {}) {
  const r = rng(seed);
  const fx = gearEffects(gear);
  const s = {
    t: 0,
    seed,
    fx,
    player: { x: WIDTH / 2, y: 0.5, vx: 0, vy: JUMP * fx.jump, rocket: fx.rocketStart, shield: fx.shields, invulnerable: 0 },
    platforms: [],
    coins: [],
    hazards: [],
    pickups: [],
    top: 0, // highest platform made so far
    best: 0, // highest the player has been (the score)
    camera: 0,
    chase: 0, // the rising bottom
    coinsTaken: 0,
    dead: false,
    cause: null,
    revives: 0,
    events: [],
  };
  s.platforms.push({ x: WIDTH / 2, y: 0, w: 3, kind: 'normal' });
  s.rand = r;
  fill(s, 30);
  return s;
}

// keep the world built to `ahead` above the camera
function fill(s, ahead) {
  const r = s.rand;
  const limit = reach() * 0.85; // never a gap a base jump cannot make
  while (s.top < s.camera + ahead) {
    const d = difficulty(s.top);
    const gap = 0.9 + r() * (1.1 + d * (limit - 2.1));
    const y = s.top + Math.min(limit, gap);
    const w = 2.2 - d * 0.9 + r() * 0.6;
    const x = w / 2 + r() * (WIDTH - w);
    const roll = r();
    let kind = 'normal';
    if (roll < 0.08 + d * 0.22) kind = 'moving';
    else if (roll < 0.12 + d * 0.3 && s.top > 20) kind = 'crumble';
    const p = { x, y, w, kind };
    if (kind === 'moving') p.vx = (r() < 0.5 ? -1 : 1) * (1.2 + d * 2.3);
    s.platforms.push(p);
    // a crumbling platform always has a solid one near it, so it is a trap
    // for the careless, never a dead end
    if (kind === 'crumble') {
      const w2 = 1.8;
      s.platforms.push({ x: (x + WIDTH / 2 + r() * 3) % (WIDTH - w2) + w2 / 2, y: y + 0.3 + r() * 0.6, w: w2, kind: 'normal' });
    }
    const extra = r();
    if (kind === 'normal' && extra < 0.07) p.spring = true;
    else if (extra < 0.1 && s.top > 60) s.pickups.push({ x: p.x, y: p.y + 0.8, kind: 'rocket' });
    if (r() < 0.35) s.coins.push({ x: 0.5 + r() * (WIDTH - 1), y: y + 0.6 + r() * 1.5 });
    // spikes arrive at 120 m and thicken with height, and keep thickening past the ramp
    if (s.top > 120 && r() < 0.012 + d * 0.05 + Math.max(0, s.top - RAMP) * 0.00003) s.hazards.push({ x: 1 + r() * (WIDTH - 2), y: y + 1.2 + r() * 1.2, r: 0.45, vx: (r() < 0.5 ? -1 : 1) * (0.6 + d * 1.6) });
    s.top = y;
  }
  // forget what fell far below
  const floor = s.chase - 4; // below the storm nothing matters
  s.platforms = s.platforms.filter((p) => p.y > floor);
  s.coins = s.coins.filter((c) => c.y > floor);
  s.hazards = s.hazards.filter((h) => h.y > floor);
  s.pickups = s.pickups.filter((p) => p.y > floor);
}

// step the run by dt with steering input dir (-1, 0, 1)
export function step(s, dt, dir = 0) {
  if (s.dead) return s;
  const p = s.player;
  const h = Math.min(dt, 1 / 30);
  s.t += h;
  // steering, with a little drift so it feels like a body, not a cursor
  if (dir) p.vx += dir * MOVE.accel * h;
  else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), MOVE.drag * h);
  p.vx = Math.max(-MOVE.max, Math.min(MOVE.max, p.vx));
  p.x = (((p.x + p.vx * h) % WIDTH) + WIDTH) % WIDTH;
  if (p.invulnerable > 0) p.invulnerable -= h;
  if (p.rocket > 0) {
    p.rocket -= h;
    p.vy = ROCKET.speed;
  } else p.vy -= GRAVITY * h;
  const y0 = p.y;
  p.y += p.vy * h;

  for (const pl of s.platforms) {
    if (pl.kind === 'moving') {
      pl.x += pl.vx * h;
      if (pl.x < pl.w / 2 || pl.x > WIDTH - pl.w / 2) pl.vx *= -1;
    }
    if (pl.gone) continue;
    // land only when falling through the top of it
    if (p.vy <= 0 && y0 - PLAYER_R >= pl.y - 1e-6 && p.y - PLAYER_R <= pl.y && Math.abs(wrapDx(p.x, pl.x)) <= pl.w / 2 + PLAYER_R * 0.6) {
      if (pl.kind === 'crumble') {
        pl.gone = true;
        s.events.push({ t: s.t, type: 'crumble' });
        continue;
      }
      p.y = pl.y + PLAYER_R;
      p.vy = JUMP * s.fx.jump * (pl.spring ? SPRING : 1);
      s.events.push({ t: s.t, type: pl.spring ? 'spring' : 'bounce' });
    }
  }
  const pull = s.fx.magnet;
  s.coins = s.coins.filter((c) => {
    const dx = wrapDx(c.x, p.x);
    const dy = c.y - p.y;
    const d = Math.hypot(dx, dy);
    if (pull && d < pull) {
      c.x -= (dx / d) * 12 * h;
      c.y -= (dy / d) * 12 * h;
    }
    if (d < PLAYER_R + 0.35) {
      s.coinsTaken++;
      s.events.push({ t: s.t, type: 'coin' });
      return false;
    }
    return true;
  });
  s.pickups = s.pickups.filter((k) => {
    if (Math.hypot(wrapDx(k.x, p.x), k.y - p.y) < PLAYER_R + 0.45) {
      if (k.kind === 'rocket') p.rocket = ROCKET.time;
      s.events.push({ t: s.t, type: k.kind });
      return false;
    }
    return true;
  });
  for (const z of s.hazards) {
    z.x += z.vx * h;
    if (z.x < z.r || z.x > WIDTH - z.r) z.vx *= -1;
    if (z.hit || p.rocket > 0 || p.invulnerable > 0) continue;
    if (Math.hypot(wrapDx(z.x, p.x), z.y - p.y) < z.r + PLAYER_R) {
      if (p.shield > 0) {
        p.shield--;
        z.hit = true;
        p.invulnerable = 1;
        s.events.push({ t: s.t, type: 'shield' });
      } else return die(s, 'hazard');
    }
  }
  s.best = Math.max(s.best, p.y);
  if (s.t > CHASE.after) s.chase += chaseSpeed(s.chase) * h;
  // a missed jump is not the end: the camera follows you down to land lower,
  // but that is ground lost to the storm, and the storm is what kills
  s.camera = Math.max(s.chase, p.y - 6);
  if (p.y < s.chase - 0.3) return die(s, 'storm');
  fill(s, 30);
  return s;
}

function die(s, cause) {
  s.dead = true;
  s.cause = cause;
  s.events.push({ t: s.t, type: 'dead', cause });
  return s;
}

// Keep going after dying (an ad, or gems): back on a fresh platform just
// above the bottom of the screen, a moment of safety, a bounce up.
export function revive(s) {
  if (!s.dead) return s;
  const p = s.player;
  s.chase -= 3; // some room to recover
  s.camera = Math.max(s.chase, s.camera - 3);
  const y = s.chase + 2.5;
  s.platforms.push({ x: WIDTH / 2, y, w: 4, kind: 'normal' });
  p.x = WIDTH / 2;
  p.y = y + PLAYER_R;
  p.vx = 0;
  p.vy = JUMP * s.fx.jump;
  p.invulnerable = 2;
  s.dead = false;
  s.cause = null;
  s.revives++;
  s.events.push({ t: s.t, type: 'revive' });
  return s;
}

export const score = (s) => Math.floor(s.best);
const wrapDx = (a, b) => {
  let d = a - b;
  if (d > WIDTH / 2) d -= WIDTH;
  if (d < -WIDTH / 2) d += WIDTH;
  return d;
};
