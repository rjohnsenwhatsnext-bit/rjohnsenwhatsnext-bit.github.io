// Tram Queue: a player for the tests and the video recorder (Claude). It asks the
// sim's solver for a winning list of taps, then plays them one at a time through
// the real step, so a rules change that breaks a level shows up as a loss here.
import { newGame, step, status, solve } from './sim.mjs';

export function play(level, seed = 1) {
  const s = newGame(level, seed);
  const plan = solve(s) || [];
  const inputs = [];
  for (const id of plan) {
    if (status(s) !== 'playing') break;
    const input = { tap: id };
    inputs.push(input);
    step(s, input);
  }
  return { won: status(s) === 'won', inputs, ticks: inputs.length };
}
