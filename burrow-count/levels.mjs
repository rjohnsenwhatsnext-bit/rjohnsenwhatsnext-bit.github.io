// Burrow Count: the levels (Claude). Chapter 1 teaches the neighbour clue.
//
// Each level is drawn as text. One letter per region (the letter is only a label);
// a CAPITAL marks the cell that holds the region's critter in the answer; '.' is a
// clue cell. Clue numbers are worked out from the answer, never typed in.
//
// Uniqueness is guaranteed, not hoped for: if a drawing still has more than one
// answer, the first cell where another answer differs is turned into one more clue
// cell (which only removes cells that are not in our answer) until one answer is left.
// `extraClues` says how many were needed; the tests prove every level has exactly one.
import { neighbours, solve } from './sim.mjs';

function build(chapter, n, name, objective, lives, drawing) {
  const rows = drawing.length, cols = drawing[0].length, flat = drawing.join('');
  const letters = [...new Set(flat.toLowerCase().replace(/\./g, ''))];
  const level = {
    id: `c${chapter}-${String(n).padStart(2, '0')}`, chapter, name, objective, lives, rows, cols,
    regionCount: letters.length,
    region: [...flat].map((ch) => (ch === '.' ? -1 : letters.indexOf(ch.toLowerCase()))),
    solution: Array(letters.length).fill(-1), clues: [], extraClues: 0,
  };
  [...flat].forEach((ch, i) => { if (ch !== '.' && ch === ch.toUpperCase()) level.solution[level.region[i]] = i; });
  if (level.solution.includes(-1)) throw new Error(`${level.id}: every region needs exactly one capital`);
  const addClue = (i) => {
    const hit = new Set(level.solution);
    level.clues.push({ r: (i / cols) | 0, c: i % cols, n: neighbours(level, i).filter((j) => hit.has(j)).length });
  };
  level.region.forEach((g, i) => { if (g < 0) addClue(i); });
  for (;;) {
    const found = solve(level, 2);
    if (!found.length) throw new Error(`${level.id}: no answer`);
    const other = found.find((f) => f.some((cell, g) => cell !== level.solution[g]));
    if (!other) break;
    const cell = other.find((c, g) => c !== level.solution[g]);
    level.region[cell] = -1;
    addClue(cell);
    level.extraClues++;
  }
  return level;
}

export const LEVELS = [
  build(1, 1, 'First Burrow', 'Place 3 critters so the clue matches', 5, [
    'Aab',
    '.bB',
    'cCc',
  ]),
  build(1, 2, 'Four Corners', 'Place 4 critters, one in each colour', 5, [
    'aAab',
    '.cbB',
    'cCcd',
    '.dDd',
  ]),
  build(1, 3, 'The Middle Ground', 'Use the clues in the middle of the board', 4, [
    'aAbb',
    'a..B',
    'C..d',
    'ccDd',
  ]),
  build(1, 4, 'One Per Row', 'Five rows, five critters', 4, [
    'a.aAa',
    'bB.bb',
    'ccc.C',
    'd.Ddd',
    'Ee.ee',
  ]),
  build(1, 5, 'Jigsaw', 'Fit five odd shapes together', 3, [
    'aaabB',
    'A.ccb',
    'dCc.b',
    'ddeEe',
    'Deee.',
  ]),
  build(1, 6, 'The Lone Burrow', 'Ring around the middle: use the clues to place the rest', 3, [
    'aA.bb',
    'aCccb',
    'dcEcb',
    'dcccB',
    'dD.bb',
  ]),
  build(1, 7, 'Six Blocks', 'Six blocks, six critters', 3, [
    'aAabbb',
    'a.abBb',
    'Cccd.d',
    'c.cddD',
    'eeEf.f',
    'eeeFff',
  ]),
  build(1, 8, 'Diagonal Tunnels', 'Follow the tunnels that run corner to corner', 3, [
    'aaabCd',
    'A.bcde',
    'aBcdef',
    'bc.efF',
    'cDef.f',
    'dEffff',
  ]),
  build(1, 9, 'Hold Your Nerve', 'Few clues to start with, so be patient and work from the clues you have', 3, [
    'aaAabb',
    'cadDdb',
    'cceedB',
    'cEefdb',
    'C.fffb',
    'cc.fFb',
  ]),
  build(1, 10, 'The Great Burrow', 'The finale: three rings and one deep chamber', 3, [
    'aa.abb',
    'addeeB',
    'aDf.eb',
    'AdFfec',
    'ad.eEc',
    'cccCcc',
  ]),
];
