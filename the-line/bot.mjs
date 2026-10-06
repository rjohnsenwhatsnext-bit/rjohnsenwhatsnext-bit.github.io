// The Line: a player for the tests (Claude). Every 0.1 s it tries each choice
// (left, straight, right) for half a second ahead, then asks how much room it
// would have from there, and takes the best. A steady, not perfect, player:
// enough to show early runs are easy and a full board is hard.
import { step, clearRay, insetAt, newRun } from './sim.mjs';

const copy = (run) => ({ ...run, pts: run.pts.slice(), events: [] });

// Fly `steer` for half a second, then each choice again for a second, through
// the real step (so its own fresh line counts), and score the best way out.
function roomAfter(run, steer) {
  const r = copy(run);
  for (let i = 0; i < 30 && !r.over; i++) step(r, { steer });
  if (r.over) return -1;
  let best = 0;
  for (const next of [0, -1, 1]) {
    const q = copy(r);
    let ticks = 0;
    for (; ticks < 60 && !q.over; ticks++) step(q, { steer: next });
    const room = q.over ? ticks / 60 : 1 + clearRay(q.board, q.grid, q.x, q.y, q.a, 6, insetAt(q.dist));
    best = Math.max(best, room);
  }
  return best;
}

export function play(board, { seconds = 240, useErase = false } = {}) {
  const run = newRun(board);
  let steer = 0;
  for (let tick = 0; !run.over && run.t < seconds; tick++) {
    if (tick % 6 === 0) {
      const options = [0, -1, 1].map((s) => [s, roomAfter(run, s) + (s === 0 ? 0.2 : 0)]).sort((p, q) => q[1] - p[1]);
      steer = options[0][0];
      if (useErase && run.erases > 0 && options[0][1] < 0.8) { step(run, { steer, erase: true }); continue; }
    }
    step(run, { steer });
  }
  return run;
}
