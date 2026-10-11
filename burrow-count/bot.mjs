// Burrow Count: a player for the tests and video recording (Claude). It drives the
// sim only: it solves the level with the sim's own solver, then taps the answer one
// region at a time, one tap every 20 ticks so a recording reads as a person playing.
import { newGame, step, status, solve } from './sim.mjs';

export function play(level, seed = 1) {
  const state = newGame(level, seed);
  const answer = solve(level, 1)[0] || [];
  const inputs = [];
  for (const cell of answer) {
    inputs.push({ place: [(cell / level.cols) | 0, cell % level.cols] });
    for (let i = 0; i < 20; i++) inputs.push(null);
  }
  let ticks = 0;
  for (const input of inputs) {
    if (status(state) !== 'playing') break;
    step(state, input);
    ticks++;
  }
  return { won: status(state) === 'won', inputs, ticks, state };
}
