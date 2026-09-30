// Moving air as level pieces: fans, vents, gust fronts, open windows. A level
// lists its sources; `airField` turns them into the wind(pos, t) the flight
// uses. The plane is never "boosted": the air moves and the same physics that
// flies it everywhere else does the rest, so a floaty glider rides a fan's
// stream a long way and a heavy dart only gets nudged.
//
// Sources can be switched on and off during a flight (a player tapping a fan).
// Switches are recorded with their time, so a replay of the same fold, throw
// and taps flies exactly the same way. Nothing here uses random numbers.
//
// Every source has an `id` (for switching) and `on` (initial state, default true).
//
//   { type: 'fan', id, position, direction, radius, reach, speed, spin? }
//     A cone of air leaving the fan face along `direction`. Full `speed` in
//     the middle of the jet near the fan, spreading and slowing with
//     distance, gone beyond `reach`. Ceiling fans point down.
//   { type: 'vent', id, box, speed }
//     Rising air inside a box (heating vents, a stairwell, a chimney),
//     strongest in the middle, fading to the edges and top.
//   { type: 'gust', id, direction, speed, width, period, phase?, box? }
//     A band of wind `width` metres wide sweeping along `direction` every
//     `period` seconds (a door slamming, a draught). Limited to `box` if given.
//   { type: 'breeze', id, box, velocity, wobble? }
//     Steady air through a box (an open window, a corridor draught).

import { add, sub, scale, dot, norm, len } from './vec.mjs';

function inBoxSoft(p, box, edge) {
  // 1 well inside, fading to 0 across `edge` metres at the box faces
  let k = 1;
  for (let i = 0; i < 3; i++) {
    const d = Math.min(p[i] - box.min[i], box.max[i] - p[i]);
    if (d <= 0) return 0;
    k *= Math.min(1, d / edge);
  }
  return k;
}

function fanAir(s, p) {
  const dir = norm(s.direction);
  const rel = sub(p, s.position);
  const along = dot(rel, dir);
  if (along < 0 || along > s.reach) return null;
  const across = len(sub(rel, scale(dir, along)));
  // the jet widens as it goes (about 12 degrees half angle) and slows
  const width = s.radius + along * 0.21;
  if (across > width * 1.4) return null;
  const core = Math.exp(-(across * across) / (2 * (width * 0.6) ** 2));
  const decay = (s.radius / width) * (1 - along / s.reach);
  const v = scale(dir, s.speed * core * decay);
  if (s.spin) {
    // a little swirl around the axis, like the air off a real fan
    const radial = sub(rel, scale(dir, along));
    const r = len(radial) || 1;
    const tangent = norm([dir[1] * radial[2] - dir[2] * radial[1], dir[2] * radial[0] - dir[0] * radial[2], dir[0] * radial[1] - dir[1] * radial[0]]);
    return add(v, scale(tangent, s.spin * s.speed * core * decay * Math.min(1, r / s.radius)));
  }
  return v;
}

function ventAir(s, p) {
  const k = inBoxSoft(p, s.box, 0.35);
  if (!k) return null;
  const h = (p[1] - s.box.min[1]) / (s.box.max[1] - s.box.min[1]);
  return [0, s.speed * k * (1 - 0.5 * h), 0];
}

function gustAir(s, p, t) {
  if (s.box && !inBoxSoft(p, s.box, 0.3)) return null;
  const dir = norm(s.direction);
  // the front travels at the gust speed and repeats every period
  const travel = s.speed * s.period;
  const x = dot(p, dir) - ((t + (s.phase || 0)) % s.period) * s.speed;
  const m = ((x % travel) + travel) % travel;
  const d = Math.min(m, travel - m);
  if (d > s.width) return null;
  const k = 0.5 * (1 + Math.cos((Math.PI * d) / s.width));
  const soft = s.box ? inBoxSoft(p, s.box, 0.3) : 1;
  return scale(dir, s.speed * k * soft);
}

function breezeAir(s, p, t) {
  const k = inBoxSoft(p, s.box, 0.4);
  if (!k) return null;
  const w = s.wobble || 0;
  const wob = 1 + w * (0.6 * Math.sin(t * 1.7 + p[0] * 0.4) + 0.4 * Math.sin(t * 3.1 + p[2] * 0.7));
  return scale(s.velocity, k * wob);
}

const KINDS = { fan: fanAir, vent: ventAir, gust: gustAir, breeze: breezeAir };

// airField(sources, ambient?) -> { wind(pos, t), set(id, on, t), switches, isOn(id, t) }
// ambient(pos, t) is any background wind (default still air).
export function airField(sources, ambient = () => [0, 0, 0]) {
  for (const s of sources) {
    if (!KINDS[s.type]) throw new Error(`Unknown air source type ${s.type}`);
    if (!s.id) throw new Error('Every air source needs an id');
  }
  const switches = []; // { t, id, on } in time order
  function isOn(id, t) {
    const s = sources.find((x) => x.id === id);
    let on = s.on !== false;
    for (const sw of switches) if (sw.id === id && sw.t <= t) on = sw.on;
    return on;
  }
  return {
    sources,
    switches,
    isOn,
    set(id, on, t) {
      if (!sources.some((s) => s.id === id)) throw new Error(`No air source ${id}`);
      if (switches.length && t < switches[switches.length - 1].t) throw new Error('Switches must be recorded in time order');
      switches.push({ t, id, on: Boolean(on) });
    },
    wind(p, t) {
      let w = ambient(p, t);
      for (const s of sources) {
        if (!isOn(s.id, t)) continue;
        const v = KINDS[s.type](s, p, t);
        if (v) w = add(w, v);
      }
      return w;
    },
  };
}
