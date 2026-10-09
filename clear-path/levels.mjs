// Clear Path: levels (Claude). Chapter 1, "First Steps", is LEVELS[0..9].
// Levels 1 to 4 are drawn by hand. Levels 5 to 10 are drawn as a shape and the
// arrows are laid backwards: each arrow is placed with a clear path at that
// moment, and the last one placed is the first one cleared, so every board is
// solvable by construction (the tests also check it with the bot).

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
  const grid = shape.map(() => new Array(w).fill('.'));
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

function shaped(id, name, objective, shape, seed, slips, dirs) {
  const rows = layBackwards(shape, seed, dirs);
  return { id, chapter: 1, name, objective, w: rows[0].length, h: rows.length, rows, slips };
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
];

// A fresh solvable 6x6 board for a given day number (for example days since 2026-01-01).
export function dailyLevel(day) {
  const shape = new Array(6).fill('######');
  const rows = layBackwards(shape, day * 7919 + 13);
  return { id: 'daily-' + day, chapter: 0, name: 'Daily Board', objective: 'Today\'s board. At most 2 slips.', w: 6, h: 6, rows, slips: 2 };
}
