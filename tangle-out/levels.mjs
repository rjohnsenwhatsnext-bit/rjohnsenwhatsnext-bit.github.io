// Chapter 1: Loose Ends. LEVELS[0..9]. Each board is built in reverse from its own seed, so it always clears.
// lives / maxTaps null means no limit. A blocked tap costs a life and counts as a tap.
export const CHAPTERS = [{ id: 1, name: 'Loose Ends' }];

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
];
