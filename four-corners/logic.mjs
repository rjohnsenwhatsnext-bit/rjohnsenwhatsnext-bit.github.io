// Four Corners: the rules and the daily puzzle maker (Claude). Pure, no DOM.
//
// Ryan, 29 Sep 2026: "lets just build them all" (the daily strategy games).
// Sixteen words, four hidden groups of four. Pick four you think belong
// together; four wrong guesses and it is over. The groups run from plain
// (yellow) to devious (purple). Our own name, colours and words; the shape is
// the Connections one.
//
// Each day takes a plain, a knowledge, a wordplay and a devious group from
// bank.mjs, four words from each, and refuses any combination where a word
// would honestly fit two of the day's groups.

import { BANK } from './bank.mjs';

export const MISTAKES = 4;
export const COLOURS = ['yellow', 'green', 'blue', 'purple'];
const EPOCH = Date.UTC(2026, 8, 29);
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}
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
function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each tier's categories in a fixed shuffled order; day d takes the next one
// along, so a category does not come round again until its whole tier has.
const byTier = (t) => BANK.filter((c) => c.tier === t);
const ORDER = {};
for (const t of [1, 2, 3, 4]) ORDER[t] = shuffled(byTier(t), rng(9000 + t));
// the fourth group: devious on even days, wordplay again on odd ones (the
// devious pool is small, so it would repeat too soon every day)
const slots = (day) => [1, 2, 3, day % 2 === 0 ? 4 : 3];

const fits = (cat, word) => cat.members.includes(word) || cat.also.includes(word);

export function makePuzzle(day) {
  const rand = rng(day * 48271 + 11);
  for (let shift = 0; shift < 60; shift++) {
    const used = new Set();
    const groups = [];
    let ok = true;
    for (const [k, t] of slots(day).entries()) {
      const pool = ORDER[t];
      // two wordplay slots on odd days take different steps through the pool
      let idx = (day * (k === 3 ? 7 : 1) + shift * (k + 1)) % pool.length;
      let cat = pool[idx];
      let tries = 0;
      while (used.has(cat.name) && tries++ < pool.length) cat = pool[(idx = (idx + 1) % pool.length)];
      if (used.has(cat.name)) {
        ok = false;
        break;
      }
      used.add(cat.name);
      groups.push(cat);
    }
    if (!ok) continue;
    const picked = groups.map((g) => shuffled(g.members, rand).slice(0, 4));
    const words = picked.flat();
    if (new Set(words).size !== 16) continue;
    // no word may fit any group but its own
    const clash = picked.some((ws, i) => ws.some((w) => groups.some((g, j) => j !== i && fits(g, w))));
    if (clash) continue;
    return {
      day,
      groups: groups.map((g, i) => ({ name: g.name, tier: g.tier, colour: COLOURS[i], words: picked[i] })),
      tiles: shuffled(words, rand),
    };
  }
  throw new Error(`No clean puzzle for day ${day}`);
}

// ---- playing
export function newGame(p) {
  return { found: [], guesses: [], mistakes: 0, over: false, won: false };
}
// guess four words -> { ok, group?, oneAway?, repeat? }
export function guess(p, g, words) {
  if (g.over) return { ok: false, reason: 'Over' };
  if (words.length !== 4 || new Set(words).size !== 4) return { ok: false, reason: 'Pick four' };
  const key = words.slice().sort().join('|');
  if (g.guesses.some((x) => x.slice().sort().join('|') === key)) return { ok: false, repeat: true, reason: 'Already tried that' };
  g.guesses.push(words.slice());
  const hit = p.groups.find((gr) => words.every((w) => gr.words.includes(w)));
  if (hit) {
    g.found.push(hit.name);
    if (g.found.length === 4) {
      g.over = true;
      g.won = true;
    }
    return { ok: true, group: hit };
  }
  g.mistakes++;
  const oneAway = p.groups.some((gr) => gr.words.filter((w) => words.includes(w)).length === 3);
  if (g.mistakes >= MISTAKES) g.over = true;
  return { ok: false, oneAway, over: g.over };
}
export const remaining = (p, g) => p.tiles.filter((w) => !p.groups.some((gr) => g.found.includes(gr.name) && gr.words.includes(w)));

const SQUARE = { yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪' };
export function shareText(p, g) {
  const rows = g.guesses.map((ws) => ws.map((w) => SQUARE[p.groups.find((gr) => gr.words.includes(w)).colour]).join(''));
  return [`Four Corners #${p.day}${g.hints ? ' (with a hint)' : ''}`, ...rows].join('\n');
}
// A hint (a watched rewarded ad): the name of one group not found yet, the
// easiest first. One a day; marked on the share card and not a perfect day.
export const HINTS = 1;
export function hint(p, g) {
  if (g.over) return { ok: false, reason: 'The puzzle is over' };
  if ((g.hints || 0) >= HINTS) return { ok: false, reason: 'One hint a day' };
  const group = p.groups.find((gr) => !g.found.includes(gr.name));
  g.hints = (g.hints || 0) + 1;
  g.hinted = group.name;
  return { ok: true, name: group.name, colour: group.colour };
}
export function record(stats, { day, won, mistakes, hints = 0 }) {
  const s = { played: 0, won: 0, streak: 0, best: 0, perfect: 0, lastDay: null, ...stats };
  if (s.lastDay === day) return s;
  s.played++;
  if (won) {
    s.won++;
    s.streak = s.lastWonDay === day - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.lastWonDay = day;
    if (!mistakes && !hints) s.perfect++;
  } else s.streak = 0;
  s.lastDay = day;
  return s;
}
