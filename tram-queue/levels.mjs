// Tram Queue levels (Claude). Chapter 1, "Town Loop": ten designed levels.
// Trams are [x, y, dir, colour]; colours are 0 to 3. `queue` is what the stop serves, in
// order, one entry per tram (trams already parked in `held` included). `par` is the fewest
// parks the designed solution needs, which the third star asks for. Every level is proven
// winnable by the solver in tests/tram-queue.test.mjs.

export const CHAPTERS = [
  { id: 1, name: 'Town Loop', idea: 'Send trams to the stop in the order the queue wants them.' },
  { id: 2, name: 'Signal Box', idea: 'Closed signals and sleeping trams open once enough trams have been served.' },
];

export const LEVELS = [
  {
    id: 'c1-01', chapter: 1, name: 'First Stop', objective: 'Tap each tram in the order of the queue.',
    w: 3, h: 3, lanes: 3, par: 0,
    trams: [[0, 0, 'U', 0], [1, 0, 'U', 1], [2, 0, 'U', 2]],
    queue: [0, 1, 2],
  },
  {
    id: 'c1-02', chapter: 1, name: 'Four Corners', objective: 'Match the colour at the front of the queue.',
    w: 2, h: 2, lanes: 2, par: 0,
    trams: [[0, 0, 'U', 0], [1, 0, 'U', 1], [0, 1, 'D', 2], [1, 1, 'D', 3]],
    queue: [1, 0, 3, 2],
  },
  {
    id: 'c1-03', chapter: 1, name: 'Stuck Behind', objective: 'Trams in the way must park first. Two lanes are enough.',
    w: 3, h: 3, lanes: 2, par: 2,
    trams: [[0, 1, 'R', 0], [1, 1, 'R', 1], [2, 1, 'R', 2]],
    queue: [0, 1, 2],
  },
  {
    id: 'c1-04', chapter: 1, name: 'Two Lines', objective: 'Two rows share one queue. Alternate between them.',
    w: 3, h: 3, lanes: 2, par: 0,
    trams: [[0, 0, 'L', 0], [1, 0, 'L', 1], [2, 0, 'L', 2], [0, 2, 'R', 2], [1, 2, 'R', 1], [2, 2, 'R', 0]],
    queue: [0, 1, 2, 0, 1, 2],
  },
  {
    id: 'c1-05', chapter: 1, name: 'Full Lanes', objective: 'Park three trams and fill every lane, then clear the lot.',
    w: 4, h: 3, lanes: 3, par: 3,
    trams: [[0, 1, 'R', 0], [1, 1, 'R', 1], [2, 1, 'R', 2], [3, 1, 'R', 3]],
    queue: [0, 1, 2, 3],
  },
  {
    id: 'c1-06', chapter: 1, name: 'One Park Only', objective: 'Win with no more than one tram parked.',
    w: 3, h: 3, lanes: 2, par: 1, maxParks: 1,
    trams: [[0, 0, 'L', 0], [1, 0, 'L', 1], [2, 0, 'L', 0], [1, 2, 'R', 1]],
    queue: [1, 1, 0, 0],
  },
  {
    id: 'c1-07', chapter: 1, name: 'Already Waiting', objective: 'A tram is already parked. Do not park a second without a plan.',
    w: 3, h: 3, lanes: 2, par: 0, held: [2],
    trams: [[0, 0, 'L', 0], [1, 0, 'L', 1], [2, 0, 'L', 0], [1, 2, 'D', 1]],
    queue: [1, 0, 1, 2, 0],
  },
  {
    id: 'c1-08', chapter: 1, name: 'Straight Through', objective: 'One lane and no parking at all. Plan both rows.',
    w: 4, h: 3, lanes: 1, par: 0, maxParks: 0,
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [2, 0, 'R', 2], [3, 0, 'R', 3], [0, 2, 'L', 3], [1, 2, 'L', 2], [2, 2, 'L', 1], [3, 2, 'L', 0]],
    queue: [3, 3, 2, 2, 1, 1, 0, 0],
  },
  {
    id: 'c1-09', chapter: 1, name: 'Three Lines', objective: 'Nine trams, two lanes, at most two parks. Choose which rows to hold.',
    w: 3, h: 3, lanes: 2, par: 2, maxParks: 2,
    trams: [[2, 0, 'R', 2], [1, 0, 'R', 1], [0, 0, 'R', 0], [2, 1, 'R', 0], [1, 1, 'R', 2], [0, 1, 'R', 1], [2, 2, 'R', 1], [1, 2, 'R', 0], [0, 2, 'R', 2]],
    queue: [1, 2, 0, 1, 0, 0, 2, 1, 2],
  },
  {
    id: 'c1-10', chapter: 1, name: 'Town Loop Finale', objective: 'Clear the end of line trams first, then park once to finish the loop.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, held: [2],
    trams: [
      [3, 0, 'U', 0], [3, 1, 'U', 0], [3, 2, 'D', 1],
      [2, 0, 'R', 1], [1, 0, 'R', 2], [0, 0, 'R', 0],
      [2, 1, 'R', 0], [1, 1, 'R', 1], [0, 1, 'R', 2],
      [2, 2, 'R', 2], [1, 2, 'R', 0], [0, 2, 'R', 1],
    ],
    queue: [1, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 1, 2],
  },
  // Chapter 2, "Signal Box". `signals` are [x, y, n]: closed until n trams are served.
  // `locks` are { tramIndex: n }: that tram sleeps until n trams are served.
  {
    id: 'c2-01', chapter: 2, name: 'Signal Ahead', objective: 'A red signal blocks the top tram. Serve the other one to open it.',
    w: 3, h: 2, lanes: 2, par: 0, signals: [[1, 0, 1]],
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1]],
    queue: [1, 0],
  },
  {
    id: 'c2-02', chapter: 2, name: 'Two Signals', objective: 'Each signal opens after a different number of trams are served.',
    w: 4, h: 3, lanes: 2, par: 0, signals: [[2, 0, 1], [2, 2, 2]],
    trams: [[0, 0, 'R', 0], [0, 2, 'R', 1], [0, 1, 'R', 2]],
    queue: [2, 0, 1],
  },
  {
    id: 'c2-03', chapter: 2, name: 'Behind the Signal', objective: 'The signal opens, but a tram is still in front. Park it once.',
    w: 4, h: 2, lanes: 2, par: 1, signals: [[3, 0, 1]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 1, 'L', 2]],
    queue: [2, 0, 1],
  },
  {
    id: 'c2-04', chapter: 2, name: 'Sleeper', objective: 'The left tram is asleep until two trams are served.',
    w: 3, h: 3, lanes: 2, par: 0, locks: { 0: 2 },
    trams: [[0, 0, 'U', 0], [1, 0, 'U', 1], [2, 0, 'U', 2]],
    queue: [1, 2, 0],
  },
  {
    id: 'c2-05', chapter: 2, name: 'Wake Up Call', objective: 'Two sleepers wake at different times. Serve in the right order.',
    w: 4, h: 2, lanes: 2, par: 0, locks: { 0: 2, 1: 1 },
    trams: [[0, 0, 'U', 0], [1, 0, 'U', 1], [2, 0, 'U', 2], [3, 0, 'U', 3]],
    queue: [3, 1, 0, 2],
  },
  {
    id: 'c2-06', chapter: 2, name: 'Signal and Sleeper', objective: 'A signal and a sleeper both wait on the first tram. Park one to finish.',
    w: 4, h: 3, lanes: 2, par: 1, signals: [[2, 1, 1]], locks: { 2: 1 },
    trams: [[0, 1, 'R', 0], [1, 1, 'R', 1], [3, 0, 'D', 2], [1, 2, 'L', 3]],
    queue: [3, 2, 0, 1],
  },
  {
    id: 'c2-07', chapter: 2, name: 'One Lane Crossing', objective: 'One lane and one park. Open the signal first.',
    w: 3, h: 3, lanes: 1, par: 1, maxParks: 1, signals: [[2, 0, 1]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 2, 'L', 2], [1, 2, 'L', 3]],
    queue: [2, 0, 1, 3],
  },
  {
    id: 'c2-08', chapter: 2, name: 'Two Gates', objective: 'Two signals open together after two trams. Find the two that unlock them.',
    w: 4, h: 3, lanes: 2, par: 1, signals: [[3, 0, 2], [3, 2, 2]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 2, 'R', 2], [1, 2, 'R', 3], [2, 1, 'U', 3], [3, 1, 'R', 0]],
    queue: [3, 0, 1, 0, 2, 3],
  },
  {
    id: 'c2-09', chapter: 2, name: 'Late Shift', objective: 'Dig through the column with exactly two parks, then wake the sleeper.',
    w: 4, h: 3, lanes: 2, par: 2, maxParks: 2, locks: { 3: 1 },
    trams: [[0, 0, 'D', 0], [0, 1, 'D', 1], [0, 2, 'D', 2], [1, 0, 'U', 3], [3, 1, 'R', 3]],
    queue: [3, 0, 3, 1, 2],
  },
  {
    id: 'c2-10', chapter: 2, name: 'Signal Box Finale', objective: 'Wake the sleeper, open the signal and park once to clear the box.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, held: [1], signals: [[3, 0, 2]], locks: { 2: 1 },
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 1, 'R', 2], [2, 1, 'U', 3], [0, 2, 'L', 0], [1, 2, 'L', 3]],
    queue: [0, 3, 3, 1, 2, 0, 1],
  },
];
