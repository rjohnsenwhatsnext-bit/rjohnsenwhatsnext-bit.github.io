// Paper folding for the paper plane engine.
//
// A sheet is a set of facets. Each facet is a convex polygon in SHEET
// coordinates (metres on the unfolded paper, origin bottom left, x across,
// y along) plus an affine map to the FOLDED plane, the flat state you see
// while folding. Folding along any line splits every facet it crosses and
// reflects the moving part across the line, so the geometry is exact at any
// angle and any number of layers. Nothing here is a preset plane.
//
// After folding, any crease can be opened by an angle (0 = flat as folded,
// 180 = unfolded). Opening turns the flat result into 3D: wings out, dihedral,
// a bent flap. `build()` gives the 3D facets for drawing and the mass and
// surface samples the physics flies.
//
// Sheets are immutable: every operation returns a new sheet.

import { rigidIdentity, rigidApply, rigidCompose, rigidAboutAxis, sub, cross, norm } from './vec.mjs';

export const A4 = { width: 0.21, length: 0.297, gsm: 80 };
export const PAPER_THICKNESS = 0.0001; // metres, only used to stack layers for drawing

// ---- 2D affine maps [a, b, c, d, tx, ty]: x' = a x + c y + tx, y' = b x + d y + ty
const ID2 = [1, 0, 0, 1, 0, 0];
const apply2 = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
const compose2 = (A, B) => [
  A[0] * B[0] + A[2] * B[1],
  A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3],
  A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4],
  A[1] * B[4] + A[3] * B[5] + A[5],
];
function invert2(M) {
  const det = M[0] * M[3] - M[1] * M[2];
  const a = M[3] / det;
  const b = -M[1] / det;
  const c = -M[2] / det;
  const d = M[0] / det;
  return [a, b, c, d, -(a * M[4] + c * M[5]), -(b * M[4] + d * M[5])];
}
function reflection2(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) throw new Error('A fold line needs two different points');
  const ux = dx / l;
  const uy = dy / l;
  // L = 2 u u^T - I
  const L = [2 * ux * ux - 1, 2 * ux * uy, 2 * ux * uy, 2 * uy * uy - 1];
  return [L[0], L[2], L[1], L[3], a[0] - (L[0] * a[0] + L[1] * a[1]), a[1] - (L[2] * a[0] + L[3] * a[1])];
}

// Signed side of point p relative to the directed line a->b: >0 left, <0 right.
const side = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}
function polyCentroid(poly) {
  let cx = 0;
  let cy = 0;
  let A = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const cr = p[0] * q[1] - q[0] * p[1];
    A += cr;
    cx += (p[0] + q[0]) * cr;
    cy += (p[1] + q[1]) * cr;
  }
  if (Math.abs(A) < 1e-14) return poly[0];
  return [cx / (3 * A), cy / (3 * A)];
}

// Clip a convex polygon to the half plane where sign * side(a, b, p) >= 0.
function clipHalf(poly, a, b, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = sign * side(a, b, p);
    const sq = sign * side(a, b, q);
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out.length >= 3 && Math.abs(polyArea(out)) > 1e-10 ? out : null;
}

function pointInConvex(poly, p) {
  let sgn = 0;
  for (let i = 0; i < poly.length; i++) {
    const s = side(poly[i], poly[(i + 1) % poly.length], p);
    if (Math.abs(s) < 1e-14) continue;
    if (!sgn) sgn = Math.sign(s);
    else if (Math.sign(s) !== sgn) return false;
  }
  return true;
}

export function createSheet({ width = A4.width, length = A4.length, gsm = A4.gsm } = {}) {
  return {
    width,
    length,
    gsm,
    facets: [{ poly: [[0, 0], [width, 0], [width, length], [0, length]], M: ID2, z: 0, moved: [] }],
    folds: [],
    clips: [],
  };
}

// The folded (flat) outline of every facet, for drawing the folding screen.
export function flatFacets(sheet) {
  return sheet.facets.map((f, i) => ({ index: i, z: f.z, poly: f.poly.map((p) => apply2(f.M, p)), sheetPoly: f.poly }));
}

// Which facets a fold acts on. layers:
//   'all'            every layer the line crosses on the moving side (default)
//   { top: n }       only the n topmost layers (valley) or bottommost (mountain)
//   { flap: k }      only paper that fold k moved: fold one flap, e.g. one wing
//   { notFlap: k }   only paper that fold k did not move
//   { grab: [x, y] } what a finger does: the top layer under that point
//                    (folded coordinates) and all paper joined to it on the
//                    moving side. Inside a folded half its tucked strips come
//                    along; the other half, joined only by a crease that is
//                    not on the moving side, stays.
function selected(sheet, f, layers, kind, zCut) {
  if (!layers || layers === 'all') return true;
  if (layers.flap !== undefined) return Boolean(f.moved[layers.flap]);
  if (layers.notFlap !== undefined) return !f.moved[layers.notFlap];
  if (layers.top !== undefined) return kind === 'mountain' ? f.z <= zCut : f.z >= zCut;
  throw new Error('Unknown layers option');
}

// fold(sheet, { a, b, move, kind, layers })
//   a, b    two points on the fold line in FOLDED coordinates (metres)
//   move    a point [x, y] (folded coordinates) on the side that folds over:
//           the flap the player tapped. 'left' / 'right' of the directed
//           line a->b also work, but a point is what a screen has.
//   kind    'valley' (flap comes up and over on top) or 'mountain' (goes under)
export function fold(sheet, { a, b, move, kind = 'valley', layers = 'all' }) {
  if (kind !== 'valley' && kind !== 'mountain') throw new Error("kind must be 'valley' or 'mountain'");
  let sgn;
  if (Array.isArray(move)) {
    const sd = side(a, b, move);
    if (Math.abs(sd) < 1e-12) throw new Error('The point for the moving side is on the fold line');
    sgn = Math.sign(sd);
  } else if (move === 'left' || move === 'right') sgn = move === 'left' ? 1 : -1;
  else throw new Error("move must be a point on the side that folds, or 'left' / 'right'");
  const R = reflection2(a, b);
  const k = sheet.folds.length;

  // Facets touching the moving side, to work out layer cuts and stacking.
  const flat = sheet.facets.map((f) => apply2Poly(f));
  const touching = sheet.facets.map((f, i) => flat[i].some((p) => sgn * side(a, b, p) > 1e-12));
  let zCut = null;
  const grabbed = layers && layers.grab ? grabPiece(sheet, flat, touching, a, b, sgn, layers.grab) : null;
  const pick = (f) => (grabbed ? grabbed.has(f) : selected(sheet, f, layers, kind, zCut));
  if (layers && layers.top !== undefined) {
    const zs = [...new Set(sheet.facets.filter((f, i) => touching[i]).map((f) => f.z))].sort((x, y) => (kind === 'mountain' ? x - y : y - x));
    const n = Math.max(1, layers.top);
    zCut = zs[Math.min(n, zs.length) - 1];
  }

  const staying = [];
  const going = [];
  sheet.facets.forEach((f, i) => {
    const sel = touching[i] && pick(f);
    if (!sel) {
      staying.push({ ...f, moved: [...f.moved, false] });
      return;
    }
    const inv = invert2(f.M);
    const stayF = clipHalf(flat[i], a, b, -sgn);
    const goF = clipHalf(flat[i], a, b, sgn);
    if (stayF) staying.push({ ...f, poly: stayF.map((p) => apply2(inv, p)), moved: [...f.moved, false] });
    if (goF) going.push({ ...f, poly: goF.map((p) => apply2(inv, p)), M: compose2(R, f.M), moved: [...f.moved, true] });
  });
  if (!going.length) throw new Error('That fold line does not move any paper');

  // Stacking: a valley flap lands on top of everything, in reverse order; a
  // mountain flap goes underneath.
  const allZ = sheet.facets.map((f) => f.z);
  const top = Math.max(...allZ);
  const bottom = Math.min(...allZ);
  const gz = going.map((f) => f.z);
  const gMax = Math.max(...gz);
  const gMin = Math.min(...gz);
  for (const f of going) f.z = kind === 'valley' ? top + 1 + (gMax - f.z) : bottom - 1 - (f.z - gMin);

  // The crease as the chord of paper it runs across, kept in folded
  // coordinates and carried along if later folds move it.
  const chord = lineChord(flat, a, b);
  return {
    ...sheet,
    facets: [...staying, ...going],
    folds: [...sheet.folds.map((fd) => carryAxis(fd, R, a, b, sgn, sheet, pick, k)), { a: chord[0], b: chord[1], kind, open: 0, movedBy: [] }],
  };
}

// The piece a finger lifts: the topmost facet under the grab point, then every
// moving-side facet joined to it along an edge of the paper that is itself on
// the moving side (joins across the fold line, or on the staying side, do not
// carry). Returns a Set of facets.
function grabPiece(sheet, flat, touching, a, b, sgn, at) {
  const F = sheet.facets;
  let start = -1;
  F.forEach((f, i) => {
    if (touching[i] && pointInConvex(flat[i], at) && (start < 0 || f.z > F[start].z)) start = i;
  });
  if (start < 0) throw new Error('Grab the paper to fold it');
  const ids = F.map((f, i) => i).filter((i) => touching[i]);
  const box = (poly) => [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];
  const boxes = new Map(ids.map((i) => [i, box(F[i].poly)]));
  const near = (u, v) => u[0] <= v[2] + 1e-9 && v[0] <= u[2] + 1e-9 && u[1] <= v[3] + 1e-9 && v[1] <= u[3] + 1e-9;
  const joined = (i, j) => {
    const P = F[i].poly;
    const Q = F[j].poly;
    for (let m = 0; m < P.length; m++) {
      const p1 = P[m];
      const p2 = P[(m + 1) % P.length];
      const d = [p2[0] - p1[0], p2[1] - p1[1]];
      const L = Math.hypot(d[0], d[1]);
      if (L < 1e-9) continue;
      for (let n = 0; n < Q.length; n++) {
        const q1 = Q[n];
        const q2 = Q[(n + 1) % Q.length];
        if (Math.abs(side(p1, p2, q1)) / L > 1e-9 || Math.abs(side(p1, p2, q2)) / L > 1e-9) continue;
        const t1 = ((q1[0] - p1[0]) * d[0] + (q1[1] - p1[1]) * d[1]) / L;
        const t2 = ((q2[0] - p1[0]) * d[0] + (q2[1] - p1[1]) * d[1]) / L;
        const lo = Math.max(0, Math.min(t1, t2));
        const hi = Math.min(L, Math.max(t1, t2));
        if (hi - lo < 1e-7) continue;
        // the shared stretch, on the folded table: joined if any of it is on the moving side
        const e1 = apply2(F[i].M, [p1[0] + (d[0] * lo) / L, p1[1] + (d[1] * lo) / L]);
        const e2 = apply2(F[i].M, [p1[0] + (d[0] * hi) / L, p1[1] + (d[1] * hi) / L]);
        const s1 = sgn * side(a, b, e1);
        const s2 = sgn * side(a, b, e2);
        if (s1 > 1e-12 || s2 > 1e-12) return true;
      }
    }
    return false;
  };
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.pop();
    for (const j of ids) {
      if (seen.has(j) || !near(boxes.get(i), boxes.get(j)) || !joined(i, j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return new Set([...seen].map((i) => F[i]));
}

function apply2Poly(f) {
  return f.poly.map((p) => apply2(f.M, p));
}

function lineChord(flatPolys, a, b) {
  const d = [b[0] - a[0], b[1] - a[1]];
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const poly of flatPolys) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const sp = side(a, b, p);
      const sq = side(a, b, q);
      const proj = (x) => ((x[0] - a[0]) * d[0] + (x[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
      if (Math.abs(sp) < 1e-12) {
        tMin = Math.min(tMin, proj(p));
        tMax = Math.max(tMax, proj(p));
      }
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        const t = sp / (sp - sq);
        const x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        tMin = Math.min(tMin, proj(x));
        tMax = Math.max(tMax, proj(x));
      }
    }
  }
  if (!isFinite(tMin) || tMax - tMin < 1e-4) return [a, b];
  return [
    [a[0] + d[0] * tMin, a[1] + d[1] * tMin],
    [a[0] + d[0] * tMax, a[1] + d[1] * tMax],
  ];
}

// An earlier crease moves with a later fold when the paper under its middle
// is folded over.
function carryAxis(fd, R, a, b, sgn, sheet, pick, k) {
  const mid = [(fd.a[0] + fd.b[0]) / 2, (fd.a[1] + fd.b[1]) / 2];
  if (sgn * side(a, b, mid) <= 1e-12) return fd;
  const under = sheet.facets.filter((f) => pointInConvex(apply2Poly(f), mid));
  const moves = under.some(pick);
  if (!moves) return fd;
  return { ...fd, a: apply2(R, fd.a), b: apply2(R, fd.b), movedBy: [...fd.movedBy, k] };
}

// Turn the whole folded paper over, left to right about the vertical line x = cx.
export function flip(sheet, cx) {
  const flat = sheet.facets.flatMap((f) => apply2Poly(f));
  const mid = cx !== undefined ? cx : (Math.min(...flat.map((p) => p[0])) + Math.max(...flat.map((p) => p[0]))) / 2;
  const R = [-1, 0, 0, 1, 2 * mid, 0];
  const zMax = Math.max(...sheet.facets.map((f) => f.z));
  const zMin = Math.min(...sheet.facets.map((f) => f.z));
  return {
    ...sheet,
    facets: sheet.facets.map((f) => ({ ...f, M: compose2(R, f.M), z: zMax + zMin - f.z })),
    folds: sheet.folds.map((fd) => ({ ...fd, a: apply2(R, fd.a), b: apply2(R, fd.b), kind: fd.kind === 'valley' ? 'mountain' : 'valley' })),
    flipped: !sheet.flipped,
  };
}

// Open crease k by `degrees`: 0 = flat as folded, 180 = back to flat
// unfolded, and past 180 bends it the other way (paper bends either way at
// a crease), up to 360 = folded flat the opposite way.
export function openCrease(sheet, k, degrees) {
  if (!sheet.folds[k]) throw new Error(`No fold ${k}`);
  if (!(degrees >= 0 && degrees <= 360)) throw new Error('Opening must be 0 to 360 degrees');
  return { ...sheet, folds: sheet.folds.map((fd, i) => (i === k ? { ...fd, open: degrees } : fd)) };
}

// A paperclip (or any small weight) clipped on at a point in SHEET coordinates.
export function addClip(sheet, at, mass = 0.0005) {
  return { ...sheet, clips: [...sheet.clips, { at, mass }] };
}

// The 3D paper: every facet's transform from folded plane to space, the
// drawable 3D polygons, and the samples the physics uses.
//   spacing  sample grid in metres (smaller is finer and slower)
export function build(sheet, { spacing = 0.006 } = {}) {
  const n = sheet.folds.length;
  const density = sheet.gsm / 1000; // kg per m^2

  // Opening transforms, last fold first: that is the order paper unfolds.
  const opens = new Array(n).fill(null);
  for (let k = n - 1; k >= 0; k--) {
    const fd = sheet.folds[k];
    if (!fd.open) continue;
    let A = [fd.a[0], fd.a[1], 0];
    let B = [fd.b[0], fd.b[1], 0];
    for (let j = n - 1; j > k; j--) {
      if (opens[j] && fd.movedBy.includes(j)) {
        A = rigidApply(opens[j], A);
        B = rigidApply(opens[j], B);
      }
    }
    // Which way is "open": a valley flap lifts up (+z in the folded plane), a
    // mountain flap drops down. Decided in the flat state from a moved facet.
    const moving = sheet.facets.find((f) => f.moved[k]);
    if (!moving) continue;
    const c = polyCentroid(apply2Poly(moving));
    const d2 = [fd.b[0] - fd.a[0], fd.b[1] - fd.a[1]];
    const perp = [c[0] - fd.a[0], c[1] - fd.a[1]];
    const sigma = Math.sign(d2[0] * perp[1] - d2[1] * perp[0]) || 1;
    const s = fd.kind === 'valley' ? sigma : -sigma;
    const dir = norm(sub(B, A));
    opens[k] = rigidAboutAxis(A, dir, (s * fd.open * Math.PI) / 180);
  }

  const facets = sheet.facets.map((f) => {
    let T = rigidIdentity();
    for (let k = n - 1; k >= 0; k--) if (opens[k] && f.moved[k]) T = rigidCompose(opens[k], T);
    const flatPoly = apply2Poly(f);
    const zOff = f.z * PAPER_THICKNESS;
    const poly3 = flatPoly.map((p) => rigidApply(T, [p[0], p[1], zOff]));
    const normal = norm(cross(sub(poly3[1], poly3[0]), sub(poly3[2], poly3[0])));
    return { flatPoly, sheetPoly: f.poly, T, poly3, normal, z: f.z, area: Math.abs(polyArea(f.poly)) };
  });

  // Mass: every layer counts. Samples on a grid aligned in the folded plane,
  // so stacked layers land on the same points and the air sees one surface.
  const mass = [];
  const aeroMap = new Map();
  for (const f of facets) {
    const pts = gridInside(f.flatPoly, spacing);
    const mEach = (f.area * density) / Math.max(1, pts.length);
    if (!pts.length) {
      const c = polyCentroid(f.flatPoly);
      mass.push({ p: rigidApply(f.T, [c[0], c[1], 0]), m: f.area * density });
      continue;
    }
    for (const q of pts) {
      const p = rigidApply(f.T, [q[0], q[1], 0]);
      mass.push({ p, m: mEach });
      const key = `${Math.round(p[0] * 2000)},${Math.round(p[1] * 2000)},${Math.round(p[2] * 2000)}`;
      if (!aeroMap.has(key)) aeroMap.set(key, { p, n: f.normal, area: spacing * spacing });
    }
  }
  for (const c of sheet.clips) {
    const holder = [...facets].sort((x, y) => y.z - x.z).find((f) => pointInConvex(f.sheetPoly, c.at));
    if (!holder) throw new Error('That clip is not on the paper');
    const src = sheet.facets[facets.indexOf(holder)];
    const q = apply2(src.M, c.at);
    mass.push({ p: rigidApply(holder.T, [q[0], q[1], 0]), m: c.mass, clip: true });
  }

  const totalMass = mass.reduce((s, x) => s + x.m, 0);
  return {
    facets: facets.map(({ poly3, normal, z, sheetPoly }) => ({ poly: poly3, normal, z, sheetPoly })),
    massSamples: mass,
    aeroSamples: [...aeroMap.values()],
    hull: facets.flatMap((f) => f.poly3),
    totalMass,
    spacing,
  };
}

function gridInside(poly, h) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const out = [];
  const x0 = Math.ceil(Math.min(...xs) / h - 0.5) * h + h / 2;
  const y0 = Math.ceil(Math.min(...ys) / h - 0.5) * h + h / 2;
  for (let x = x0; x <= Math.max(...xs); x += h) for (let y = y0; y <= Math.max(...ys); y += h) if (pointInConvex(poly, [x, y])) out.push([x, y]);
  return out;
}
