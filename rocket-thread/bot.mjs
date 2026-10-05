// Rocket Thread: a player that searches for a way up, for the tests (Claude).
// It decides hold or let go ten times a second and keeps the best few hundred
// flights at every step, like a player who can see every possible next half
// second. If it can reach a score with room to spare, a person can; if it
// cannot, the course is not fair.
import { newRun, newCourse, step, clearance } from './sim.mjs';

const TICKS = 6; // one decision per 0.1 s

function advance(run, hold) {
  const r = { ...run, gotCells: run.gotCells.slice(), announced: run.announced.slice(), events: [] };
  for (let i = 0; i < TICKS && !r.over; i++) step(r, { hold });
  return r;
}

// Climb seed's course until `target` score.
// margin: metres of room the flight must keep from everything (a person needs slack).
// -> { reached, score, holds: [bool per 0.1 s], run }
export function solve(seed, { target = 100, beam = 220, margin = 0, maxSeconds = 600 } = {}) {
  const course = newCourse(seed);
  let front = [{ run: newRun(seed, course), path: [] }];
  let best = front[0];
  for (let k = 0; k < maxSeconds * 10; k++) {
    const next = [];
    const seen = new Set();
    for (const node of front) {
      for (const hold of [false, true]) {
        const run = advance(node.run, hold);
        if (run.crashed || run.closest < margin) continue;
        const path = node.path.concat(hold);
        if (run.score >= target) return { reached: true, score: run.score, holds: path, run };
        const key = `${Math.round(run.x * 5)}|${Math.round(run.tilt * 12)}|${Math.round(run.y * 2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const room = clearance(course, run.x, run.y + 1.5, run.t + 0.25);
        next.push({ run, path, score: run.y * 10 + Math.min(room, 2) * 3 });
      }
    }
    if (!next.length) return { reached: false, score: best.run.score, holds: best.path, run: best.run };
    next.sort((a, b) => b.score - a.score);
    front = next.slice(0, beam);
    best = front[0];
  }
  return { reached: false, score: best.run.score, holds: best.path, run: best.run };
}

// Replays holds through the real step on a fresh course, the way a server would check a score.
export function replay(seed, holds) {
  const run = newRun(seed);
  for (const hold of holds) for (let i = 0; i < TICKS && !run.over; i++) step(run, { hold });
  return run;
}
