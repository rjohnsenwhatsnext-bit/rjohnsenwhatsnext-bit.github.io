// Clear Path: a player for the tests and video recording (Claude). It only
// drives sim: tap the hinted free arrow until the board is clear.
import { newGame, step, status, hint } from './sim.mjs';

// -> { won, inputs, ticks }
export function play(level, seed = 0, { maxTicks = 2000 } = {}) {
  const state = newGame(level, seed);
  const inputs = [];
  while (status(state) === 'playing' && state.ticks < maxTicks) {
    const h = hint(state);
    if (!h) break;
    const input = { tap: { x: h.x, y: h.y } };
    inputs.push(input);
    step(state, input);
  }
  return { won: status(state) === 'won', inputs, ticks: state.ticks };
}

// A deliberately bad player: taps the first arrow it finds, free or not.
export function flail(level, seed = 0, { maxTicks = 2000 } = {}) {
  const state = newGame(level, seed);
  const inputs = [];
  while (status(state) === 'playing' && state.ticks < maxTicks) {
    const i = state.cells.findIndex((c) => c !== 0);
    const input = { tap: { x: i % state.w, y: Math.floor(i / state.w) } };
    inputs.push(input);
    step(state, input);
  }
  return { won: status(state) === 'won', inputs, ticks: state.ticks };
}
