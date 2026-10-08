// Chapter 1: Loose Ends. LEVELS[0..9]. Each board is built in reverse from its own seed, so it always clears.
// lives / maxTaps null means no limit. A blocked tap costs a life and counts as a tap.
export const CHAPTERS = [{ id: 1, name: 'Loose Ends' }, { id: 2, name: 'Rocks and Ice' }, { id: 3, name: 'Keys and Order' }, { id: 4, name: 'Twin Tracks' }];

export const LEVELS = [
  { id: 1, chapter: 1, name: 'First Slide', objective: 'Tap each line to slide it out', w: 4, h: 4, count: 3, minLen: 2, maxLen: 3, seed: 101, lives: null, maxTaps: null },
  { id: 2, chapter: 1, name: 'Wide Open', objective: 'Clear the board, no limits', w: 5, h: 5, count: 5, minLen: 2, maxLen: 4, seed: 202, lives: null, maxTaps: null },
  { id: 3, chapter: 1, name: 'Ins and Outs', objective: 'Clear the board. Blocked lines show what is in their way', w: 5, h: 6, count: 7, minLen: 2, maxLen: 4, seed: 303, lives: null, maxTaps: null },
  { id: 4, chapter: 1, name: 'Long Haul', objective: 'Clear the board of long lines', w: 6, h: 6, count: 7, minLen: 4, maxLen: 6, seed: 404, lives: null, maxTaps: null },
  { id: 5, chapter: 1, name: 'Tight Squeeze', objective: 'Clear a crowded board', w: 6, h: 7, count: 11, minLen: 2, maxLen: 4, seed: 505, lives: null, maxTaps: null },
  { id: 6, chapter: 1, name: 'Three Lives', objective: 'Clear the board with 3 lives. A blocked tap costs one', w: 6, h: 7, count: 11, minLen: 2, maxLen: 5, seed: 606, lives: 3, maxTaps: null },
  { id: 7, chapter: 1, name: 'Short Hops', objective: 'Clear many short lines with 3 lives', w: 7, h: 7, count: 16, minLen: 1, maxLen: 3, seed: 707, lives: 3, maxTaps: null },
  { id: 8, chapter: 1, name: 'Tap Budget', objective: 'Clear within 16 taps', w: 7, h: 8, count: 14, minLen: 2, maxLen: 5, seed: 808, lives: 4, maxTaps: 16 },
  { id: 9, chapter: 1, name: 'No Slips', objective: 'Clear a dense board with 1 life, so plan every tap', w: 7, h: 9, count: 18, minLen: 2, maxLen: 5, seed: 909, lives: 1, maxTaps: null },
  { id: 10, chapter: 1, name: 'Big Untangle', objective: 'Finale: clear the biggest board within 26 taps and 2 lives', w: 8, h: 9, count: 22, minLen: 2, maxLen: 6, seed: 1010, lives: 2, maxTaps: 26 },
  // Chapter 2: Rocks and Ice. LEVELS[10..19]. New rules: rocks (never move, always block), frozen lines
  // (first tap thaws, second slides), timeLimit (ticks, 60 a second). See the top of sim.mjs.
  { id: 11, chapter: 2, name: 'Rock Garden', objective: 'Rocks never move. Slide the lines that miss them', w: 5, h: 6, count: 5, minLen: 2, maxLen: 3, rocks: 2, seed: 1111, lives: null, maxTaps: null },
  { id: 12, chapter: 2, name: 'Stonewalled', objective: 'Clear a board scattered with rocks', w: 6, h: 6, count: 7, minLen: 2, maxLen: 4, rocks: 5, seed: 1212, lives: null, maxTaps: null },
  { id: 13, chapter: 2, name: 'First Frost', objective: 'Frozen lines need two taps: one to thaw, one to slide', w: 5, h: 6, count: 6, minLen: 2, maxLen: 3, frozen: 2, seed: 1313, lives: null, maxTaps: null },
  { id: 14, chapter: 2, name: 'Deep Freeze', objective: 'Thaw and clear a board of ice with 4 lives', w: 6, h: 7, count: 9, minLen: 2, maxLen: 4, frozen: 5, seed: 1414, lives: 4, maxTaps: null },
  { id: 15, chapter: 2, name: 'Frozen Ground', objective: 'Rocks and ice together, 3 lives', w: 6, h: 7, count: 9, minLen: 2, maxLen: 4, rocks: 4, frozen: 3, seed: 1515, lives: 3, maxTaps: null },
  { id: 16, chapter: 2, name: 'Quarry Run', objective: 'Wind through a rocky quarry with 3 lives', w: 7, h: 7, count: 12, minLen: 2, maxLen: 4, rocks: 6, seed: 1616, lives: 3, maxTaps: null },
  { id: 17, chapter: 2, name: 'Cold Snap', objective: 'Clear icy lines within 17 taps, thawing included', w: 7, h: 7, count: 11, minLen: 2, maxLen: 4, frozen: 5, seed: 1717, lives: 3, maxTaps: 17 },
  { id: 18, chapter: 2, name: 'Beat the Clock', objective: 'Clear the rocky board in 30 seconds', w: 6, h: 7, count: 10, minLen: 2, maxLen: 4, rocks: 3, timeLimit: 1800, seed: 1818, lives: null, maxTaps: null },
  { id: 19, chapter: 2, name: 'Thaw Plan', objective: 'Plan the thaws: rocks and ice within 21 taps and 3 lives', w: 7, h: 8, count: 14, minLen: 2, maxLen: 4, rocks: 5, frozen: 5, seed: 1919, lives: 3, maxTaps: 21 },
  { id: 20, chapter: 2, name: 'Glacier Pass', objective: 'Finale: rocks, ice and a clock. 27 taps, 2 lives, 50 seconds', w: 8, h: 9, count: 18, minLen: 2, maxLen: 5, rocks: 8, frozen: 7, timeLimit: 3000, seed: 2020, lives: 2, maxTaps: 27 },
  // Chapter 3: Keys and Order. LEVELS[20..29]. New rules: numbered lines (clear in number order) and locked
  // lines (open once their key line is out). See the top of sim.mjs.
  { id: 21, chapter: 3, name: 'Number One', objective: 'Numbered lines slide out in order, 1 first', w: 5, h: 6, count: 6, minLen: 2, maxLen: 3, numbered: 3, seed: 2121, lives: null, maxTaps: null },
  { id: 22, chapter: 3, name: 'In Order', objective: 'Follow the numbers on a wider board', w: 6, h: 6, count: 8, minLen: 2, maxLen: 4, numbered: 5, seed: 2222, lives: null, maxTaps: null },
  { id: 23, chapter: 3, name: 'First Lock', objective: 'A locked line opens when its key line slides out', w: 5, h: 6, count: 6, minLen: 2, maxLen: 3, locked: 2, seed: 2323, lives: null, maxTaps: null },
  { id: 24, chapter: 3, name: 'Key Ring', objective: 'Find each key and open every lock with 4 lives', w: 6, h: 7, count: 9, minLen: 2, maxLen: 4, locked: 4, seed: 2424, lives: 4, maxTaps: null },
  { id: 25, chapter: 3, name: 'Lock and Count', objective: 'Numbers and locks together, 3 lives', w: 6, h: 7, count: 9, minLen: 2, maxLen: 4, numbered: 3, locked: 2, seed: 2525, lives: 3, maxTaps: null },
  { id: 26, chapter: 3, name: 'Numbered Ice', objective: 'Numbers and ice within 15 taps and 3 lives', w: 6, h: 7, count: 10, minLen: 2, maxLen: 4, numbered: 4, frozen: 3, seed: 2626, lives: 3, maxTaps: 15 },
  { id: 27, chapter: 3, name: 'Locked Quarry', objective: 'Open the locks among the rocks with 3 lives', w: 7, h: 7, count: 12, minLen: 2, maxLen: 4, locked: 3, rocks: 5, seed: 2727, lives: 3, maxTaps: null },
  { id: 28, chapter: 3, name: 'Count Down', objective: 'Follow the numbers in 40 seconds', w: 7, h: 7, count: 12, minLen: 2, maxLen: 4, numbered: 5, rocks: 3, timeLimit: 2400, seed: 2828, lives: null, maxTaps: null },
  { id: 29, chapter: 3, name: 'Vault Plan', objective: 'Numbers, locks and ice within 19 taps and 2 lives', w: 7, h: 8, count: 14, minLen: 2, maxLen: 4, numbered: 4, locked: 4, frozen: 3, seed: 2929, lives: 2, maxTaps: 19 },
  { id: 30, chapter: 3, name: 'Master Lock', objective: 'Finale: numbers, locks, ice, rocks and a clock. 24 taps, 2 lives, 50 seconds', w: 8, h: 9, count: 18, minLen: 2, maxLen: 5, numbered: 6, locked: 5, frozen: 4, rocks: 5, timeLimit: 3000, seed: 3030, lives: 2, maxTaps: 24 },
  // Chapter 4: Twin Tracks. LEVELS[30..39]. New rule: linked pairs, two lines that slide out together on one tap
  // and only when both paths are clear. See the top of sim.mjs.
  { id: 31, chapter: 4, name: 'Twin Pair', objective: 'Linked lines slide out together with one tap', w: 5, h: 6, count: 6, minLen: 2, maxLen: 3, linked: 1, seed: 3131, lives: null, maxTaps: null },
  { id: 32, chapter: 4, name: 'Two Pairs', objective: 'Both lines of a pair need a clear path', w: 6, h: 6, count: 8, minLen: 2, maxLen: 4, linked: 2, seed: 3232, lives: null, maxTaps: null },
  { id: 33, chapter: 4, name: 'Tag Team', objective: 'Three linked pairs on a taller board, 4 lives', w: 6, h: 7, count: 9, minLen: 2, maxLen: 4, linked: 3, seed: 3333, lives: 4, maxTaps: null },
  { id: 34, chapter: 4, name: 'Stone Twins', objective: 'Linked pairs among the rocks, 3 lives', w: 6, h: 7, count: 10, minLen: 2, maxLen: 4, linked: 2, rocks: 3, seed: 3434, lives: 3, maxTaps: null },
  { id: 35, chapter: 4, name: 'Double Trouble', objective: 'Find the partner that is stuck, 3 lives', w: 7, h: 7, count: 12, minLen: 2, maxLen: 4, linked: 3, rocks: 4, seed: 3535, lives: 3, maxTaps: null },
  { id: 36, chapter: 4, name: 'Quick Pairs', objective: 'Slide the pairs in 40 seconds', w: 7, h: 7, count: 12, minLen: 1, maxLen: 3, linked: 3, timeLimit: 2400, seed: 3636, lives: null, maxTaps: null },
  { id: 37, chapter: 4, name: 'Pair Budget', objective: 'Clear linked lines within 14 taps and 3 lives', w: 7, h: 8, count: 14, minLen: 2, maxLen: 4, linked: 4, seed: 3737, lives: 3, maxTaps: 14 },
  { id: 38, chapter: 4, name: 'Crowded Twins', objective: 'Five pairs and rocks, 2 lives. Plan the order', w: 7, h: 8, count: 14, minLen: 2, maxLen: 4, linked: 5, rocks: 4, seed: 3838, lives: 2, maxTaps: null },
  { id: 39, chapter: 4, name: 'Pair Plan', objective: 'Plan the pairs: rocks, 14 taps, 2 lives and 45 seconds', w: 7, h: 9, count: 16, minLen: 2, maxLen: 4, linked: 5, rocks: 4, timeLimit: 2700, seed: 3939, lives: 2, maxTaps: 14 },
  { id: 40, chapter: 4, name: 'Twin Peaks', objective: 'Finale: six pairs, rocks and a clock. 18 taps, 2 lives, 50 seconds', w: 8, h: 9, count: 20, minLen: 2, maxLen: 5, linked: 6, rocks: 6, timeLimit: 3000, seed: 4040, lives: 2, maxTaps: 18 },
];
