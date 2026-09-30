// Fiver: the rules. Pure functions, no DOM, so the tests and (later) the
// server that checks leaderboard results use exactly the same rules.

// Ryan, 29 Sep 2026: "medium and hard levels and add more letters", "make it
// 5 tries for 7 and 5 for 6".
export const LEVELS = {
  easy: { letters: 5, tries: 6, name: 'Easy' },
  medium: { letters: 6, tries: 5, name: 'Medium' },
  hard: { letters: 7, tries: 5, name: 'Hard' },
};

// Puzzle 1 is 29 September 2026; a new one at local midnight, like a paper.
const EPOCH = Date.UTC(2026, 8, 29);
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

export function answerFor(words, level, day) {
  const list = words[LEVELS[level].letters].answers;
  return list[(((day - 1) % list.length) + list.length) % list.length];
}

// Is this a word we accept? The guess list is one run-together string of
// sorted fixed-length words, so a binary search needs no split.
export function isWord(words, word) {
  const n = word.length;
  const blob = words[n]?.guesses;
  if (!blob) return false;
  let lo = 0;
  let hi = blob.length / n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const w = blob.substr(mid * n, n);
    if (w === word) return true;
    if (w < word) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

// Colour a guess against the answer: 'hit' right letter right place, 'near'
// in the word elsewhere, 'miss' not in it. Repeated letters are only marked
// as many times as the answer has them, hits first.
export function score(guess, answer) {
  const res = Array(guess.length).fill('miss');
  const left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] === 'hit') continue;
    if (left[guess[i]] > 0) {
      res[i] = 'near';
      left[guess[i]]--;
    }
  }
  return res;
}

// "Use every clue" rule: every hit stays put and every near letter is used.
// Returns the reason a guess breaks it, or null.
export function clueBreak(guess, history) {
  for (const { word, marks } of history) {
    for (let i = 0; i < word.length; i++) {
      if (marks[i] === 'hit' && guess[i] !== word[i]) return `Letter ${i + 1} must be ${word[i].toUpperCase()}`;
    }
    const need = {};
    for (let i = 0; i < word.length; i++) if (marks[i] !== 'miss') need[word[i]] = (need[word[i]] || 0) + 1;
    for (const [ch, n] of Object.entries(need)) {
      const have = [...guess].filter((c) => c === ch).length;
      if (have < n) return `Guess must contain ${ch.toUpperCase()}${n > 1 ? ` (${n} times)` : ''}`;
    }
  }
  return null;
}

// The spoiler-free result to share: our own squares, not anyone else's.
const SQUARE = { hit: '🟩', near: '🟨', miss: '⬛' };
export function shareText(level, day, rows, won) {
  const L = LEVELS[level];
  const head = `Fiver ${L.name} #${day} ${won ? rows.length : 'X'}/${L.tries}`;
  return [head, ...rows.map((r) => r.map((m) => SQUARE[m]).join(''))].join('\n');
}

// Stats per level: played, won, streak, best streak, guesses it took.
export function record(stats, { day, won, tries }) {
  const s = { played: 0, won: 0, streak: 0, best: 0, lastDay: null, dist: {}, ...stats };
  if (s.lastDay === day) return s; // one result a day
  s.played++;
  if (won) {
    s.won++;
    s.streak = s.lastWonDay === day - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.lastWonDay = day;
    s.dist = { ...s.dist, [tries]: (s.dist[tries] || 0) + 1 };
  } else s.streak = 0;
  s.lastDay = day;
  return s;
}
