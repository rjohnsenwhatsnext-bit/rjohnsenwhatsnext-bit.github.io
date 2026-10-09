// Ring Lock levels (Claude). Chapter 1 is LEVELS[0..9].
// ring: {n notches, target notch, links: [[otherRing, factor]]}. Turning a ring
// by dir also turns each linked ring by dir * factor (factor -1 turns it the
// other way). scramble: moves played on the solved board to make the start, so
// a level is always solvable in at most scramble.length moves. moves: the budget.
const R = (n, target = 0, links = []) => ({ n, target, links });

export const LEVELS = [
  { id: 1, chapter: 1, name: 'First Turn', objective: 'Turn the ring until its mark sits at the top.',
    rings: [R(6)], scramble: [[0, 1], [0, 1]], moves: 5 },
  { id: 2, chapter: 1, name: 'Two Rings', objective: 'Line up both rings at the top.',
    rings: [R(6), R(6)], scramble: [[0, 1], [1, -1], [1, -1]], moves: 6 },
  { id: 3, chapter: 1, name: 'Three Deep', objective: 'Line up all three rings at the top.',
    rings: [R(8), R(8), R(8)], scramble: [[0, 1], [0, 1], [1, -1], [2, 1], [2, 1], [2, 1]], moves: 9 },
  { id: 4, chapter: 1, name: 'Off Centre', objective: 'Match the pattern: each ring has its own target notch.',
    rings: [R(8, 0), R(8, 2), R(8, 5)], scramble: [[0, -1], [1, 1], [1, 1], [2, -1], [2, -1]], moves: 8 },
  { id: 5, chapter: 1, name: 'Linked', objective: 'The first ring drags the second along. Plan around it.',
    rings: [R(6, 0, [[1, 1]]), R(6)], scramble: [[0, 1], [0, 1], [1, 1]], moves: 6 },
  { id: 6, chapter: 1, name: 'Opposites', objective: 'The first ring turns the second the other way.',
    rings: [R(6, 0, [[1, -1]]), R(6), R(6)], scramble: [[0, 1], [0, 1], [0, 1], [2, 1], [1, -1]], moves: 9 },
  { id: 7, chapter: 1, name: 'Odd Gears', objective: 'Rings with different notch counts share a link.',
    rings: [R(6, 0, [[1, 1]]), R(12), R(8, 0, [[1, 1]])], scramble: [[0, 1], [0, 1], [2, 1], [2, 1], [2, 1]], moves: 10 },
  { id: 8, chapter: 1, name: 'Chain Reaction', objective: 'Each ring nudges the next. Work from the end of the chain.',
    rings: [R(6, 0, [[1, 1]]), R(6, 0, [[2, 1]]), R(6, 0, [[3, -1]]), R(6)], scramble: [[0, 1], [1, 1], [2, 1], [3, 1]], moves: 8 },
  { id: 9, chapter: 1, name: 'Tight Fit', objective: 'Four rings, a pattern, and only six moves.',
    rings: [R(8, 0, [[1, 1]]), R(8, 3), R(8, 0), R(8, 5, [[2, -1]])],
    scramble: [[0, 1], [0, 1], [1, -1], [2, 1], [3, 1], [3, 1]], moves: 6 },
  { id: 10, chapter: 1, name: 'The Lock', objective: 'Four linked rings, mixed sizes, one spare move. Open the lock.',
    rings: [R(6, 0, [[1, 1], [3, -1]]), R(8, 3, [[2, 1]]), R(12, 6, [[3, 1]]), R(6, 2)],
    scramble: [[0, 1], [1, 1], [2, -1], [3, 1], [0, 1], [2, -1]], moves: 7 },
];
