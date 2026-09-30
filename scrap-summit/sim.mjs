// Scrap Summit: the climb itself. A body sits in a bin and holds a
// sledgehammer; the hammer head follows the player's aim. When the head is
// pressed into something solid it cannot move, so the body moves instead:
// push down on a rock and you lever yourself up, hook the head over a ledge
// and pull yourself over. That lever is the whole game.
//
// Pure and deterministic (no Math.random, no trig in the step), so the same
// mountain and the same inputs always give the same climb. That is what makes
// ghosts (a friend's recorded run beside yours) and checkable scores possible.
// World units are metres, y up.

export const G = 18; // a little under real gravity: floatier, more readable
export const BODY_R = 0.45;
export const HEAD_R = 0.16;
export const ARM = { min: 0.35, max: 1.7 };
export const HEAD_SPEED = 11; // how fast the head can swing, metres a second
export const LEVER_MAX = 9; // the fastest a lever can throw the body
export const DT = 1 / 120;
// sqrt is exact on every device; Math.hypot is not guaranteed to be, and a
// ghost must replay identically on any phone
const len = (x, y) => Math.sqrt(x * x + y * y);

// ---- geometry: convex polygons, closest points, circle contacts
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy || 1e-12;
  let t = ((px - ax) * dx + (py - ay) * dy) / l;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + dx * t, ay + dy * t];
}
function inside(poly, x, y) {
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}
// Push a circle out of a convex polygon (counter-clockwise). Returns the
// contact normal and depth, or null.
export function circlePoly(x, y, r, poly) {
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const [cx, cy] = closestOnSeg(x, y, a[0], a[1], b[0], b[1]);
    const d = len(x - cx, y - cy);
    if (d < bd) {
      bd = d;
      best = [cx, cy];
    }
  }
  const isIn = inside(poly, x, y);
  if (!isIn && bd >= r) return null;
  let nx = x - best[0];
  let ny = y - best[1];
  const l = len(nx, ny) || 1e-9;
  nx /= l;
  ny /= l;
  if (isIn) {
    nx = -nx;
    ny = -ny;
    return { nx, ny, depth: r + bd };
  }
  return { nx, ny, depth: r - bd };
}

// resolve a circle against every solid near it; returns the summed push and
// the strongest normal (for friction and grip)
function collide(world, x, y, r) {
  let px = 0;
  let py = 0;
  let n = null;
  let deepest = 0;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const s of world.near(x + px, y + py, r)) {
      const c = circlePoly(x + px, y + py, r, s.poly);
      if (!c) continue;
      px += c.nx * c.depth;
      py += c.ny * c.depth;
      moved = true;
      if (c.depth > deepest) {
        deepest = c.depth;
        n = { x: c.nx, y: c.ny, solid: s };
      }
    }
    if (!moved) break;
  }
  return { px, py, n };
}

// ---- the climber
export function createClimb(world, { start = world.start } = {}) {
  return {
    t: 0,
    steps: 0,
    body: { x: start[0], y: start[1], vx: 0, vy: 0 },
    head: { ox: 0.9, oy: -0.3 }, // hammer head, relative to the body
    planted: null, // the surface the head is biting into: { nx, ny, grip }
    grounded: false,
    best: start[1],
    top: false,
    inputs: [], // the recorded aim per step, for ghosts and checking
  };
}

// aim: where the player wants the hammer head, relative to the body (metres)
export function step(c, world, aim) {
  // record the aim at a fixed precision so a replay is exact
  const ax = Math.round(aim[0] * 256) / 256;
  const ay = Math.round(aim[1] * 256) / 256;
  c.inputs.push(ax, ay);
  const b = c.body;
  // keep the aim within the arm
  let tx = ax;
  let ty = ay;
  const l = len(tx, ty) || 1e-9;
  const reach = world.armMax ?? ARM.max;
  const k = l > reach ? reach / l : l < ARM.min ? ARM.min / l : 1;
  tx *= k;
  ty *= k;
  // the head swings towards the aim, no faster than HEAD_SPEED
  let dx = tx - c.head.ox;
  let dy = ty - c.head.oy;
  const d = len(dx, dy);
  const maxMove = HEAD_SPEED * DT;
  if (d > maxMove) {
    dx *= maxMove / d;
    dy *= maxMove / d;
  }
  const ox = c.head.ox + dx;
  const oy = c.head.oy + dy;
  const hx = b.x + c.head.ox; // where the head is now, in the world
  const hy = b.y + c.head.oy;

  // Planted: the head bites into a surface that faces upward (a ledge top, a
  // rock, the ground) and holds. The arm is rigid, so moving the aim moves
  // the body instead: drag the head back and you haul yourself forward, hook
  // a ledge and you hang. Lifting the head off lets go, and the body keeps
  // the speed the arm gave it: that is the fling. Ice lets the head slip.
  let planted = c.planted;
  if (planted && dx * planted.nx + dy * planted.ny > 0.004) planted = null; // lifting off
  if (planted) {
    const slip = 1 - planted.grip;
    const along = dx * -planted.ny + dy * planted.nx; // aim movement along the surface
    const nhx = hx + slip * along * -planted.ny;
    const nhy = hy + slip * along * planted.nx;
    const nbx = nhx - ox;
    const nby = nhy - oy;
    let vx = (nbx - b.x) / DT;
    let vy = (nby - b.y) / DT;
    const sp = len(vx, vy);
    if (sp > LEVER_MAX) {
      vx *= LEVER_MAX / sp;
      vy *= LEVER_MAX / sp;
    }
    b.x += vx * DT;
    b.y += vy * DT;
    b.vx = vx;
    b.vy = vy;
    c.head.ox = nhx - b.x;
    c.head.oy = nhy - b.y;
  } else {
    // free: the head swings to the aim; if that runs it into something solid
    // it stops there and the body takes the push (the plain lever)
    const hit = collide(world, b.x + ox, b.y + oy, HEAD_R);
    if (hit.n) {
      b.x += hit.px;
      b.y += hit.py;
      b.vx += hit.px / DT;
      b.vy += hit.py / DT;
      const sp = len(b.vx, b.vy);
      if (sp > LEVER_MAX) {
        b.vx *= LEVER_MAX / sp;
        b.vy *= LEVER_MAX / sp;
      }
      if (hit.py > 0 && b.vy < 0) b.vy = 0;
      if (hit.n.y > 0.35) planted = { nx: hit.n.x, ny: hit.n.y, grip: hit.n.solid.grip ?? 0.95 };
    }
    c.head.ox = ox;
    c.head.oy = oy;
  }
  c.planted = planted;

  // the body: gravity, a touch of air drag, then out of the rocks
  if (!c.planted) {
    b.vy -= G * DT;
    b.vx *= 0.999;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
  }
  const bc = collide(world, b.x, b.y, BODY_R);
  c.grounded = false;
  if (bc.n) {
    b.x += bc.px;
    b.y += bc.py;
    const n = bc.n;
    const vn = b.vx * n.x + b.vy * n.y;
    if (vn < 0) {
      // a little bounce, and friction along the surface (ice has almost none)
      const bounce = n.solid.bounce ?? 0.08;
      b.vx -= (1 + bounce) * vn * n.x;
      b.vy -= (1 + bounce) * vn * n.y;
    }
    const tx2 = -n.y;
    const ty2 = n.x;
    const vt = b.vx * tx2 + b.vy * ty2;
    const grip = n.solid.grip ?? 0.9;
    const cut = vt * Math.min(1, grip * 12 * DT);
    b.vx -= cut * tx2;
    b.vy -= cut * ty2;
    if (n.y > 0.5) c.grounded = true;
  }
  if (c.planted) {
    const touch = collide(world, b.x + c.head.ox, b.y + c.head.oy, HEAD_R + 0.03);
    if (!touch.n) c.planted = null;
  }
  c.t += DT;
  c.steps++;
  if (b.y > c.best) c.best = b.y;
  if (world.summit && b.y >= world.summit) c.top = true;
  return c;
}

// Replay a recorded run on the same mountain: the same inputs give the same
// climb, so a ghost is just this, and a claimed score can be checked by it.
export function replay(world, inputs, upTo = Infinity) {
  const c = createClimb(world);
  const n = Math.min(inputs.length / 2, upTo);
  for (let i = 0; i < n; i++) step(c, world, [inputs[2 * i], inputs[2 * i + 1]]);
  return c;
}

export const height = (c, world) => Math.max(0, c.best - world.start[1]);
