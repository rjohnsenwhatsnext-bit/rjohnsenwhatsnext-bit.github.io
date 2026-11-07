// Crown & Conquest: friends and the weekly league, over the Tovelly games
// server (Claude, 13 Oct 2026). server/friends.mjs holds the rules.
//
// The player is the same anonymous identity the numbers code registers
// (arcade-telemetry.js keeps it in localStorage under <idSuffix>.player). If
// that has not happened yet, one is registered here under the same key, so a
// phone never ends up with two.
//
// Every call resolves to { ok: true, ...answer } or { ok: false, error }, with
// the server's own words in error, so a screen can always say what went wrong.
const SERVER = 'https://api-production-50fc.up.railway.app';
const KEY = 'crownconquest.player';
const GAME = 'crown-conquest';

let registering = null;
function stored() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return p && p.id && p.token ? p : null;
  } catch {
    return null;
  }
}
async function identity() {
  const have = stored();
  if (have) return have;
  registering ??= fetch(SERVER + '/v1/players', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game: GAME, name: null }) })
    .then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'The server answered ' + r.status);
      const again = stored(); // the numbers code may have registered meanwhile: keep theirs
      if (again) return again;
      const me = { id: j.id, token: j.token };
      localStorage.setItem(KEY, JSON.stringify(me));
      return me;
    })
    .finally(() => (registering = null));
  return registering;
}
async function call(method, path, body) {
  try {
    const me = await identity();
    const r = await fetch(SERVER + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + me.token }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ error: 'The server answered ' + r.status }));
    if (!r.ok) return { ok: false, status: r.status, error: j.error || 'The server answered ' + r.status };
    return { ok: true, ...j };
  } catch (e) {
    return { ok: false, error: navigator.onLine === false ? 'You are offline. Friends and the league need a connection.' : 'Could not reach the server: ' + (e?.message || e) };
  }
}

export const social = {
  friends: () => call('GET', '/v1/friends'),
  request: (code) => call('POST', '/v1/friends/request', { code }),
  respond: (id, accept) => call('POST', '/v1/friends/respond', { id, accept }),
  remove: (id) => call('POST', '/v1/friends/remove', { id }),
  // the kingdom a friend sees and can fight; sent when it has changed
  saveKingdom: (profile) => call('POST', '/v1/profile', { profile }),
  setName: (name) => call('POST', '/v1/name', { name }),
  // wins this week; the server joins the week's group on the first win
  league: (wins) => (wins > 0 ? call('POST', '/v1/scores', { best: wins }) : call('GET', '/v1/league')),
};
