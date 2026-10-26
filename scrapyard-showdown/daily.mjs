// Small, deterministic daily goals. Progress is local and solo matches only.
const DAY = 86400000;
export const contractFor = (date = new Date()) => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const index = Math.floor(day.getTime() / DAY);
  const choices = [
    { id: 'winner', title: 'Take the yard', detail: 'Win one solo derby.', target: 1, value: (m, me) => Number(m.winner === me) },
    { id: 'knockouts', title: 'Clear the crossing', detail: 'Score two knockouts in a solo derby.', target: 2, value: (m, me) => m.cars[me].kills },
    { id: 'damage', title: 'Make it hurt', detail: 'Deal 100 damage in a solo derby.', target: 100, value: (m, me) => Math.floor(m.cars[me].damage) },
  ];
  return { date: day.toISOString().slice(0, 10), ...choices[((index % choices.length) + choices.length) % choices.length] };
};

export const freshDaily = () => ({ streak: 0, completed: [] });
export function readDaily(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { streak: Math.max(0, Math.min(100000, Math.floor(Number(v?.streak) || 0))), completed: Array.isArray(v?.completed) ? [...new Set(v.completed.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(-60) : [] };
  } catch { return freshDaily(); }
}
export function completeContract(save, match, me, date = new Date()) {
  const contract = contractFor(date);
  if (save.completed.includes(contract.date)) return { contract, progress: contract.target, done: true, newlyDone: false };
  const progress = Math.min(contract.target, contract.value(match, me));
  if (progress < contract.target) return { contract, progress, done: false, newlyDone: false };
  const prev = new Date(`${contract.date}T00:00:00.000Z`); prev.setUTCDate(prev.getUTCDate() - 1);
  save.streak = save.completed.includes(prev.toISOString().slice(0, 10)) ? save.streak + 1 : 1;
  save.completed.push(contract.date); save.completed = save.completed.slice(-60);
  return { contract, progress, done: true, newlyDone: true };
}
