// Outback Tiles: a player for the tests and the video recorder. It searches for
// a full clearing order on a copy of the board (highest tiles first, dead
// positions remembered), then plays it through step(). If the search runs out of
// budget it shuffles and tries again. It never makes a wrong pair.
import { newGame, step, status, isFreeIn } from './sim.mjs';

// a list of [idA, idB] that clears the board from here, or null
export function solve(s, budget = 80000) {
  const tiles = s.tiles, alive = tiles.map((t) => t.alive), dead = new Set(), plan = [];
  let nodes = 0;
  const dfs = (left) => {
    if (left === 0) return true;
    if (++nodes > budget) return false;
    const key = alive.map((a) => (a ? 1 : 0)).join('');
    if (dead.has(key)) return false;
    const free = [];
    for (let i = 0; i < tiles.length; i++) if (isFreeIn(tiles, alive, i)) free.push(i);
    const cands = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (tiles[free[i]].face === tiles[free[j]].face) cands.push([free[i], free[j]]);
      }
    }
    cands.sort((p, q) => tiles[q[0]].z + tiles[q[1]].z - tiles[p[0]].z - tiles[p[1]].z);
    for (const [a, b] of cands) {
      alive[a] = alive[b] = false;
      plan.push([a, b]);
      if (dfs(left - 2)) return true;
      plan.pop();
      alive[a] = alive[b] = true;
    }
    dead.add(key);
    return false;
  };
  return dfs(alive.filter(Boolean).length) ? plan : null;
}

export function play(level, seed = 1, maxTicks = 2000) {
  const s = newGame(level, seed), inputs = [];
  const send = (input) => { inputs.push(input); step(s, input); };
  while (status(s) === 'playing' && s.tick < maxTicks) {
    const plan = solve(s);
    if (plan) {
      for (const [a, b] of plan) {
        if (status(s) !== 'playing') break;
        send({ pick: a });
        send({ pick: b });
      }
    } else if (s.shufflesLeft > 0) send({ shuffle: true });
    else break;
  }
  return { won: status(s) === 'won', inputs, ticks: s.tick };
}
