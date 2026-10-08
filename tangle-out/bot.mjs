// Drives sim only: always taps a line that can slide out, so it never makes a mistake.
import { newGame, step, status, freeLines } from './sim.mjs';

export function play(level, seed = 0, maxTicks = 5000) {
  const state = newGame(level, seed);
  const inputs = [];
  while (status(state) === 'playing' && state.tick < maxTicks) {
    const free = freeLines(state);
    if (!free.length) break;
    const [x, y] = free[0].cells[free[0].cells.length - 1];
    const input = { tap: { x, y } };
    inputs.push(input);
    step(state, input);
  }
  return { won: status(state) === 'won', inputs, ticks: state.tick };
}
