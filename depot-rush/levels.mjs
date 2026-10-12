// Depot Rush: levels (Claude). Chapter 1, "Morning Depot": learn the bays.
// Buses are front first in each lane. See sim.mjs for the level shape.
// Colours: r red, b blue, g green, y yellow.

export const CHAPTERS = [{ id: 1, name: 'Morning Depot', blocker: 'Limited bays' }];

export const LEVELS = [
  { id: 'c1-01', chapter: 1, name: 'First Stop', objective: 'Tap a bus to send it to the passengers of its colour.',
    bays: 2, seats: 2, par: 2, lanes: [['r'], ['b']], queue: 'rr bb' },
  { id: 'c1-02', chapter: 1, name: 'Right Order', objective: 'One bay only: send the bus that matches the front of the line.',
    bays: 1, seats: 2, par: 2, lanes: [['b'], ['r']], queue: 'rr bb' },
  { id: 'c1-03', chapter: 1, name: 'Two Deep', objective: 'Buses wait behind each other. Clear the line in the order it arrives.',
    bays: 2, seats: 2, par: 4, lanes: [['r', 'b'], ['g', 'r']], queue: 'rr gg bb rr' },
  { id: 'c1-04', chapter: 1, name: 'Full House', objective: 'Buses have different seat counts. Fill every seat.',
    bays: 2, seats: 2, par: 4, lanes: [['r3'], ['b1', 'r1'], ['b2']], queue: 'rrr bbb r' },
  { id: 'c1-05', chapter: 1, name: 'Single Bay', objective: 'Six buses, one bay. Every tap must match the line.',
    bays: 1, seats: 2, par: 6, lanes: [['r', 'g'], ['g', 'b'], ['b', 'r']], queue: 'rr gg bb gg bb rr' },
  { id: 'c1-06', chapter: 1, name: 'Spare Buses', objective: 'Some buses are not needed. Finish within 5 taps.',
    bays: 2, seats: 2, par: 4, maxTaps: 5, lanes: [['g', 'y', 'r'], ['b', 'g'], ['r']], queue: 'yy rr bb' },
  { id: 'c1-07', chapter: 1, name: 'Rush Hour', objective: 'Four lanes, two bays. Plan which lane to open next.',
    bays: 2, seats: 2, par: 8, lanes: [['r', 'g'], ['g', 'b'], ['b', 'y'], ['y', 'r']], queue: 'rr bb yy gg yy rr gg bb' },
  { id: 'c1-08', chapter: 1, name: 'Mixed Fleet', objective: 'Small and big buses together. Match seats to the crowd.',
    bays: 2, seats: 2, par: 8, lanes: [['b3', 'r1'], ['g2', 'b1'], ['r2', 'y2'], ['y1', 'g1']], queue: 'bbb gg b rrr yyy g' },
  { id: 'c1-09', chapter: 1, name: 'Nine Buses', objective: 'Three lanes of three and no spare bay. Think before you tap.',
    bays: 2, seats: 2, par: 9, lanes: [['g', 'y', 'r'], ['b', 'g', 'y'], ['r', 'b', 'g']], queue: 'gg rr bb bb yy gg gg yy rr' },
  { id: 'c1-10', chapter: 1, name: 'Grand Terminal', objective: 'Twelve buses, four lanes. Park them all to open chapter 2.',
    bays: 2, seats: 2, par: 12, lanes: [['r', 'b', 'g'], ['y', 'r', 'b'], ['g', 'y', 'r'], ['b', 'g', 'y']],
    queue: 'rr bb gg yy rr bb gg yy rr bb gg yy' },
];
