// Small vector, matrix and quaternion helpers. Plain arrays, no allocations
// in the hot loop beyond what the caller asks for.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// 3x3 matrices as flat arrays, row major.
export const mat3Mul = (A, B) => {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
};
export const mat3Vec = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
export const mat3T = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export function mat3Inv(A) {
  const [a, b, c, d, e, f, g, h, i] = A;
  const co = [e * i - f * h, -(d * i - f * g), d * h - e * g, -(b * i - c * h), a * i - c * g, -(a * h - b * g), b * f - c * e, -(a * f - c * d), a * e - b * d];
  const det = a * co[0] + b * co[1] + c * co[2];
  if (Math.abs(det) < 1e-30) throw new Error('Singular matrix');
  return [co[0] / det, co[3] / det, co[6] / det, co[1] / det, co[4] / det, co[7] / det, co[2] / det, co[5] / det, co[8] / det];
}

// Rigid transforms {R: mat3, t: vec3}: p' = R p + t.
export const rigidIdentity = () => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
export const rigidApply = (T, p) => add(mat3Vec(T.R, p), T.t);
// (A after B): p -> A(B(p))
export const rigidCompose = (A, B) => ({ R: mat3Mul(A.R, B.R), t: add(mat3Vec(A.R, B.t), A.t) });
// Rotation by angle about the line through point a with unit direction d.
export function rigidAboutAxis(a, d, angle) {
  const [x, y, z] = d;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const C = 1 - c;
  const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  return { R, t: sub(a, mat3Vec(R, a)) };
}

// Quaternions [w, x, y, z], unit, body to world.
export const quatMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
export const quatNorm = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
export function quatToMat3(q) {
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
export function quatFromMat3(m) {
  const tr = m[0] + m[4] + m[8];
  let w, x, y, z;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (m[7] - m[5]) / s;
    y = (m[2] - m[6]) / s;
    z = (m[3] - m[1]) / s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    w = (m[7] - m[5]) / s;
    x = 0.25 * s;
    y = (m[1] + m[3]) / s;
    z = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    w = (m[2] - m[6]) / s;
    x = (m[1] + m[3]) / s;
    y = 0.25 * s;
    z = (m[5] + m[7]) / s;
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    w = (m[3] - m[1]) / s;
    x = (m[2] + m[6]) / s;
    y = (m[5] + m[7]) / s;
    z = 0.25 * s;
  }
  return quatNorm([w, x, y, z]);
}
// Quaternion for a rotation of |w|*dt about w (body rates), for q' = q * dq.
export function quatFromRotVec(w, dt) {
  const ang = Math.hypot(w[0], w[1], w[2]) * dt;
  if (ang < 1e-12) return [1, 0, 0, 0];
  const s = Math.sin(ang / 2) / (ang / dt);
  return [Math.cos(ang / 2), w[0] * s, w[1] * s, w[2] * s];
}

// Symmetric 3x3 eigen decomposition (Jacobi). Returns {values, vectors} with
// vectors as columns of a row-major matrix.
export function eigenSym3(A) {
  const a = A.slice();
  let V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[5]);
    if (off < 1e-18) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-20) continue;
      const app = a[p * 3 + p];
      const aqq = a[q * 3 + q];
      const theta = (aqq - app) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const J = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      J[p * 3 + p] = c;
      J[q * 3 + q] = c;
      J[p * 3 + q] = s;
      J[q * 3 + p] = -s;
      const JT = mat3T(J);
      const na = mat3Mul(mat3Mul(JT, a), J);
      for (let k = 0; k < 9; k++) a[k] = na[k];
      V = mat3Mul(V, J);
    }
  }
  return { values: [a[0], a[4], a[8]], vectors: V };
}
