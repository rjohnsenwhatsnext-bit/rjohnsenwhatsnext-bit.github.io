// Leap Legends and the Tovelly games server (arcade/server on Railway).
// The phone is an anonymous player (an id and a secret kept on the device).
// Events for Ryan's experiment are queued and sent in batches, kept for a
// retry when offline; scores go up at the end of a run; the league comes back.
// Nothing here can stop the game: a failure is recorded in `net.status` and
// shown on the league card, never swallowed.
export const SERVER = 'https://api-production-50fc.up.railway.app';
const GAME = 'leap-legends';
const KEY = 'leaplegends.player';
const QUEUE = 'leaplegends.events';

const read = (k, f) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? f;
  } catch {
    return f;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    net.status = 'This device cannot save: ' + e.message;
  }
};

export const net = {
  status: 'Connecting…',
  league: null, // the last league view from the server
  player: read(KEY, null), // { id, token, name }
};
let queue = read(QUEUE, []);

async function call(method, path, body) {
  const r = await fetch(SERVER + path, {
    method,
    headers: { 'content-type': 'application/json', ...(net.player ? { authorization: `Bearer ${net.player.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method === 'POST' && JSON.stringify(body || {}).length < 60000,
  });
  const j = await r.json().catch(() => ({ error: `The server answered ${r.status}` }));
  if (!r.ok) throw Object.assign(new Error(j.error || `The server answered ${r.status}`), { status: r.status });
  return j;
}

// Registration happens once: calls that arrive while it is under way wait for
// the same one (at start-up the league, the first events and the tracking
// all ask at once, and each used to register a player of its own).
let registering = null;
function ensurePlayer() {
  if (net.player) return Promise.resolve(net.player);
  registering ??= (async () => {
    const name = `Legend ${Math.floor(1000 + Math.random() * 9000)}`;
    const p = await call('POST', '/v1/players', { game: GAME, name });
    net.player = { id: p.id, token: p.token, name };
    write(KEY, net.player);
    return net.player;
  })().finally(() => {
    registering = null;
  });
  return registering;
}
// every server call goes through here: a lost identity (401) re-registers once
async function withPlayer(fn) {
  await ensurePlayer();
  try {
    return await fn();
  } catch (e) {
    if (e.status !== 401) throw e;
    net.player = null;
    await ensurePlayer();
    return fn();
  }
}

// ---- the experiment: record now, send in batches
export function track(name, props = {}) {
  queue.push({ name, props, at: Date.now() });
  if (queue.length > 500) queue = queue.slice(-500); // a long time offline keeps the latest
  write(QUEUE, queue);
}
let sending = false;
export async function flush() {
  if (sending || !queue.length) return;
  sending = true;
  const batch = queue.slice(0, 100);
  try {
    await withPlayer(() => call('POST', '/v1/events', { events: batch }));
    queue = queue.slice(batch.length);
    write(QUEUE, queue);
  } catch (e) {
    net.status = 'Offline: ' + e.message;
    console.warn('Events not sent yet, kept for later:', e.message);
  } finally {
    sending = false;
  }
}

// ---- leagues
export async function postScore(best) {
  try {
    net.league = await withPlayer(() => call('POST', '/v1/scores', { best: Math.floor(best) }));
    net.status = 'ok';
  } catch (e) {
    net.status = 'League offline: ' + e.message;
    console.warn('Score not sent:', e.message);
  }
  return net.league;
}
let lastFetch = 0;
export async function fetchLeague(force = false) {
  if (!force && Date.now() - lastFetch < 60000) return net.league;
  lastFetch = Date.now();
  try {
    net.league = await withPlayer(() => call('GET', '/v1/league'));
    net.status = 'ok';
  } catch (e) {
    net.status = 'League offline: ' + e.message;
    console.warn('League not loaded:', e.message);
  }
  return net.league;
}
export async function setName(name) {
  const r = await withPlayer(() => call('POST', '/v1/name', { name }));
  net.player = { ...net.player, name: r.name };
  write(KEY, net.player);
  return r.name;
}

// One line for the home card: where you stand and what it takes to move.
export function leagueLine(l = net.league) {
  if (!l) return net.status === 'ok' || net.status === 'Connecting…' ? 'Weekly league: loading…' : `Weekly league unavailable. ${net.status}`;
  const days = Math.max(1, Math.ceil(l.endsIn / 86400000));
  if (!l.joined) return `${l.league} league · climb this week to join a group of 30 real players · ${days}d left`;
  const me = l.group.find((r) => r.me);
  const n = l.group.length;
  if (!me || !me.best) return `${l.league} league · ${n} climbing this week · climb to get on the board · ${days}d left`;
  const promo = l.promote && me.rank > l.promote ? l.group[l.promote - 1].best - me.best + 1 : 0;
  const zone = l.promote && me.rank <= l.promote ? 'in the promotion zone' : l.relegate && me.rank > n - l.relegate ? 'in the drop zone' : promo ? `${promo} m to promotion` : 'safe';
  return `${l.league} league · ${ordinal(me.rank)} of ${n} · ${zone} · ${days}d left`;
}
export const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10] || 'th');

setInterval(flush, 20000);
addEventListener('pagehide', () => flush());
