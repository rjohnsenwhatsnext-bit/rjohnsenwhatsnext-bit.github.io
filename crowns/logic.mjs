// Crowns: the rules and the daily puzzle maker (Claude). Pure, no DOM.
//
// Ryan, 29 Sep 2026: "lets keep the strategy games going those are great and
// easy for retention", then "lets just build them all". A daily logic puzzle
// in the shape of LinkedIn's Queens: a grid split into coloured regions; put
// one crown in every row, every column and every region, and no two crowns
// may touch, not even corner to corner.
//
// Every puzzle is made from the date, so everyone gets the same one, and is
// only kept if a solver proves it has exactly one answer AND that it can be
// reached by plain deduction, with no guessing. That is what makes it fair.

export const LEVELS = {
  easy: { n: 6, name: 'Easy' },
  medium: { n: 7, name: 'Medium' },
  hard: { n: 8, name: 'Hard' },
};

// Puzzle 1 is 29 September 2026; a new one at local midnight.
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

// ---- the rules
// crowns: array of [row, col]. -> null when solved, else the first problem
export function problem(puzzle, crowns) {
  const { n, regions } = puzzle;
  const rows = Array(n).fill(0);
  const cols = Array(n).fill(0);
  const regs = Array(n).fill(0);
  for (const [r, c] of crowns) {
    rows[r]++;
    cols[c]++;
    regs[regions[r][c]]++;
  }
  for (let i = 0; i < n; i++) {
    if (rows[i] > 1) return { kind: 'row', index: i, text: `Row ${i + 1} has two crowns` };
    if (cols[i] > 1) return { kind: 'col', index: i, text: `Column ${i + 1} has two crowns` };
    if (regs[i] > 1) return { kind: 'region', index: i, text: 'A colour has two crowns' };
  }
  for (let a = 0; a < crowns.length; a++)
    for (let b = a + 1; b < crowns.length; b++)
      if (Math.abs(crowns[a][0] - crowns[b][0]) <= 1 && Math.abs(crowns[a][1] - crowns[b][1]) <= 1) return { kind: 'touch', cells: [crowns[a], crowns[b]], text: 'Two crowns are touching' };
  if (crowns.length < n) return { kind: 'short', text: `${n - crowns.length} to go` };
  return null;
}
export const solved = (puzzle, crowns) => problem(puzzle, crowns) === null;

// ---- counting answers: backtracking row by row, stops at `limit`
export const countSolutions = (regions, limit = 2) => solutions(regions, limit).length;
// the answers themselves, each as the column of the crown in each row
export function solutions(regions, limit = 2) {
  const out = [];
  const n = regions.length;
  const colUsed = Array(n).fill(false);
  const regUsed = Array(n).fill(false);
  let found = 0;
  let prev = -9;
  const place = [];
  (function go(r) {
    if (found >= limit) return;
    if (r === n) {
      found++;
      out.push(place.slice());
      return;
    }
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      if (colUsed[c] || regUsed[g] || Math.abs(c - prev) <= 1) continue;
      colUsed[c] = regUsed[g] = true;
      const keep = prev;
      prev = c;
      place.push(c);
      go(r + 1);
      place.pop();
      prev = keep;
      colUsed[c] = regUsed[g] = false;
    }
  })(0);
  return out;
}

// is region g still one piece?
function connected(regions, g) {
  const n = regions.length;
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (regions[i][j] === g) cells.push(i * n + j);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const k = stack.pop();
    const i = Math.floor(k / n);
    const j = k % n;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]])
      if (a >= 0 && b >= 0 && a < n && b < n && regions[a][b] === g && !seen.has(a * n + b)) {
        seen.add(a * n + b);
        stack.push(a * n + b);
      }
  }
  return seen.size === cells.length;
}
// Break a second answer: move one of its crown cells (never one of the real
// answer's) into a neighbouring colour, keeping every colour in one piece.
function repair(regions, answerCols, rand) {
  const n = regions.length;
  for (let round = 0; round < 80; round++) {
    const sols = solutions(regions, 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((c, r) => c !== answerCols[r]));
    const cells = alt.map((c, r) => [r, c]).filter(([r, c]) => answerCols[r] !== c);
    let moved = false;
    for (const [r, c] of cells.sort(() => rand() - 0.5)) {
      const from = regions[r][c];
      const nbs = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && regions[a][b] !== from);
      for (const [a, b] of nbs.sort(() => rand() - 0.5)) {
        regions[r][c] = regions[a][b];
        if (connected(regions, from)) {
          moved = true;
          break;
        }
        regions[r][c] = from;
      }
      if (moved) break;
    }
    if (!moved) return false;
  }
  return false;
}

// ---- solving by deduction, the way a person does. Returns the steps used
// and whether it finished; a puzzle is only published if it finishes.
// Rules, easiest first:
//  1. a row, column or region with one open cell: that is a crown
//  2. a crown rules out its row, column, region and the 8 cells around it
//  3. a region that sits inside one row (or column) owns it: rule out the
//     rest of that row; likewise k regions inside k rows
//  4. a cell whose crown would leave some row, column or region with no
//     open cell is ruled out
export function deduce(regions) {
  const n = regions.length;
  const open = regions.map((row) => row.map(() => true));
  const crown = regions.map((row) => row.map(() => false));
  const used = { rule3: 0, rule4: 0 };
  const units = [];
  for (let i = 0; i < n; i++) units.push(Array.from({ length: n }, (_, j) => [i, j]));
  for (let j = 0; j < n; j++) units.push(Array.from({ length: n }, (_, i) => [i, j]));
  for (let g = 0; g < n; g++) {
    const cells = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (regions[i][j] === g) cells.push([i, j]);
    units.push(cells);
  }
  const has = (u) => u.some(([i, j]) => crown[i][j]);
  const openIn = (u) => u.filter(([i, j]) => open[i][j] && !crown[i][j]);
  function put(i, j) {
    crown[i][j] = true;
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) {
        if (a === i && b === j) continue;
        if (a === i || b === j || regions[a][b] === regions[i][j] || (Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1)) open[a][b] = false;
      }
  }
  // would a crown at (i, j) leave some unit with nowhere to go?
  function starves(i, j) {
    const gone = (a, b) => a === i || b === j || regions[a][b] === regions[i][j] || (Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1);
    return units.some((u) => !has(u) && !u.some(([a, b]) => a === i && b === j) && u.every(([a, b]) => !open[a][b] || crown[a][b] || gone(a, b)));
  }
  for (let guard = 0; guard < 400; guard++) {
    if (units.every(has)) return { solved: true, ...used, crowns: crownsOf() };
    let moved = false;
    // rule 1
    for (const u of units) {
      if (has(u)) continue;
      const o = openIn(u);
      if (o.length === 0) return { solved: false, ...used, stuck: 'contradiction' };
      if (o.length === 1) {
        put(...o[0]);
        moved = true;
        break;
      }
    }
    if (moved) continue;
    // rule 3: k regions whose open cells all sit in the same k rows (or columns)
    for (const axis of [0, 1]) {
      for (let k = 1; k <= 3 && !moved; k++) {
        const regionUnits = units.slice(2 * n).filter((u) => !has(u));
        for (const combo of combos(regionUnits, k)) {
          const lines = new Set(combo.flatMap((u) => openIn(u).map((c) => c[axis])));
          if (lines.size !== k) continue;
          const inCombo = new Set(combo.flatMap((u) => u.map(([a, b]) => a * n + b)));
          for (const line of lines)
            for (let t = 0; t < n; t++) {
              const [a, b] = axis === 0 ? [line, t] : [t, line];
              if (open[a][b] && !crown[a][b] && !inCombo.has(a * n + b)) {
                open[a][b] = false;
                moved = true;
              }
            }
          if (moved) {
            used.rule3++;
            break;
          }
        }
      }
      if (moved) break;
    }
    if (moved) continue;
    // rule 4
    for (let i = 0; i < n && !moved; i++)
      for (let j = 0; j < n && !moved; j++)
        if (open[i][j] && !crown[i][j] && starves(i, j)) {
          open[i][j] = false;
          used.rule4++;
          moved = true;
        }
    if (!moved) return { solved: false, ...used, stuck: 'needs a guess' };
  }
  return { solved: false, ...used, stuck: 'too long' };
  function crownsOf() {
    const out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (crown[i][j]) out.push([i, j]);
    return out;
  }
}
function* combos(list, k, start = 0, pick = []) {
  if (pick.length === k) {
    yield pick;
    return;
  }
  for (let i = start; i < list.length; i++) yield* combos(list, k, i + 1, [...pick, list[i]]);
}

// ---- making a puzzle
// Place n crowns that do not touch, grow a region out of each one at random
// until the grid is full, then keep it only if it has one answer and deduction
// reaches it. Harder levels also want rule 3 or 4 to be needed at least once.
export function makePuzzle(level, day) {
  const { n } = LEVELS[level];
  const rand = rng(day * 7919 + n * 104729);
  for (let attempt = 0; attempt < 4000; attempt++) {
    // a crown in every row and column, never in neighbouring columns on neighbouring rows
    const cols = [];
    const used = new Set();
    let ok = true;
    for (let r = 0; r < n && ok; r++) {
      const choices = [];
      for (let c = 0; c < n; c++) if (!used.has(c) && (r === 0 || Math.abs(c - cols[r - 1]) > 1)) choices.push(c);
      if (!choices.length) ok = false;
      else {
        const c = choices[Math.floor(rand() * choices.length)];
        cols.push(c);
        used.add(c);
      }
    }
    if (!ok) continue;
    const regions = Array.from({ length: n }, () => Array(n).fill(-1));
    const frontier = [];
    cols.forEach((c, r) => {
      regions[r][c] = r;
      frontier.push([r, c]);
    });
    let left = n * n - n;
    while (left > 0) {
      const [r, c] = frontier[Math.floor(rand() * frontier.length)];
      const nb = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && regions[a][b] < 0);
      if (!nb.length) {
        frontier.splice(frontier.findIndex(([a, b]) => a === r && b === c), 1);
        continue;
      }
      const [a, b] = nb[Math.floor(rand() * nb.length)];
      regions[a][b] = regions[r][c];
      frontier.push([a, b]);
      left--;
    }
    if (!repair(regions, cols, rand)) continue;
    const d = deduce(regions);
    if (!d.solved) continue;
    const needsMore = d.rule3 + d.rule4;
    if (level === 'medium' && needsMore < 1) continue;
    if (level === 'hard' && needsMore < 3) continue;
    // colour numbers shuffled so region 0 is not always the top row's
    const order = Array.from({ length: n }, (_, i) => i).sort(() => rand() - 0.5);
    const shuffled = regions.map((row) => row.map((g) => order[g]));
    return { level, day, n, regions: shuffled, answer: cols.map((c, r) => [r, c]), attempts: attempt + 1 };
  }
  throw new Error(`No fair ${level} puzzle found for day ${day}`);
}

// ---- results
export function shareText(level, day, seconds, mistakes, hints = 0) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `Crowns ${LEVELS[level].name} #${day}${hints ? ' (with a hint)' : ''}\n👑 ${m}:${s}${mistakes ? ` · ${mistakes} slip${mistakes > 1 ? 's' : ''}` : ' · clean'}`;
}
// A hint (a watched rewarded ad): one answer crown the player has not placed
// yet, top row first. crowns: the player's crowns as [row, col].
export function hintFor(puzzle, crowns) {
  const have = new Set(crowns.map(([r, c]) => `${r},${c}`));
  return puzzle.answer.find(([r, c]) => !have.has(`${r},${c}`)) || null;
}
// stats per level: played, streak, best streak, fastest time
export function record(stats, { day, seconds }) {
  const s = { played: 0, streak: 0, best: 0, fastest: null, lastDay: null, ...stats };
  if (s.lastDay === day) return s;
  s.played++;
  s.streak = s.lastDay === day - 1 ? s.streak + 1 : 1;
  s.best = Math.max(s.best, s.streak);
  s.fastest = s.fastest === null ? seconds : Math.min(s.fastest, seconds);
  s.lastDay = day;
  return s;
}
