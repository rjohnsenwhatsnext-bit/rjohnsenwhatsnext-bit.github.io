// Worked examples of folding, step by step, the way you would by hand. These
// are not presets the game picks from: they are sequences of ordinary fold()
// calls, used by the tests and as a tutorial. Players fold anything.

import { A4, createSheet, fold, openCrease } from './paper.mjs';

const W = A4.width;
const L = A4.length;
const C = W / 2;

// The classic dart: two corner folds to the centre, the new edges to the
// centre again, fold in half, fold each wing down, open the wings flat.
// keel: how deep the body under the wings is (metres).
// dihedral: how far the two halves open (degrees, 0 = wings flat).
export function classicDart({ keel = 0.028, dihedral = 8, wingOpen = 90 } = {}) {
  let s = createSheet();
  s = fold(s, { a: [C, L], b: [0, L - C], move: [0.001, L - 0.001] }); // 0 top left corner to the centre line
  s = fold(s, { a: [C, L], b: [W, L - C], move: [W - 0.001, L - 0.001] }); // 1 top right corner to the centre line
  const t = Math.tan((22.5 * Math.PI) / 180);
  const y2 = L - C / t;
  s = fold(s, { a: [C, L], b: [0, y2], move: [0.001, y2 + 0.02] }); // 2 the new left edge to the centre again
  s = fold(s, { a: [C, L], b: [W, y2], move: [W - 0.001, y2 + 0.02] }); // 3 the new right edge to the centre again
  s = fold(s, { a: [C, 0], b: [C, L], move: [0.01, 0.05] }); // 4 in half: left half over onto the right
  // 5, 6: each wing down, on a line from the nose to the keel depth at the tail
  const wa = [C, L];
  const wb = [C + keel, 0];
  const wing = [C + keel + 0.03, 0.03];
  s = fold(s, { a: wa, b: wb, move: wing, kind: 'valley', layers: { flap: 4 } }); // the top half's wing
  s = fold(s, { a: wa, b: wb, move: wing, kind: 'mountain', layers: { notFlap: 4 } }); // the other wing, behind
  // open: wings out to flat, halves apart for the dihedral
  s = openCrease(s, 5, wingOpen);
  s = openCrease(s, 6, wingOpen);
  s = openCrease(s, 4, dihedral);
  return s;
}

// Tail flaps (elevators): a crease across the back of both wings, bent up by
// `degrees`. depth: how far in from the tail the crease sits (metres).
// side: 'both', 'left' or 'right' wing only (one side makes it turn).
export function withElevators(sheet, degrees, { depth = 0.03, side = 'both', wings = [5, 6] } = {}) {
  let s = sheet;
  // wings: the indices of the two wing folds (5 and 6 in classicDart)
  const which = side === 'both' ? wings : side === 'left' ? [wings[1]] : [wings[0]];
  const yLine = depth;
  for (const k of which) {
    s = fold(s, { a: [-0.2, yLine], b: [0.4, yLine], move: [0.08, 0.001], kind: 'valley', layers: { flap: k } });
    // The two wings are mirror images (one folded over the top, one under),
    // so "up" is past flat on one and short of flat on the other. Getting
    // this wrong bends one flap up and one down: the plane rolls instead.
    const up = k === wings[0] ? 180 - degrees : 180 + degrees;
    s = openCrease(s, s.folds.length - 1, up);
  }
  return s;
}

// A wide floaty glider from a landscape sheet: the long edge leads. Roll the
// leading edge down three times for weight at the front, fold in half, fold
// each wing down leaving a shallow keel, open the wings.
export function wideGlider({ roll = 0.022, keel = 0.016, dihedral = 10 } = {}) {
  const Wd = A4.length; // landscape: 0.297 across
  const Ln = A4.width; // 0.21 front to back, the leading edge at y = Ln
  const Cx = Wd / 2;
  let s = createSheet({ width: Wd, length: Ln });
  let top = Ln;
  for (let i = 0; i < 3; i++) {
    // fold the top strip down over itself
    s = fold(s, { a: [-0.05, top - roll], b: [Wd + 0.05, top - roll], move: [Cx, top - 0.001] });
    top -= roll;
  }
  const f0 = s.folds.length;
  s = fold(s, { a: [Cx, -0.05], b: [Cx, Ln + 0.05], move: [0.01, 0.05] }); // in half
  const wing = [Cx + keel + 0.04, 0.05];
  s = fold(s, { a: [Cx + keel, -0.05], b: [Cx + keel, Ln + 0.05], move: wing, kind: 'valley', layers: { flap: f0 } });
  s = fold(s, { a: [Cx + keel, -0.05], b: [Cx + keel, Ln + 0.05], move: wing, kind: 'mountain', layers: { notFlap: f0 } });
  s = openCrease(s, f0 + 1, 90);
  s = openCrease(s, f0 + 2, 90);
  s = openCrease(s, f0, dihedral);
  s.wingFolds = [f0 + 1, f0 + 2];
  return s;
}
