// Crown & Conquest: the reasons to come back (Claude, for Ryan, 13 Oct 2026).
//   streak       a reward for each day in a row, biggest on day 7
//   quests       three small jobs a day, and a chest for doing all three
//   pity         an Epic or better at least every PITY chests
//   album        every flag and skin, with chests for filling it
//   event        a flag that can only be won on a weekend
//   difficulty   easier or harder campaign battles, with rewards to match
// Rules only: no screen, no clock, no network. The day is passed in as
// 'YYYY-MM-DD' (the phone's own date), so every rule here is tested.
// All of it lives in s.engage, which an older save does not have.
import { FLAGS, SKINS } from './catalog.mjs';

const RES = ['food', 'wood', 'stone', 'gold'];
const dayNumber = (day) => Math.round(Date.parse(day + 'T00:00:00Z') / 86400000);
const addRes = (s, n) => RES.forEach((k) => (s.resources[k] = Math.min(50000, s.resources[k] + n)));
const addChests = (s, n) => (s.chests = Math.min(1000, s.chests + n));

export function engageState(s) {
  const e = s.engage && typeof s.engage === 'object' ? s.engage : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  s.engage = {
    streak: { day: typeof e.streak?.day === 'string' ? e.streak.day : '', count: Math.max(0, Math.floor(Number(e.streak?.count) || 0)) },
    quests: { day: typeof e.quests?.day === 'string' ? e.quests.day : '', base: obj(e.quests?.base), claimed: Array.isArray(e.quests?.claimed) ? e.quests.claimed.slice(0, 5) : [], bonus: e.quests?.bonus === true },
    pity: Math.max(0, Math.floor(Number(e.pity) || 0)),
    opened: Math.max(0, Math.floor(Number(e.opened) || 0)),
    album: Array.isArray(e.album) ? e.album.filter((x) => typeof x === 'string').slice(0, 40) : [],
    event: { id: typeof e.event?.id === 'string' ? e.event.id : '', base: Math.max(0, Math.floor(Number(e.event?.base) || 0)), claimed: e.event?.claimed === true },
    week: { id: typeof e.week?.id === 'string' ? e.week.id : '', base: Math.max(0, Math.floor(Number(e.week?.base) || 0)) },
    guide: Math.max(0, Math.min(GUIDE.length, Math.floor(Number(e.guide) || 0))),
  };
  return s.engage;
}

// ---- the first five steps: what to do, in order, each paid as it is done
// (Ryan, 13 Oct 2026: "is there a built in tutorial"). Each step is read from
// the kingdom itself, so it cannot be skipped by tapping and cannot get stuck.
const troops = (s) => Object.values(s.army).reduce((a, b) => a + b, 0) + s.jobs.filter((j) => j.kind === 'train').length;
export const GUIDE = [
  { go: 'land', text: 'Tap a tree to send a worker to it', why: 'Workers gather the wood, stone and gold everything is built from.', done: (s) => (s.nodes || []).some((n) => n.workers > 0) },
  { go: 'build', text: 'Tap Build and place a building', why: 'Cottages hold a bigger army. Farms feed it.', done: (s) => s.buildings.length > 7 || s.jobs.some((j) => j.kind === 'build') },
  // every kingdom starts with an army, so this step pays out at once rather than asking for busywork
  { go: 'army', text: 'Tap Army and train a soldier', why: 'You march with whoever is in your army.', done: (s) => troops(s) > 0 || s.battles > 0 },
  { go: 'battle', text: 'Tap here to march on your first battle', why: 'Then tap Advance to send everyone at the enemy keep.', done: (s) => s.wins > 0 },
  { go: 'treasury', text: 'Open a war chest in the Treasury', why: 'Every first victory earns one.', done: (s) => s.engage.opened > 0 },
];
// The step the player is on, or null when the guide is finished.
export function guideView(s) {
  const e = engageState(s);
  if (e.guide >= GUIDE.length) return null;
  const g = GUIDE[e.guide];
  return { step: e.guide + 1, of: GUIDE.length, go: g.go, text: g.text, why: g.why, done: g.done(s) };
}
// Pays the current step if it has been done. Returns { finished } or null.
export function advanceGuide(s) {
  const v = guideView(s);
  if (!v || !v.done) return null;
  s.engage.guide += 1;
  addRes(s, 100);
  const finished = s.engage.guide >= GUIDE.length;
  if (finished) addChests(s, 1);
  return { finished };
}

// ---- the daily streak
export const STREAK = [
  { text: '200 of each resource', give: (s) => addRes(s, 200) },
  { text: 'A war chest', give: (s) => addChests(s, 1) },
  { text: '300 XP', give: (s) => (s.xp += 300) },
  { text: '400 of each resource', give: (s) => addRes(s, 400) },
  { text: 'Two war chests', give: (s) => addChests(s, 2) },
  { text: '600 XP', give: (s) => (s.xp += 600) },
  { text: 'Three war chests and a flag', give: (s, pick) => (addChests(s, 3), giveFlag(s, pick)) },
];
function giveFlag(s, pick = 0) {
  const left = FLAGS.filter((f) => f.product && !s.flags.includes(f.id));
  if (!left.length) return void (s.resources.gold = Math.min(50000, s.resources.gold + 800));
  s.flags.push(left[Math.min(left.length - 1, Math.floor(pick * left.length))].id);
}
// What today's box is, without claiming it.
export function streakView(s, day) {
  const k = engageState(s).streak;
  const claimed = k.day === day;
  const alive = claimed || (k.day && dayNumber(day) - dayNumber(k.day) === 1);
  const count = claimed ? k.count : alive ? k.count + 1 : 1;
  return { claimed, count, box: (count - 1) % STREAK.length, lost: !claimed && !alive && k.count > 1 ? k.count : 0 };
}
export function claimStreak(s, day, pick = 0) {
  const v = streakView(s, day);
  if (v.claimed) return null;
  STREAK[v.box].give(s, pick);
  s.engage.streak = { day, count: v.count };
  return { count: v.count, text: STREAK[v.box].text };
}

// ---- three quests a day, from numbers the kingdom already keeps
const grown = (s) => s.buildings.reduce((n, b) => n + b.level, 0);
export const QUESTS = [
  { id: 'win', text: 'Win a battle', need: 1, of: (s) => s.wins, reward: { gold: 150 } },
  { id: 'fight', text: 'Fight 2 battles', need: 2, of: (s) => s.battles, reward: { food: 250 } },
  { id: 'grow', text: 'Build or upgrade twice', need: 2, of: grown, reward: { wood: 250 } },
  { id: 'xp', text: 'Earn 120 XP', need: 120, of: (s) => Math.floor(s.xp), reward: { stone: 200 } },
  { id: 'chest', text: 'Open a war chest', need: 1, of: (s) => s.engage.opened, reward: { gold: 100 } },
];
const seed = (day) => [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function todays(day) {
  const skip = [seed(day) % QUESTS.length, (seed(day) >>> 3) % (QUESTS.length - 1)];
  const left = QUESTS.filter((_, i) => i !== skip[0]);
  return left.filter((_, i) => i !== skip[1]);
}
export function questView(s, day) {
  const e = engageState(s);
  if (e.quests.day !== day) e.quests = { day, base: Object.fromEntries(QUESTS.map((q) => [q.id, q.of(s)])), claimed: [], bonus: false };
  return todays(day).map((q) => {
    const have = Math.max(0, Math.min(q.need, q.of(s) - (Number(e.quests.base[q.id]) || 0)));
    return { id: q.id, text: q.text, need: q.need, have, done: have >= q.need, claimed: e.quests.claimed.includes(q.id), reward: Object.entries(q.reward).map(([k, n]) => n + ' ' + k).join(', ') };
  });
}
// Returns { bonus } when the reward was given; bonus is true when it was the last of the three.
export function claimQuest(s, day, id) {
  const q = questView(s, day).find((v) => v.id === id);
  if (!q || !q.done || q.claimed) return null;
  for (const [k, n] of Object.entries(QUESTS.find((v) => v.id === id).reward)) s.resources[k] = Math.min(50000, s.resources[k] + n);
  s.engage.quests.claimed.push(id);
  // read after the reward: the base was taken at the start of the day
  const all = todays(day).every((v) => s.engage.quests.claimed.includes(v.id));
  if (all && !s.engage.quests.bonus) {
    s.engage.quests.bonus = true;
    addChests(s, 1);
    return { bonus: true };
  }
  return { bonus: false };
}

// ---- chests: an Epic or better at least every PITY chests
export const PITY = 10;
export const EPIC_ROLL = 0.88; // where Epic starts in catalog.mjs LOOT (60 + 28)
export function pityRoll(s, roll) {
  return engageState(s).pity >= PITY - 1 ? Math.max(roll, EPIC_ROLL) : roll;
}
export function noteChest(s, rarity) {
  const e = engageState(s);
  e.opened += 1;
  e.pity = rarity === 'Epic' || rarity === 'Legendary' ? 0 : e.pity + 1;
}
export const chestsToPity = (s) => PITY - engageState(s).pity;

// ---- the album
export const ALBUM = [
  ...[5, 10, 15, 20].map((n) => ({ id: 'flags' + n, kind: 'flags', need: n, chests: n / 5 })),
  ...[3, 6, 9, 11].map((n, i) => ({ id: 'skins' + n, kind: 'skins', need: n, chests: i + 1 })),
];
export function albumView(s) {
  const e = engageState(s);
  const have = { flags: FLAGS.filter((f) => s.flags.includes(f.id)).length, skins: SKINS.filter((k) => s.skins.includes(k.id)).length };
  return {
    flags: { have: have.flags, of: FLAGS.length },
    skins: { have: have.skins, of: SKINS.length },
    goals: ALBUM.filter((g) => g.need <= (g.kind === 'flags' ? FLAGS.length : SKINS.length)).map((g) => ({ ...g, have: Math.min(g.need, have[g.kind]), done: have[g.kind] >= g.need, claimed: e.album.includes(g.id) })),
  };
}
export function claimAlbum(s, id) {
  const g = albumView(s).goals.find((v) => v.id === id);
  if (!g || !g.done || g.claimed) return null;
  s.engage.album.push(id);
  addChests(s, g.chests);
  return { chests: g.chests };
}

// ---- the weekend tournament: Friday, Saturday and Sunday
export const EVENT_WINS = 3;
export function eventNow(day) {
  const n = dayNumber(day);
  const weekday = (n + 4) % 7; // 1 Jan 1970 was a Thursday; 0 is Sunday
  if (![5, 6, 0].includes(weekday)) return null;
  const friday = n - ((weekday + 2) % 7);
  const flags = FLAGS.filter((f) => f.event);
  const flag = flags[Math.floor(friday / 7) % flags.length];
  return { id: 'w' + friday, flag, daysLeft: 3 - ((weekday + 2) % 7) };
}
export function eventView(s, day) {
  const ev = eventNow(day);
  if (!ev) return null;
  const e = engageState(s);
  if (e.event.id !== ev.id) e.event = { id: ev.id, base: s.wins, claimed: false };
  const have = Math.max(0, Math.min(EVENT_WINS, s.wins - e.event.base));
  return { ...ev, have, need: EVENT_WINS, done: have >= EVENT_WINS, claimed: e.event.claimed, owned: s.flags.includes(ev.flag.id) };
}
export function claimEvent(s, day) {
  const v = eventView(s, day);
  if (!v || !v.done || v.claimed) return null;
  s.engage.event.claimed = true;
  if (v.owned) {
    addChests(s, 2);
    return { text: 'Two war chests (you already fly this flag)' };
  }
  s.flags.push(v.flag.id);
  return { text: v.flag.name + ' flag' };
}

// ---- wins this week, for the league board (Monday to Sunday)
export function weekWins(s, day) {
  const n = dayNumber(day);
  const id = 'm' + (n - ((n + 3) % 7));
  const e = engageState(s);
  if (e.week.id !== id) e.week = { id, base: s.wins };
  return Math.max(0, s.wins - e.week.base);
}

// ---- difficulty, for campaign battles
export const DIFFICULTY = {
  easy: { name: 'Squire', enemy: 0.75, reward: 0.75, note: 'Smaller enemy armies. Three quarters of the spoils.' },
  normal: { name: 'Knight', enemy: 1, reward: 1, note: 'The campaign as designed.' },
  hard: { name: 'Warlord', enemy: 1.35, reward: 1.5, note: 'Larger, tougher enemy armies. Half as much again in spoils.' },
};
export const difficultyOf = (s) => (DIFFICULTY[s.settings?.difficulty] ? s.settings.difficulty : 'normal');
// A campaign mission as this kingdom will meet it.
export function missionFor(m, level) {
  const d = DIFFICULTY[level] || DIFFICULTY.normal;
  return {
    ...m,
    power: m.power * (level === 'hard' ? 1.1 : 1),
    army: Object.fromEntries(Object.entries(m.army).map(([k, n]) => [k, Math.max(1, Math.round(n * d.enemy))])),
    reward: Object.fromEntries(Object.entries(m.reward).map(([k, n]) => [k, Math.round(n * d.reward)])),
  };
}
