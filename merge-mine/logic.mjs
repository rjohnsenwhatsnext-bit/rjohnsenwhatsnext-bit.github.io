// Merge Mine: the rules (Claude). Pure and seeded: the state is plain JSON,
// the random draws come from a counter kept in the state, so a save always
// plays on the same way, and the tests and a future server can use it all.
// No drawing here; main.mjs draws, Codex owns the look.
//
// Ryan, 29 Sep 2026: "build the merge game mechanics to hand over to codex".
// The shape is the proven one (Travel Town, Merge Mansion, Gossip Harbor):
// tap a generator for an item, drag two the same together for the next one
// up, fill the orders pinned above the board, spend the coins on the mine
// site, open the next area. The hooks that keep people coming back: energy
// that refills while the phone is shut, orders that are always nearly done,
// chests you do not know the inside of, and the odd lucky merge that jumps a
// level. Nothing is sold yet; energy can be topped up with a rewarded ad.

export const COLS = 7;
export const ROWS = 9;
export const CELLS = COLS * ROWS;

// Every item family, lowest first. Merge two of a level for one of the next.
export const CHAINS = {
  ore: ['Rubble', 'Coal', 'Copper', 'Iron', 'Silver', 'Gold', 'Opal', 'Diamond'],
  tool: ['Nail', 'Hammer', 'Pick', 'Shovel', 'Drill', 'Jackhammer', 'Rock drill'],
  timber: ['Twig', 'Plank', 'Beam', 'Prop', 'Frame', 'Headframe'],
  lamp: ['Candle', 'Carbide lamp', 'Oil lantern', 'Helmet lamp', 'Floodlight'],
  // chests are merged too; tapping one opens it
  chest: ['Crate', 'Strongbox', 'Payroll chest'],
};
export const maxLevel = (chain) => CHAINS[chain].length;
export const itemName = (it) => CHAINS[it.c][it.l - 1];

// Generators sit on the board and cannot be moved or merged. Each tap costs
// energy and drops an item next to it; now and then a better one.
export const GENERATORS = {
  face: { name: 'Rock face', chain: 'ore', unlock: 1, drops: [[1, 80], [2, 18], [3, 2]] },
  shed: { name: 'Tool shed', chain: 'tool', unlock: 1, drops: [[1, 82], [2, 16], [3, 2]] },
  mill: { name: 'Sawmill', chain: 'timber', unlock: 3, drops: [[1, 82], [2, 16], [3, 2]] },
  store: { name: 'Lamp room', chain: 'lamp', unlock: 5, drops: [[1, 85], [2, 14], [3, 1]] },
};
export const GEN_CELLS = { face: 0, shed: COLS - 1, mill: CELLS - COLS, store: CELLS - 1 };

export const ENERGY = { max: 100, perTap: 1, regenMs: 2 * 60 * 1000, ad: 50 };
// a merge that skips a level: rare enough to be a moment
export const LUCKY = 0.04;
// how many orders are up at once
export const ORDER_SLOTS = 3;
export const CUSTOMERS = ['The foreman', 'The assayer', 'The surveyor', 'The blacksmith', 'The shift boss', 'The cook'];

// The mine site, area by area. Coins build each project; the last one opens
// the next area. Past the named ones the costs keep climbing.
export const AREAS = [
  { name: 'The old adit', projects: ['Clear the rubble', 'Fix the rail line', 'Prop the entrance', 'Hang the lamps', 'Open the adit'] },
  { name: 'The headframe', projects: ['Pour the footings', 'Raise the frame', 'Hang the sheave wheel', 'Fit the cage', 'Ring the bell'] },
  { name: 'The deep level', projects: ['Pump out the water', 'Timber the drive', 'Lay the tramway', 'Blast the crosscut', 'Strike the reef'] },
  { name: 'The battery', projects: ['Build the stamper shed', 'Mount the stampers', 'Run the belts', 'Fire the boiler', 'First crushing'] },
  { name: 'The mine town', projects: ['Build the pub', 'Open the store', 'Dig the dam', 'Build the hall', 'The big payday'] },
];
export const projectCost = (area, i) => Math.round(80 * 1.7 ** area * (1 + i * 0.6));
export const areaName = (a) => (AREAS[a] ? AREAS[a].name : `Level ${a + 1}`);
export const projectName = (a, i) => (AREAS[a] ? AREAS[a].projects[i] : `Project ${i + 1}`);
export const PROJECTS_PER_AREA = 5;

// player level from xp: each level takes a bit longer than the last
// (measured with the plain player in the tests: level 3, the sawmill, in the
// first sitting or two; level 5, the lamp room, around day two)
export const xpForLevel = (lvl) => Math.round(30 * (lvl - 1) ** 1.8);
export function levelFor(xp) {
  let l = 1;
  while (xp >= xpForLevel(l + 1)) l++;
  return l;
}

// ---- random, from the state
function rand(s) {
  let a = (s.seed + Math.imul(s.draws++, 0x9e3779b1)) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b) >>> 0;
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35) >>> 0;
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
function weighted(s, pairs) {
  let r = rand(s) * pairs.reduce((t, p) => t + p[1], 0);
  for (const [v, w] of pairs) {
    if (r < w) return v;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
}

// ---- a new game
export function newGame(seed = 1, now = Date.now()) {
  const s = {
    v: 1,
    seed: seed >>> 0,
    draws: 0,
    board: Array(CELLS).fill(null), // null | { c, l } an item | { g } a generator
    energy: ENERGY.max,
    energyAt: now, // when energy was last counted
    coins: 0,
    xp: 0,
    area: 0,
    built: 0, // projects finished in this area
    orders: [],
    served: 0, // orders ever filled: the first ones are easy
    stats: { taps: 0, merges: 0, lucky: 0, chests: 0 },
  };
  for (const [g, cell] of Object.entries(GEN_CELLS)) if (GENERATORS[g].unlock <= 1) s.board[cell] = { g };
  // a few starting pieces so the first merge is one drag away
  for (const [cell, it] of [[23, { c: 'ore', l: 1 }], [24, { c: 'ore', l: 1 }], [31, { c: 'tool', l: 1 }], [32, { c: 'tool', l: 1 }], [38, { c: 'chest', l: 1 }]]) s.board[cell] = it;
  while (s.orders.length < ORDER_SLOTS) s.orders.push(makeOrder(s));
  return s;
}

export const level = (s) => levelFor(s.xp);
export const isGen = (cell) => Boolean(cell && cell.g);
export const isItem = (cell) => Boolean(cell && cell.c);
const unlockedChains = (s) => Object.values(GENERATORS).filter((g) => g.unlock <= level(s)).map((g) => g.chain);

// ---- energy: counted from the clock, so it refills while the game is shut
export function tickEnergy(s, now = Date.now()) {
  if (s.energy >= ENERGY.max) {
    s.energyAt = now;
    return s;
  }
  const gained = Math.floor((now - s.energyAt) / ENERGY.regenMs);
  if (gained > 0) {
    s.energy = Math.min(ENERGY.max, s.energy + gained);
    s.energyAt = s.energy >= ENERGY.max ? now : s.energyAt + gained * ENERGY.regenMs;
  }
  return s;
}
export const nextEnergyIn = (s, now = Date.now()) => (s.energy >= ENERGY.max ? 0 : ENERGY.regenMs - ((now - s.energyAt) % ENERGY.regenMs));
// a watched rewarded ad; the caller only calls this once the ad paid out
export function adEnergy(s, now = Date.now()) {
  tickEnergy(s, now);
  s.energy = Math.min(ENERGY.max + ENERGY.ad, s.energy + ENERGY.ad);
  return s;
}

// ---- the board
const neighbours = (i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out = [];
  for (let d = 1; d < Math.max(COLS, ROWS); d++)
    for (let dr = -d; dr <= d; dr++)
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc);
      }
  return out;
};
// the nearest empty cell to i, or -1 when the board is full
export const nearestEmpty = (s, i) => neighbours(i).find((j) => !s.board[j]) ?? -1;
export const emptyCells = (s) => s.board.reduce((n, x) => n + (x ? 0 : 1), 0);

// Tap a generator. -> { ok, cell, item } or { ok: false, reason }
export function tapGenerator(s, cell, now = Date.now()) {
  const g = s.board[cell];
  if (!isGen(g)) return { ok: false, reason: 'That is not a generator' };
  tickEnergy(s, now);
  if (s.energy < ENERGY.perTap) return { ok: false, reason: 'Out of energy', energy: true };
  const to = nearestEmpty(s, cell);
  if (to < 0) return { ok: false, reason: 'The board is full. Merge or sell something.' };
  const gen = GENERATORS[g.g];
  const item = { c: gen.chain, l: weighted(s, gen.drops) };
  if (s.energy === ENERGY.max) s.energyAt = now; // the regen clock starts when energy first drops below max
  s.energy -= ENERGY.perTap;
  s.board[to] = item;
  s.stats.taps++;
  // one tap in 40 also shakes loose a crate
  let bonus = null;
  if (rand(s) < 1 / 40) {
    const b = nearestEmpty(s, cell);
    if (b >= 0) {
      s.board[b] = { c: 'chest', l: 1 };
      bonus = { cell: b, item: s.board[b] };
    }
  }
  return { ok: true, cell: to, item, bonus };
}

// Drag from one cell to another.
// Same chain and level: merge into the target (sometimes two levels up).
// Empty target: move. Different item: swap. Generators do not move.
// -> { kind: 'merge' | 'move' | 'swap' | 'none', item?, lucky?, xp? }
export function move(s, from, to) {
  if (from === to) return { kind: 'none' };
  const a = s.board[from];
  const b = s.board[to];
  if (!isItem(a) || isGen(b)) return { kind: 'none' };
  if (!b) {
    s.board[to] = a;
    s.board[from] = null;
    return { kind: 'move' };
  }
  if (a.c === b.c && a.l === b.l && a.l < maxLevel(a.c)) {
    let l = a.l + 1;
    const lucky = l < maxLevel(a.c) && rand(s) < LUCKY;
    if (lucky) l++;
    s.board[to] = { c: a.c, l };
    s.board[from] = null;
    // levels come from orders and the site; a merge only tips in a point
    // once it makes something worth having
    const xp = l >= 4 ? 1 : 0;
    const before = level(s);
    s.xp += xp;
    s.stats.merges++;
    if (lucky) s.stats.lucky++;
    return { kind: 'merge', item: s.board[to], lucky, xp, levelUp: levelUp(s, before) };
  }
  s.board[to] = a;
  s.board[from] = b;
  return { kind: 'swap' };
}

// Sell an item for a few coins, to make room.
export const sellValue = (it) => (it.c === 'chest' ? 0 : Math.max(1, 2 ** (it.l - 1)));
export function sell(s, cell) {
  const it = s.board[cell];
  if (!isItem(it)) return { ok: false, reason: 'Nothing to sell' };
  if (it.c === 'chest') return { ok: false, reason: 'Open it instead' };
  const coins = sellValue(it);
  s.coins += coins;
  s.board[cell] = null;
  return { ok: true, coins };
}

// Open a chest: what is inside is not known until it opens. Bigger chests,
// more and better. -> { ok, drops: [{ cell, item }], coins, energy }
export function openChest(s, cell) {
  const it = s.board[cell];
  if (!isItem(it) || it.c !== 'chest') return { ok: false, reason: 'That is not a chest' };
  s.board[cell] = null;
  const chains = unlockedChains(s);
  const n = [3, 5, 8][it.l - 1];
  const drops = [];
  let coins = 0;
  let energy = 0;
  for (let k = 0; k < n; k++) {
    const kind = weighted(s, [['item', 70], ['coins', 20], ['energy', 10]]);
    if (kind === 'coins') coins += Math.round((4 + rand(s) * 8) * it.l);
    else if (kind === 'energy') energy += 5 * it.l;
    else {
      // the chest's own cell first, then the nearest free ones
      const to = s.board[cell] ? nearestEmpty(s, cell) : cell;
      if (to < 0) {
        coins += 5 * it.l; // no room: paid out in coins instead of lost
        continue;
      }
      const c = chains[Math.floor(rand(s) * chains.length)];
      const l = Math.min(maxLevel(c) - 1, weighted(s, [[1, 50], [2, 30], [3, 15], [4, 5]]) + it.l - 1);
      s.board[to] = { c, l };
      drops.push({ cell: to, item: s.board[to] });
    }
  }
  s.coins += coins;
  s.energy += energy;
  s.stats.chests++;
  return { ok: true, drops, coins, energy };
}

// ---- orders
// Early orders ask for what the first merges make; later ones reach higher.
export function makeOrder(s) {
  const chains = unlockedChains(s);
  const lvl = level(s);
  const easy = s.served < 3;
  const count = easy ? 1 : weighted(s, [[1, 45], [2, 40], [3, 15]]);
  const want = [];
  for (let k = 0; k < count; k++) {
    const c = chains[Math.floor(rand(s) * chains.length)];
    const top = Math.min(maxLevel(c) - 1, easy ? 2 : 2 + Math.floor(lvl / 2));
    const l = Math.max(2, top - Math.floor(rand(s) * 2));
    want.push({ c, l });
  }
  const points = want.reduce((t, w) => t + 2 ** w.l, 0);
  return {
    who: CUSTOMERS[Math.floor(rand(s) * CUSTOMERS.length)],
    want,
    coins: Math.round(points * 1.5),
    xp: points,
    // one order in six also pays a crate
    chest: rand(s) < 1 / 6 ? 1 : 0,
  };
}
// the board cells that would fill order o, or null if something is missing
export function orderCells(s, o) {
  const used = new Set();
  const cells = [];
  for (const w of o.want) {
    const i = s.board.findIndex((x, j) => !used.has(j) && isItem(x) && x.c === w.c && x.l === w.l);
    if (i < 0) return null;
    used.add(i);
    cells.push(i);
  }
  return cells;
}
// how close an order is: items already on the board, of how many
export const orderProgress = (s, o) => {
  const used = new Set();
  let have = 0;
  for (const w of o.want) {
    const i = s.board.findIndex((x, j) => !used.has(j) && isItem(x) && x.c === w.c && x.l === w.l);
    if (i >= 0) {
      used.add(i);
      have++;
    }
  }
  return { have, of: o.want.length };
};
export function fillOrder(s, k) {
  const o = s.orders[k];
  if (!o) return { ok: false, reason: 'No such order' };
  const cells = orderCells(s, o);
  if (!cells) return { ok: false, reason: 'Not everything is on the board yet' };
  const before = level(s);
  for (const i of cells) s.board[i] = null;
  s.coins += o.coins;
  s.xp += o.xp;
  s.served++;
  let chestCell = -1;
  if (o.chest) {
    chestCell = s.board.findIndex((x) => !x);
    if (chestCell >= 0) s.board[chestCell] = { c: 'chest', l: o.chest };
    else s.coins += 10; // no room for the crate: its worth in coins
  }
  s.orders[k] = makeOrder(s);
  return { ok: true, levelUp: levelUp(s, before), coins: o.coins, xp: o.xp, chestCell };
}

// Every generator the player's level has earned, on the board. Run after
// anything that gives xp (a merge can cross a level too), and on load, so a
// generator is never missed however the level was reached.
export function checkUnlocks(s) {
  const onBoard = new Set(s.board.filter(isGen).map((x) => x.g));
  const opened = [];
  for (const [g, gen] of Object.entries(GENERATORS)) {
    if (gen.unlock <= level(s) && !onBoard.has(g)) {
      let cell = GEN_CELLS[g];
      if (s.board[cell]) {
        // something is sitting where it goes: move that out of the way
        const to = nearestEmpty(s, cell);
        if (to >= 0) s.board[to] = s.board[cell];
        else s.coins += isItem(s.board[cell]) ? sellValue(s.board[cell]) : 0;
      }
      s.board[cell] = { g };
      opened.push(g);
    }
  }
  return opened;
}
const levelUp = (s, before) => {
  const opened = checkUnlocks(s);
  return level(s) > before || opened.length ? { level: level(s), generators: opened } : null;
};

// ---- the mine site
export const nextProject = (s) => ({ area: s.area, index: s.built, name: projectName(s.area, s.built), cost: projectCost(s.area, s.built) });
export function build(s) {
  const p = nextProject(s);
  if (s.coins < p.cost) return { ok: false, reason: `Needs ${p.cost} coins` };
  const before = level(s);
  s.coins -= p.cost;
  s.xp += 10 + 5 * s.area;
  s.built++;
  let areaDone = null;
  if (s.built >= PROJECTS_PER_AREA) {
    areaDone = areaName(s.area);
    s.area++;
    s.built = 0;
    // finishing an area pays a strongbox
    const at = s.board.findIndex((x) => !x);
    if (at >= 0) s.board[at] = { c: 'chest', l: 2 };
  }
  return { ok: true, project: p, areaDone, levelUp: levelUp(s, before) };
}

// ---- saving: a save from an older or broken copy is refused, not trusted
export function load(json, now = Date.now()) {
  const s = typeof json === 'string' ? JSON.parse(json) : json;
  if (!s || s.v !== 1 || !Array.isArray(s.board) || s.board.length !== CELLS) throw new Error('Save does not fit this version');
  checkUnlocks(s);
  return tickEnergy(s, now);
}
