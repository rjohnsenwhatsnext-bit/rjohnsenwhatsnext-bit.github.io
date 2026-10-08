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

  // Chapter 2, "The Red Centre", is LEVELS[10..19]. New: gold objective and starting hints.
  // 11 to 12: gold nuggets, clear only those
  { id: 11, chapter: 2, name: 'First Nugget', objective: 'gold', gold: 2, limit: 0, goal: 'Clear every gold tile',
    faces: 6, hints: 2, shuffles: 3, undos: 4, layers: [L(6, 2), L(2, 2, 4)] },
  { id: 12, chapter: 2, name: 'Spinifex Flat', objective: 'gold', gold: 3, limit: 0, goal: 'Clear every gold tile',
    faces: 7, hints: 2, shuffles: 3, undos: 4, layers: [L(8, 2), L(6, 2, 2, 1)] },
  // 13 to 15: a ring layout, a careful stack, then a deep gold seam
  { id: 13, chapter: 2, name: 'Salt Pan', objective: 'clear', limit: 0, goal: 'Clear the ring',
    faces: 8, hints: 2, shuffles: 3, undos: 4, layers: [L(6, 4, 0, 0, [[2, 1], [3, 1], [2, 2], [3, 2]]), L(2, 2, 2, 1)] },
  { id: 14, chapter: 2, name: 'Ironbark', objective: 'mistakes', limit: 4, goal: 'Clear the stack with 4 wrong pairs at most',
    faces: 9, hints: 1, shuffles: 2, undos: 3, layers: [L(8, 3), L(6, 2, 2, 1)] },
  { id: 15, chapter: 2, name: 'Gold Seam', objective: 'gold', gold: 4, limit: 0, goal: 'Clear every gold tile',
    faces: 8, hints: 1, shuffles: 2, undos: 3, layers: [L(8, 4), L(6, 2, 2, 1), L(4, 2, 2, 3)] },
  // 16 to 18: gold, tries and a pair target together
  { id: 16, chapter: 2, name: 'Mirage', objective: 'turns', limit: 26, goal: 'Clear the stack in 26 tries',
    faces: 10, hints: 1, shuffles: 2, undos: 3, layers: [L(8, 2), L(6, 2, 2), L(4, 2, 4)] },
  { id: 17, chapter: 2, name: 'Billabong', objective: 'gold', gold: 5, limit: 0, goal: 'Clear every gold tile',
    faces: 9, hints: 1, shuffles: 2, undos: 3, layers: [L(10, 3, 0, 0, [[4, 1], [5, 1]]), L(6, 2, 2, 1)] },
  { id: 18, chapter: 2, name: 'Dune Crossing', objective: 'target', limit: 18, goal: 'Clear 18 pairs',
    faces: 10, hints: 1, shuffles: 2, undos: 3, layers: [L(10, 4), L(6, 2, 2, 2)] },
  // 19: preparation challenge, few wrong pairs on a wide stack
  { id: 19, chapter: 2, name: 'Heatwave', objective: 'mistakes', limit: 3, goal: 'Clear the stack with 3 wrong pairs at most',
    faces: 11, hints: 0, shuffles: 2, undos: 2, layers: [L(10, 3), L(8, 2, 2, 1), L(6, 2, 4, 2)] },
  // 20: finale
  { id: 20, chapter: 2, name: 'Uluru Gold', objective: 'gold', gold: 6, limit: 0, goal: 'Clear every gold tile',
    faces: 12, hints: 1, shuffles: 2, undos: 2, layers: [L(12, 2), L(10, 2, 2, 1), L(8, 2, 4, 1)] },
];
