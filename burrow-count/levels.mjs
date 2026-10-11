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
import { neighbours, lineCells, jumpCells, solve } from './sim.mjs';

function build(chapter, n, name, objective, lives, drawing) {
  const rows = drawing.length, cols = drawing[0].length, flat = drawing.join('');
  const letters = [...new Set(flat.toLowerCase().replace(/[.*+~]/g, ''))];
  const isClue = (ch) => ch === '.' || ch === '*' || ch === '+' || ch === '~';
  const level = {
    id: `c${chapter}-${String(n).padStart(2, '0')}`, chapter, name, objective, lives, rows, cols,
    regionCount: letters.length,
    region: [...flat].map((ch) => (isClue(ch) ? -1 : letters.indexOf(ch.toLowerCase()))),
    solution: Array(letters.length).fill(-1), clues: [], extraClues: 0,
  };
  [...flat].forEach((ch, i) => { if (!isClue(ch) && ch === ch.toUpperCase()) level.solution[level.region[i]] = i; });
  if (level.solution.includes(-1)) throw new Error(`${level.id}: every region needs exactly one capital`);
  const addClue = (i, reach = 1, line = false, jump = false) => {
    const hit = new Set(level.solution), r = (i / cols) | 0, c = i % cols;
    const cells = jump ? jumpCells(level, r, c) : line ? lineCells(level, r, c) : neighbours(level, i, reach);
    const k = { r, c, n: cells.filter((j) => hit.has(j)).length };
    if (reach > 1) k.reach = reach; // wide clue, see the top of sim.mjs
    if (line) k.line = true; // line clue, see the top of sim.mjs
    if (jump) k.jump = true; // jump clue, see the top of sim.mjs
    level.clues.push(k);
  };
  [...flat].forEach((ch, i) => { if (isClue(ch)) addClue(i, ch === '*' ? 2 : 1, ch === '+', ch === '~'); });
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

  // Chapter 2 teaches the wide clue, drawn '*': it counts every critter within 2 steps.
  build(2, 1, 'Wide Eyes', 'Meet the wide clue: it counts critters two steps away', 5, [
    'aAabb',
    'a.*bB',
    'cCcdd',
    'ccddD',
    'ccdd.',
  ]),
  build(2, 2, 'Long Sight', 'A wide clue in the corner reaches a long way', 5, [
    '*aaAb',
    'aabbB',
    'ccdd.',
    'CcdDd',
    '.ccdd',
  ]),
  build(2, 3, 'Two Lookouts', 'Two wide clues watch the same board', 4, [
    'aAab*b',
    'a.bbBb',
    'ccdD.d',
    'Cc*dee',
    'cceEee',
  ]),
  build(2, 4, 'Mixed Signals', 'Close clues and wide clues side by side', 4, [
    'aaAbb*',
    'a.bbBb',
    'ccd.dd',
    'Cc*dDe',
    'ffeeeE',
    'fFfe.e',
  ]),
  build(2, 5, 'Corner Watch', 'Wide clues in the corners of a six by six board', 4, [
    '*aAabb',
    'aab.bB',
    'cCcddb',
    'cc*dDd',
    'eeffd.',
    'EefFff',
  ]),
  build(2, 6, 'Near And Far', 'Use the close clues to make sense of the wide one', 3, [
    'aAa.bb',
    'a*bbBc',
    'ddbc.c',
    'DdeCcc',
    '.eeeff',
    'eEefFf',
  ]),
  build(2, 7, 'Long Corridor', 'Seven regions down a narrow board', 3, [
    'aAab*b',
    'a.bbBc',
    'dd.ccC',
    'dDe*cc',
    'ffeEee',
    'Ff.gGg',
    'ffggg.',
  ]),
  build(2, 8, 'Wide Awake', 'Three wide clues and eight regions', 3, [
    'aAab*bb',
    'a.cbBdd',
    'ccC.*dd',
    'eeeD.ff',
    'e*egFgf',
    'EeggGgf',
    'hhhHh.f',
  ]),
  build(2, 9, 'Steady Hands', 'Very few clues to start with: let the wide ones lead', 3, [
    'aaAabbb',
    'cacb*bB',
    'cccddbd',
    'CcedDde',
    'eeEeeff',
    'g*gfFff',
    'Ggg.fff',
  ]),
  build(2, 10, 'The Long Tunnel', 'The finale: nine regions and wide clues to read them by', 3, [
    'aAa*bbc',
    'a.bbBcc',
    'ddbc.cC',
    'dD.eeec',
    'ff*eEgg',
    'Ffh.ggG',
    'hhHh*ii',
    'hhhhiIi',
  ]),

  // Chapter 3 teaches the line clue, drawn '+': it counts every critter in its row and column.
  build(3, 1, 'Crossroads', 'Meet the line clue: it counts its whole row and column', 5, [
    'aAab',
    '+bbB',
    'cCcd',
    'ccdD',
  ]),
  build(3, 2, 'Straight Lines', 'Two lines cross the board, so read both ways', 5, [
    'aAabb',
    'a+bbB',
    'cCcdd',
    'ee+dD',
    'Eeedd',
  ]),
  build(3, 3, 'Two Lines', 'A corner line and a middle line together', 4, [
    '+aAbb',
    'ca.bB',
    'CcddD',
    'ceeed',
    'ee+Ed',
  ]),
  build(3, 4, 'Corner Cross', 'A line from the corner of a six by six board', 4, [
    '+aaAbb',
    'cabbBb',
    'cC.ddb',
    'eeddDf',
    'Eefff.',
    'eefFf+',
  ]),
  build(3, 5, 'Column Watch', 'Lines in the middle of the board see a long way', 4, [
    'aaAbbb',
    'a+bbBc',
    'dd.ccC',
    'DdeeEc',
    'ffe+ec',
    'fFfeee',
  ]),
  build(3, 6, 'Lines And Lookouts', 'Mix line clues with a wide clue and close clues', 3, [
    'aAa*bb',
    'a+bbBc',
    'ddbcCc',
    'Dd.eec',
    'ffeEe+',
    'Ffffee',
  ]),
  build(3, 7, 'Three Ways', 'Close, wide and line clues on a wider board', 3, [
    'aAab+bb',
    'a.cbBdd',
    'cCcc*dd',
    'eefdDdg',
    'EefffgG',
    'e+fFfgg',
  ]),
  build(3, 8, 'Cross And Wide', 'Eight regions and three kinds of clue', 3, [
    'aAab+bb',
    'a.cbBcc',
    'ddCc*ee',
    'dDffeee',
    'ggf+fEe',
    'GgfFhhh',
    'g+hhHh.',
  ]),
  build(3, 9, 'Quiet Crossing', 'Only two lines to start with: let them lead', 3, [
    'aaAabbb',
    'cabdbBd',
    'CccdddD',
    'ceeffd+',
    'eEefffg',
    'ee+fFgg',
    'eeffggG',
  ]),
  build(3, 10, 'The Great Crossing', 'The finale: nine regions and every kind of clue', 3, [
    'aAa*bbcc',
    'a.bbBcCc',
    'ddb+ccee',
    'DdfffEee',
    'gdf*fhhe',
    'ggFfhHhi',
    'Gg+hiiiI',
    'gghhiiii',
  ]),

  // Chapter 4 teaches the jump clue, drawn '~': it counts every critter a knight's move away.
  build(4, 1, 'Hop Over', 'Meet the jump clue: it counts critters a knight move away', 5, [
    'aAabb',
    'ab~bB',
    'cCcdd',
    'ccddD',
    '~cddd',
  ]),
  build(4, 2, 'Two Hops', 'Two jump clues watch opposite sides of the board', 5, [
    '~aAab',
    'aabbB',
    'cc~dd',
    'CcddD',
    'ccdd.',
  ]),
  build(4, 3, 'Corner Hops', 'Jump clues in the corners reach into the middle', 4, [
    'aAab~',
    'abbbB',
    'ccd~d',
    'CcdDe',
    '~ceEe',
  ]),
  build(4, 4, 'Skip And Touch', 'Jump clues and close clues on a six by six board', 4, [
    'aAabbb',
    'a.bbBc',
    'ddb~cC',
    'Ddeeec',
    'ffeEe~',
    'Ffffee',
  ]),
  build(4, 5, 'Centre Leap', 'A jump clue in the middle of the board sees eight cells', 4, [
    'aaAabb',
    'cabbBb',
    'cC~ddb',
    'ceeDd.',
    'EeffdF',
    'eefff~',
  ]),
  build(4, 6, 'Hops And Looks', 'Mix jump, wide, line and close clues', 3, [
    'aAab~b',
    'a.bbBc',
    'dd*cCc',
    'Dddeec',
    'ffeEe+',
    'Ffffee',
  ]),
  build(4, 7, 'Long Jump', 'Seven regions on a wider board', 3, [
    'aAabb~b',
    'a.cbBdd',
    'ccC~.dd',
    'eefdDdg',
    'EefffgG',
    'e+fFfgg',
  ]),
  build(4, 8, 'Hop Scotch', 'Eight regions and four kinds of clue', 3, [
    'aAabb~b',
    'a.cbBcc',
    'ddCc*ee',
    'dDffeee',
    'ggf~fEe',
    'GgfFhhh',
    'g+hhHh.',
  ]),
  build(4, 9, 'Quiet Leap', 'Only a few clues to start with: let the hops lead', 3, [
    'aaAabbb',
    'cabdbBd',
    'CccdddD',
    'ceeff~d',
    'eEefffg',
    'ee~fFgg',
    'eeffggG',
  ]),
  build(4, 10, 'The Great Leap', 'The finale: nine regions and every kind of clue', 3, [
    'aAab*bcc',
    'a.bbBcCc',
    'ddb~ccee',
    'DdfffEee',
    'gdf+fhhe',
    'ggFfhHhi',
    'Gg~hiiiI',
    'gghhiiii',
  ]),
];
