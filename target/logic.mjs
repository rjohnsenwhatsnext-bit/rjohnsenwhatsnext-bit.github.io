// Target: the rules and the daily puzzle maker (Claude). Pure, no DOM.
//
// Ryan, 29 Sep 2026: "lets just build them all" (the daily strategy games).
// Six numbers and a target, the numbers round from Countdown: pick two
// numbers and + − × ÷ them, the answer takes their place, keep going until
// you make the target exactly. You do not have to use every number. Whole
// numbers only: no fractions, nothing below one.
//
// Every daily puzzle is solved before it is published: the target is
// reachable, and the fewest steps it takes sets the level.

export const LEVELS = {
  easy: { name: 'Easy', large: 1, lo: 100, hi: 300, steps: [2, 3] },
  medium: { name: 'Medium', large: 2, lo: 200, hi: 600, steps: [3, 4] },
  hard: { name: 'Hard', large: 1, lo: 500, hi: 999, steps: [4, 5] },
};
export const LARGE = [25, 50, 75, 100];
export const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
export const OPS = ['+', '−', '×', '÷'];

const EPOCH = Date.UTC(2026, 8, 29);
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// one step: a op b, or null if it is not allowed (or pointless: ×1, ÷1)
export function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a > b ? a - b : null;
  if (op === '×') return a === 1 || b === 1 ? null : a * b;
  if (op === '÷') return b > 1 && a % b === 0 ? a / b : null;
  return null;
}
const PLAYER_APPLY = (a, op, b) => {
  // the player may do the pointless ones; only the maker skips them
  if (op === '×') return a * b;
  if (op === '÷') return b >= 1 && a % b === 0 ? a / b : null;
  return apply(a, op, b);
};
export { PLAYER_APPLY as play };

// Every number reachable from a set, with the fewest steps to it and one way
// to get there. Searches every order of pairings, remembering sets it has
// already seen.
export function reachable(nums) {
  const best = new Map(); // value -> { steps, how: [ 'a op b = c', ... ] }
  const seen = new Set();
  (function go(list, how) {
    const k = list.slice().sort((x, y) => x - y).join(',');
    if (seen.has(k)) return;
    seen.add(k);
    for (const v of list) {
      const b = best.get(v);
      if (!b || b.steps > how.length) best.set(v, { steps: how.length, how });
    }
    if (list.length < 2) return;
    for (let i = 0; i < list.length; i++)
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i];
        const b = list[j];
        for (const op of OPS) {
          if ((op === '+' || op === '×') && i > j) continue; // same either way round
          const c = apply(a, op, b);
          if (c === null) continue;
          const rest = list.filter((_, t) => t !== i && t !== j);
          rest.push(c);
          go(rest, [...how, `${a} ${op} ${b} = ${c}`]);
        }
      }
  })(nums, []);
  return best;
}

// Today's puzzle for a level: numbers, a target, and one shortest way to it.
export function makePuzzle(level, day) {
  const L = LEVELS[level];
  // seeded per level by its position, not its name (easy and hard are both four letters)
  const rand = rng(day * 2654435761 + (Object.keys(LEVELS).indexOf(level) + 1) * 40503);
  const draw = (bag, k) => {
    const b = bag.slice();
    const out = [];
    for (let i = 0; i < k; i++) out.push(b.splice(Math.floor(rand() * b.length), 1)[0]);
    return out;
  };
  for (let attempt = 0; attempt < 200; attempt++) {
    const nums = [...draw(LARGE, L.large), ...draw(SMALL, 6 - L.large)];
    const all = reachable(nums);
    const pool = [...all.entries()].filter(([v, b]) => v >= L.lo && v <= L.hi && b.steps >= L.steps[0] && b.steps <= L.steps[1] && !nums.includes(v));
    if (!pool.length) continue;
    const [target, b] = pool[Math.floor(rand() * pool.length)];
    return { level, day, nums, target, steps: b.steps, solution: b.how, attempts: attempt + 1 };
  }
  throw new Error(`No ${level} puzzle for day ${day}`);
}

// ---- playing: a board is the tiles left and the steps taken
export function newBoard(p) {
  return { tiles: p.nums.map((v, i) => ({ id: i, v })), steps: [], next: p.nums.length, done: false };
}
// combine tile ids a and b with op; -> { ok, reason?, value? }
export function combine(board, a, op, b, target) {
  if (board.done) return { ok: false, reason: 'Already solved' };
  const A = board.tiles.find((t) => t.id === a);
  const B = board.tiles.find((t) => t.id === b);
  if (!A || !B || a === b) return { ok: false, reason: 'Pick two numbers' };
  const v = PLAYER_APPLY(A.v, op, B.v);
  if (v === null) return { ok: false, reason: op === '÷' ? `${A.v} ÷ ${B.v} is not a whole number` : `${A.v} ${op} ${B.v} would go below one` };
  const tile = { id: board.next++, v, made: true };
  board.steps.push({ a: A, op, b: B, c: tile, before: board.tiles.slice() });
  board.tiles = board.tiles.filter((t) => t.id !== a && t.id !== b).concat(tile);
  if (v === target) board.done = true;
  return { ok: true, value: v, done: board.done };
}
export function undo(board) {
  const s = board.steps.pop();
  if (!s) return false;
  board.tiles = s.before;
  board.done = false;
  return true;
}
// how close the nearest tile is
export const closest = (board, target) => Math.min(...board.tiles.map((t) => Math.abs(t.v - target)));

export function shareText(level, day, { seconds, steps, gaveUp, hints = 0 }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `Target ${LEVELS[level].name} #${day}${hints ? ' (with a hint)' : ''}\n${gaveUp ? '🎯 not today' : `🎯 in ${steps} step${steps > 1 ? 's' : ''} · ${m}:${s}`}`;
}
// A hint (a watched rewarded ad): the first step of a shortest way. One per
// level per day; the share card says so.
export const hintFor = (p) => p.solution[0];
export function record(stats, { day, won, seconds }) {
  const s = { played: 0, won: 0, streak: 0, best: 0, fastest: null, lastDay: null, ...stats };
  if (s.lastDay === day) return s;
  s.played++;
  if (won) {
    s.won++;
    s.streak = s.lastWonDay === day - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.lastWonDay = day;
    s.fastest = s.fastest === null ? seconds : Math.min(s.fastest, seconds);
  } else s.streak = 0;
  s.lastDay = day;
  return s;
}
