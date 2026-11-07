// Leap Legends weekly leagues (Duolingo's trick): each week every player who
// climbs is put in a group of up to 30 in their league; at the end of the
// week the top 5 go up a league and the bottom 5 go down. Pure functions, so
// the same file runs on the server that will hold the real groups. Every row
// is a real player: no bots are ever added to fill a group.

export const LEAGUES = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Legend'];
export const GROUP = { size: 30, up: 5, down: 5 };

// Split this week's entrants in one league into groups of up to 30. Players
// are grouped by when they joined the week, so a group fills while people
// are playing; `entrants` is [{ id, joinedAt }].
export function makeGroups(entrants) {
  const sorted = [...entrants].sort((a, b) => a.joinedAt - b.joinedAt || String(a.id).localeCompare(String(b.id)));
  const groups = [];
  for (let i = 0; i < sorted.length; i += GROUP.size) groups.push(sorted.slice(i, i + GROUP.size).map((e) => e.id));
  // a tiny last group is folded into the one before, so nobody is alone
  if (groups.length > 1 && groups.at(-1).length < 10) {
    const tail = groups.pop();
    groups[groups.length - 1].push(...tail);
  }
  return groups;
}

// The standings in a group: best height this week, ties to who got there first.
export function standings(rows) {
  return [...rows].sort((a, b) => b.best - a.best || a.at - b.at).map((r, i) => ({ ...r, rank: i + 1 }));
}

// Where each player in a finished group goes next week. Only players who
// climbed this week can move; the top of Legend and the bottom of Bronze stay.
// Small groups move fewer people, so nobody is promoted for turning up alone.
export function settle(league, rows) {
  const li = LEAGUES.indexOf(league);
  if (li < 0) throw new Error('Unknown league ' + league);
  const ranked = standings(rows.filter((r) => r.best > 0));
  const n = ranked.length;
  const up = li < LEAGUES.length - 1 ? Math.min(GROUP.up, Math.floor(n / 3)) : 0;
  const down = li > 0 ? Math.min(GROUP.down, Math.floor(n / 3)) : 0;
  return ranked.map((r, i) => ({
    id: r.id,
    rank: r.rank,
    next: i < up ? LEAGUES[li + 1] : i >= n - down ? LEAGUES[li - 1] : league,
    moved: i < up ? 'up' : i >= n - down ? 'down' : 'stay',
  }));
}

// What the player sees mid-week: their rank, and the gap to the promotion
// line or to safety. `rows` includes them (id === me).
export function myPosition(league, rows, me) {
  const ranked = standings(rows);
  const mine = ranked.find((r) => r.id === me);
  if (!mine) return null;
  const n = ranked.length;
  const li = LEAGUES.indexOf(league);
  const up = li < LEAGUES.length - 1 ? Math.min(GROUP.up, Math.floor(n / 3)) : 0;
  const down = li > 0 ? Math.min(GROUP.down, Math.floor(n / 3)) : 0;
  const zone = mine.rank <= up ? 'up' : mine.rank > n - down ? 'down' : 'stay';
  const toUp = up && mine.rank > up ? ranked[up - 1].best - mine.best : 0;
  const toSafe = zone === 'down' ? ranked[n - down - 1].best - mine.best : 0;
  return { rank: mine.rank, of: n, zone, toUp: Math.max(0, Math.ceil(toUp)), toSafe: Math.max(0, Math.ceil(toSafe)) };
}
