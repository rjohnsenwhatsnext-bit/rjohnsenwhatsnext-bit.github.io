// Homestead: the daily jobs board (Claude). Ryan's NEXT-FEATURES #1: three
// jobs a day the property can actually do right now, a reward for finishing
// all three, and a streak for coming back day after day. Progress is counted
// from Codex's own s.stats counters, so any way of doing the work counts.
//
// dayKey is the calendar date in Brisbane from the server clock (dayKeyFor),
// so the board turns over at midnight for everyone and the phone's clock
// cannot skip days.
import { stageIndex } from './stages.mjs';

export function dayKeyFor(serverNow) {
  return new Date(serverNow).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }); // YYYY-MM-DD
}
const dayNumber = (key) => Math.round(Date.parse(key + 'T00:00:00Z') / 864e5);

const count = (s, stat) => (stat === 'campGuests' ? s.campGuests || 0 : s.stats[stat] || 0);
const built = (s, kind) => s.buildings.some((b) => b.built && b.kind === kind);

// Everything a day can ask for, and when the property can do it
export const TEMPLATES = [
  { id: 'build', stat: 'built', text: (n) => `Finish ${n === 1 ? 'a building project' : n + ' building projects'}`, n: [1, 2], can: () => true },
  { id: 'sell', stat: 'sold', text: (n) => `Sell ${n} head of stock`, n: [2, 4], can: (s) => built(s, 'yards') && s.animals.length >= 2 },
  { id: 'feed', stat: 'fed', text: () => 'Feed the yarded mob by ute', n: [1, 1], can: (s) => built(s, 'shed') && built(s, 'yards') && s.vehicles.includes('ute') && s.animals.length > 0 },
  { id: 'garden', stat: 'harvests', text: (n) => (n === 1 ? 'Pick the market garden' : `Pick the garden ${n} times`), n: [1, 2], can: (s) => built(s, 'garden') },
  { id: 'campers', stat: 'campGuests', text: (n) => `Host ${n} lots of campers`, n: [1, 3], can: (s) => built(s, 'camp') },
  { id: 'field', stat: 'fieldHarvests', text: (n) => (n === 1 ? 'Harvest a field' : `Harvest ${n} fields`), n: [1, 2], can: (s) => built(s, 'field') },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Today's board, made once a day from what the property can do that morning.
// -> { day, jobs: [{ id, text, target, progress, done }], allDone, claimed, streak, reward }
export function dailyJobs(s, dayKey) {
  if (!s.daily || s.daily.day !== dayKey) {
    const rand = rng(dayNumber(dayKey) * 7919 + (s.visitorSeed || 1));
    const pool = TEMPLATES.filter((t) => t.can(s));
    const picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    // a young property may only be able to build: ask for a second build then
    while (picked.length < 3) picked.push(TEMPLATES[0]);
    const jobs = picked.map((t, k) => {
      const [lo, hi] = t.n;
      const target = lo + Math.floor(rand() * (hi - lo + 1)) + (picked.slice(0, k).filter((p) => p.id === t.id).length ? 1 : 0);
      return { id: t.id, stat: t.stat, target, text: t.text(target) };
    });
    const base = Object.fromEntries(jobs.map((j) => [j.stat, count(s, j.stat)]));
    s.daily = { day: dayKey, jobs, base, claimed: false, streak: s.daily?.streak || 0, lastClaimed: s.daily?.lastClaimed || null };
  }
  const d = s.daily;
  // several jobs on the same counter share it: each needs its own amount on top
  const used = {};
  const jobs = d.jobs.map((j) => {
    const have = count(s, j.stat) - d.base[j.stat] - (used[j.stat] || 0);
    const progress = Math.max(0, Math.min(j.target, have));
    used[j.stat] = (used[j.stat] || 0) + progress;
    return { ...j, progress, done: progress >= j.target };
  });
  const allDone = jobs.every((j) => j.done);
  return { day: d.day, jobs, allDone, claimed: d.claimed, streak: d.streak, reward: rewardFor(s, streakIf(d, dayKey)) };
}

const streakIf = (d, dayKey) => (d.lastClaimed && dayNumber(dayKey) - dayNumber(d.lastClaimed) === 1 ? d.streak + 1 : 1);
// bigger properties get bigger rewards; the streak adds a tenth a day, up to a week
export const rewardFor = (s, streak) => Math.round((400 + 300 * stageIndex(s)) * (1 + 0.1 * Math.min(7, streak - 1)));

export function claimDaily(s, dayKey) {
  const b = dailyJobs(s, dayKey);
  if (b.claimed) return { ok: false, reason: "Today's jobs are already paid" };
  if (!b.allDone) return { ok: false, reason: 'Finish all three jobs first' };
  const streak = streakIf(s.daily, dayKey);
  const reward = rewardFor(s, streak);
  s.money += reward;
  s.xp = (s.xp || 0) + 40;
  s.daily.claimed = true;
  s.daily.streak = streak;
  s.daily.lastClaimed = dayKey;
  return { ok: true, reward, streak };
}
