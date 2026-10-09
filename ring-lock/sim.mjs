// Ring Lock: pure rules (Claude). No DOM, no clock, no Math.random.
//
// A level has rings. Each ring has `n` notches and a position 0..n-1. The
// level is won when every ring sits on its own target notch. Turning a ring
// one notch may also turn the rings it is linked to (see levels.mjs).
//
// TICK: one tick is one player action, not a span of time. There is no timer.
// step(state, input) takes ONE of:
//   null / {}                      nothing happens, the tick still counts
//   { move: [ring, dir] }          turn ring (index) by dir (+1 or -1) one notch; costs 1 move
//   { hint: true }                 ask for a hint: sets state.hint = {ring, dir}, costs no move
// Anything else is ignored. After the game is won or lost step does nothing.
//
// state.events lists what happened this tick, for sound and haptics:
//   {type:'notch', ring}  {type:'hint', ring, dir}  {type:'won'}  {type:'lost'}
// The list is replaced on every step.
//
// CHAPTER 2 RULES (all optional per ring, all depend only on positions):
//   step: k           a direct turn moves this ring k notches instead of 1.
//                     Its links still move by dir * factor.
//   fixed: true       the ring cannot be turned directly. Only links move it.
//   gate: {ring, at}  the ring can be turned directly only while ring `ring`
//                     sits on notch `at`. A refused turn costs no move and
//                     reports {type:'blocked', ring}. Links still drag a gated ring.
// Level scrambles must stay legal under these rules (see tests). A gated ring's
// links must never move its own gate ring, so every scramble reverses cleanly.
// Moves are only listed by solve() and the bot when canTurn() allows them.
//
// CHAPTER 3 RULE:
//   block: [notches]  a direct turn is refused if it would land this ring on a
//                     listed notch (after its step, in the direction asked). A
//                     refused turn costs no move and reports {type:'blocked', ring}.
//                     Links ignore block, so a linked ring can still be dragged
//                     onto a blocked notch. canTurn(pos, rings, ring, dir) checks
//                     block only when dir is given. Chapter 3 scrambles never land
//                     a directly turned ring on its own blocked notches, so every
//                     scramble reverses cleanly.

const mod = (a, n) => ((a % n) + n) % n;

// Can the player turn `ring` directly right now? Pass dir (+1 or -1) to also
// check the ring's blocked notches.
export function canTurn(pos, rings, ring, dir) {
  const r = rings[ring];
  if (r.fixed) return false;
  if (r.gate && pos[r.gate.ring] !== r.gate.at) return false;
  if (dir && r.block && r.block.length) {
    const landing = mod(pos[ring] + dir * (r.step || 1), r.n);
    if (r.block.indexOf(landing) !== -1) return false;
  }
  return true;
}

// Turn `ring` by `dir`, plus its links. Mutates pos. Does not check canTurn.
export function turn(pos, rings, ring, dir) {
  pos[ring] = mod(pos[ring] + dir * (rings[ring].step || 1), rings[ring].n);
  for (const [j, k] of rings[ring].links || []) pos[j] = mod(pos[j] + dir * k, rings[j].n);
}

export const solved = (pos, rings) => rings.every((r, i) => pos[i] === r.target);

// Starting positions: the solved board with the level's scramble played on it,
// so every level is reachable by construction.
export function startPositions(level) {
  const pos = level.rings.map((r) => r.target);
  for (const [ring, dir] of level.scramble) turn(pos, level.rings, ring, dir);
  return pos;
}

export function newGame(level, seed = 1) {
  return {
    levelId: level.id,
    seed,
    skin: Math.abs(Math.floor(seed)) % 5, // cosmetic only, never changes the rules
    rings: level.rings.map((r) => ({ n: r.n, target: r.target, links: (r.links || []).map((l) => l.slice()),
      step: r.step || 1, fixed: !!r.fixed, gate: r.gate ? { ring: r.gate.ring, at: r.gate.at } : null,
      block: r.block ? r.block.slice() : [] })),
    pos: startPositions(level),
    movesLeft: level.moves,
    movesMade: 0,
    hints: 0,
    hint: null,
    tick: 0,
    over: null, // null, 'won' or 'lost'
    events: [],
  };
}

export function status(state) {
  return state.over || 'playing';
}

// Shortest list of [ring, dir] moves to solve, or null if none within `limit`.
// Breadth first over the (small) space of positions.
export function solve(state, limit = state.movesLeft) {
  const { rings } = state;
  const key = (p) => p.join(',');
  if (solved(state.pos, rings)) return [];
  const seen = new Map([[key(state.pos), null]]);
  let frontier = [state.pos.slice()];
  for (let depth = 1; depth <= limit && frontier.length; depth++) {
    const next = [];
    for (const p of frontier) {
      for (let ring = 0; ring < rings.length; ring++) {
        for (const dir of [1, -1]) {
          if (!canTurn(p, rings, ring, dir)) continue;
          const q = p.slice();
          turn(q, rings, ring, dir);
          const k = key(q);
          if (seen.has(k)) continue;
          seen.set(k, { from: key(p), move: [ring, dir] });
          if (solved(q, rings)) {
            const path = [];
            for (let cur = k, e = seen.get(cur); e; cur = e.from, e = seen.get(cur)) path.unshift(e.move);
            return path;
          }
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function step(state, input) {
  state.events = [];
  if (state.over) return state;
  state.tick++;
  const move = input && input.move;
  if (move && Number.isInteger(move[0]) && move[0] >= 0 && move[0] < state.rings.length && (move[1] === 1 || move[1] === -1)) {
    if (!canTurn(state.pos, state.rings, move[0], move[1])) {
      state.events.push({ type: 'blocked', ring: move[0] });
      return state;
    }
    turn(state.pos, state.rings, move[0], move[1]);
    state.movesLeft--;
    state.movesMade++;
    state.hint = null;
    state.events.push({ type: 'notch', ring: move[0] });
    if (solved(state.pos, state.rings)) {
      state.over = 'won';
      state.events.push({ type: 'won' });
    } else if (state.movesLeft <= 0) {
      state.over = 'lost';
      state.events.push({ type: 'lost' });
    }
  } else if (input && input.hint) {
    const path = solve(state);
    if (path && path.length) {
      state.hints++;
      state.hint = { ring: path[0][0], dir: path[0][1] };
      state.events.push({ type: 'hint', ring: path[0][0], dir: path[0][1] });
    }
  }
  return state;
}
