// Three authored mine jobs. Classic mode still starts from an empty board.
const filled = (kind, holes) => Array.from({ length: 8 }, (_, c) => holes.includes(c) ? 0 : kind);
const empty = () => Array(8).fill(0);

export const MISSIONS = [
  {
    title: 'Open the seam', objective: 'Clear the marked ore row', target: 'lines', count: 1, moves: 3,
    board: Array.from({ length: 8 }, (_, r) => r === 5 ? filled(2, [2, 3, 4]) : empty()),
    tray: [{ shape: 3, colour: 5 }, { shape: 2, colour: 3 }, { shape: 0, colour: 6 }],
    meter: 0,
  },
  {
    title: 'Crosscut', objective: 'Clear two lines in one placement', target: 'double', count: 2, moves: 2,
    board: Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) =>
      r === 3 && c === 4 ? 0 : r === 3 ? 4 : c === 4 ? 1 : 0)),
    tray: [{ shape: 0, colour: 5 }, { shape: 1, colour: 3 }, { shape: 2, colour: 6 }],
    meter: 0,
  },
  {
    title: 'Light the cart', objective: 'Clear both seams to launch the miner', target: 'blast', count: 1, moves: 3,
    board: Array.from({ length: 8 }, (_, r) => r === 1 ? filled(3, [1, 2, 3]) : r === 5 ? filled(5, [5, 6]) : empty()),
    tray: [{ shape: 3, colour: 2 }, { shape: 1, colour: 6 }, { shape: 0, colour: 4 }],
    meter: 90,
  },
];

export function applyMission(game, index) {
  const mission = MISSIONS[index];
  if (!mission) throw new RangeError('Unknown mine mission');
  game.board = mission.board.map(row => row.slice());
  game.tray = mission.tray.map(piece => ({ ...piece }));
  game.meter = mission.meter;
  return mission;
}
