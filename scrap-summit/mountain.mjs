// Scrap Summit: the mountain. One fixed climb, the same for every player, so
// times and heights compare fairly and a friend's ghost climbs the same rocks.
// Built from convex pieces (every polygon counter-clockwise). Each section is
// harder than the last; a slip can drop you a long way, on purpose.
//
// Surface kinds: rock (grips), ice (the hammer slips, grip 0.12), plank
// (grippy), bouncy tyre (bounce 0.6). Codex draws them; this file is shape
// and feel only.

const KIND = {
  rock: { grip: 0.95, bounce: 0.08 },
  ice: { grip: 0.12, bounce: 0.05 },
  plank: { grip: 0.9, bounce: 0.1 },
  tyre: { grip: 0.8, bounce: 0.6 },
  metal: { grip: 0.6, bounce: 0.15 },
};

function piece(kind, poly, name) {
  // make sure it is counter-clockwise
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  const pts = a < 0 ? [...poly].reverse() : poly;
  return { kind, poly: pts, name, ...KIND[kind] };
}
const box = (kind, x0, y0, x1, y1, name) => piece(kind, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], name);
const tri = (kind, a, b, c, name) => piece(kind, [a, b, c], name);

export const SECTIONS = [
  { name: 'The tip', from: 0 },
  { name: 'Boulder stairs', from: 6 },
  { name: 'The chimney', from: 24 },
  { name: 'The overhang', from: 40 },
  { name: 'The fridge glacier', from: 54 },
  { name: 'Crate tower', from: 70 },
  { name: 'The spire', from: 94 },
];

export function buildMountain() {
  const s = [];
  // ---- the tip: the ground and a few easy boulders to learn on
  s.push(box('rock', -40, -4, 40, 0, 'ground'));
  s.push(box('rock', -40, 0, -14, 30, 'left cliff'));
  s.push(tri('rock', [3, 0], [5.5, 0], [5.5, 0.9], 'first rock'));
  s.push(box('rock', 7, 0, 9, 1.4, 'second rock'));
  s.push(tri('tyre', [10.5, 0], [12, 0], [11.2, 0.7], 'old tyre'));

  // ---- boulder stairs: steps up and back across, gaps you can fall through
  const stairs = [
    [12.5, 2.2, 15.5],
    [9, 4.2, 11.5],
    [4.5, 6.2, 7.5],
    [0.5, 8.4, 3],
    [-3.5, 10.6, -0.8],
    [-7.5, 12.8, -5],
    [-4, 15.0, -1.2],
    [0, 17.2, 2.4],
    [3.5, 19.4, 6],
    [7, 21.6, 9.5],
  ];
  for (const [x0, y, x1] of stairs) {
    s.push(box('rock', x0, y - 0.9, x1, y, 'stair'));
    s.push(tri('rock', [x0 + 0.3, y - 0.9], [x1 - 0.3, y - 0.9], [(x0 + x1) / 2, y - 2], 'stair root'));
  }

  // ---- the chimney: two walls 2.6 apart with small nubs to push and hook on
  s.push(box('rock', 9, 22.2, 10.2, 40, 'chimney left'));
  s.push(box('rock', 12.8, 21.6, 14, 40, 'chimney right'));
  s.push(box('rock', 10.2, 21.6, 12.8, 22.2, 'chimney floor'));
  for (let i = 0; i < 9; i++) {
    const y = 23.8 + i * 1.8;
    if (i % 2) s.push(tri('rock', [12.8, y], [12.8, y + 0.5], [12.2, y + 0.5], 'nub'));
    else s.push(tri('rock', [10.2, y + 0.5], [10.2, y], [10.8, y + 0.5], 'nub'));
  }
  s.push(box('plank', 7, 40, 14, 40.5, 'chimney lid'));

  // ---- the overhang: a big block to get over by hooking its top edge
  s.push(box('metal', 3, 40, 7, 41, 'washing machine'));
  s.push(box('rock', -2, 41, 3.6, 44, 'overhang base'));
  s.push(box('rock', -3.5, 44, 5.4, 45.2, 'overhang lip'));
  s.push(box('rock', -3.5, 45.2, -1.5, 50, 'overhang pillar'));
  s.push(box('plank', -6, 50, 1, 50.5, 'overhang top'));
  s.push(box('metal', -8.5, 50.5, -5.5, 52.5, 'safe'));
  s.push(box('rock', -10, 52.5, -6.5, 54, 'ledge'));

  // ---- the fridge glacier: a long icy slope with a few rough patches to plant on
  s.push(piece('ice', [[-6.5, 54], [-6.5, 54.5], [6, 62], [6, 61.2]], 'glacier'));
  s.push(box('rock', -3, 55.6, -2.4, 56.4, 'rough patch'));
  s.push(box('rock', 1, 58.1, 1.6, 58.9, 'rough patch'));
  s.push(box('rock', 4.2, 60.4, 4.8, 61.2, 'rough patch'));
  s.push(box('metal', 6, 61, 8.5, 64.5, 'fridge'));
  s.push(piece('ice', [[8.5, 64.5], [8.5, 65], [2, 69.5], [2, 69]], 'upper glacier'));
  s.push(box('rock', 5.8, 66.5, 6.4, 67.3, 'rough patch'));
  s.push(box('rock', -1, 69, 2, 70, 'glacier top'));

  // ---- crate tower: offset crates, a tilted plank, tyres to bounce off
  const crates = [
    [-3.5, 70, 1.8],
    [-1.8, 71.8, 1.6],
    [-4.4, 73.4, 1.6],
    [-2.2, 75.6, 1.4],
    [-5, 77.4, 1.4],
    [-2.6, 79.6, 1.2],
    [0.2, 81.6, 1.4],
    [-2.5, 83.8, 1.2],
    [0.6, 85.8, 1.2],
    [-1.8, 88, 1.1],
    [1, 90.2, 1.1],
  ];
  for (const [x, y, w] of crates) s.push(box('plank', x, y, x + w, y + w * 0.9, 'crate'));
  s.push(piece('plank', [[-6, 86], [-5.6, 85.6], [-2.4, 88.4], [-2.8, 88.8]], 'tilted plank'));
  s.push(tri('tyre', [3, 84], [4.4, 84], [3.7, 84.8], 'tyre'));
  s.push(box('plank', -1, 92, 3.5, 92.6, 'tower top'));

  // ---- the spire: thin, tall, nothing to fall back onto
  const spire = [
    [1.8, 94.4, 0.9],
    [0.4, 96.4, 0.7],
    [1.9, 98.6, 0.6],
    [0.6, 100.8, 0.6],
    [1.8, 103, 0.55],
    [0.7, 105.2, 0.5],
    [1.6, 107.4, 0.5],
  ];
  s.push(box('rock', 0.8, 92.6, 1.6, 108, 'spire'));
  for (const [x, y, w] of spire) s.push(box('rock', Math.min(x, x + w), y, Math.max(x, x + w) + (x < 1.2 ? 0 : 0.2), y + 0.35, 'spire step'));
  s.push(box('metal', -1.2, 108, 3.6, 108.6, 'summit'));

  return makeWorld(s, { start: [0, 0.46], summit: 108.6 });
}

// spatial index: solids by 4 m cell, so a step only checks what is near
function makeWorld(solids, { start, summit }) {
  const CELL = 4;
  const grid = new Map();
  for (const sd of solids) {
    const xs = sd.poly.map((p) => p[0]);
    const ys = sd.poly.map((p) => p[1]);
    sd.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    for (let gx = Math.floor(sd.box[0] / CELL); gx <= Math.floor(sd.box[2] / CELL); gx++)
      for (let gy = Math.floor(sd.box[1] / CELL); gy <= Math.floor(sd.box[3] / CELL); gy++) {
        const k = gx + ',' + gy;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(sd);
      }
  }
  return {
    solids,
    start,
    summit,
    sections: SECTIONS,
    near(x, y, r) {
      const out = new Set();
      for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
        for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) for (const sd of grid.get(gx + ',' + gy) || []) out.add(sd);
      return out;
    },
    sectionAt(y) {
      let cur = SECTIONS[0];
      for (const sc of SECTIONS) if (y >= sc.from) cur = sc;
      return cur;
    },
  };
}
