// Leap Legends: the wallet, lives, gear, avatars and daily streak. Pure
// functions over a plain state object, time passed in, so the rules can be
// tested and the same file can later run on a server.
//
// Two currencies: coins (picked up in runs, earned from daily rewards) and
// gems (bought, or a few from the daily streak). Real money only ever buys
// gems, remove ads, or a lives refill; everything else is priced in coins or
// gems here. Store prices in real money are set in Play Console, never here.

export const LIVES = { max: 5, regenMs: 20 * 60 * 1000 };

export const GEAR = {
  boots: { name: 'Spring boots', what: 'Jump 5% higher a level', base: 150 },
  magnet: { name: 'Coin magnet', what: 'Pull coins in from further away', base: 120 },
  rocket: { name: 'Rocket start', what: 'Launch each run with half a second more rocket a level', base: 200 },
  shield: { name: 'Shield', what: 'Survive a hit (one per two levels)', base: 250 },
};
export const MAX_LEVEL = 5;
// each level costs 1.8 times the last; level 5 is where the pay to win bites
export const upgradeCost = (key, level) => Math.round(GEAR[key].base * 1.8 ** level);
// skip the grind: any upgrade for gems instead (one gem per 25 coins, rounded up)
export const upgradeGems = (key, level) => Math.ceil(upgradeCost(key, level) / 25);

export const AVATARS = [
  { id: 'hopper', name: 'Hopper', price: 0 },
  { id: 'sprout', name: 'Sprout', coins: 500 },
  { id: 'blaze', name: 'Blaze', coins: 1500 },
  { id: 'frost', name: 'Frost', coins: 3000 },
  { id: 'nova', name: 'Nova', gems: 60 },
  { id: 'king', name: 'King', gems: 120 },
  { id: 'ghost', name: 'Ghost', gems: 200 },
  { id: 'legend', name: 'Legend', gems: 400 },
  // season pass only: never for sale, earned on the paid track
  { id: 'comet', name: 'Comet', season: 10 },
  { id: 'titan', name: 'Titan', season: 20 },
  { id: 'zenith', name: 'Zenith', season: 30 },
];

// What each Play product gives. The ids must match Play Console.
export const PRODUCTS = {
  gems_small: { gems: 80 },
  gems_medium: { gems: 450 },
  gems_large: { gems: 1000 },
  remove_ads: { adsOff: true },
  lives_refill: { refill: true },
  piggy_bank: { piggy: true }, // smash the pig: every gem saved in it
  starter_pack: { starter: true }, // once, in the first 48 hours
  season_pass: { season: true }, // the paid track of this month's season
  vip_weekly: { vipDays: 7 }, // a subscription: each renewal grants 7 more days
};

// The piggy bank fills a gem per 40 m climbed, up to 300, and only a
// purchase opens it; it can be bought once there is something worth it.
export const PIGGY = { metresPerGem: 40, cap: 300, min: 60 };
// The starter pack: shown for 48 hours from the first run, bought once.
export const STARTER = { hours: 48, gems: 300, avatar: 'blaze', boots: 1 };
// A season is a calendar month: 30 tiers, 400 xp a tier, a metre climbed is an xp.
export const SEASON = { tiers: 30, xpPerTier: 400 };
export const FREEZE = { gems: 30, max: 2 };
export const VIP = { lives: 6, coins: 2 };

export const DAILY = [
  { coins: 50 },
  { coins: 75 },
  { coins: 100 },
  { coins: 150, gems: 2 },
  { coins: 200 },
  { coins: 300 },
  { coins: 400, gems: 10 },
];

export const REVIVE_GEMS = [10, 20, 40, 80];
export const REFILL_GEMS = 25;

export function fresh(now) {
  return {
    coins: 0,
    gems: 20, // a starter handful, enough for a first revive and a taste of the shop
    lives: LIVES.max,
    livesAt: now,
    adsOff: false,
    avatars: ['hopper'],
    avatar: 'hopper',
    gear: { boots: 0, magnet: 0, rocket: 0, shield: 0 },
    daily: { last: null, streak: 0 },
    best: 0,
    week: null,
    weekBest: 0,
    runs: 0,
    bought: [],
    piggy: 0,
    firstRunAt: null,
    starterBought: false,
    season: null,
    freezes: 0,
    vipUntil: 0,
  };
}

export const isVip = (s, now) => now < (s.vipUntil || 0);
export const adsOff = (s, now) => s.adsOff || isVip(s, now);
export const maxLives = (s, now) => (isVip(s, now) ? VIP.lives : LIVES.max);

// lives come back one every 20 minutes up to five (six for VIP); above that
// (a refill bought over the top) they do not regenerate but are not taken away
export function tickLives(s, now) {
  const cap = maxLives(s, now);
  if (s.lives >= cap) return { ...s, livesAt: now };
  const earned = Math.floor((now - s.livesAt) / LIVES.regenMs);
  if (earned <= 0) return s;
  const lives = Math.min(cap, s.lives + earned);
  return { ...s, lives, livesAt: lives >= cap ? now : s.livesAt + earned * LIVES.regenMs };
}
export const nextLifeIn = (s, now) => (s.lives >= maxLives(s, now) ? 0 : Math.max(0, s.livesAt + LIVES.regenMs - now));

export function startRun(s, now) {
  const t = tickLives(s, now);
  if (t.lives <= 0) throw new Error('No lives left');
  // the regen clock starts from the first life spent, not from when they were full
  return { ...t, lives: t.lives - 1, livesAt: t.lives >= maxLives(t, now) ? now : t.livesAt, runs: t.runs + 1, firstRunAt: t.firstRunAt ?? now };
}
export const addLife = (s, n = 1) => ({ ...s, lives: s.lives + n });

// the ISO week a moment falls in, for the weekly best (and the weekly board)
export function weekOf(now) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const n = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}

export function endRun(s, { height, coins }, now) {
  const week = weekOf(now);
  const weekBest = s.week === week ? s.weekBest : 0;
  const season = ensureSeason(s, now).season;
  return {
    ...s,
    coins: s.coins + coins * (isVip(s, now) ? VIP.coins : 1),
    piggy: Math.min(PIGGY.cap, (s.piggy || 0) + Math.floor(height / PIGGY.metresPerGem)),
    season: { ...season, xp: season.xp + Math.floor(height) },
    best: Math.max(s.best, height),
    week,
    weekBest: Math.max(weekBest, height),
    newBest: height > s.best,
    newWeekBest: height > weekBest,
  };
}

function pay(s, { coins = 0, gems = 0 }) {
  if (s.coins < coins) throw new Error(`Needs ${coins - s.coins} more coins`);
  if (s.gems < gems) throw new Error(`Needs ${gems - s.gems} more gems`);
  return { ...s, coins: s.coins - coins, gems: s.gems - gems };
}

export function upgrade(s, key, currency = 'coins') {
  if (!GEAR[key]) throw new Error('Unknown gear');
  const level = s.gear[key] || 0;
  if (level >= MAX_LEVEL) throw new Error('Already maxed');
  const paid = pay(s, currency === 'gems' ? { gems: upgradeGems(key, level) } : { coins: upgradeCost(key, level) });
  return { ...paid, gear: { ...s.gear, [key]: level + 1 } };
}

export function buyAvatar(s, id) {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) throw new Error('Unknown avatar');
  if (s.avatars.includes(id)) return { ...s, avatar: id };
  if (a.season) throw new Error(`Earned at tier ${a.season} of the season pass`);
  const paid = pay(s, { coins: a.coins || 0, gems: a.gems || 0 });
  return { ...paid, avatars: [...s.avatars, id], avatar: id };
}

export const reviveCost = (revivesThisRun) => REVIVE_GEMS[Math.min(revivesThisRun, REVIVE_GEMS.length - 1)];
export const payRevive = (s, revivesThisRun) => pay(s, { gems: reviveCost(revivesThisRun) });
export const refillWithGems = (s, now = Date.now()) => ({ ...pay(s, { gems: REFILL_GEMS }), lives: Math.max(s.lives, maxLives(s, now)) });

// a verified Play purchase arrived: grant it. `token` makes it idempotent, so
// the same purchase replayed (restart, restore) is never granted twice.
export function grant(s, productId, token, now = Date.now()) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error('Unknown product ' + productId);
  if (token && s.bought.includes(token)) return s;
  let n = { ...s, bought: token ? [...s.bought, token] : s.bought };
  if (p.gems) n = { ...n, gems: n.gems + p.gems };
  if (p.adsOff) n = { ...n, adsOff: true };
  if (p.refill) n = { ...n, lives: Math.max(n.lives, maxLives(n, now)) };
  if (p.piggy) n = { ...n, gems: n.gems + (n.piggy || 0), piggy: 0 };
  if (p.starter) {
    n = { ...n, starterBought: true, gems: n.gems + STARTER.gems, avatars: n.avatars.includes(STARTER.avatar) ? n.avatars : [...n.avatars, STARTER.avatar] };
    n = { ...n, gear: { ...n.gear, boots: Math.min(MAX_LEVEL, (n.gear.boots || 0) + STARTER.boots) } };
  }
  if (p.season) {
    const e = ensureSeason(n, now);
    n = { ...e, season: { ...e.season, premium: true } };
  }
  if (p.vipDays) n = { ...n, vipUntil: Math.max(now, n.vipUntil || 0) + p.vipDays * 86400000 };
  return n;
}

// ---- the piggy bank
export const piggyReady = (s) => (s.piggy || 0) >= PIGGY.min;

// ---- the starter pack: how long it is still on offer, or 0
export function starterLeft(s, now) {
  if (s.starterBought || !s.firstRunAt) return 0;
  return Math.max(0, s.firstRunAt + STARTER.hours * 3600000 - now);
}

// ---- the season pass
export const seasonId = (now) => new Date(now).toISOString().slice(0, 7);
export function ensureSeason(s, now) {
  const id = seasonId(now);
  if (s.season && s.season.id === id) return s;
  return { ...s, season: { id, xp: 0, premium: false, free: [], paid: [] } };
}
export const seasonTier = (season) => Math.min(SEASON.tiers, Math.floor(season.xp / SEASON.xpPerTier));
export function seasonEndsIn(now) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - now;
}
export function seasonReward(tier, track) {
  if (track === 'free') return tier % 5 === 0 ? { gems: 5 } : { coins: 50 + tier * 10 };
  const avatar = AVATARS.find((a) => a.season === tier);
  if (avatar) return { avatar: avatar.id, gems: 20 };
  return tier % 5 === 0 ? { gems: 40, coins: 500 } : { gems: 8, coins: 100 };
}
export function claimSeason(s, tier, track, now) {
  const n = ensureSeason(s, now);
  const se = n.season;
  if (tier < 1 || tier > seasonTier(se)) throw new Error(`Reach tier ${tier} first`);
  if (track === 'paid' && !se.premium) throw new Error('That is on the season pass');
  if (se[track].includes(tier)) throw new Error('Already claimed');
  const r = seasonReward(tier, track);
  return {
    ...n,
    coins: n.coins + (r.coins || 0),
    gems: n.gems + (r.gems || 0),
    avatars: r.avatar && !n.avatars.includes(r.avatar) ? [...n.avatars, r.avatar] : n.avatars,
    season: { ...se, [track]: [...se[track], tier] },
  };
}

// ---- streak freezes: bought ahead, each one covers a missed day
export function buyFreeze(s) {
  if ((s.freezes || 0) >= FREEZE.max) throw new Error(`You can hold ${FREEZE.max}`);
  return { ...pay(s, { gems: FREEZE.gems }), freezes: (s.freezes || 0) + 1 };
}

const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
export function dailyReady(s, now) {
  return s.daily.last !== dayKey(now);
}
// log in on consecutive days to climb the streak; miss a day and it starts again
export function claimDaily(s, now) {
  const today = dayKey(now);
  if (s.daily.last === today) throw new Error('Already claimed today');
  // days missed since the last claim; freezes cover them one each
  const missed = s.daily.last ? Math.round((Date.parse(today) - Date.parse(s.daily.last)) / 86400000) - 1 : Infinity;
  const freezes = s.freezes || 0;
  const kept = missed === 0 || (missed > 0 && missed <= freezes);
  const streak = kept ? s.daily.streak + 1 : 1;
  const used = kept && missed > 0 ? missed : 0;
  const reward = DAILY[(streak - 1) % DAILY.length];
  return { state: { ...s, freezes: freezes - used, coins: s.coins + (reward.coins || 0), gems: s.gems + (reward.gems || 0), daily: { last: today, streak } }, reward, streak, frozeUsed: used };
}
