// Homestead: property stages (Claude). Ryan's NEXT-FEATURES #1: the long goal,
// from a hobby block to a big station, whatever kind of farming the player
// chooses. Reads Codex's property state; changes it only when a stage is
// reached (a reward). Unlocks gate NEW content only (fields, machinery sizes,
// crops), never a building an existing save already uses.

const built = (s, kind) => s.buildings.filter((b) => b.built && (!kind || b.kind === kind)).length;
const homeKinds = ['caravan', 'cabin', 'cottage', 'queenslander', 'modern', 'stationhouse'];
const hasHome = (s) => s.buildings.some((b) => b.built && homeKinds.includes(b.kind));
// produce of any kind: stock sold, garden picks and field harvests all count
const output = (s) => (s.stats.sold || 0) + (s.stats.harvests || 0) + (s.stats.fieldHarvests || 0);

// Each stage: what it takes (all of `needs`), what it opens, what reaching it pays.
export const STAGES = [
  { id: 'block', name: 'Hobby block', needs: [], unlocks: [], reward: 0 },
  {
    id: 'smallfarm',
    name: 'Small farm',
    needs: [
      ['A home on the block', (s) => hasHome(s)],
      ['Four things built', (s) => built(s) >= 4],
      ['First produce sold or picked', (s) => output(s) >= 1],
    ],
    unlocks: ['smallTractor', 'grain', 'vegetables'],
    reward: 1500,
  },
  {
    id: 'property',
    name: 'Working property',
    needs: [
      ['16 acres', (s) => (s.acres || 8) >= 16],
      ['A second worker', (s) => s.workers.length >= 2],
      ['Eight things built', (s) => built(s) >= 8],
      ['Ten lots of produce', (s) => output(s) >= 10],
    ],
    unlocks: ['midTractor', 'header', 'vegHarvester', 'cane'],
    reward: 4000,
  },
  {
    id: 'station',
    name: 'Station',
    needs: [
      ['40 acres', (s) => (s.acres || 8) >= 40],
      ['Three workers', (s) => s.workers.length >= 3],
      ['Forty lots of produce', (s) => output(s) >= 40],
      ['A truck or a harvester of your own', (s) => s.vehicles.includes('truck') || (s.machines || []).some((m) => /header|caneHarvester|vegHarvester/.test(m))],
    ],
    unlocks: ['bigTractor', 'caneHarvester', 'silos', 'roadTrain'],
    reward: 9000,
  },
  {
    id: 'bigstation',
    name: 'Big station',
    needs: [
      ['All 72 acres', (s) => (s.acres || 8) >= 72],
      ['Four workers', (s) => s.workers.length >= 4],
      ['A station homestead', (s) => built(s, 'stationhouse') >= 1],
      ['A hundred lots of produce', (s) => output(s) >= 100],
    ],
    unlocks: ['helicopter'],
    reward: 20000,
  },
];

export function stageIndex(s) {
  let i = 0;
  for (let k = 1; k < STAGES.length; k++) if (STAGES[k].needs.every(([, ok]) => ok(s))) i = k;
  else break;
  return i;
}
export const stageOf = (s) => STAGES[stageIndex(s)];

// the next stage and how far along each need is: for the stage card
export function nextStage(s) {
  const i = stageIndex(s);
  const next = STAGES[i + 1];
  if (!next) return null;
  const needs = next.needs.map(([text, ok]) => ({ text, done: Boolean(ok(s)) }));
  return { ...next, needs, done: needs.filter((n) => n.done).length, of: needs.length };
}

export function unlocked(s, key) {
  const i = stageIndex(s);
  return STAGES.slice(0, i + 1).some((st) => st.unlocks.includes(key));
}

// Call after anything that could move the property up (Codex's screen does
// it after each tick batch or finished job). Pays each newly reached stage
// once and returns it for the celebration; null when nothing new.
export function reachStage(s) {
  const i = stageIndex(s);
  const had = Number.isInteger(s.stage) ? s.stage : 0;
  if (i <= had) {
    s.stage = Math.max(had, i);
    return null;
  }
  const reached = STAGES.slice(had + 1, i + 1);
  for (const st of reached) {
    s.money += st.reward;
    s.xp = (s.xp || 0) + 50;
  }
  s.stage = i;
  const top = STAGES[i];
  return { stage: top, reward: reached.reduce((t, st) => t + st.reward, 0), unlocks: reached.flatMap((st) => st.unlocks) };
}
