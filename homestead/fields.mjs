// Homestead: fields, crops and machinery (Claude). Ryan, 30 Sep 2026: "add in
// the ability to just be like a cane farm as well or like maybe grain and
// vegetable farming ... we will need to add tractors and harvesters".
//
// One engine for every crop, inside Codex's property simulation: a field is
// a building (kind 'field') on the map; the crop cycle is jobs in Codex's own
// job system (property.mjs assign/finish/tick), so workers collect the right
// machine from the shed and work the field row by row, visibly. Nothing here
// runs its own clock: growth moves with Codex's game days and weather.
//
//   lay out a field -> work the ground -> sow (cane: plant) -> it grows with
//   the season and weather (spraying lifts the yield) -> harvest with the
//   right machine -> cart it: grain to the receival site, cane to the mill,
//   vegetables into Codex's produce and farm shop.
// Cane regrows after harvest (ratoon crops) three times before replanting.
import { BUILDINGS, canPlace, dims, entry, cash } from './property.mjs';
import { unlocked } from './stages.mjs';

// ---- the seasons: 7 game days each; cane only crushes in the crushing season
export const SEASONS = ['Summer', 'Autumn', 'Winter', 'Spring'];
export const seasonOf = (s) => SEASONS[Math.floor(((s.day || 1) - 1) / 7) % 4];

// ---- crops. grow: game seconds. yield: loads per square at normal quality.
// price: dollars a load when delivered. seed: dollars a square to sow.
export const CROPS = {
  wheat: { name: 'Wheat', path: 'grain', grow: 360, yield: 1, price: 90, seed: 12, sow: ['Autumn', 'Winter'] },
  barley: { name: 'Barley', path: 'grain', grow: 330, yield: 1, price: 80, seed: 10, sow: ['Autumn', 'Winter'] },
  sorghum: { name: 'Sorghum', path: 'grain', grow: 390, yield: 1.1, price: 85, seed: 11, sow: ['Spring', 'Summer'] },
  cane: { name: 'Sugar cane', path: 'cane', grow: 720, yield: 2.2, price: 70, seed: 30, sow: ['Autumn', 'Spring'], ratoons: 3, harvestIn: ['Winter', 'Spring'] },
  potatoes: { name: 'Potatoes', path: 'vegetables', grow: 240, yield: 1.5, price: 0, seed: 20, sow: SEASONS },
  pumpkins: { name: 'Pumpkins', path: 'vegetables', grow: 270, yield: 1.4, price: 0, seed: 15, sow: SEASONS },
};
export const PATHS = {
  grain: { name: 'Grain', unlock: 'grain', sells: 'the grain receival site' },
  cane: { name: 'Sugar cane', unlock: 'cane', sells: 'the sugar mill' },
  vegetables: { name: 'Vegetables', unlock: 'vegetables', sells: 'your farm shop' },
};

// ---- machinery. pace: work seconds per square (lower is faster).
// hire: a contractor does the job instead, for this much per square.
export const MACHINES = {
  smallTractor: { name: 'Small tractor', kind: 'tractor', cost: 9000, pace: 1.0, unlock: 'smallTractor' },
  midTractor: { name: 'Mid-size tractor', kind: 'tractor', cost: 22000, pace: 0.6, unlock: 'midTractor' },
  bigTractor: { name: 'Big 4WD tractor', kind: 'tractor', cost: 48000, pace: 0.35, unlock: 'bigTractor' },
  plough: { name: 'Plough', kind: 'implement', cost: 2500, for: 'work', unlock: 'smallTractor' },
  seeder: { name: 'Air seeder', kind: 'implement', cost: 4000, for: 'sow', paths: ['grain'], unlock: 'grain' },
  bedFormer: { name: 'Bed former and planter', kind: 'implement', cost: 3000, for: 'sow', paths: ['vegetables'], unlock: 'vegetables' },
  canePlanter: { name: 'Cane planter', kind: 'implement', cost: 6000, for: 'sow', paths: ['cane'], unlock: 'cane' },
  sprayer: { name: 'Boom sprayer', kind: 'implement', cost: 3500, for: 'spray', unlock: 'smallTractor' },
  header: { name: 'Header (combine harvester)', kind: 'harvester', cost: 38000, pace: 0.5, paths: ['grain'], unlock: 'header' },
  vegHarvester: { name: 'Vegetable harvester', kind: 'harvester', cost: 26000, pace: 0.6, paths: ['vegetables'], unlock: 'vegHarvester' },
  caneHarvester: { name: 'Cane harvester', kind: 'harvester', cost: 55000, pace: 0.5, paths: ['cane'], unlock: 'caneHarvester' },
};
// what a contractor charges a square when you do not own the machine
export const HIRE = { work: 25, sow: 30, spray: 20, harvest: 60 };
export const FIELD_SQUARE_COST = 150; // clearing and laying out, a square

export function migrateFields(s) {
  s.machines ??= [];
  s.store ??= { grain: 0, cane: 0 };
  s.stats.fieldHarvests ??= 0;
  s.stats.delivered ??= 0;
  for (const b of s.buildings) if (b.kind === 'field') b.stage ??= 'bare';
  return s;
}
export const fields = (s) => s.buildings.filter((b) => b.kind === 'field' && b.built);
const squares = (b) => dims(b).w * dims(b).h;
const owned = (s, id) => (s.machines || []).includes(id);
const busy = (s, machine) => s.jobs.some((j) => j.machine === machine);
const tractorOf = (s) => ['bigTractor', 'midTractor', 'smallTractor'].find((t) => owned(s, t) && !busy(s, t));
const stop = (x, y, label, work = 0) => ({ x, y, label, work });

// the rows of a field, one stop at the end of each, so the worker is seen
// driving up and down the paddock
function rowStops(b, label, perSquare) {
  const { w, h } = dims(b);
  const out = [];
  for (let r = 0; r < h; r++) out.push(stop(r % 2 ? b.x : b.x + w - 1, b.y + r, `${label}, row ${r + 1} of ${h}`, w * perSquare));
  return out;
}

export function buyMachine(s, id) {
  migrateFields(s);
  const m = MACHINES[id];
  if (!m) return { ok: false, reason: 'Unknown machine' };
  if (!unlocked(s, m.unlock)) return { ok: false, reason: 'Not available at this stage of your property yet' };
  if (owned(s, id)) return { ok: false, reason: 'You already own this.' };
  if (s.money < m.cost) return { ok: false, reason: `You need ${cash(m.cost - s.money)} more.` };
  s.money -= m.cost;
  s.machines.push(id);
  return { ok: true };
}

// ---- the job types, called from Codex's assign() for anything it does not
// know. Returns null when the type is not a field job; { reason } to refuse;
// or { job, cost, onQueued } for assign() to put through its own enqueue.
export const FIELD_JOBS = ['layField', 'workGround', 'sow', 'spray', 'harvestField', 'deliver'];
export function fieldJob(s, worker, type, target) {
  if (!FIELD_JOBS.includes(type)) return null;
  migrateFields(s);
  if (type === 'deliver') return deliveryJob(s, target?.what ?? target);
  if (type === 'layField') {
    const { x, y, w, h, path } = target || {};
    if (!PATHS[path]) return { reason: 'Choose grain, sugar cane or vegetables.' };
    if (!unlocked(s, PATHS[path].unlock)) return { reason: `${PATHS[path].name} opens at a later stage of your property.` };
    if (!(w >= 2 && h >= 2 && w <= 8 && h <= 8)) return { reason: 'Fields are 2 to 8 squares on each side.' };
    const why = canPlace(s, 'field', x, y, w, h);
    if (why) return { reason: why };
    const b = { id: s.nextId++, kind: 'field', x, y, w, h, path, built: false, progress: 0, stage: 'bare' };
    const at = entry(b);
    return {
      cost: w * h * FIELD_SQUARE_COST,
      job: { type: 'build', building: b.id, title: `Lay out a ${PATHS[path].name.toLowerCase()} field`, stops: [stop(3, 15, 'Collect survey pegs and gear', 2), stop(at.x, at.y, 'Clearing and laying out the field', 4 + w * h * 0.5)] },
      onQueued: () => s.buildings.push(b),
    };
  }
  const b = s.buildings.find((o) => o.id === (target?.field ?? target) && o.kind === 'field');
  if (!b?.built) return { reason: 'Choose a finished field.' };
  if (s.jobs.some((j) => j.building === b.id)) return { reason: 'A job is already queued for this field.' };
  const n = squares(b);
  if (type === 'workGround' || type === 'sow' || type === 'spray') {
    const need = { workGround: 'bare', sow: 'worked', spray: 'growing' }[type];
    if (b.stage !== need) return { reason: { workGround: 'This field is already worked.', sow: 'Work the ground before sowing.', spray: 'Spray a growing crop.' }[type] };
    let crop = null;
    if (type === 'sow') {
      crop = target?.crop;
      const c = CROPS[crop];
      if (!c || c.path !== b.path) return { reason: `Choose a ${PATHS[b.path].name.toLowerCase()} crop for this field.` };
      if (!c.sow.includes(seasonOf(s))) return { reason: `${c.name} is sown in ${c.sow.join(' or ')}. It is ${seasonOf(s)}.` };
    }
    if (type === 'spray' && b.sprayed) return { reason: 'Already sprayed this crop.' };
    const task = { workGround: 'work', sow: 'sow', spray: 'spray' }[type];
    const implement = Object.entries(MACHINES).find(([id, m]) => m.kind === 'implement' && m.for === task && (!m.paths || m.paths.includes(b.path)) && owned(s, id) && !busy(s, id))?.[0];
    const tractor = tractorOf(s);
    const seed = crop ? CROPS[crop].seed * n : 0;
    const label = { workGround: 'Working the ground', sow: `Sowing ${crop && CROPS[crop].name.toLowerCase()}`, spray: 'Spraying the crop' }[type];
    if (tractor && implement) {
      const pace = MACHINES[tractor].pace;
      return { cost: seed + Math.round(n * 4), job: { type, building: b.id, crop, machine: tractor, implement, title: `${label} (${MACHINES[tractor].name.toLowerCase()})`, stops: [stop(3, 15, `Hitch the ${MACHINES[implement].name.toLowerCase()}`, 2), ...rowStops(b, label, pace)] } };
    }
    // no machine of your own: a contractor does it, for a price, and quicker to arrange
    return { cost: seed + HIRE[task] * n, job: { type, building: b.id, crop, hire: true, title: `${label} (contractor)`, stops: [stop(entry(b).x, entry(b).y, `Contractor ${label.toLowerCase()}`, 3 + n * 0.4)] } };
  }
  if (type === 'harvestField') {
    if (b.stage !== 'ready') return { reason: 'The crop is not ready yet.' };
    const c = CROPS[b.crop];
    if (c.harvestIn && !c.harvestIn.includes(seasonOf(s))) return { reason: `Cane is cut in the crushing season (${c.harvestIn.join(' and ')}). It is ${seasonOf(s)}.` };
    const harvester = Object.entries(MACHINES).find(([id, m]) => m.kind === 'harvester' && m.paths.includes(b.path) && owned(s, id) && !busy(s, id))?.[0];
    if (harvester) return { cost: Math.round(n * 6), job: { type, building: b.id, machine: harvester, title: `Harvest ${c.name.toLowerCase()} (${MACHINES[harvester].name.toLowerCase()})`, stops: [stop(3, 15, `Start the ${MACHINES[harvester].name.toLowerCase()}`, 2), ...rowStops(b, `Harvesting ${c.name.toLowerCase()}`, MACHINES[harvester].pace)] } };
    if (b.path === 'vegetables') return { cost: 0, job: { type, building: b.id, title: `Hand-pick ${c.name.toLowerCase()}`, stops: rowStops(b, 'Picking by hand', 2.2) } };
    return { cost: HIRE.harvest * n, job: { type, building: b.id, hire: true, title: `Harvest ${c.name.toLowerCase()} (contractor)`, stops: [stop(entry(b).x, entry(b).y, 'Contract harvester working the field', 4 + n * 0.5)] } };
  }
  return null;
}
// deliver is not tied to one field: target { what: 'grain' | 'cane' }
export function deliveryJob(s, what) {
  migrateFields(s);
  if (!['grain', 'cane'].includes(what) || !(s.store[what] > 0)) return { reason: `No ${what} to cart.` };
  if (s.jobs.some((j) => j.type === 'deliver' && j.what === what)) return { reason: 'A load is already on its way.' };
  const loads = s.store[what];
  const dest = what === 'grain' ? 'the grain receival site' : 'the sugar mill siding';
  return { cost: 40 + loads * 2, job: { type: 'deliver', what, loads, title: `Cart ${what} to ${dest}`, stops: [stop(3, 15, s.vehicles.includes('truck') ? 'Load the truck' : 'Carrier arrives', 3), stop(1, 16, `Deliver to ${dest}`, 5)] } };
}

// ---- when a field job finishes (from Codex's finish()); true when handled
export function fieldFinish(s, j, emit) {
  if (j.type === 'build') {
    const b = s.buildings.find((o) => o.id === j.building);
    if (b?.kind === 'field') migrateFields(s);
    return false; // Codex's build finish still runs (built, xp, message)
  }
  if (!FIELD_JOBS.includes(j.type)) return false;
  migrateFields(s);
  if (j.type === 'deliver') {
    const c = Object.values(CROPS).find((c) => c.path === j.what);
    const loads = Math.min(j.loads, s.store[j.what]);
    const paid = Math.round(loads * c.price);
    s.store[j.what] -= loads;
    s.money += paid;
    s.stats.delivered += loads;
    s.xp += 20;
    emit(s, `${loads} loads of ${j.what} delivered · ${cash(paid)}`);
    return true;
  }
  const b = s.buildings.find((o) => o.id === j.building);
  if (!b) return true;
  if (j.type === 'workGround') {
    b.stage = 'worked';
    emit(s, 'Ground worked and ready to sow.');
  }
  if (j.type === 'sow') {
    b.crop = j.crop;
    b.stage = 'growing';
    b.sownAt = s.time;
    b.ready = s.time + CROPS[j.crop].grow;
    b.quality = 1;
    b.sprayed = false;
    b.ratoon = 0;
    emit(s, `${CROPS[j.crop].name} sown. Ready in about ${Math.round(CROPS[j.crop].grow / 180)} game days, weather permitting.`);
  }
  if (j.type === 'spray') {
    b.sprayed = true;
    b.quality = Math.min(1.4, (b.quality || 1) + 0.15);
    emit(s, 'Crop sprayed: weeds and pests knocked back.');
  }
  if (j.type === 'harvestField') {
    const c = CROPS[b.crop];
    const loads = Math.max(1, Math.round(squares(b) * c.yield * (b.quality || 1)));
    if (b.path === 'vegetables') s.produce = (s.produce || 0) + loads;
    else s.store[b.path] += loads;
    s.stats.fieldHarvests++;
    s.stats.harvests = (s.stats.harvests || 0) + 0; // garden picks stay Codex's own count
    s.xp += 25;
    emit(s, `${c.name} harvested: ${loads} ${b.path === 'vegetables' ? 'crates for the farm shop' : 'loads in store'}.`);
    // cane regrows from the stool (a ratoon crop); everything else goes back to bare ground
    if (c.ratoons && (b.ratoon || 0) < c.ratoons) {
      b.ratoon = (b.ratoon || 0) + 1;
      b.stage = 'growing';
      b.ready = s.time + c.grow;
      b.quality = 0.95 - b.ratoon * 0.05;
      b.sprayed = false;
    } else {
      b.stage = 'bare';
      b.crop = null;
      b.ready = 0;
      b.ratoon = 0;
    }
  }
  return true;
}

// ---- once a game day (from Codex's daily tick): crops grow with the weather
export function fieldsDaily(s, emit) {
  migrateFields(s);
  for (const b of fields(s)) {
    if (b.stage !== 'growing') continue;
    const w = s.weather;
    b.quality = Math.max(0.5, Math.min(1.4, (b.quality || 1) + (w === 'Rain' ? 0.06 : w === 'Hot' ? -0.05 : 0.01)));
    if (s.time >= b.ready) {
      b.stage = 'ready';
      emit(s, `${CROPS[b.crop].name} is ready to harvest.`);
    }
  }
}
// crops also ripen between days (the screen and away catch-up see it straight away)
export function fieldsTick(s) {
  for (const b of s.buildings) if (b.kind === 'field' && b.stage === 'growing' && s.time >= b.ready) b.stage = 'ready';
}
