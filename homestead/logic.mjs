// Homestead: the rules (Claude). A slice of a FarmVille / Hay Day style
// game on an Aussie cattle station, to test with real players before the
// full build (Ryan, 29 Sep 2026: "also farmville that was widely successful
// for a bit" ... "yeah do it"). Pure: every function takes the time it is
// told (now, in ms), so tests can run a week in a second and the screen can
// use a clock the phone's settings cannot wind forward (clock.mjs).
//
// The loop: plant crops and wait; turn crops into feed at the mill; feed the
// chooks and the cows and wait; fill the road train's orders for coins and
// XP; spend coins on more paddocks; levels open new crops and animals.
// Things take real minutes and hours, so there is always a reason to come
// back later, and a rewarded ad can halve one wait.

export const CROPS = {
  wheat: { name: 'Wheat', grow: 2 * 60e3, level: 1, yield: 2, value: 3, xp: 1 },
  sorghum: { name: 'Sorghum', grow: 5 * 60e3, level: 1, yield: 2, value: 5, xp: 1 },
  canola: { name: 'Canola', grow: 20 * 60e3, level: 3, yield: 2, value: 9, xp: 2 },
};
export const FEEDS = {
  chookFeed: { name: 'Chook feed', level: 1, time: 5 * 60e3, needs: { wheat: 2, sorghum: 1 }, makes: 3, value: 6, xp: 1 },
  cattleFeed: { name: 'Cattle feed', level: 4, time: 10 * 60e3, needs: { sorghum: 2, canola: 1 }, makes: 3, value: 12, xp: 2 },
};
export const ANIMALS = {
  chook: { name: 'Chook', eats: 'chookFeed', time: 20 * 60e3, gives: 'egg', level: 1, count: 3, max: 9, price: 30 },
  cow: { name: 'Cow', eats: 'cattleFeed', time: 60 * 60e3, gives: 'milk', level: 4, count: 2, max: 6, price: 120 },
};
export const PRODUCE = {
  egg: { name: 'Eggs', value: 12, xp: 2 },
  milk: { name: 'Milk', value: 25, xp: 4 },
};
export const ITEMS = { ...CROPS, ...FEEDS, ...PRODUCE };
export const itemName = (id) => ITEMS[id].name;

export const START_PADDOCKS = 6;
export const MAX_PADDOCKS = 18;
export const paddockCost = (n) => Math.round(40 * 1.35 ** (n - START_PADDOCKS));
export const MILL_QUEUE = 2;
export const MILL_MAX = 5;
export const millSlotCost = (n) => Math.round(80 * 1.6 ** (n - MILL_QUEUE));
export const animalCost = (kind, n) => Math.round(ANIMALS[kind].price * 1.3 ** (n - ANIMALS[kind].count));
export const ORDER_SLOTS = 6;
export const ORDER_WAIT = 60e3; // a skipped order is replaced after a minute
export const xpForLevel = (lvl) => Math.round(20 * (lvl - 1) ** 1.9);
export function levelFor(xp) {
  let l = 1;
  while (xp >= xpForLevel(l + 1)) l++;
  return l;
}

function rand(s) {
  let a = (s.seed + Math.imul(s.draws++, 0x9e3779b1)) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b) >>> 0;
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35) >>> 0;
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

export function newStation(seed, now) {
  const s = {
    v: 1,
    seed: seed >>> 0,
    draws: 0,
    coins: 40,
    xp: 0,
    shed: { wheat: 4, sorghum: 2 }, // what is in the machinery shed
    paddocks: Array.from({ length: START_PADDOCKS }, () => ({ crop: null, ready: 0 })),
    mill: [], // [{ feed, ready }]
    millSlots: MILL_QUEUE,
    animals: Object.fromEntries(Object.entries(ANIMALS).map(([k, a]) => [k, Array.from({ length: a.count }, () => ({ ready: 0, fed: false, sped: false }))])),
    orders: [],
    stats: { harvests: 0, orders: 0, fed: 0 },
  };
  fillOrders(s, now);
  return s;
}
export const level = (s) => levelFor(s.xp);
const have = (s, id) => s.shed[id] || 0;
const add = (s, id, n) => (s.shed[id] = have(s, id) + n);
const take = (s, id, n) => {
  s.shed[id] = have(s, id) - n;
  if (!s.shed[id]) delete s.shed[id];
};
function gain(s, xp) {
  const before = level(s);
  s.xp += xp;
  const after = level(s);
  return after > before ? { level: after, unlocked: unlocksAt(after) } : null;
}
export function unlocksAt(lvl) {
  const out = [];
  for (const [k, c] of Object.entries(CROPS)) if (c.level === lvl) out.push(c.name);
  for (const [k, f] of Object.entries(FEEDS)) if (f.level === lvl) out.push(f.name);
  for (const [k, a] of Object.entries(ANIMALS)) if (a.level === lvl) out.push(a.name + 's');
  return out;
}

// ---- paddocks
// Planting is free. It used to cost one of the crop (Hay Day's rule), and the
// test bot soft-locked on day 1: its last sorghum went into chook feed, so no
// sorghum could be planted, so no feed, no eggs, no orders, no coins. The
// harvest is the reward; nothing can leave a station unable to start again.
export function plant(s, i, crop, now) {
  const p = s.paddocks[i];
  const c = CROPS[crop];
  if (!p) return { ok: false, reason: 'No such paddock' };
  if (!c || c.level > level(s)) return { ok: false, reason: 'Not open yet' };
  if (p.crop) return { ok: false, reason: 'Already planted' };
  p.crop = crop;
  p.ready = now + c.grow;
  p.sped = false;
  return { ok: true };
}
export function harvest(s, i, now) {
  const p = s.paddocks[i];
  if (!p || !p.crop) return { ok: false, reason: 'Nothing planted' };
  if (now < p.ready) return { ok: false, reason: 'Not ready', left: p.ready - now };
  const c = CROPS[p.crop];
  add(s, p.crop, c.yield);
  s.stats.harvests++;
  const got = { item: p.crop, n: c.yield };
  p.crop = null;
  p.ready = 0;
  return { ok: true, got, levelUp: gain(s, c.xp) };
}
export function buyPaddock(s) {
  const n = s.paddocks.length;
  if (n >= MAX_PADDOCKS) return { ok: false, reason: 'No more land in this slice' };
  const cost = paddockCost(n + 1);
  if (s.coins < cost) return { ok: false, reason: `Needs ${cost} coins` };
  s.coins -= cost;
  s.paddocks.push({ crop: null, ready: 0 });
  return { ok: true, cost };
}

// ---- spending coins: more of what makes things (the station grows with its orders)
export function buyMillSlot(s) {
  if (s.millSlots >= MILL_MAX) return { ok: false, reason: 'The mill is as big as it gets' };
  const cost = millSlotCost(s.millSlots + 1);
  if (s.coins < cost) return { ok: false, reason: `Needs ${cost} coins` };
  s.coins -= cost;
  s.millSlots++;
  return { ok: true, cost };
}
export function buyAnimal(s, kind) {
  const a = ANIMALS[kind];
  if (!a || a.level > level(s)) return { ok: false, reason: 'Not open yet' };
  const n = s.animals[kind].length;
  if (n >= a.max) return { ok: false, reason: `The ${a.name.toLowerCase()} pen is full` };
  const cost = animalCost(kind, n + 1);
  if (s.coins < cost) return { ok: false, reason: `Needs ${cost} coins` };
  s.coins -= cost;
  s.animals[kind].push({ ready: 0, fed: false, sped: false });
  return { ok: true, cost };
}

// ---- the feed mill
export function mill(s, feed, now) {
  const f = FEEDS[feed];
  if (!f || f.level > level(s)) return { ok: false, reason: 'Not open yet' };
  if (s.mill.length >= s.millSlots) return { ok: false, reason: 'The mill is busy' };
  for (const [id, n] of Object.entries(f.needs)) if (have(s, id) < n) return { ok: false, reason: `Needs ${n} ${itemName(id).toLowerCase()}` };
  for (const [id, n] of Object.entries(f.needs)) take(s, id, n);
  // queued jobs run one after another
  const start = Math.max(now, ...s.mill.map((j) => j.ready));
  s.mill.push({ feed, ready: start + f.time, sped: false });
  return { ok: true };
}
export function collectMill(s, now) {
  const done = s.mill.filter((j) => j.ready <= now);
  if (!done.length) return { ok: false, reason: 'Nothing finished' };
  s.mill = s.mill.filter((j) => j.ready > now);
  let xp = 0;
  const got = [];
  for (const j of done) {
    add(s, j.feed, FEEDS[j.feed].makes);
    xp += FEEDS[j.feed].xp;
    got.push({ item: j.feed, n: FEEDS[j.feed].makes });
  }
  return { ok: true, got, levelUp: gain(s, xp) };
}

// ---- animals: feed one, wait, collect
export function feed(s, kind, idx, now) {
  const a = ANIMALS[kind];
  const b = s.animals[kind]?.[idx];
  if (!a || !b || a.level > level(s)) return { ok: false, reason: 'Not open yet' };
  if (b.fed) return { ok: false, reason: now >= b.ready ? 'Ready to collect' : 'Already fed' };
  if (!have(s, a.eats)) return { ok: false, reason: `Needs ${itemName(a.eats).toLowerCase()}` };
  take(s, a.eats, 1);
  b.fed = true;
  b.ready = now + a.time;
  b.sped = false;
  s.stats.fed++;
  return { ok: true };
}
export function collect(s, kind, idx, now) {
  const a = ANIMALS[kind];
  const b = s.animals[kind]?.[idx];
  if (!b || !b.fed) return { ok: false, reason: 'Not fed' };
  if (now < b.ready) return { ok: false, reason: 'Not ready', left: b.ready - now };
  b.fed = false;
  b.ready = 0;
  add(s, a.gives, 1);
  return { ok: true, got: { item: a.gives, n: 1 }, levelUp: gain(s, PRODUCE[a.gives].xp) };
}

// ---- speeding up: a watched ad halves what is left on one timer, once
// target: { paddock: i } | { mill: j } | { animal: [kind, idx] }
export function speedUp(s, target, now) {
  const t = target.paddock !== undefined ? s.paddocks[target.paddock] : target.mill !== undefined ? s.mill[target.mill] : s.animals[target.animal?.[0]]?.[target.animal?.[1]];
  if (!t || !t.ready || t.ready <= now) return { ok: false, reason: 'Nothing waiting there' };
  if (t.sped) return { ok: false, reason: 'Already sped up once' };
  t.ready = now + Math.ceil((t.ready - now) / 2);
  t.sped = true;
  return { ok: true, ready: t.ready };
}

// ---- the road train's orders
const unlockedItems = (s) => Object.entries(ITEMS).filter(([id]) => (CROPS[id]?.level ?? FEEDS[id]?.level ?? Object.values(ANIMALS).find((a) => a.gives === id)?.level) <= level(s)).map(([id]) => id);
export function makeOrder(s) {
  const pool = unlockedItems(s);
  const lvl = level(s);
  const kinds = Math.min(pool.length, 1 + Math.floor(rand(s) * Math.min(3, 1 + lvl / 2)));
  const want = {};
  while (Object.keys(want).length < kinds) {
    const id = pool[Math.floor(rand(s) * pool.length)];
    if (want[id]) continue;
    const base = ITEMS[id].value <= 6 ? 3 : ITEMS[id].value <= 12 ? 2 : 1;
    // orders grow a little with level, never past what a station can make
    want[id] = base + Math.floor(rand(s) * (1 + Math.min(lvl, 8) / 4));
  }
  const worth = Object.entries(want).reduce((t, [id, n]) => t + ITEMS[id].value * n, 0);
  return { want, coins: Math.round(worth * 1.4), xp: Math.max(1, Math.round(worth / 6)), wait: 0 };
}
export function fillOrders(s, now) {
  while (s.orders.length < ORDER_SLOTS) s.orders.push(makeOrder(s));
  for (const [k, o] of s.orders.entries()) if (o.wait && o.wait <= now) s.orders[k] = makeOrder(s);
}
export const canFill = (s, o) => !o.wait && Object.entries(o.want).every(([id, n]) => have(s, id) >= n);
export function fillOrder(s, k, now) {
  const o = s.orders[k];
  if (!o || o.wait) return { ok: false, reason: 'No order there' };
  if (!canFill(s, o)) return { ok: false, reason: 'Not everything is in the shed' };
  for (const [id, n] of Object.entries(o.want)) take(s, id, n);
  s.coins += o.coins;
  s.stats.orders++;
  s.orders[k] = makeOrder(s);
  return { ok: true, coins: o.coins, xp: o.xp, levelUp: gain(s, o.xp) };
}
export function skipOrder(s, k, now) {
  const o = s.orders[k];
  if (!o || o.wait) return { ok: false, reason: 'No order there' };
  s.orders[k] = { want: {}, coins: 0, xp: 0, wait: now + ORDER_WAIT };
  return { ok: true };
}

// ---- what is ready now, for the screen and for reminders
export function nextReady(s, now) {
  const times = [...s.paddocks.filter((p) => p.crop).map((p) => p.ready), ...s.mill.map((j) => j.ready), ...Object.values(s.animals).flat().filter((b) => b.fed).map((b) => b.ready)].filter((t) => t > now);
  return times.length ? Math.min(...times) : null;
}

// ---- saving: a save from another version is refused, not trusted
export function load(json) {
  const s = typeof json === 'string' ? JSON.parse(json) : json;
  if (s && s.millSlots === undefined) s.millSlots = MILL_QUEUE;
  if (!s || s.v !== 1 || !Array.isArray(s.paddocks) || !s.animals || !s.shed) throw new Error('Save does not fit this version');
  return s;
}
