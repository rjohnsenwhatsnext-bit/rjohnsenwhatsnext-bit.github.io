// Don't Touch Red: a player that searches, for the tests (Claude). Every
// 0.15 s it tries no tap, a left tap and a right tap, and keeps the best few
// hundred games. If it can last with room to spare, a person can; if it
// cannot, the spawning is not fair.
import { newGame, copy, step, redDist, WARN } from './sim.mjs';

const TICKS = 9; // one decision per 0.15 s

function advance(w, tap) {
  const n = copy(w);
  for (let i = 0; i < TICKS && !n.over; i++) step(n, { tap: i === 0 ? tap : 0 });
  return n;
}

// -> { lasted, seconds, taps: [-1|0|1 per 0.15 s], game }
export function survive(seed, { seconds = 120, beam = 120, margin = 0 } = {}) {
  let front = [{ w: newGame(seed), taps: [] }];
  let best = front[0];
  while (true) {
    const next = [];
    for (const node of front) {
      for (const tap of [0, -1, 1]) {
        const w = advance(node.w, tap);
        if (w.over || w.closest < margin) continue;
        const taps = node.taps.concat(tap);
        if (w.t >= seconds) return { lasted: true, seconds: w.t, taps, game: w };
        // prefer room around the ball: real edge distance to every red thing,
        // including ones still flashing, since they are about to be solid
        let room = 6;
        for (const o of w.reds) room = Math.min(room, redDist(o, w.x, w.y) - (o.age < WARN ? 0.3 : 0));
        next.push({ w, taps, score: room + w.score * 0.02 + (tap ? -0.01 : 0) });
      }
    }
    if (!next.length) return { lasted: false, seconds: best.w.t, taps: best.taps, game: best.w };
    next.sort((a, b) => b.score - a.score);
    front = next.slice(0, beam);
    best = front[0];
  }
}

export function replay(seed, taps) {
  const w = newGame(seed);
  for (const tap of taps) for (let i = 0; i < TICKS && !w.over; i++) step(w, { tap: i === 0 ? tap : 0 });
  return w;
}
