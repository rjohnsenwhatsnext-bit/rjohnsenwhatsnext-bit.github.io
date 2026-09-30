// Flight of a folded paper plane: rigid body, six degrees of freedom, forces
// worked out every step from the paper's own surface.
//
// The folded paper (paper.mjs build()) gives mass samples (every layer and
// clip) and surface samples (one per patch of paper the air can touch). Each
// step, for every surface patch, the air velocity it feels is the wind minus
// the plane's velocity and its spin at that point. A flat plate normal force
// and skin friction act on the patch; they add up to the total force and
// turning moment. Nothing is looked up per design: turning, stalling,
// tumbling and gliding all come out of the geometry.
//
// Frames: world is x forward (the throw direction at zero yaw), y up, z right
// (three.js convention). Body is x nose, y up (away from the keel), z right,
// origin at the centre of mass.

import { add, sub, scale, dot, cross, len, norm, mat3Mul, mat3Vec, mat3T, mat3Inv, quatMul, quatNorm, quatToMat3, quatFromMat3, quatFromRotVec, eigenSym3 } from './vec.mjs';
import { airField } from './air.mjs';

export const RHO = 1.225; // air density, kg/m^3
export const GRAVITY = 9.81;
const STALL = 0.3; // radians (about 17 degrees): low aspect ratio paper stalls late
const CN_SEPARATED = 1.17; // flat plate normal force coefficient broadside on
const CF = 0.012; // skin friction, both faces

// ---- The plane, in its own frame -------------------------------------------

// model(built, { nose }) turns build() output into a flyable body.
//   nose  optional unit vector (in build coordinates) to force the nose direction
export function model(built, { nose, up } = {}) {
  const ms = built.massSamples;
  const m = built.totalMass;
  const cg = scale(ms.reduce((s, x) => add(s, scale(x.p, x.m)), [0, 0, 0]), 1 / m);

  // Principal axes: the long axis is the nose line, the axis with the most
  // inertia is up (normal to the main surface).
  const I0 = inertiaAbout(ms, cg);
  const { values, vectors } = eigenSym3(I0);
  const cols = [0, 1, 2].map((i) => [vectors[i], vectors[3 + i], vectors[6 + i]]);
  const order = [0, 1, 2].sort((a, b) => values[a] - values[b]);
  // Up: the axis with the most inertia, square to the main surface.
  let yb = cols[order[2]];
  const aero = built.aeroSamples;
  // Nose: along the keel, the fold you hold a paper plane by. The keel is the
  // paper standing square to the wings; it runs front to back. A dart is long
  // and a wide glider is wide, so "the longest direction" would get gliders
  // wrong (flown sideways). With no keel at all, fall back to the long axis.
  const keelish = aero.filter((x) => Math.abs(dot(x.n, yb)) < 0.5);
  const cand = [cols[order[0]], cols[order[1]]];
  let xb = cand[0];
  if (keelish.length >= 8) {
    const along = cand.map((c) => spread(keelish, cg, c));
    xb = along[1] > along[0] ? cand[1] : cand[0];
  }
  const aeroArea = aero.reduce((s, x) => s + x.area, 0);
  const ac = scale(aero.reduce((s, x) => add(s, scale(x.p, x.area)), [0, 0, 0]), 1 / aeroArea);

  if (up) yb = norm(up);
  if (nose) xb = norm(nose);
  else {
    // The nose is the heavy end: centre of mass ahead of the middle of the paper.
    const lead = dot(sub(cg, ac), xb);
    if (lead < 0) xb = scale(xb, -1);
    if (Math.abs(lead) < 1e-4) {
      // Balanced: take the narrower (pointier) end.
      const along = aero.map((x) => dot(sub(x.p, cg), xb));
      const hi = Math.max(...along);
      const lo = Math.min(...along);
      const widthAt = (t) => spread(aero.filter((x, i) => Math.abs(along[i] - t) < 0.02), cg, cross(xb, yb));
      if (widthAt(lo) < widthAt(hi)) xb = scale(xb, -1);
    }
  }
  yb = norm(sub(yb, scale(xb, dot(yb, xb))));
  // Up is away from the keel: vertical surfaces (normals across y) sit below.
  const keel = aero.filter((x) => Math.abs(dot(x.n, yb)) < 0.5);
  if (keel.length) {
    const kc = scale(keel.reduce((s, x) => add(s, x.p), [0, 0, 0]), 1 / keel.length);
    if (dot(sub(kc, cg), yb) > 0) yb = scale(yb, -1);
  }
  const zb = norm(cross(xb, yb));
  const Rb = [xb[0], yb[0], zb[0], xb[1], yb[1], zb[1], xb[2], yb[2], zb[2]]; // body to build coords
  const RbT = mat3T(Rb);
  const toBody = (p) => mat3Vec(RbT, sub(p, cg));

  const massBody = ms.map((x) => ({ r: toBody(x.p), m: x.m }));
  const I = inertiaAbout(massBody.map((x) => ({ p: x.r, m: x.m })), [0, 0, 0]);

  const samples = aero.map((x) => ({ r: toBody(x.p), n: norm(mat3Vec(RbT, x.n)), area: x.area, w: 1 }));

  // Effective aspect ratio of the lifting surfaces sets the lift slope.
  const lifting = samples.filter((s) => Math.abs(s.n[1]) > 0.5);
  const liftArea = lifting.reduce((s, x) => s + x.area * Math.abs(x.n[1]), 0) || aeroArea;
  const zs = lifting.length ? lifting.map((s) => s.r[2]) : samples.map((s) => s.r[2]);
  const span = Math.max(...zs) - Math.min(...zs) + built.spacing;
  const AR = (span * span) / liftArea;
  const liftSlope = (2 * Math.PI * AR) / (2 + AR);
  // Where the lift acts along each strip depends on the wing's shape: a long
  // thin wing is loaded towards its leading edge (quarter chord), a stubby
  // delta like a dart carries lift where its span grows, which puts the centre
  // of lift near the middle of the area (two thirds back from the nose).
  chordWeights(samples, built.spacing, Math.max(0, Math.min(1, (AR - 1) / 3)));

  const hull = built.hull.map(toBody);
  return { mass: m, I, Iinv: mat3Inv(I), samples, liftSlope, AR, span, area: aeroArea, liftArea, hull, cgBuild: cg, bodyToBuild: Rb, massBody };
}

function inertiaAbout(pts, c) {
  let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
  for (const s of pts) {
    const x = s.p[0] - c[0];
    const y = s.p[1] - c[1];
    const z = s.p[2] - c[2];
    xx += s.m * (y * y + z * z);
    yy += s.m * (x * x + z * z);
    zz += s.m * (x * x + y * y);
    xy -= s.m * x * y;
    xz -= s.m * x * z;
    yz -= s.m * y * z;
  }
  // A sheet has thickness too: keep the flat axes from being exactly singular.
  const eps = 1e-9;
  return [xx + eps, xy, xz, xy, yy + eps, yz, xz, yz, zz + eps];
}

function spread(list, cg, axis) {
  if (!list.length) return 0;
  const v = list.map((x) => dot(sub(x.p, cg), axis));
  return Math.max(...v) - Math.min(...v);
}

// Attached flow on a thin plate is loaded towards the leading edge (the
// centre of pressure sits a quarter of the way back, not in the middle).
// Each patch gets a weight from where it sits between leading and trailing
// edge along its strip, flat plate thin aerofoil loading, mean 1 per strip.
function chordWeights(samples, h, blend) {
  const bins = new Map();
  for (const s of samples) {
    const across = cross(s.n, [1, 0, 0]);
    if (len(across) < 0.2) continue; // faces the nose: no chord to speak of
    const p = norm(across);
    const station = Math.round(dot(s.r, p) / h);
    const key = `${Math.round(Math.abs(s.n[0]) * 10)},${Math.round(Math.abs(s.n[1]) * 10)},${Math.round(Math.abs(s.n[2]) * 10)}|${station}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(s);
  }
  for (const list of bins.values()) {
    const xs = list.map((s) => s.r[0]);
    const le = Math.max(...xs) + h / 2;
    const te = Math.min(...xs) - h / 2;
    const c = Math.max(le - te, h);
    let sum = 0;
    for (const s of list) {
      const xi = Math.min(0.999, Math.max(0.001, (le - s.r[0]) / c));
      s.w = Math.min(6, Math.sqrt((1 - xi) / (xi + 0.03)));
      sum += s.w;
    }
    const mean = sum / list.length;
    for (const s of list) s.w = 1 + blend * (s.w / mean - 1);
  }
}

// Force and moment (body frame) from air moving at `air` (body frame,
// velocity of the air relative to the plane's centre) with body rates `omega`.
export function aeroLoads(pl, air, omega) {
  let fx = 0, fy = 0, fz = 0, mx = 0, my = 0, mz = 0;
  const a = pl.liftSlope;
  for (const s of pl.samples) {
    const r = s.r;
    // air relative to this patch = air - (omega x r)
    const wx = air[0] - (omega[1] * r[2] - omega[2] * r[1]);
    const wy = air[1] - (omega[2] * r[0] - omega[0] * r[2]);
    const wz = air[2] - (omega[0] * r[1] - omega[1] * r[0]);
    const w2 = wx * wx + wy * wy + wz * wz;
    if (w2 < 1e-10) continue;
    const wl = Math.sqrt(w2);
    const n = s.n;
    const wn = wx * n[0] + wy * n[1] + wz * n[2];
    const sa = wn / wl;
    const ca = Math.sqrt(Math.max(0, 1 - sa * sa));
    const alpha = Math.abs(Math.asin(Math.max(-1, Math.min(1, sa))));
    const f = alpha <= STALL - 0.08 ? 0 : alpha >= STALL + 0.08 ? 1 : (alpha - (STALL - 0.08)) / 0.16;
    const cn = (1 - f) * a * sa * ca * s.w + f * CN_SEPARATED * sa * Math.abs(sa);
    const q = 0.5 * RHO * w2 * s.area;
    // normal force along n, friction along the in-plane part of the air
    let Fx = q * cn * n[0];
    let Fy = q * cn * n[1];
    let Fz = q * cn * n[2];
    const tx = wx - wn * n[0];
    const ty = wy - wn * n[1];
    const tz = wz - wn * n[2];
    const k = 0.5 * RHO * wl * s.area * CF;
    Fx += k * tx;
    Fy += k * ty;
    Fz += k * tz;
    fx += Fx;
    fy += Fy;
    fz += Fz;
    mx += r[1] * Fz - r[2] * Fy;
    my += r[2] * Fx - r[0] * Fz;
    mz += r[0] * Fy - r[1] * Fx;
  }
  return { force: [fx, fy, fz], moment: [mx, my, mz] };
}

// ---- What the fold will do, before it is thrown ----------------------------

// analyse(pl): steady forward flight at a range of angles of attack, no spin.
// Returns trim angle (nose up where the pitching moment is zero), glide ratio,
// glide speed, stability and any built in turn, for the folding screen.
export function analyse(pl) {
  const V = 8;
  const rows = [];
  for (let deg = -10; deg <= 45; deg += 0.5) {
    const al = (deg * Math.PI) / 180;
    // plane moving along its nose tipped down by alpha relative to the path
    const air = [-V * Math.cos(al), V * Math.sin(al), 0];
    const { force, moment } = aeroLoads(pl, air, [0, 0, 0]);
    const liftDir = norm(cross([0, 0, 1], norm(scale(air, -1)))); // perpendicular, up side
    const lift = dot(force, liftDir);
    rows.push({ deg, lift, drag: Math.abs(dot(force, norm(air))), pitch: moment[2], roll: moment[0], yaw: moment[1], side: force[2] });
  }
  // trim: pitching moment crosses from nose up (+) to nose down (-) as alpha rises
  let trim = null;
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1];
    const c = rows[i];
    if (p.pitch > 0 && c.pitch <= 0) {
      const t = p.pitch / (p.pitch - c.pitch);
      trim = { deg: p.deg + (c.deg - p.deg) * t, i };
      break;
    }
  }
  const W = pl.mass * GRAVITY;
  if (!trim) {
    const allUp = rows.every((r) => r.pitch > 0);
    return {
      stable: false,
      verdict: allUp ? 'pitches up and tumbles over backwards' : 'noses straight down',
      trimDeg: null,
      glideRatio: 0,
      glideSpeed: null,
      turn: 0,
      rows,
    };
  }
  const r = rows[trim.i];
  const glideRatio = r.lift > 0 ? r.lift / Math.max(1e-9, r.drag) : 0;
  const glideSpeed = r.lift > 0 ? V * Math.sqrt(W / Math.hypot(r.lift, r.drag)) : null;
  const slope = (rows[trim.i].pitch - rows[trim.i - 1].pitch) / 0.5; // per degree
  // A built in roll or yaw moment at trim means it will turn. Normalised by
  // the pitch stiffness so it reads as "how much" rather than raw newton metres.
  const turn = r.roll / Math.max(1e-9, Math.abs(slope) * 5);
  let verdict = 'glides';
  if (trim.deg < 1.5) verdict = 'flies fast and dives';
  else if (trim.deg > STALL * 57.3 - 2) verdict = 'stalls and swoops';
  else if (glideRatio > 4) verdict = 'long floaty glide';
  if (Math.abs(turn) > 0.15) verdict += turn > 0 ? ', banks and turns right' : ', banks and turns left';
  return {
    stable: slope < 0,
    verdict,
    trimDeg: trim.deg,
    glideRatio,
    glideSpeed,
    turn,
    staticStiffness: -slope,
    rows,
  };
}

// ---- Flying it ---------------------------------------------------------------

// createFlight(pl, throwSpec, scenario)
//   throwSpec  { speed m/s, pitch deg (up), yaw deg (right), roll deg (right wing down), position [x,y,z] }
//   scenario   see scenarios.mjs; supplies wind(pos, t) and the world
// Returns { state, step(dt), done, result, events }.
export function createFlight(pl, throwSpec, scenario) {
  const { speed = 8, pitch = 5, yaw = 0, roll = 0 } = throwSpec;
  const pos0 = throwSpec.position || scenario.launch.position;
  const p = (pitch * Math.PI) / 180;
  const y = (yaw * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  // body axes in world: nose along the throw, then roll about the nose
  const nose = [Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)];
  const right0 = norm(cross(nose, [0, 1, 0]));
  const up0 = norm(cross(right0, nose));
  // positive roll banks right: the up vector leans towards the right wing
  const up = add(scale(up0, Math.cos(r)), scale(right0, Math.sin(r)));
  const right = norm(cross(nose, up));
  const R0 = [nose[0], up[0], right[0], nose[1], up[1], right[1], nose[2], up[2], right[2]];

  const state = {
    t: 0,
    pos: pos0.slice(),
    vel: scale(nose, speed),
    q: quatFromMat3(R0),
    omega: [0, 0, 0],
    pitchTurned: 0,
    maxTurned: 0,
    maxHeight: pos0[1],
  };
  const events = [];
  // Each flight has its own air, so switching a fan in one flight never
  // leaks into the next. Levels list `airSources` (air.mjs); `wind` is the
  // background air either way.
  const ambient = scenario.wind || (() => [0, 0, 0]);
  const air = scenario.airSources ? airField(scenario.airSources, ambient) : null;
  const windAt = air ? air.wind : ambient;
  const out = {
    state,
    events,
    done: false,
    result: null,
    step,
    air,
    bodyToWorld: () => quatToMat3(state.q),
    // a player tapping a fan: flips it now, recorded for replays
    toggle(id) {
      if (!air) throw new Error('This level has no air sources');
      const on = !air.isOn(id, state.t);
      air.set(id, on, state.t);
      events.push({ type: 'switch', id, on, t: state.t });
      return on;
    },
    setAir(id, on) {
      if (!air) throw new Error('This level has no air sources');
      air.set(id, on, state.t);
      events.push({ type: 'switch', id, on: Boolean(on), t: state.t });
    },
  };
  const hoopPassed = new Set();
  const reach = Math.max(...pl.hull.map((h) => len(h))) + 0.05;

  function step(dt) {
    if (out.done) return out;
    const sub = Math.max(1, Math.ceil(dt / (1 / 480)));
    const h = dt / sub;
    for (let i = 0; i < sub && !out.done; i++) substep(h);
    return out;
  }

  function substep(h) {
    const Rw = quatToMat3(state.q);
    const RwT = mat3T(Rw);
    const wind = windAt(state.pos, state.t);
    const airBody = mat3Vec(RwT, sub(wind, state.vel));
    const { force, moment } = aeroLoads(pl, airBody, state.omega);
    const Fw = add(mat3Vec(Rw, force), [0, -pl.mass * GRAVITY, 0]);
    state.vel = add(state.vel, scale(Fw, h / pl.mass));
    const prevPos = state.pos;
    state.pos = add(state.pos, scale(state.vel, h));
    // Euler: I w' = M - w x (I w)
    const Iw = mat3Vec(pl.I, state.omega);
    const wdot = mat3Vec(pl.Iinv, sub(moment, cross(state.omega, Iw)));
    state.omega = add(state.omega, scale(wdot, h));
    state.q = quatNorm(quatMul(state.q, quatFromRotVec(state.omega, h)));
    state.pitchTurned += state.omega[2] * h;
    state.maxTurned = Math.max(state.maxTurned, Math.abs(state.pitchTurned));
    state.t += h;
    state.maxHeight = Math.max(state.maxHeight, state.pos[1]);
    checkWorld(prevPos);
  }

  function checkWorld(prevPos) {
    const Rw = quatToMat3(state.q);
    // hoops: the centre of mass crosses the hoop's plane inside its radius
    (scenario.hoops || []).forEach((hp, i) => {
      const loopsNow = Math.floor(state.maxTurned / (2 * Math.PI));
      const last = events.filter((e) => e.type === 'hoop' && e.index === i).pop();
      if (last && last.loopsBefore >= loopsNow) return; // already through, and not looped since
      const s0 = dot(sub(prevPos, hp.center), hp.normal);
      const s1 = dot(sub(state.pos, hp.center), hp.normal);
      if (s0 < 0 && s1 >= 0) {
        const t = s0 / (s0 - s1);
        const x = add(prevPos, scale(sub(state.pos, prevPos), t));
        if (len(sub(x, hp.center)) <= hp.radius) {
          hoopPassed.add(i);
          events.push({ type: 'hoop', index: i, t: state.t, loopsBefore: Math.floor(state.maxTurned / (2 * Math.PI)) });
        }
      }
    });
    // goals entered by the centre of mass
    (scenario.zones || []).forEach((z, i) => {
      if (inBox(state.pos, z.box) && !events.some((e) => e.type === 'zone' && e.index === i)) events.push({ type: 'zone', index: i, name: z.name, t: state.t });
    });
    // solid things and the ground, against the paper's outline
    // only solids within reach of the paper need the full check
    const near = (scenario.solids || []).map((s, i) => [s, i]).filter(([s]) => boxDistance(state.pos, s.box) <= reach);
    let lowest = Infinity;
    for (const h of pl.hull) {
      const w = add(mat3Vec(Rw, h), state.pos);
      if (w[1] < lowest) lowest = w[1];
      for (const [s, i] of near) {
        if (inBox(w, s.box)) return finish('hit', { index: i, name: s.name });
      }
    }
    if (lowest <= (scenario.groundY || 0)) return finish('landed');
    if (state.t > (scenario.timeLimit || 30)) return finish('time');
    const b = scenario.bounds;
    if (b && !inBox(state.pos, b)) return finish('out');
  }

  function finish(reason, extra = {}) {
    out.done = true;
    const start = pos0;
    const flat = Math.hypot(state.pos[0] - start[0], state.pos[2] - start[2]);
    out.result = {
      reason,
      ...extra,
      t: state.t,
      position: state.pos.slice(),
      distance: flat,
      maxHeight: state.maxHeight,
      // the most it has been round, so nosing down after a loop does not un-count it
      loops: Math.floor(state.maxTurned / (2 * Math.PI)),
      hoops: [...hoopPassed],
      hoopEvents: events.filter((e) => e.type === 'hoop'),
      zones: events.filter((e) => e.type === 'zone').map((e) => e.name),
    };
    out.result.goals = scenario.goals ? scenario.goals(out.result) : null;
    events.push({ type: 'end', reason, t: state.t });
  }

  return out;
}

function boxDistance(p, box) {
  let d2 = 0;
  for (let i = 0; i < 3; i++) {
    const d = Math.max(box.min[i] - p[i], 0, p[i] - box.max[i]);
    d2 += d * d;
  }
  return Math.sqrt(d2);
}

export function inBox(p, box) {
  return p[0] >= box.min[0] && p[0] <= box.max[0] && p[1] >= box.min[1] && p[1] <= box.max[1] && p[2] >= box.min[2] && p[2] <= box.max[2];
}

// Run a whole flight in one go (tests, predictions, replays).
// inputs: [{ t, id, on }] fan switches at those times, for tests and replays.
export function simulate(pl, throwSpec, scenario, { dt = 1 / 120, maxTime, inputs = [] } = {}) {
  const f = createFlight(pl, throwSpec, scenario);
  const limit = maxTime || scenario.timeLimit || 30;
  const track = [];
  const pending = [...inputs].sort((a, b) => a.t - b.t);
  while (!f.done && f.state.t < limit + 1) {
    while (pending.length && pending[0].t <= f.state.t + 1e-9) {
      const inp = pending.shift();
      f.setAir(inp.id, inp.on);
    }
    f.step(dt);
    track.push({ t: f.state.t, pos: f.state.pos.slice(), q: f.state.q.slice() });
  }
  return { result: f.result, track, events: f.events };
}
