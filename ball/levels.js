// Ball levels. One character per tile, rows top to bottom.
//   #  brick        ^  spike (floor)   v  spike (ceiling)
//   O  ring (pass through it; all rings open the exit)
//   E  exit        S  start           C  checkpoint
//   ~  water (a big ball floats, a small one sinks)
//   P  pump: blows you up big (jumps higher, floats, too big for 1 tile gaps)
//   D  pin: lets the air out (small, fits 1 tile gaps, sinks in water)
//   F  fire: sets you alight (3 s to find water) unless you are still wet
//   J  flame jet (fires up two tiles, on and off on a beat)
//   /  ramp rising to the right     \  ramp rising to the left
//   T  spring (a big launch)       X  crumbling block (gives way, comes back)
//   =  platform moving side to side  |  lift moving up and down
//   .  air
// Sized against the ball: a small ball jumps about 2.5 tiles high and 4 across,
// a big one about 3.5 high. Every row the same width; edges are brick.

const air = (w) => '#' + '.'.repeat(w - 2) + '#';
const solid = (w) => '#'.repeat(w);


// Bigger levels are built from pieces rather than typed: fill a box with a
// tile, set one tile. Walls all round. Sized against the measured ball: small
// jumps 2.55 tiles, big 3.53; a wall jump in a two tile chimney climbs about 2.
function build(w, h, steps) {
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.')));
  const fill = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
  };
  steps({ fill, set: (x, y, c) => (g[y][x] = c) });
  return g.map((r) => r.join(''));
}

const CAVES = [
  {
    name: 'Into the caves',
    hint: 'Fire sets you alight: find water in 3 seconds. Or roll through water first. Wet rubber slips.',
    start: 'small',
    theme: 'cave',
    map: build(38, 10, ({ fill, set }) => {
      fill(1, 1, 36, 2, '#'); // rock roof
      fill(1, 8, 36, 8, '#'); // floor
      fill(8, 8, 10, 8, '~'); // the dunking pool
      fill(16, 3, 22, 4, '#'); // rock over the fire...
      fill(16, 5, 22, 5, 'v'); // ...with teeth, so you cannot just jump it
      fill(17, 7, 21, 7, 'F'); // the fire
      set(2, 7, 'S');
      set(12, 6, 'O');
      set(26, 5, 'O');
      set(31, 7, 'O');
      set(24, 7, 'C');
      set(35, 7, 'E');
    }),
  },
  {
    name: 'The shaft',
    hint: 'Up. Time your bounces to go higher, and kick off the walls.',
    start: 'small',
    theme: 'cave',
    map: build(9, 25, ({ fill, set }) => {
      // ledges every two rows, right then left, all the way up
      for (let y = 22, right = true; y >= 2; y -= 2, right = !right) {
        if (right) fill(5, y, 7, y, '#');
        else fill(1, y, 3, y, '#');
      }
      set(1, 23, 'S');
      set(6, 17, 'O');
      set(1, 15, 'F'); // fire on the end of a ledge: land short of it
      set(2, 11, 'C');
      set(6, 9, 'O');
      set(7, 5, 'J'); // a flame jet on a ledge: time it
      set(2, 3, 'O');
      set(6, 1, 'E');
    }),
  },
  {
    name: 'Fire and water',
    hint: 'Time the jets. Climb the chimney wall to wall. Get wet before the fire.',
    start: 'small',
    theme: 'cave',
    map: build(30, 16, ({ fill, set }) => {
      fill(1, 14, 28, 14, '#'); // lower floor
      fill(1, 3, 24, 3, '#'); // upper floor, which is the lower cave's roof
      // the chimney: two tiles wide between its wall and the cave wall
      fill(25, 3, 25, 12, '#');
      // lower cave: flame jets, then a pool
      set(2, 13, 'S');
      set(8, 13, 'J');
      set(12, 13, 'J');
      set(16, 13, 'J');
      set(9, 11, 'O'); // at the top of the jump over the first jet
      fill(20, 14, 22, 14, '~');
      set(23, 13, 'C');
      set(26, 8, 'O');
      // upper cave, heading back left: a pool to dunk in, then fire
      fill(18, 3, 20, 3, '~');
      fill(18, 4, 20, 4, '#'); // rock under the pool, or you fall through it
      fill(10, 2, 14, 2, 'F');
      set(22, 2, 'O');
      set(3, 2, 'E');
    }),
  },
];

export const LEVELS = [
  {
    name: 'Hills',
    hint: 'Drag left to roll. Tap right to bounce. Collect all four rings.',
    start: 'small',
    map: build(50, 12, ({ fill, set }) => {
      fill(1, 10, 48, 10, '#'); // ground
      // a small hill
      set(8, 9, '/');
      fill(9, 9, 10, 9, '#');
      set(11, 9, '\\');
      set(9, 8, 'O');
      // a two step hill
      set(15, 9, '/');
      set(16, 9, '#');
      set(16, 8, '/');
      fill(17, 8, 18, 9, '#');
      set(19, 8, '\\');
      set(19, 9, '#');
      set(20, 9, '\\');
      set(18, 7, 'O');
      // a spike pit: build speed down the hill and bounce across
      fill(25, 10, 26, 10, '^'); // forgiving first gap, inside normal bounce range
      set(26, 7, 'O');
      set(23, 9, 'C');
      // a spring up to a high shelf with a ring on it
      fill(33, 10, 34, 10, 'T'); // broad visible pad at floor height
      fill(36, 6, 43, 6, '#'); // broad landing shelf for the first spring
      set(41, 5, 'O');
      set(41, 9, 'C');
      set(47, 9, 'E');
      set(2, 9, 'S');
    }),
  },
  {
    name: 'Crumble bridge',
    hint: 'The bridge will not hold for long. Keep rolling.',
    start: 'small',
    map: build(46, 12, ({ fill, set }) => {
      fill(1, 10, 8, 10, '#');
      fill(9, 10, 36, 10, '^'); // the drop
      fill(9, 8, 14, 8, 'X'); // the crumbling bridge
      set(12, 7, 'O');
      fill(15, 8, 16, 8, '#'); // two solid blocks to stop on and wait for the platform
      set(18, 8, '='); // a moving platform across the middle
      fill(24, 8, 25, 8, '#'); // and two to land on
      fill(26, 8, 31, 8, 'X');
      set(28, 7, 'O');
      fill(37, 10, 44, 10, '#');
      set(33, 5, 'O');
      set(38, 9, 'C');
      set(43, 9, 'E');
      set(2, 9, 'S');
    }),
  },
  {
    name: 'Half pipe',
    hint: 'Roll back and forth to build speed. Bounce at the top to reach the high rings.',
    start: 'small',
    map: build(26, 16, ({ fill, set }) => {
      fill(1, 14, 24, 14, '#');
      // the pipe walls: slopes stacked on solid rock, one row up per tile
      for (let i = 0; i < 6; i++) {
        set(6 - i, 13 - i, '\\');
        fill(1, 13 - i, 5 - i, 13 - i, '#');
        set(19 + i, 13 - i, '/');
        fill(20 + i, 13 - i, 24, 13 - i, '#');
      }
      set(12, 13, 'S');
      set(6, 10, 'O'); // run up the left slope and bounce off it
      set(19, 10, 'O'); // run up the right slope and bounce off it
      set(12, 10, 'O'); // straight up from the middle: needs a timed higher bounce
      set(16, 13, 'E');
    }),
  },
  {
    name: 'Squeeze and float',
    hint: 'Pin to squeeze through, pump to float. Order matters.',
    start: 'big',
    map: build(50, 12, ({ fill, set }) => {
      fill(1, 10, 48, 10, '#');
      set(4, 9, 'D'); // shrink first
      fill(8, 8, 15, 8, '#'); // a low tunnel roof: only a small ball fits
      set(11, 9, 'O');
      set(18, 9, 'P'); // then pump up
      fill(21, 10, 33, 10, '~'); // a pond: small sinks, big floats
      fill(21, 11, 33, 11, '^');
      set(27, 8, 'O');
      set(36, 9, '/');
      fill(37, 8, 40, 9, '#');
      set(41, 9, '\\');
      set(38, 7, 'O');
      set(43, 9, 'C');
      set(47, 9, 'E');
      set(2, 9, 'S');
    }),
  },
  {
    name: 'Moving parts',
    hint: 'Ride the lifts, time the platforms, trust the springs.',
    start: 'small',
    map: build(44, 16, ({ fill, set }) => {
      fill(1, 14, 7, 14, '#');
      fill(8, 14, 42, 14, '^'); // spikes all the way along
      set(8, 12, '|'); // a lift...
      fill(8, 4, 9, 4, '#'); // ...that turns round here
      fill(11, 7, 14, 7, '#'); // a high shelf
      set(13, 6, 'O');
      set(16, 8, '='); // a platform shuttling across
      fill(24, 8, 26, 13, '#'); // a pillar
      set(25, 7, 'T'); // with a spring on top
      set(25, 3, 'O');
      set(28, 10, '='); // another platform, between the pillar and the wall
      fill(35, 9, 35, 10, '#');
      fill(35, 11, 42, 11, '#'); // the landing shelf
      set(32, 8, 'O');
      set(37, 10, 'C');
      set(41, 10, 'E');
      set(2, 13, 'S');
    }),
  },
  ...CAVES,
];

// Checks every level is well formed; used by the tests and at load.
export function checkLevel(level) {
  const w = level.map[0].length;
  const problems = [];
  level.map.forEach((row, i) => {
    if (row.length !== w) problems.push(`${level.name}: row ${i} is ${row.length} wide, not ${w}`);
    if (/[^#^vOESC~PDFJX/\\T=|.]/.test(row)) problems.push(`${level.name}: row ${i} has an unknown tile`);
  });
  const all = level.map.join('');
  if ((all.match(/S/g) || []).length !== 1) problems.push(`${level.name}: needs exactly one start`);
  if ((all.match(/E/g) || []).length !== 1) problems.push(`${level.name}: needs exactly one exit`);
  if (!/O/.test(all)) problems.push(`${level.name}: needs at least one ring`);
  if (level.map[0] !== '#'.repeat(w) || level.map[level.map.length - 1].replace(/\^/g, '#') !== '#'.repeat(w)) problems.push(`${level.name}: top and bottom rows must be solid`);
  return problems;
}
