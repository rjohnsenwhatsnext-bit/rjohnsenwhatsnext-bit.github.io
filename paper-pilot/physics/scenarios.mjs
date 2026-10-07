// Places to throw a paper plane. Each scenario is plain data plus a wind
// function, flown by the same physics as everything else: the plane that suits
// one place will not suit another, because the air and the obstacles differ,
// not because of any rule about plane types.
//
// World frame: x forward (the natural throw direction), y up, z right, metres.
// Boxes are axis aligned: { min: [x, y, z], max: [x, y, z] }.
//   solids   the paper stops if any part of it enters one (walls, desks, trees)
//   zones    reached when the plane's centre of mass enters (the bin, the lawn)
//   hoops    passed when the centre of mass crosses the hoop disc forwards
//   goals(result) -> { passed, score, lines[] } how the flight is judged
// Wind is deterministic (no random numbers), so the same fold and the same
// throw always fly the same way.

const box = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
const calm = () => [0, 0, 0];

function gusts(base, strength, t, pos) {
  // smooth, repeatable turbulence: a few slow sine waves in time and space
  const g = (a, b, c) => Math.sin(t * a + pos[0] * b + c);
  return [base[0] + strength * (0.6 * g(1.3, 0.21, 0.4) + 0.4 * g(2.9, 0.53, 1.9)), base[1] + strength * 0.5 * g(1.7, 0.37, 2.6), base[2] + strength * 0.7 * g(1.1, 0.29, 5.1)];
}

export const scenarios = {
  classroom: {
    name: 'Classroom',
    brief: 'Across the room and into the bin by the door. Mind the ceiling.',
    launch: { position: [0, 1.5, 0], speedRange: [3, 12] },
    wind: calm,
    solids: [
      { name: 'ceiling', box: box(-2, 3, -4, 12, 3.4, 4) },
      { name: 'back wall', box: box(9, 0, -4, 9.3, 3, 4) },
      { name: 'desk', box: box(3, 0, -1.2, 4.2, 0.75, 0.2) },
      { name: 'desk', box: box(3, 0, 1.0, 4.2, 0.75, 2.4) },
      { name: 'bin wall', box: box(7.0, 0, 0.7, 7.05, 0.45, 1.25) },
      { name: 'bin wall', box: box(7.55, 0, 0.7, 7.6, 0.45, 1.25) },
    ],
    zones: [{ name: 'bin', box: box(7.05, 0, 0.7, 7.55, 0.45, 1.25) }],
    hoops: [],
    bounds: box(-2, -1, -4, 9.5, 3.5, 4),
    timeLimit: 15,
    goals(r) {
      const inBin = r.zones.includes('bin');
      return { passed: inBin, score: inBin ? 100 : Math.max(0, Math.round(40 - 8 * Math.hypot(r.position[0] - 7.3, r.position[2] - 0.97))), lines: [inBin ? 'In the bin' : 'Missed the bin'] };
    },
  },

  window: {
    name: 'Out the window',
    brief: 'From the upstairs window, round the corner of the building next door to the letterbox. It has to turn right.',
    launch: { position: [0, 4.6, 0], speedRange: [3, 12] },
    wind: (pos, t) => (pos[0] > 4.3 ? gusts([0, 0, 0.3], 0.25, t, pos) : [0, 0, 0]),
    solids: [
      { name: 'upstairs floor', box: box(-2, 0, -4, 4.3, 3.2, 4) },
      { name: 'ceiling', box: box(-2, 6, -4, 4.3, 6.4, 4) },
      // wall with a window 4.1 to 5.1 m high, 1.4 m wide, centred on z = 0
      { name: 'wall', box: box(4, 3.2, -4, 4.3, 4.1, 4) },
      { name: 'wall', box: box(4, 5.1, -4, 4.3, 6.4, 4) },
      { name: 'wall', box: box(4, 4.1, -4, 4.3, 5.1, -0.7) },
      { name: 'wall', box: box(4, 4.1, 0.7, 4.3, 5.1, 4) },
      // the building next door, straight ahead: go right of it
      { name: 'next door', box: box(8, 0, -8, 11, 9, 1.5) },
    ],
    zones: [{ name: 'letterbox', box: box(8.5, 0, 3, 13, 1.2, 8) }],
    hoops: [],
    bounds: box(-2, -1, -8, 16, 10, 12),
    timeLimit: 20,
    goals(r) {
      const through = r.position[0] > 4.3 || r.zones.length > 0;
      const hit = r.zones.includes('letterbox');
      return { passed: hit, score: hit ? 100 : through ? 40 : 0, lines: [through ? 'Out the window' : 'Hit the wall', hit ? 'Round the corner to the letterbox' : 'Did not make the corner'] };
    },
  },

  rooftop: {
    name: 'Rooftop',
    brief: 'Off the roof into a gusty headwind, over the trees to the oval. A slow floater gets blown back; you need something that punches through.',
    launch: { position: [0, 9, 0], speedRange: [3, 14] },
    wind: (pos, t) => gusts([-2.2, 0, 0], 1.0, t, pos),
    solids: [
      { name: 'trees', box: box(10, 0, -6, 13, 6, 6) },
    ],
    zones: [{ name: 'oval', box: box(16, 0, -8, 40, 0.5, 8) }],
    hoops: [],
    bounds: box(-3, -1, -15, 60, 30, 15),
    timeLimit: 30,
    goals(r) {
      const onOval = r.zones.includes('oval') && r.reason === 'landed';
      return { passed: onOval, score: Math.round(r.position[0] * (onOval ? 3 : 1)), lines: [onOval ? 'Landed on the oval' : r.reason === 'hit' ? 'Into the trees' : 'Short of the oval', `${r.position[0].toFixed(1)} m out`] };
    },
  },

  loop: {
    name: 'Loop the loop',
    brief: 'Loop all the way round and come through the hoop. Only a plane that climbs hard can loop.',
    launch: { position: [0, 1.6, 0], speedRange: [3, 14] },
    wind: calm,
    solids: [],
    zones: [],
    // where real looping flights come back round level (measured, 28 Sep 2026)
    hoops: [{ center: [3.3, 1.2, 0], normal: [1, 0, 0], radius: 0.5 }],
    bounds: box(-4, -1, -6, 15, 8, 6),
    timeLimit: 10,
    goals(r) {
      const afterLoop = r.hoopEvents.some((e) => e.loopsBefore >= 1);
      const looped = r.loops >= 1;
      return { passed: afterLoop, score: afterLoop ? 100 : looped ? 50 : r.hoops.length ? 20 : 0, lines: [looped ? `Looped ${r.loops}x` : 'No loop', afterLoop ? 'Through the hoop after the loop' : 'Not through the hoop after a loop'] };
    },
  },

  mansion: mansion(),

  cliff: {
    name: 'Clifftop',
    brief: 'Forty metres up with the wind behind you and a thermal over the beach. How far can paper go?',
    launch: { position: [0, 40, 0], speedRange: [3, 14] },
    wind: (pos, t) => {
      const w = gusts([2.0, 0, 0], 0.8, t, pos);
      // a column of rising air over the beach
      const dx = pos[0] - 45;
      const dz = pos[2];
      const r2 = dx * dx + dz * dz;
      w[1] += 1.6 * Math.exp(-r2 / (2 * 12 * 12));
      return w;
    },
    solids: [{ name: 'cliff face', box: box(-40, 0, -50, 0.4, 39.2, 50) }],
    zones: [],
    hoops: [],
    bounds: box(-5, -1, -150, 400, 120, 150),
    groundY: 0,
    timeLimit: 120,
    goals(r) {
      return { passed: r.distance > 60, score: Math.round(r.distance), lines: [`${r.distance.toFixed(1)} m`, `${r.t.toFixed(1)} s in the air`] };
    },
  },
};

// The mansion: one long flight, room to room, riding the air. Launched from
// the top of the grand staircase. Fans can be tapped on and off mid-flight
// (flight.toggle(id)); the ceiling fan in the ballroom pushes down and is
// best switched off in time, the desk and garden fans push you on, the vents
// and the stairwell lift you. Checkpoints are the doorways; the goal is the
// chaise longue in the conservatory at the far end.
function mansion() {
  const solids = [];
  const wall = (name, x, openings, zMin = -4, zMax = 4, top = 6) => {
    // a wall across the route at x, with door openings [{ y0, y1, z0, z1 }]
    // built from blocks around each opening
    const t = 0.25;
    const o = openings[0];
    solids.push({ name, box: box(x, 0, zMin, x + t, o.y0, zMax) });
    solids.push({ name, box: box(x, o.y1, zMin, x + t, top, zMax) });
    solids.push({ name, box: box(x, o.y0, zMin, x + t, o.y1, o.z0) });
    solids.push({ name, box: box(x, o.y0, o.z1, x + t, o.y1, zMax) });
  };
  // outer shell
  solids.push({ name: 'left wall', box: box(-3, 0, -4.3, 52, 7, -4) });
  solids.push({ name: 'right wall', box: box(-3, 0, 4, 52, 7, 4.3) });
  solids.push({ name: 'ceiling', box: box(-3, 6.4, -4, 52, 7, 4) });
  solids.push({ name: 'staircase', box: box(-3, 0, -4, 1.2, 4.6, -1.2) });
  // entrance hall: a chandelier to fly round or under
  // off to the right of the throwing line: a hazard to steer round, not a wall
  solids.push({ name: 'chandelier', box: box(5.2, 4.3, 1.1, 6.2, 5.1, 2.3) });
  solids.push({ name: 'chandelier chain', box: box(5.65, 5.1, 1.65, 5.75, 6.4, 1.75) });
  wall('hall doorway', 10, [{ y0: 0, y1: 4.4, z0: -1.3, z1: 1.3 }]); // tall double doors
  // ballroom: tables, two chandeliers
  solids.push({ name: 'banquet table', box: box(13, 0, -3, 21, 0.8, -1.6) });
  solids.push({ name: 'chandelier', box: box(17.5, 4.5, 1.0, 18.5, 5.2, 2.2) });
  solids.push({ name: 'chandelier', box: box(17.5, 4.5, -2.2, 18.5, 5.2, -1.0) });
  wall('ballroom arch', 24, [{ y0: 0.4, y1: 3.2, z0: -1.2, z1: 1.2 }]);
  // library: bookshelves making a gap to thread
  solids.push({ name: 'bookshelf', box: box(28, 0, -4, 28.6, 3.4, -1.0) });
  solids.push({ name: 'bookshelf', box: box(28, 0, 1.2, 28.6, 3.4, 4) });
  solids.push({ name: 'library ceiling', box: box(24.25, 4.2, -4, 36, 6.4, 4) });
  wall('conservatory doors', 36, [{ y0: 0.2, y1: 2.9, z0: -2.2, z1: 2.2 }]); // French doors
  // conservatory: planters
  solids.push({ name: 'planter', box: box(41, 0, -1, 42.2, 1.2, 1) });
  return {
    name: 'The mansion',
    brief: 'From the top of the stairs, through every room to the chaise in the conservatory. Tap fans to switch them. Ride the air.',
    // Ryan, 7 Oct 2026: "you literally struggle to get throught the first door ... lower the start point".
    // 4.8 m was above the hall doorway's 4.4 m top; 3.8 m throws through it. Was 5.2, then 4.8.
    launch: { position: [0.3, 3.8, 0], speedRange: [3, 12] },
    wind: calm,
    // Lift comes after each doorway, to win back the height a doorway costs.
    airSources: [
      // Ryan, 7 Oct 2026: "make the fans closer and layin down on the ground facing
      // up so they actually do something". Floor fans sit on the flight line,
      // one before each doorway, blowing straight up; the old desk and garden
      // fans blew along the floor beside the route and barely touched a plane.
      { type: 'fan', id: 'hall floor fan', position: [3.6, 0.05, 0], direction: [0, 1, 0], radius: 0.9, reach: 6, speed: 5.5 },
      { type: 'fan', id: 'doorway floor fan', position: [7.6, 0.05, 0], direction: [0, 1, 0], radius: 0.9, reach: 6, speed: 5.5 },
      { type: 'vent', id: 'ballroom vents', box: box(11.5, 0, -1.8, 15.5, 4.5, 1.8), speed: 2.3 },
      { type: 'fan', id: 'ceiling fan', position: [17.5, 6.3, 0], direction: [0, -1, 0], radius: 0.8, reach: 5.5, speed: 3.2, spin: 0.3 },
      { type: 'fan', id: 'ballroom floor fan', position: [20.5, 0.05, 0], direction: [0, 1, 0], radius: 0.9, reach: 6, speed: 5.5 },
      { type: 'vent', id: 'library vent', box: box(29.5, 0, -1.3, 34, 3.9, 1.3), speed: 2.4 },
      { type: 'breeze', id: 'library window', box: box(24.3, 0, -4, 36, 4.2, 4), velocity: [0, 0, 0.4], wobble: 0.4 },
      { type: 'fan', id: 'library floor fan', position: [26.5, 0.05, 0], direction: [0, 1, 0], radius: 0.8, reach: 4.1, speed: 5 },
      { type: 'fan', id: 'garden floor fan', position: [39.5, 0.05, 0], direction: [0, 1, 0], radius: 0.9, reach: 6, speed: 5.5 },
      { type: 'gust', id: 'garden door', direction: [0, 0, 1], speed: 1.0, width: 1.5, period: 4, box: box(36.3, 0, -4, 52, 6.4, 4) },
    ],
    solids,
    zones: [
      { name: 'hall doorway', box: box(10, 0, -1.3, 10.25, 4.4, 1.3) },
      { name: 'ballroom arch', box: box(24, 0.4, -1.2, 24.25, 3.2, 1.2) },
      { name: 'conservatory doors', box: box(36, 0.2, -2.2, 36.25, 2.9, 2.2) },
      { name: 'chaise', box: box(46, 0, -1.2, 49.5, 0.7, 1.2) },
    ],
    hoops: [],
    bounds: box(-3, -1, -4.3, 52, 7, 4.3),
    timeLimit: 90,
    goals(r) {
      const order = ['hall doorway', 'ballroom arch', 'conservatory doors', 'chaise'];
      const reached = order.filter((n) => r.zones.includes(n));
      const landed = r.zones.includes('chaise');
      return {
        passed: landed,
        score: reached.length * 25 + (landed ? 0 : Math.round(Math.max(0, r.position[0]) / 2)),
        lines: [landed ? 'Landed on the chaise' : `Made it ${reached.length ? 'past the ' + reached[reached.length - 1] : 'nowhere'}`, `${r.position[0].toFixed(1)} m through the house, ${r.t.toFixed(1)} s`],
      };
    },
  };
}

// Free flight in still air, for trying a fold.
export const openField = {
  name: 'Open field',
  brief: 'Still air, flat grass. Just see how it flies.',
  launch: { position: [0, 1.6, 0], speedRange: [3, 14] },
  wind: calm,
  solids: [],
  zones: [],
  hoops: [],
  bounds: box(-10, -1, -60, 200, 60, 60),
  timeLimit: 30,
  goals: (r) => ({ passed: true, score: Math.round(r.distance), lines: [`${r.distance.toFixed(1)} m`] }),
};
