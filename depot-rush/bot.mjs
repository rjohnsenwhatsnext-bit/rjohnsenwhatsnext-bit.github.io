// Depot Rush: a player for the tests and video recording (Claude). It searches
// the tap choices depth first through the real step (skipping states it has
// seen), then replays the winning taps tick by tick on a fresh game. Drives sim only.
import { newGame, step, status, cloneState } from './sim.mjs';

const key = (s) =>
  [s.lanes.map((l) => l.map((b) => b.colour + b.seats).join('')).join('|'),
    s.bays.map((b) => (b ? `${b.colour}${b.seats}.${b.load}` : '-')).join(','),
    s.queue.length, s.maxTaps === Infinity ? '' : s.taps].join('/');

const boarded = (s) => s.events.some((e) => e.type === 'board');

// idle ticks until nothing more boards
function settle(s, inputs) {
  for (let n = 0; n < 500 && boarded(s); n++) {
    step(s, null);
    if (inputs) inputs.push(null);
  }
}

function solve(level, seed, limit = 200000) {
  const seen = new Set();
  let nodes = 0;
  const walk = (s, taps) => {
    if (++nodes > limit) return null;
    for (let i = 0; i < s.lanes.length; i++) {
      if (s.lanes[i].length === 0) continue;
      const c = cloneState(s);
      step(c, { tap: i });
      if (c.events.some((e) => e.type === 'refused')) continue;
      settle(c);
      const st = status(c);
      if (st === 'won') return [...taps, i];
      if (st === 'lost') continue;
      const k = key(c);
      if (seen.has(k)) continue;
      seen.add(k);
      const found = walk(c, [...taps, i]);
      if (found) return found;
    }
    return null;
  };
  return walk(newGame(level, seed), []);
}

export function play(level, seed = 1) {
  const taps = solve(level, seed);
  if (!taps) return { won: false, inputs: [], ticks: 0 };
  const game = newGame(level, seed);
  const inputs = [];
  for (const lane of taps) {
    const input = { tap: lane };
    step(game, input);
    inputs.push(input);
    settle(game, inputs);
  }
  return { won: status(game) === 'won', inputs, ticks: inputs.length };
}
