// Tram Queue levels (Claude). Chapter 1, "Town Loop": ten designed levels.
// Trams are [x, y, dir, colour]; colours are 0 to 3. `queue` is what the stop serves, in
// order, one entry per tram (trams already parked in `held` included). `par` is the fewest
// parks the designed solution needs, which the third star asks for. Every level is proven
// winnable by the solver in tests/tram-queue.test.mjs.

export const CHAPTERS = [
  { id: 1, name: 'Town Loop', idea: 'Send trams to the stop in the order the queue wants them.' },
  { id: 2, name: 'Signal Box', idea: 'Closed signals and sleeping trams open once enough trams have been served.' },
  { id: 3, name: 'Closing Gates', idea: 'Gates shut for good once enough trams are served. Send the trams that need them first.' },
  { id: 4, name: 'Pulse Line', idea: 'Pulsing gates shut for a while, then open again. Park before they shut or wait them out.' },
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
  // Chapter 3, "Closing Gates". `shut` is [x, y, n]: open until n trams are served, then shut for good.
  {
    id: 'c3-01', chapter: 3, name: 'Last Call', objective: 'The gate shuts once one tram is served. Park the top tram before it does.',
    w: 3, h: 2, lanes: 1, par: 1, shut: [[2, 0, 1]],
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1]],
    queue: [1, 0],
  },
  {
    id: 'c3-02', chapter: 3, name: 'Rush Hour Gate', objective: 'Clear the front tram, then park the one behind it while the gate is open.',
    w: 4, h: 3, lanes: 2, par: 1, shut: [[3, 0, 2]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 2, 'R', 2]],
    queue: [1, 2, 0],
  },
  {
    id: 'c3-03', chapter: 3, name: 'Shut Behind You', objective: 'The gate sits at the top of the column. Dig out the column before it closes.',
    w: 3, h: 3, lanes: 2, par: 1, shut: [[0, 0, 2]],
    trams: [[0, 2, 'U', 0], [0, 1, 'U', 1], [0, 0, 'U', 2]],
    queue: [2, 0, 1],
  },
  {
    id: 'c3-04', chapter: 3, name: 'Two Shutters', objective: 'Two gates close at different times. Park both trams behind them first.',
    w: 4, h: 3, lanes: 2, par: 2, shut: [[3, 0, 1], [3, 2, 2]],
    trams: [[0, 0, 'R', 0], [0, 2, 'R', 1], [0, 1, 'R', 2]],
    queue: [2, 0, 1],
  },
  {
    id: 'c3-05', chapter: 3, name: 'Narrow Window', objective: 'The sleeper wakes after one tram and its gate shuts after two. Send it in between.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, shut: [[3, 0, 2]], locks: { 0: 1 },
    trams: [[0, 0, 'R', 0], [0, 2, 'R', 1], [1, 2, 'R', 2]],
    queue: [2, 1, 0],
  },
  {
    id: 'c3-06', chapter: 3, name: 'One Lane Shift', objective: 'One lane, one park. Park the top tram, then serve the rest in order.',
    w: 4, h: 3, lanes: 1, par: 1, maxParks: 1, shut: [[3, 0, 2]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 2, 'R', 2], [1, 2, 'R', 3]],
    queue: [1, 3, 2, 0],
  },
  {
    id: 'c3-07', chapter: 3, name: 'Cross Traffic', objective: 'Two trams cross one gate. Park both, then serve the rest as it shuts.',
    w: 4, h: 3, lanes: 2, par: 2, maxParks: 2, shut: [[2, 1, 2]],
    trams: [[0, 1, 'R', 0], [2, 0, 'D', 1], [3, 2, 'L', 2], [3, 0, 'L', 3]],
    queue: [2, 3, 0, 1],
  },
  {
    id: 'c3-08', chapter: 3, name: 'Held Over', objective: 'One lane taken and no parking at all. Send the second tram before the gate shuts.',
    w: 3, h: 2, lanes: 1, par: 0, maxParks: 0, held: [1], shut: [[2, 0, 2]],
    trams: [[1, 0, 'R', 2], [0, 0, 'R', 0], [0, 1, 'R', 0]],
    queue: [2, 0, 1, 0],
  },
  {
    id: 'c3-09', chapter: 3, name: 'Three Rules', objective: 'Two gates and a signal. Serve the bottom row first, then park once.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, shut: [[3, 0, 3], [3, 1, 1]], signals: [[3, 2, 2]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 2, 'R', 2], [0, 1, 'R', 3]],
    queue: [3, 1, 2, 0],
  },
  {
    id: 'c3-10', chapter: 3, name: 'Closing Gates Finale', objective: 'Gate, signal and sleeper together. Park the front tram once to clear the line.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, held: [1], shut: [[3, 0, 3]], signals: [[3, 2, 1]], locks: { 2: 2 },
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 1, 'R', 2], [0, 2, 'R', 0], [3, 1, 'U', 3]],
    queue: [3, 1, 0, 2, 0, 1],
  },
  // Chapter 4, "Pulse Line". `pulses` are [x, y, from, to]: open, shut once `from` trams are served,
  // open again once `to` trams are served.
  {
    id: 'c4-01', chapter: 4, name: 'Pulse Ahead', objective: 'The gate shuts for a moment after the first tram. Park the top tram before it does.',
    w: 3, h: 2, lanes: 2, par: 1, pulses: [[2, 0, 1, 2]],
    trams: [[0, 0, 'R', 2], [2, 1, 'R', 0], [1, 1, 'R', 1]],
    queue: [0, 2, 1],
  },
  {
    id: 'c4-02', chapter: 4, name: 'Back Open', objective: 'The gate shuts, then opens again. Wait it out with no parking.',
    w: 4, h: 2, lanes: 1, par: 0, maxParks: 0, pulses: [[3, 0, 1, 3]],
    trams: [[0, 0, 'R', 1], [1, 1, 'R', 0], [0, 1, 'R', 2], [2, 1, 'R', 3]],
    queue: [3, 0, 2, 1],
  },
  {
    id: 'c4-03', chapter: 4, name: 'Two Pulses', objective: 'Two gates pulse at different times. Park both rows first, then serve the middle tram.',
    w: 4, h: 3, lanes: 2, par: 2, pulses: [[3, 0, 1, 2], [3, 2, 2, 3]],
    trams: [[0, 0, 'R', 0], [0, 2, 'R', 1], [0, 1, 'R', 2]],
    queue: [2, 0, 1],
  },
  {
    id: 'c4-04', chapter: 4, name: 'Pulse Queue', objective: 'One lane, one park. Park the front tram of the top row before the gate shuts.',
    w: 3, h: 2, lanes: 1, par: 1, maxParks: 1, pulses: [[2, 0, 1, 3]],
    trams: [[0, 0, 'R', 0], [1, 0, 'R', 1], [0, 1, 'R', 2], [1, 1, 'R', 3]],
    queue: [3, 1, 2, 0],
  },
  {
    id: 'c4-05', chapter: 4, name: 'Wake and Park', objective: 'The sleeper wakes after one tram, just before its gate shuts. Park it in the gap.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, pulses: [[3, 0, 2, 3]], locks: { 0: 1 },
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1], [0, 2, 'R', 2]],
    queue: [1, 2, 0],
  },
  {
    id: 'c4-06', chapter: 4, name: 'Signal and Pulse', objective: 'A signal opens the top row and a pulse shuts it again. Wait for the pulse to pass.',
    w: 4, h: 3, lanes: 2, par: 0, maxParks: 0, signals: [[1, 0, 1]], pulses: [[3, 0, 2, 3]],
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1], [0, 2, 'R', 2], [1, 2, 'R', 3]],
    queue: [1, 3, 2, 0],
  },
  {
    id: 'c4-07', chapter: 4, name: 'Shut and Pulse', objective: 'One lane, one park. One gate shuts for good and one only pulses. Park for the one that shuts.',
    w: 4, h: 3, lanes: 1, par: 1, maxParks: 1, shut: [[3, 0, 2]], pulses: [[3, 2, 1, 2]],
    trams: [[0, 0, 'R', 0], [0, 2, 'R', 1], [0, 1, 'R', 2], [1, 1, 'R', 3]],
    queue: [3, 2, 1, 0],
  },
  {
    id: 'c4-08', chapter: 4, name: 'Shut From the Start', objective: 'A waiting tram is served at once and the gate is already shut. One lane, no parking.',
    w: 3, h: 2, lanes: 1, par: 0, maxParks: 0, held: [1], pulses: [[2, 0, 1, 3]],
    trams: [[0, 0, 'R', 2], [1, 1, 'R', 0], [0, 1, 'R', 3]],
    queue: [1, 0, 3, 2],
  },
  {
    id: 'c4-09', chapter: 4, name: 'Three Rules Twice', objective: 'A pulse, a closing gate and a signal. Serve one tram, park one, and the rest follow.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, pulses: [[3, 0, 2, 4]], shut: [[3, 1, 3]], signals: [[3, 2, 2]],
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1], [0, 2, 'R', 2], [1, 2, 'R', 3], [1, 1, 'U', 0]],
    queue: [0, 1, 0, 3, 2],
  },
  {
    id: 'c4-10', chapter: 4, name: 'Pulse Line Finale', objective: 'Pulse, closing gate, signal and sleeper together. Park once, after the second tram.',
    w: 4, h: 3, lanes: 2, par: 1, maxParks: 1, held: [0], pulses: [[3, 0, 1, 3]], shut: [[3, 1, 4]], signals: [[2, 2, 2]], locks: { 1: 1 },
    trams: [[0, 0, 'R', 0], [0, 1, 'R', 1], [0, 2, 'R', 2], [3, 2, 'U', 3], [2, 1, 'U', 1]],
    queue: [3, 0, 1, 0, 1, 2],
  },
];
