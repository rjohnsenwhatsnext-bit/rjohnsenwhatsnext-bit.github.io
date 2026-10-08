// Outback Tiles: levels. Chapter 1, "The Bush Track", is LEVELS[0..9].
// See the top of sim.mjs for what the objective kinds and layer fields mean.
// `goal` is the line the player reads; `limit` is the number it names.

const L = (w, h, dx = 0, dy = 0, holes = []) => ({ w, h, dx, dy, holes });

export const LEVELS = [
  // 1 to 2: free tiles and matching, nothing to lose
  { id: 1, chapter: 1, name: 'First Pair', objective: 'clear', limit: 0, goal: 'Clear every tile',
    faces: 3, shuffles: 3, undos: 5, layers: [L(4, 2)] },
  { id: 2, chapter: 1, name: 'Two Rows', objective: 'clear', limit: 0, goal: 'Clear every tile',
    faces: 4, shuffles: 3, undos: 5, layers: [L(6, 2)] },
  // 3 to 5: stacking, then a shorter goal, then wrong pairs cost you
  { id: 3, chapter: 1, name: 'Stacked Up', objective: 'clear', limit: 0, goal: 'Clear the stack',
    faces: 5, shuffles: 3, undos: 5, layers: [L(6, 2), L(4, 2, 2)] },
  { id: 4, chapter: 1, name: 'Dry Creek', objective: 'target', limit: 9, goal: 'Clear 9 pairs',
    faces: 6, shuffles: 3, undos: 4, layers: [L(6, 4, 0, 0, [[0, 0], [5, 0], [0, 3], [5, 3]]), L(2, 2, 4, 2)] },
  { id: 5, chapter: 1, name: 'Careful Steps', objective: 'mistakes', limit: 3, goal: 'Clear the stack with 3 wrong pairs at most',
    faces: 6, shuffles: 2, undos: 4, layers: [L(6, 3), L(4, 2, 2, 1)] },
  // 6 to 8: those skills together
  { id: 6, chapter: 1, name: 'Quick Smoko', objective: 'turns', limit: 20, goal: 'Clear the stack in 20 tries',
    faces: 7, shuffles: 2, undos: 4, layers: [L(8, 2), L(6, 2, 2), L(2, 2, 6)] },
  { id: 7, chapter: 1, name: 'Gibber Plain', objective: 'clear', limit: 0, goal: 'Clear the stack, one shuffle only',
    faces: 8, shuffles: 1, undos: 4, layers: [L(8, 3, 0, 0, [[3, 1], [4, 1]]), L(6, 2, 2, 1), L(4, 1, 4, 2)] },
  { id: 8, chapter: 1, name: 'Steady Hands', objective: 'mistakes', limit: 2, goal: 'Clear the stack with 2 wrong pairs at most',
    faces: 9, shuffles: 2, undos: 3, layers: [L(8, 4), L(6, 2, 2, 2), L(2, 2, 5, 1)] },
  // 9: preparation challenge, a tight count of tries on a big stack
  { id: 9, chapter: 1, name: 'Red Dust Rush', objective: 'turns', limit: 32, goal: 'Clear the stack in 32 tries',
    faces: 10, shuffles: 1, undos: 3, layers: [L(10, 2), L(8, 2, 2), L(6, 2, 4), L(4, 2, 6)] },
  // 10: finale
  { id: 10, chapter: 1, name: 'Boab Crown', objective: 'mistakes', limit: 5, goal: 'Clear the crown with 5 wrong pairs at most',
    faces: 12, shuffles: 2, undos: 3,
    layers: [L(10, 4, 0, 0, [[0, 0], [9, 0], [0, 3], [9, 3]]), L(8, 2, 2, 2), L(6, 2, 4, 2), L(2, 2, 6, 2)] },
];
