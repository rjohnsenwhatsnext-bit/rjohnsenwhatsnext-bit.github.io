// Clear Path: levels (Claude). Chapter 1, "First Steps", is LEVELS[0..9].
// Levels 1 to 4 are drawn by hand. Levels 5 to 10 are drawn as a shape and the
// arrows are laid backwards: each arrow is placed with a clear path at that
// moment, and the last one placed is the first one cleared, so every board is
// solvable by construction (the tests also check it with the bot).

import { play } from './bot.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP = { '^': [0, -1], '>': [1, 0], v: [0, 1], '<': [-1, 0] };

// shape: rows where '#' is a cell to fill. dirs: allowed arrow glyphs.
export function layBackwards(shape, seed, dirs = '^>v<') {
  const h = shape.length, w = shape[0].length;
  // 'X' in a shape is a wall: it stays put, so every path must also avoid it.
  const grid = shape.map((r) => r.split('').map((c) => (c === 'X' ? 'X' : '.')));
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (shape[y][x] === '#') cells.push([x, y]);
  const rand = rng(seed);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
  }
  for (const [x, y] of cells) {
    const ok = [];
    for (const g of dirs) {
      const [dx, dy] = STEP[g];
      let cx = x + dx, cy = y + dy, clear = true;
      while (cx >= 0 && cy >= 0 && cx < w && cy < h) {
        if (grid[cy][cx] !== '.') { clear = false; break; }
        cx += dx; cy += dy;
      }
      if (clear) ok.push(g);
    }
    if (ok.length) grid[y][x] = ok[Math.floor(rand() * ok.length)];
  }
  return grid.map((r) => r.join(''));
}

function drawn(id, name, objective, rows, slips) {
  return { id, chapter: 1, name, objective, w: rows[0].length, h: rows.length, rows, slips };
}

function shaped(id, name, objective, shape, seed, slips, dirs, chapter = 1) {
  const rows = layBackwards(shape, seed, dirs);
  return { id, chapter, name, objective, w: rows[0].length, h: rows.length, rows, slips };
}

// Chapter 2, "Walls": '#' is an arrow cell, 'X' is a wall that never moves.
function walled(id, name, objective, shape, seed, slips, dirs) {
  return shaped(id, name, objective, shape, seed, slips, dirs, 2);
}

// Chapter 3, "Sturdy": the board is laid backwards as before, then `count`
// arrows are made sturdy (two taps). Sturdy arrows block like plain ones, so
// every board stays solvable.
const STURDY = { '^': 'U', '>': 'R', v: 'D', '<': 'L' };
function sturdy(id, name, objective, shape, seed, slips, dirs, count) {
  const lvl = shaped(id, name, objective, shape, seed, slips, dirs, 3);
  const rand = rng(seed + 99);
  const spots = [];
  lvl.rows.forEach((r, y) => r.split('').forEach((c, x) => { if (STURDY[c]) spots.push([x, y]); }));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = spots[i]; spots[i] = spots[j]; spots[j] = t;
  }
  const grid = lvl.rows.map((r) => r.split(''));
  for (const [x, y] of spots.slice(0, Math.min(count, spots.length))) grid[y][x] = STURDY[grid[y][x]];
  lvl.rows = grid.map((r) => r.join(''));
  return lvl;
}

// Chapter 4, "Gates": 'G' in a shape is a gate. It stays shut until gateAt arrows
// are left, then opens (see sim.mjs). Arrows are laid as if gates were open, then
// the first seed where the bot wins AND the gates matter (shut for good, the bot
// is stuck) is kept. If no seed qualifies, the board is laid with the gates as
// walls, which is always solvable. `count` arrows are made sturdy.
function gated(id, name, objective, shape, seed, slips, dirs, gateAt, count) {
  const open = shape.map((r) => r.replace(/G/g, '.'));
  const build = (s, wallsOnly) => {
    const lay = wallsOnly ? shape.map((r) => r.replace(/G/g, 'X')) : open;
    const lvl = sturdy(id, name, objective, lay, s, slips, dirs, count);
    lvl.chapter = 4;
    lvl.gateAt = gateAt;
    lvl.rows = lvl.rows.map((r, y) => r.split('').map((c, x) => (shape[y][x] === 'G' ? 'G' : c)).join(''));
    return lvl;
  };
  for (let k = 0; k < 400; k++) {
    const lvl = build(seed + k * 101, false);
    if (play(lvl, 1).won && !play(Object.assign({}, lvl, { gateAt: -1 }), 1).won) return lvl;
  }
  return build(seed, true);
}

export const LEVELS = [
  drawn(1, 'First Slide', 'Tap each arrow to send it off the board.',
    ['>..', '...', '.^.'], 5),
  drawn(2, 'Queue Up', 'An arrow cannot leave while another is in its way. Clear the front one first.',
    ['..>>', '....', '^...'], 5),
  drawn(3, 'Domino', 'Clear the chain in the right order. The highlight shows what blocks you.',
    ['v...', '>.v.', '....', '....'], 4),
  drawn(4, 'Crossroads', 'Two lanes cross. Work out which arrow is free before you tap.',
    ['.v..', '>.^.', '..^.', '....'], 3),
  shaped(5, 'Diamond', 'A tight diamond. Clear it with at most 3 slips.',
    ['..#..', '.###.', '#####', '.###.', '..#..'], 105, 3),
  shaped(6, 'The Ring', 'Arrows in a ring only point across the hole. At most 3 slips.',
    ['#####', '#...#', '#...#', '#...#', '#####'], 206, 3),
  shaped(7, 'Stripes', 'Long rows slide sideways only. At most 2 slips.',
    ['######', '######', '......', '######', '######'], 307, 2, '<>'),
  shaped(8, 'Cross Over', 'Up, down, left and right all at once. At most 2 slips.',
    ['..##..', '..##..', '######', '######', '..##..', '..##..'], 408, 2),
  shaped(9, 'Full Board', 'A packed board. At most 1 slip.',
    ['#######', '#######', '#######', '#######', '#######', '#######'], 509, 1),
  shaped(10, 'Clear Path', 'The finale. A big board and no slips allowed.',
    ['#######', '#######', '#######', '#######', '#######', '#######', '#######'], 610, 0),
  // Chapter 2, "Walls": LEVELS[10..19]. Walls never move and block like arrows.
  walled(11, 'First Wall', 'A grey wall never moves. Arrows cannot slide through it, so aim for the open side.',
    ['###', '#X#', '###', '###'], 1101, 4),
  walled(12, 'Gatepost', 'Walls guard the middle of each row. The highlight shows a wall too. At most 4 slips.',
    ['####', 'X##X', '####', '####'], 1202, 4),
  walled(13, 'Corridor', 'Two wall lines make a corridor. Arrows inside leave along it. At most 3 slips.',
    ['#####', 'XXXX#', '#####', '#XXXX', '#####'], 1303, 3),
  walled(14, 'Checkerboard', 'Walls and arrows take turns. Find the open lanes. At most 3 slips.',
    ['#X#X#', 'X#X#X', '#X#X#', 'X#X#X', '#X#X#'], 1404, 3, '^>v<'),
  walled(15, 'The Pillar', 'A pillar sits in the heart of a ring. At most 3 slips.',
    ['#####', '#####', '##X##', '#####', '#####'], 1505, 3),
  walled(16, 'Sidestep', 'Walls close the ends. Stripes slide up and down only. At most 2 slips.',
    ['X####X', '######', 'X####X', '######', 'X####X'], 1606, 2, '^v'),
  walled(17, 'Maze Edge', 'A wall maze with arrows tucked into the turns. At most 2 slips.',
    ['######', 'X####X', '#XXXX#', '######', '#X##X#', '######'], 1707, 2),
  walled(18, 'Fortress', 'Four towers hold the corners. At most 2 slips.',
    ['XX###XX', 'X#####X', '#######', '#######', 'X#####X', 'XX###XX'], 1808, 2),
  walled(19, 'Pinwheel', 'Walls spin around the middle. Plan the order. At most 1 slip.',
    ['#######', '#X#####', '#######', '###X###', '#######', '#####X#', '#######'], 1909, 1),
  walled(20, 'Open Road', 'The finale. A walled yard, a long road and no slips allowed.',
    ['#######', '#XX#XX#', '#######', '#######', '#XX#XX#', '#######', '#######'], 2010, 0),
  // Chapter 3, "Sturdy": LEVELS[20..29]. Sturdy arrows (thick, marked with a pip) need two taps.
  sturdy(21, 'Two Taps', 'A sturdy arrow takes two taps: one to crack it, one to send it off. Cracking is not a slip.',
    ['###', '###', '###'], 2101, 4, '^>v<', 2),
  sturdy(22, 'Crack and Clear', 'Crack a sturdy arrow only when its way is open. A blocked tap is still a slip. At most 4 slips.',
    ['####', '####', '####', '####'], 2202, 4, '^>v<', 4),
  sturdy(23, 'Heavy Rows', 'Long rows of sturdy arrows slide sideways. Undo brings a crack back too. At most 3 slips.',
    ['#####', '#####', '.....', '#####', '#####'], 2303, 3, '<>', 6),
  sturdy(24, 'Tall Stacks', 'Columns of sturdy arrows only move up and down. At most 3 slips.',
    ['#####', '#####', '#####', '#####', '#####', '#####'], 2404, 3, '^v', 8),
  sturdy(25, 'Hard Centre', 'A sturdy heart inside a soft ring. At most 3 slips.',
    ['#####', '#####', '#####', '#####', '#####'], 2505, 3, '^>v<', 9),
  sturdy(26, 'Wall and Shell', 'Walls and sturdy arrows together. Clear the soft ones around the walls first. At most 3 slips.',
    ['#####', '#XXX#', '#####', '#XXX#', '#####'], 2606, 3, '^>v<', 7),
  sturdy(27, 'Split Yard', 'Two yards split by a wall line. Every sturdy arrow costs a second tap. At most 2 slips.',
    ['######', '######', 'XXXXXX', '######', '######'], 2707, 2, '^>v<', 10),
  sturdy(28, 'Hollow Plus', 'A plus shape with pillars in the arms. At most 2 slips.',
    ['..##..', '..#X..', '######', '##X###', '..##..', '..##..'], 2808, 2, '^>v<', 9),
  sturdy(29, 'Iron Grid', 'A packed grid of sturdy arrows. Plan twice, tap twice. At most 1 slip.',
    ['######', '#X##X#', '######', '######', '#X##X#', '######'], 2909, 1, '^>v<', 14),
  sturdy(30, 'Last Lock', 'The finale. A big sturdy board and no slips allowed.',
    ['#######', '#######', '###X###', '#######', '#######', '#######', '#######'], 3010, 0, '^>v<', 18),
  // Chapter 4, "Gates": LEVELS[30..39]. A gate is shut until enough arrows are gone.
  gated(31, 'First Gate', 'A gate stays shut until only 4 arrows are left. Clear the others first. At most 4 slips.',
    ['###', '#G#', '###', '###'], 3101, 4, '^>v<', 4, 0),
  gated(32, 'Twin Gates', 'Two gates, one rule: they open together when 6 arrows are left. At most 4 slips.',
    ['#####', '#G.G#', '#####', '#####'], 3202, 4, '^>v<', 6, 0),
  gated(33, 'Late Opener', 'Gates in the middle row hold the long columns back. Clear the edges first. At most 3 slips.',
    ['######', '######', '..GG..', '######', '######'], 3303, 3, '^v', 12, 0),
  gated(34, 'Gate and Wall', 'Walls stay shut for good. Gates open at 8 arrows. Tell them apart. At most 3 slips.',
    ['#####', '#GXG#', '#####', '#XGX#', '#####'], 3404, 3, '^>v<', 8, 0),
  gated(35, 'Sturdy Gate', 'Sturdy arrows count once they slide, not when they crack. Gates open at 8. At most 3 slips.',
    ['####', '####', 'G##G', '####', '####'], 3505, 3, '^>v<', 8, 6),
  gated(36, 'Long Lock', 'A row of empty road with a gate at each end. Gates open at 10. At most 2 slips.',
    ['#######', '#######', 'G.....G', '#######', '#######'], 3606, 2, '^>v<', 10, 5),
  gated(37, 'Gate Ring', 'A ring of gates around a small yard. They open at 6. At most 2 slips.',
    ['#####', '#GGG#', '#G#G#', '#GGG#', '#####'], 3707, 2, '^>v<', 6, 4),
  gated(38, 'Four Corners', 'Gates in each quarter and walls in the middle. They open at 12. At most 2 slips.',
    ['######', '#G##G#', '##XX##', '##XX##', '#G##G#', '######'], 3808, 2, '^>v<', 12, 8),
  gated(39, 'Patient Yard', 'A big yard and five gates. Be patient: they open at 14. At most 1 slip.',
    ['#######', '#G###G#', '#######', '###G###', '#######', '#G###G#', '#######'], 3909, 1, '^>v<', 14, 10),
  gated(40, 'Open Gates', 'The finale. Gates and walls on a big board, and no slips allowed. Gates open at 18.',
    ['#######', '#G#X#G#', '#######', '#X#G#X#', '#######', '#G#X#G#', '#######'], 4010, 0, '^>v<', 18, 16),
];

// A fresh solvable 6x6 board for a given day number (for example days since 2026-01-01).
export function dailyLevel(day) {
  const shape = new Array(6).fill('######');
  const rows = layBackwards(shape, day * 7919 + 13);
  return { id: 'daily-' + day, chapter: 0, name: 'Daily Board', objective: 'Today\'s board. At most 2 slips.', w: 6, h: 6, rows, slips: 2 };
}
