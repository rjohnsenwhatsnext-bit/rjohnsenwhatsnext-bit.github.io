// Ring Lock: a player for the tests and video recording (Claude). It drives
// only the sim: asks for the shortest solution and plays it one move per tick.
import { newGame, step, status, solve } from './sim.mjs';

export function play(level, seed = 1) {
  const state = newGame(level, seed);
  const inputs = [];
  const path = solve(state);
  if (path) {
    for (const move of path) {
      const input = { move };
      inputs.push(input);
      step(state, input);
    }
  }
  return { won: status(state) === 'won', inputs, ticks: state.tick };
}
