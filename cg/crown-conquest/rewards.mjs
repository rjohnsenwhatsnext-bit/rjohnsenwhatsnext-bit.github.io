// Crown & Conquest: rewarded ads hand out what the Treasury lists (Claude, for
// Ryan, 13 Oct 2026: "Make the rewarded ads give out the stuff that would be
// from the shop"). Real-money checkout stays closed (commerce.mjs); this is the
// free way to the same things.
//
// The rules, so the ads do not flatten the game:
// - a supply pack or a war chest costs one ad, and each can be had once a day
// - a flag, a skin or a power unlock is kept for good, so it costs several ads;
//   the count is kept between days
// - an age is never given for an ad: ages are earned with XP
// Nothing here shows an ad. The screen asks blocked() first, shows the ad, and
// only then calls grant(), so a reward is never given for an ad that did not
// finish.
import { PRODUCTS, FEATURES, FLAGS, SKINS, hasFeature } from './catalog.mjs';
import { armyCount, population } from './town.mjs';

const ONCE_A_DAY = ['consumable', 'loot'];
const FIVE_CHESTS = 'crown.chest.war5'; // five for one ad would make the single chest pointless

// How many ads a product costs, or 0 when ads never give it.
export function adsFor(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p || p.type === 'age' || id === FIVE_CHESTS) return 0;
  if (ONCE_A_DAY.includes(p.type)) return 1;
  if (p.type === 'unlock') return 4;
  return SKINS.some((s) => s.product === id) ? 5 : 3;
}

// The kingdom's ad record. An older save has none; a new day clears the daily list.
export function adState(s, day) {
  const a = s.ads && typeof s.ads === 'object' ? s.ads : {};
  s.ads = {
    day: typeof a.day === 'string' ? a.day : day,
    claimed: Array.isArray(a.claimed) ? a.claimed.filter((x) => typeof x === 'string').slice(0, 40) : [],
    progress: a.progress && typeof a.progress === 'object' ? a.progress : {},
    ...(typeof a.chestDay === 'string' ? { chestDay: a.chestDay } : {}),
  };
  if (s.ads.day !== day) {
    s.ads.day = day;
    s.ads.claimed = [];
  }
  return s.ads;
}

export const adsWatched = (s, id, day) => Math.max(0, Math.floor(Number(adState(s, day).progress[id]) || 0));

const owned = (s, id) => {
  const flag = FLAGS.find((f) => f.product === id);
  if (flag) return s.flags.includes(flag.id);
  const skin = SKINS.find((k) => k.product === id);
  if (skin) return s.skins.includes(skin.id);
  const feature = FEATURES.find((f) => f.product === id);
  return feature ? hasFeature(s, feature.id) : false;
};

// Why this cannot be had for an ad right now, in words for the player, or null.
export function blocked(s, id, day) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p || !adsFor(id)) return 'This is not available for an ad.';
  if (ONCE_A_DAY.includes(p.type)) {
    if (adState(s, day).claimed.includes(id)) return 'Already collected today. It is back tomorrow.';
    if (id === 'crown.pack.builders' && !s.jobs.some((j) => j.kind !== 'train')) return 'Nothing is being built right now.';
    if (id === 'crown.pack.reinforcements' && population(s) - armyCount(s) < 12) return 'You need 12 free army places. Build cottages first.';
    return null;
  }
  return owned(s, id) ? 'You already have this.' : null;
}

// Call only after the ad reported its reward. Returns what to tell the player.
export function grant(s, id, day) {
  const no = blocked(s, id, day);
  if (no) return { given: false, message: no };
  const p = PRODUCTS.find((x) => x.id === id);
  const a = adState(s, day);
  if (ONCE_A_DAY.includes(p.type)) {
    if (id === 'crown.pack.provisions') for (const k of ['food', 'wood', 'stone', 'gold']) s.resources[k] = Math.min(50000, s.resources[k] + 1000);
    else if (id === 'crown.pack.experience') s.xp += 500;
    else if (id === 'crown.pack.builders') {
      // due now: the kingdom's own clock completes them on its next tick
      for (const j of s.jobs) if (j.kind !== 'train') j.end = Math.min(j.end, s.last);
    } else if (id === 'crown.pack.reinforcements') {
      s.army.sword += 8;
      s.army.archer += 4;
    } else if (id === 'crown.chest.war') s.chests = Math.min(1000, s.chests + 1);
    else return { given: false, message: 'This is not available for an ad.' };
    a.claimed.push(id);
    return { given: true, message: p.name + ' received.' };
  }
  const need = adsFor(id);
  const have = adsWatched(s, id, day) + 1;
  if (have < need) {
    a.progress[id] = have;
    return { given: true, message: `${have} of ${need} ads towards ${p.name}.` };
  }
  delete a.progress[id];
  const flag = FLAGS.find((f) => f.product === id);
  const skin = SKINS.find((k) => k.product === id);
  const feature = FEATURES.find((f) => f.product === id);
  if (flag) s.flags.push(flag.id);
  else if (skin) s.skins.push(skin.id);
  else if (feature) s.unlocks.push(feature.id);
  return { given: true, message: p.name + ' is yours for good.' };
}

// One free war chest on the first visit of each day: the reason to open the game
// tomorrow. Returns true when it was just given. A kingdom's very first day is
// not counted, because a new kingdom already starts with a chest.
export function dailyChest(s, day) {
  const a = adState(s, day);
  if (a.chestDay === day) return false;
  const first = typeof a.chestDay !== 'string';
  a.chestDay = day;
  if (first) return false;
  s.chests = Math.min(1000, s.chests + 1);
  s.log.unshift('A new day: one free war chest.');
  s.log = s.log.slice(0, 8);
  return true;
}
