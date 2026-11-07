// Ball: roll and bounce a rubber ball through levels. Pass every ring to open
// the exit.
//
// Controls (Ryan, 28 Sep 2026: no buttons): put a thumb anywhere and drag to
// roll, the further the harder; a quick tap bounces, and a tap with a second
// finger while one is rolling bounces at once. Tap again right as you land to
// bounce higher, up to three steps.
//
// Physics has weight: the ball keeps rolling when you let go and slows
// gradually; slopes speed it up by themselves (a rolling hollow ball, so about
// 0.6 g down a slope); it bounces a little when it lands hard. Water floats a
// big ball and sinks a small one and leaves you wet: fireproof but slippery.
// Fire sets a dry ball alight: 3 seconds to find water.
//
// Units are tiles (1 tile = 1); drawn at T pixels a tile.

import { LEVELS } from './levels.js';
import * as art from './art.js';

const T = 46;
const G = 30;
const SIZES = {
  small: { r: 0.36, jump: 12.3, top: 4.8, float: 0.55 },
  big: { r: 0.55, jump: 14.5, top: 4.4, float: 1.65 },
};
const BEAT = 0.12; // the landing window for a higher bounce
const COYOTE = 0.12; // a late tap just off an edge still works
const BURN = 3;
const WET = 4;

// ---- shapes ------------------------------------------------------------------

function tileShape(c, x, y) {
  if (c === '#' || c === 'X' || c === 'T') return [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  if (c === '/') return [[x, y + 1], [x + 1, y], [x + 1, y + 1]];
  if (c === '\\') return [[x, y], [x + 1, y + 1], [x, y + 1]];
  return null;
}

// Circle against a convex polygon: the push out (normal and depth) or null.
function contact(cx, cy, r, poly) {
  let best = Infinity;
  let bx = 0;
  let by = 0;
  let inside = true;
  let inNx = 0;
  let inNy = 0;
  let inD = Infinity;
  const mx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const my = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len2 = ex * ex + ey * ey;
    let k = ((cx - a[0]) * ex + (cy - a[1]) * ey) / len2;
    k = Math.max(0, Math.min(1, k));
    const px = a[0] + ex * k;
    const py = a[1] + ey * k;
    const d = Math.hypot(cx - px, cy - py);
    if (d < best) {
      best = d;
      bx = px;
      by = py;
    }
    // outward normal of this edge
    let nx = ey;
    let ny = -ex;
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;
    if ((a[0] - mx) * nx + (a[1] - my) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const sd = (cx - a[0]) * nx + (cy - a[1]) * ny; // signed distance outside this edge
    if (sd > 0) inside = false;
    if (-sd < inD) {
      inD = -sd;
      inNx = nx;
      inNy = ny;
    }
  }
  if (inside) return { nx: inNx, ny: inNy, depth: r + inD };
  if (best >= r) return null;
  return { nx: (cx - bx) / best, ny: (cy - by) / best, depth: r - best };
}

export default {
  canRevive: true,

  drawTitle(g, ctx) {
    const t = performance.now() / 1000;
    art.sky(g, ctx);
    const y = ctx.H * 0.62;
    for (let x = -1; x < Math.ceil(ctx.W / T) + 2; x++) art.brick(g, x * T - ((t * 40) % T), y + T, T);
    const by = y + T - 18 - Math.abs(Math.sin(t * 3)) * 70;
    art.ring(g, 90, y - 10, false, true);
    art.ballArt(g, ctx.W / 2, by, 18, t * 4);
    art.ring(g, 90, y - 10, false, false);
  },

  create(ctx) {
    let levelIndex = Math.min(ctx.store.get('ball.level', 0), LEVELS.length - 1);
    let L, grid, rows, cols, rings, taken, ball, size, spawn, won, wonT, dead, deadT, exitAt;
    let platforms = [];
    let crumbling = new Map(); // "x,y" -> { since, broken, backAt }
    let springSquash = new Map();
    let lives = 3;
    let score = 0;
    let particles = [];
    let t = 0;
    let flash = 0;
    let comboShow = 0;
    let lastTheme = null;
    // input
    const fingers = new Map(); // id -> { x0, y0, x, y, t0, moved, jumped }
    let steer = null;
    const keys = { left: false, right: false };
    let jumpPending = false;
    let jumpHeld = false;
    let lastJump = -9;

    function load(i) {
      L = LEVELS[i];
      grid = L.map.map((row) => row.split(''));
      rows = grid.length;
      cols = grid[0].length;
      rings = [];
      platforms = [];
      crumbling = new Map();
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const c = grid[y][x];
          if (c === 'S') spawn = { x: x + 0.5, y: y + 0.5, size: L.start || 'small' };
          if (c === 'O') rings.push({ x, y });
          if (c === 'E') exitAt = { x, y };
          if (c === '=' || c === '|') {
            // three tiles wide: room for a rolling ball with momentum
            platforms.push({ x, y: y + 0.5, w: 3, h: 0.45, vx: c === '=' ? 1.8 : 0, vy: c === '|' ? 1.4 : 0, dx: 0, dy: 0 });
            grid[y][x] = '.';
          }
        }
      taken = new Set();
      won = false;
      respawn();
      ctx.store.set('ball.level', i);
    }

    function respawn() {
      size = spawn.size;
      ball = { x: spawn.x, y: spawn.y + 0.5 - SIZES[size].r - 0.01, vx: 0, vy: 0, spin: 0, grounded: false, groundT: -9, impact: 0, gn: [0, -1], inWater: 0, wet: 0, burn: 0, wall: 0, wallT: 0, combo: 0, pressT: -9, landT: -9, fromJump: false };
      jumpPending = false;
      ball.reboundUntil = -9;
      dead = false;
    }

    const tile = (x, y) => (y < 0 || y >= rows || x < 0 || x >= cols ? '#' : grid[y][x]);
    const solidAt = (x, y) => {
      const c = tile(x, y);
      if (c === 'X') {
        const cr = crumbling.get(x + ',' + y);
        return !(cr && cr.broken);
      }
      return c === '#' || c === '/' || c === '\\' || c === 'T';
    };

    function burst(x, y, color, n = 14, s = 6) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = s * (0.4 + Math.random());
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 0.5 + Math.random() * 0.4, color });
      }
    }

    function pop(why) {
      if (dead || won) return;
      dead = true;
      deadT = 0.9;
      burst(ball.x, ball.y, '#e0322b', 22, 8);
      ctx.sfx(140, 220, 'sawtooth');
      ctx.buzz(90);
      lives -= 1;
      if (lives <= 0) setTimeout(() => ctx.end(why), 700);
    }

    function requestJump(pressTime) {
      jumpPending = true;
      ball.pressT = pressTime;
    }

    function analog() {
      if (steer !== null && fingers.has(steer)) {
        const f = fingers.get(steer);
        const a = (f.x - f.x0) / 40;
        const c = Math.max(-1, Math.min(1, a));
        return Math.abs(c) < 0.08 ? 0 : c;
      }
      return (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    }

    load(levelIndex);

    function step(h) {
      const S = SIZES[size];
      const dir = analog();
      const slick = ball.wet > 0 && ball.grounded && !ball.inWater;
      ball.wallT = Math.max(0, ball.wallT - h);

      // water: how much of the ball is under
      let wet = 0;
      const cx = Math.floor(ball.x);
      for (const oy of [-1, 0, 1]) {
        const ty = Math.floor(ball.y) + oy;
        if (tile(cx, ty) !== '~') continue;
        const lo = Math.max(ty, ball.y - S.r);
        const hi = Math.min(ty + 1, ball.y + S.r);
        if (hi > lo) wet += (hi - lo) / (2 * S.r);
      }
      ball.inWater = Math.min(1, wet);
      if (ball.inWater > 0.2) {
        ball.wet = WET;
        if (ball.burn > 0) {
          ball.burn = 0;
          for (let i = 0; i < 10; i++) particles.push({ x: ball.x, y: ball.y - S.r, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, life: 0.7, color: '#e5e7eb' });
          ctx.sfx(1200, 250, 'sawtooth', 0.02);
        }
      } else ball.wet = Math.max(0, ball.wet - h);
      if (ball.burn > 0) {
        ball.burn -= h;
        if (ball.burn <= 0) return pop('Burnt up: find water faster');
      }

      // pushing: along the ground under you, gently in the air
      if (ball.grounded) {
        const [nx, ny] = ball.gn;
        const tx = -ny;
        const ty = nx; // along the surface, pointing right-ish
        const along = ball.vx * tx + ball.vy * ty;
        const grip = slick ? 0.3 : 1;
        if (dir && along * Math.sign(dir) < S.top) {
          ball.vx += tx * dir * 23 * grip * h;
          ball.vy += ty * dir * 23 * grip * h;
        }
        // a rolling ball feels about 0.6 of gravity down a slope
        const gAlong = G * ty;
        ball.vx -= 0.4 * gAlong * tx * h;
        ball.vy -= 0.4 * gAlong * ty * h;
        // rolling resistance: slows it gradually, much less when wet
        const res = (slick ? 0.4 : 2.2) * h;
        const a2 = ball.vx * tx + ball.vy * ty;
        const cut = Math.sign(a2) * Math.min(Math.abs(a2), res);
        ball.vx -= cut * tx;
        ball.vy -= cut * ty;
        if (slick && dir && Math.sign(dir) !== Math.sign(a2) && Math.abs(a2) > 1.5 && Math.random() < 0.3) particles.push({ x: ball.x, y: ball.y + S.r, vx: -ball.vx * 0.3, vy: -1, life: 0.3, color: '#9fd3ff' });
      } else if (dir && ball.vx * Math.sign(dir) < S.top) {
        // steering in the air nudges you up to your rolling top speed, no more
        // (unlimited, it flung the ball at three times top speed, 28 Sep 2026)
        ball.vx += dir * (ball.inWater ? 5 : 7) * h;
      }
      ball.vy += G * h;
      if (ball.inWater) {
        ball.vy -= G * S.float * ball.inWater * h * 1.35;
        ball.vx *= 1 - 2.2 * h;
        ball.vy *= 1 - 3.2 * h;
      }
      ball.vx *= 1 - 0.05 * h;
      ball.vx = Math.max(-S.top*1.35,Math.min(S.top*1.35,ball.vx));
      const sp = Math.hypot(ball.vx, ball.vy);
      // a safety limit only: above the biggest bounce (about 17.5 tiles/s)
      if (sp > 22) {
        ball.vx *= 22 / sp;
        ball.vy *= 22 / sp;
      }

      // bouncing: one tap; a tap timed with the landing goes higher
      const held = jumpHeld || [...fingers.values()].some(f => f.bounce);
      const autoBounce = held && !jumpPending && ball.grounded && t - lastJump > .15;
      if(autoBounce) requestJump(t);
      // Keep one airborne tap until the next contact. The old timeout silently
      // discarded taps while the ball was still in its automatic rubber rebound.
      const pressedRecently = jumpPending;
      if (pressedRecently && (ball.grounded || t-ball.groundT < COYOTE || t < ball.reboundUntil || ball.inWater > 0.35)) {
        const onBeat = !autoBounce && ball.fromJump && Math.abs(ball.pressT - ball.landT) < BEAT;
        ball.combo = onBeat && !ball.inWater ? Math.min(3, ball.combo + 1) : 0;
        const v = S.jump * [1, 1.16, 1.3, 1.42][ball.combo] * (ball.inWater > 0.35 && !ball.grounded ? 0.8 : 1);
        // A bounce goes up and preserves the player's sideways momentum.
        // Launching along a ramp normal used to fling uphill taps backwards.
        ball.vy = -v;
        ball.grounded = false;
        ball.groundT = -9;
        ball.reboundUntil = -9;
        lastJump = t;
        ball.fromJump = true;
        jumpPending = false;
        ctx.sfx((size === 'big' ? 300 : 460) * (1 + ball.combo * 0.25), 70, 'triangle');
        if (ball.combo) {
          burst(ball.x, ball.y + S.r, '#ffd23f', 6 + ball.combo * 4, 3 + ball.combo);
          ctx.buzz(10 + ball.combo * 8);
          comboShow = 0.8;
        }
      } else if (pressedRecently && ball.wallT > 0) {
        ball.vy = -S.jump * 0.92;
        ball.vx = ball.wall * 4.8;
        ball.wallT = 0;
        ball.groundT = -9;
        ball.reboundUntil = -9;
        lastJump = t;
        jumpPending = false;
        ctx.sfx(size === 'big' ? 340 : 520, 60, 'triangle');
        burst(ball.x - ball.wall * S.r, ball.y, '#d6d3cb', 5, 3);
      }

      // move, then push out of everything solid
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      ball.spin += (ball.vx / S.r) * h;
      const wasGrounded = ball.grounded;
      ball.rolling = wasGrounded;
      ball.grounded = false;
      let groundBest = 0;
      for (let ty = Math.floor(ball.y - S.r) - 1; ty <= Math.floor(ball.y + S.r) + 1; ty++) {
        for (let tx = Math.floor(ball.x - S.r) - 1; tx <= Math.floor(ball.x + S.r) + 1; tx++) {
          if (!solidAt(tx, ty)) continue;
          const c = tile(tx, ty);
          const k = contact(ball.x, ball.y, S.r, tileShape(c, tx, ty));
          if (!k) continue;
          resolve(k, S);
          if (k.ny < -0.55 && -k.ny > groundBest) {
            groundBest = -k.ny;
            ball.grounded = true;
            ball.gn = [k.nx, k.ny];
            if (c === 'T') {
              // spring: a big launch, straight up
              ball.vy = -S.jump * 1.9;
              ball.grounded = false;
              ball.groundT = -9;
              ball.reboundUntil = -9;
              lastJump = t;
              ball.combo = 0;
              springSquash.set(tx + ',' + ty, 0.25);
              ctx.sfx(330, 160, 'sine');
              ctx.buzz(20);
            }
            if (c === 'X') {
              const key = tx + ',' + ty;
              if (!crumbling.has(key)) crumbling.set(key, { since: t, broken: false, backAt: 0 });
            }
          }
          if (Math.abs(k.nx) > 0.75) {
            ball.wall = Math.sign(k.nx);
            ball.wallT = 0.14;
          }
        }
      }
      for (const p of platforms) {
        const k = contact(ball.x, ball.y, S.r, [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]]);
        if (!k) continue;
        resolve(k, S);
        if (k.ny < -0.55) {
          ball.grounded = true;
          ball.gn = [k.nx, k.ny];
          ball.x += p.dx; // ride along
          ball.y += p.dy;
        }
      }
      if (ball.grounded) ball.groundT = t;
      if (ball.grounded && !wasGrounded) ball.landT = t;
    }

    function resolve(k, S) {
      ball.x += k.nx * k.depth;
      ball.y += k.ny * k.depth;
      const vn = ball.vx * k.nx + ball.vy * k.ny;
      // rolling from one surface onto another (floor into a ramp): follow the
      // new surface instead of slamming into it, or a half pipe eats 80% of the
      // speed at the bottom and nothing can climb it
      // (only a ball moving along its old surface: a fall onto a slope is a landing)
      const along = Math.abs(ball.vx * ball.gn[0] + ball.vy * ball.gn[1]) < 1;
      if (vn < 0 && ball.rolling && along && k.ny < -0.55 && ball.gn[0] * k.nx + ball.gn[1] * k.ny < 0.99) {
        const sp = Math.hypot(ball.vx, ball.vy) * 0.95;
        let tx = -k.ny;
        let ty = k.nx;
        if (tx * ball.vx + ty * ball.vy < 0) {
          tx = -tx;
          ty = -ty;
        }
        ball.vx = tx * sp;
        ball.vy = ty * sp;
        return;
      }
      if (vn < 0) {
        if(k.ny < -.55) ball.impact = Math.min(1, Math.abs(vn)/18);
        // rubber: a hard landing bounces a couple of times before it settles
        // (Ryan, 28 Sep 2026: "he should bounce a couple times")
        const bounce = Math.abs(vn) > 2.2 ? 0.55 : 0;
        if(k.ny < -.55 && bounce)ball.reboundUntil=t+.18;
        ball.vx -= (1 + bounce) * vn * k.nx;
        ball.vy -= (1 + bounce) * vn * k.ny;
        if (Math.abs(vn) > 6) {
          ctx.sfx(200, 30, 'sine', 0.03);
          if(k.ny<-.55)burst(ball.x,ball.y+S.r,'#ddc99a',5,1.2);
        }
      }
    }

    function movePlatforms(h) {
      for (const p of platforms) {
        const ox = p.x;
        const oy = p.y;
        p.x += p.vx * h;
        p.y += p.vy * h;
        // turn round at anything solid
        const hitsSolid = () => {
          for (let ty = Math.floor(p.y); ty <= Math.floor(p.y + p.h - 1e-6); ty++) for (let tx = Math.floor(p.x); tx <= Math.floor(p.x + p.w - 1e-6); tx++) if (solidAt(tx, ty)) return true;
          return false;
        };
        if (hitsSolid()) {
          p.x = ox;
          p.y = oy;
          p.vx = -p.vx;
          p.vy = -p.vy;
        }
        p.dx = p.x - ox;
        p.dy = p.y - oy;
      }
    }

    function touch(dt) {
      const r = SIZES[size].r;
      const hit = (x0, y0, x1, y1) => {
        const nx = Math.max(x0, Math.min(ball.x, x1));
        const ny = Math.max(y0, Math.min(ball.y, y1));
        return Math.hypot(ball.x - nx, ball.y - ny) < r;
      };
      for (let ty = Math.floor(ball.y - r); ty <= Math.floor(ball.y + r) + 2; ty++) {
        for (let tx = Math.floor(ball.x - r); tx <= Math.floor(ball.x + r); tx++) {
          const c = tile(tx, ty);
          if (c === '^' && hit(tx + 0.12, ty + 0.4, tx + 0.88, ty + 1)) return pop('Popped on a spike');
          if (c === 'v' && hit(tx + 0.12, ty, tx + 0.88, ty + 0.6)) return pop('Popped on a spike');
          const fire = (c === 'F' && hit(tx + 0.12, ty + 0.3, tx + 0.88, ty + 1)) || (c === 'J' && jetOn(tx) && hit(tx + 0.2, ty - 1.6, tx + 0.8, ty + 1));
          if (fire) {
            if (ball.wet > 0) {
              ball.wet = Math.max(0, ball.wet - dt * 1.2);
              if (Math.random() < 0.4) particles.push({ x: ball.x, y: ball.y - r, vx: (Math.random() - 0.5) * 2, vy: -3, life: 0.5, color: '#e5e7eb' });
            } else if (ball.burn <= 0) {
              ball.burn = BURN;
              ctx.sfx(180, 300, 'sawtooth', 0.05);
              ctx.buzz(40);
            }
          }
          if (c === 'P' && size !== 'big' && hit(tx + 0.2, ty + 0.2, tx + 0.8, ty + 1)) {
            size = 'big';
            ball.y -= SIZES.big.r - SIZES.small.r;
            burst(ball.x, ball.y, '#7fd3ff', 10, 4);
            ctx.sfx(520, 180, 'sine');
          }
          if (c === 'D' && size !== 'small' && hit(tx + 0.2, ty + 0.2, tx + 0.8, ty + 1)) {
            size = 'small';
            burst(ball.x, ball.y, '#ffffff', 10, 4);
            ctx.sfx(700, 160, 'sine', 0.04);
          }
          if (c === 'C' && (spawn.x !== tx + 0.5 || spawn.y !== ty + 0.5) && hit(tx, ty, tx + 1, ty + 1)) {
            spawn = { x: tx + 0.5, y: ty + 0.5, size };
            burst(tx + 0.5, ty + 0.5, '#9dffb0', 10, 4);
            ctx.sfx(880, 120, 'triangle');
          }
        }
      }
      for (const q of rings) {
        const k = q.x + ',' + q.y;
        if (!taken.has(k) && Math.abs(ball.x - (q.x + 0.5)) < 0.2+r && Math.abs(ball.y - (q.y + 0.5)) < 0.42+r) {
          taken.add(k);
          score += 10;
          ctx.setScore(score);
          burst(q.x + 0.5, q.y + 0.5, '#ffd23f', 12, 5);
          ctx.sfx(988, 90, 'triangle');
          ctx.buzz(15);
        }
      }
      if (taken.size === rings.length && Math.abs(ball.x - (exitAt.x + 0.5)) < 0.5 && Math.abs(ball.y - (exitAt.y + 0.5)) < 0.7) {
        won = true;
        wonT = 1.2;
        score += 100 + lives * 20;
        ctx.setScore(score);
        flash = 0.4;
        burst(exitAt.x + 0.5, exitAt.y + 0.5, '#9dffb0', 30, 7);
        ctx.sfx(660, 120, 'triangle');
        setTimeout(() => ctx.sfx(990, 200, 'triangle'), 130);
      }
      if (ball.y > rows + 2) pop('Fell out of the world');
    }

    function jetOn(tx) {
      return (t + tx * 0.37) % 2.4 < 1.1;
    }

    return {
      // read only, for tests and tuning
      peek() {
        return { ball: { ...ball }, size, lives, level: levelIndex, rings: rings.length, taken: taken.size, missing: rings.filter((q) => !taken.has(q.x + ',' + q.y)).map((q) => [q.x, q.y]), platforms: platforms.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })), won, dead };
      },

      pointerDown(x, y, id = 0) {
        // Two thumbs (Ryan, 28 Sep 2026): a thumb on the left half is the roll
        // stick; a touch on the right half bounces the moment it lands; while
        // the roll thumb is down, a touch anywhere bounces.
        const rolling = steer !== null && fingers.has(steer);
        if (rolling || x > ctx.W / 2) {
          requestJump(t);
          fingers.set(id, { x0: x, y0: y, x, y, t0: t, moved: false, bounce: true });
          return;
        }
        fingers.set(id, { x0: x, y0: y, x, y, t0: t, moved: false });
        steer = id; // the stick starts where the thumb lands
      },
      pointerMove(x, y, down, id = 0) {
        const f = fingers.get(id);
        if (!f) return;
        f.x = x;
        f.y = y;
        if (!f.moved && Math.hypot(x - f.x0, y - f.y0) > 10) f.moved = true;
      },
      pointerUp(x, y, id = 0) {
        const f = fingers.get(id);
        if (!f) return;
        // one thumb only: a quick tap on the roll side that did not drag still bounces
        if (!f.bounce && !f.moved && t - f.t0 < 0.45 && fingers.size === 1) requestJump(t);
        fingers.delete(id);
        if (steer === id) steer = null;
      },
      key(code, down) {
        if (code === 'ArrowLeft' || code === 'KeyA') keys.left = down;
        if (code === 'ArrowRight' || code === 'KeyD') keys.right = down;
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
          if(down && !jumpHeld) requestJump(t);
          jumpHeld=down;
        }
      },
      cancelInput(){fingers.clear();steer=null;keys.left=keys.right=false;jumpHeld=false;jumpPending=false;},
      pointerCancel(x,y,id=0){fingers.delete(id);if(steer===id)steer=null;},

      revive() {
        lives = 3;
        respawn();
      },

      update(dt) {
        t += dt;
        ball.impact = Math.max(0,ball.impact-dt*6);
        for (const q of particles) {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vy += G * 0.6 * dt;
          q.life -= dt;
        }
        particles = particles.filter((q) => q.life > 0);
        if (flash > 0) flash -= dt;
        if (comboShow > 0) comboShow -= dt;
        for (const [k, v] of springSquash) springSquash.set(k, Math.max(0, v - dt));
        // crumbling blocks give way, then come back
        for (const [key, cr] of crumbling) {
          if (!cr.broken && t - cr.since > 0.45) {
            cr.broken = true;
            cr.backAt = t + 4;
            const [x, y] = key.split(',').map(Number);
            burst(x + 0.5, y + 0.5, '#b8894f', 12, 4);
            ctx.sfx(110, 160, 'square', 0.04);
          } else if (cr.broken && t > cr.backAt) {
            const [x, y] = key.split(',').map(Number);
            const r = SIZES[size].r;
            if (Math.abs(ball.x - (x + 0.5)) > 0.5 + r || Math.abs(ball.y - (y + 0.5)) > 0.5 + r) crumbling.delete(key);
          }
        }
        if (won) {
          wonT -= dt;
          if (wonT <= 0) {
            if (levelIndex + 1 >= LEVELS.length) {
              ctx.store.set('ball.level', 0);
              won = false;
              ctx.end('You beat every level!');
              return;
            }
            levelIndex += 1;
            load(levelIndex);
          }
          return;
        }
        if (dead) {
          deadT -= dt;
          if (deadT <= 0 && lives > 0) respawn();
          return;
        }
        const steps = Math.max(1,Math.ceil(dt*360));
        const h = dt / steps;
        for (let s = 0; s < steps && !dead; s++) {
          movePlatforms(h);
          step(h);
        }
        if (!dead) {
          if (ball.grounded && t - ball.landT > BEAT) {
            ball.combo = 0;
            ball.fromJump = false;
          }
          touch(dt);
        }
      },

      draw(g) {
        const S = SIZES[size];
        const cave = L.theme === 'cave';
        if (typeof document !== 'undefined' && lastTheme !== L.theme) {
          lastTheme = L.theme;
          document.documentElement.style.setProperty('--bg', cave ? '#1b1620' : '#6ec3f4');
        }
        if (cave) art.caveBack(g, ctx);
        else art.sky(g, ctx);
        const worldH = rows * T;
        let offY = Math.max(110, ctx.H - worldH);
        if (worldH > ctx.H - 110) offY = Math.max(ctx.H - worldH, Math.min(110, ctx.H * 0.55 - ball.y * T));
        // look ahead the way you are rolling
        let camX = ball.x * T - ctx.W * .42 + Math.max(-45, Math.min(45, ball.vx * 7));
        camX = Math.max(0, Math.min(cols * T - ctx.W, camX));
        if (cols * T < ctx.W) camX = (cols * T - ctx.W) / 2;
        const ceilingOnly = /^#+$/.test(L.map[0]);
        g.save();
        g.translate(-camX, offY);
        const yFrom = Math.max(0, Math.floor(-offY / T) - 1);
        const yTo = Math.min(rows, Math.ceil((ctx.H - offY) / T) + 1);
        const open = taken.size === rings.length;
        for (let y = yFrom; y < yTo; y++)
          for (let x = Math.max(0, Math.floor(camX / T) - 1); x < Math.min(cols, Math.ceil((camX + ctx.W) / T) + 1); x++) {
            const c = grid[y][x];
            const px = x * T;
            const py = y * T;
            if (c === '#' && !(y === 0 && ceilingOnly && !cave)) (cave ? art.stone : art.brick)(g, px, py, T, x, y, !['#', 'X', 'T'].includes(tile(x, y - 1)));
            else if (c === '/') art.ramp(g, px, py, T, 1, cave);
            else if (c === '\\') art.ramp(g, px, py, T, -1, cave);
            else if (c === 'X') {
              const cr = crumbling.get(x + ',' + y);
              if (!cr) art.crumble(g, px, py, T, 1);
              else if (!cr.broken) art.crumble(g, px + Math.sin(t * 60) * 2, py, T, 1 - (t - cr.since) / 0.45);
            } else if (c === 'T') art.spring(g, px, py, T, (springSquash.get(x + ',' + y) || 0) * 4);
            else if (c === 'F') art.fire(g, px, py, T, t, x);
            else if (c === 'J') art.jet(g, px, py, T, t, jetOn(x));
            else if (c === '^') {
              if (tile(x, y - 1) === '~') art.water(g, px, py, T, t, false);
              art.spikes(g, px, py, T, false);
            } else if (c === 'v') art.spikes(g, px, py, T, true);
            else if (c === 'E') art.exitDoor(g, px, py, T, open, t);
            else if (c === 'C') art.flag(g, px, py, T, spawn.x === x + 0.5 && spawn.y === y + 0.5);
            else if (c === 'P') art.pump(g, px, py, T);
            else if (c === 'D') art.pin(g, px, py, T);
            else if (c === '~') art.water(g, px, py, T, t, tile(x, y - 1) !== '~');
          }
        for (const p of platforms) art.platform(g, p.x * T, p.y * T, p.w * T, p.h * T);
        for (const q of rings) art.ring(g, q.x * T + T / 2, q.y * T + T / 2, taken.has(q.x + ',' + q.y), true);
        if (!dead) {
          art.ballArt(g, ball.x * T, ball.y * T, S.r * T, ball.spin, ball);
          if (ball.burn > 0) {
            for (let i = 0; i < 5; i++) {
              const a = t * 8 + i * 1.3;
              g.fillStyle = i % 2 ? 'rgba(255,176,32,0.9)' : 'rgba(255,90,31,0.9)';
              g.beginPath();
              g.arc(ball.x * T + Math.sin(a) * S.r * T * 0.6, ball.y * T - S.r * T * (0.6 + 0.5 * ((i * 0.37 + t * 3) % 1)), S.r * T * 0.28, 0, Math.PI * 2);
              g.fill();
            }
          }
          if (ball.wet > 0) {
            g.fillStyle = 'rgba(120,190,255,' + Math.min(1, ball.wet) + ')';
            for (let i = 0; i < 3; i++) g.fillRect(ball.x * T - S.r * T * 0.6 + i * S.r * T * 0.6, ball.y * T + S.r * T + ((t * 60 + i * 7) % 10), 2, 4);
          }
        }
        for (const q of rings) art.ring(g, q.x * T + T / 2, q.y * T + T / 2, taken.has(q.x + ',' + q.y), false);
        for (const q of particles) {
          g.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
          g.fillStyle = q.color;
          g.beginPath();g.arc(q.x*T,q.y*T,Math.max(.8,q.life*3),0,Math.PI*2);g.fill();
        }
        g.globalAlpha = 1;
        g.restore();

        if (flash > 0) {
          g.fillStyle = 'rgba(157,255,176,' + flash + ')';
          g.fillRect(0, 0, ctx.W, ctx.H);
        }
        // level, rings and lives, under the score
        g.fillStyle = 'rgba(12,20,40,0.55)';
        art.roundRect(g, 12, 16, Math.min(ctx.W - 80, 300), 38, 19);
        g.fill();
        g.font = '800 13px system-ui';
        g.textAlign = 'left';
        g.fillStyle = '#fff6e0';
        g.fillText(levelIndex + 1 + '. ' + L.name, 26, 40);
        g.textAlign = 'right';
        g.fillStyle = '#ffd23f';
        g.fillText('◯ ' + taken.size + '/' + rings.length, Math.min(ctx.W - 102, 286), 40);
        g.fillStyle = '#ff6b5e';
        g.fillText('●'.repeat(Math.max(0, lives)), Math.min(ctx.W - 102, 286), 76);
        if(!open && Math.abs(ball.x-exitAt.x)<3){
          g.textAlign='center';g.fillStyle='#fff0b7';g.font='700 14px system-ui';
          g.fillText('← '+(rings.length-taken.size)+' rings still to collect',ctx.W/2,112);
        }
        if (comboShow > 0 && ball.combo > 0) {
          g.textAlign = 'center';
          g.font = '900 ' + (20 + ball.combo * 4) + 'px system-ui';
          g.fillStyle = 'rgba(255,210,63,' + Math.min(1, comboShow * 2) + ')';
          g.fillText(['', 'BOUNCE!', 'HIGHER!', 'SKY HIGH!'][ball.combo], ctx.W / 2, 135);
        }
        if (!dead && ball.burn > 0) {
          g.textAlign = 'center';
          g.font = '900 20px system-ui';
          g.fillStyle = Math.sin(t * 14) > 0 ? '#ff5a1f' : '#ffd23f';
          g.fillText('ON FIRE! WATER! ' + ball.burn.toFixed(1), ctx.W / 2, 112);
        } else if (t < 5 && L.hint && ctx.store.get('arcade.hints', true)) {
          g.textAlign = 'center';
          g.font = '600 13px system-ui';
          g.fillStyle = 'rgba(255,246,224,' + Math.min(1, 5 - t) + ')';
          art.wrap(g, L.hint, ctx.W / 2, 105, 300, 17);
        }
        // the thumb stick, where the thumb is
        if (steer !== null && fingers.has(steer) && fingers.get(steer).moved) {
          const f = fingers.get(steer);
          const dx = Math.max(-46, Math.min(46, f.x - f.x0));
          art.stick(g, f.x0, f.y0, f.x0 + dx, f.y0);
        }
      },
    };
  },
};
