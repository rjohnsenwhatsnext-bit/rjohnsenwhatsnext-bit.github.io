// Arcade numbers and remote settings (Claude, 29 Sep 2026). Loaded before
// every game by the build (as arcade-telemetry.js, or shell/telemetry.js).
//
// Ryan's playbook asks for: level start, complete and fail, retries,
// unlocks, return sessions, save failures and crashes, each with the build,
// level and mode, so versions can be compared and it shows where people
// stop. This records those against an anonymous player id (no name, no
// account) and sends them in batches to the Tovelly games server.
//
// For games:
//   arcade.track('level_start', { level: 3, mode: 'campaign' })
//   arcade.track('level_complete', { level: 3, mode: 'campaign', stars: 2 })
//   arcade.track('level_fail', { level: 3, mode: 'campaign', reason: 'fell' })
//   arcade.track('level_retry', { level: 3 })   arcade.track('unlock', { what: 'chapter 2' })
//   arcade.track('save_failure', { message })
//   arcade.config('some.number', fallback)   a setting from the server
// On its own it records session_start, session_play (the first level_start
// or play of a session, which is what counts as coming back), errors and,
// through the shared ad code, every ad outcome.
(function () {
  if (window.arcade) return;
  const SERVER = 'https://api-production-50fc.up.railway.app';
  const G = window.ARCADE_GAME || {};
  const slug = G.slug;
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  const platform = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor.getPlatform() : 'web';
  const base = { build: G.version || 0, platform };
  const store = {
    get(k) {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch {
        return false; // a full or blocked store: the queue stays in memory this session
      }
    },
  };
  const PLAYER = (G.idSuffix || slug) + '.player'; // the same id Leap Legends and Scrap Summit already use
  const QUEUE = 'arcade.' + slug + '.events';
  const CONFIG = 'arcade.' + slug + '.config';
  let queue = store.get(QUEUE) || [];
  let config = (store.get(CONFIG) || {}).config || {};
  let played = false;
  let status = local ? 'Not sent from a development machine' : 'waiting';

  function track(name, props) {
    if (!slug) return;
    const p = Object.assign({}, base, props || {});
    queue.push({ name: String(name).slice(0, 40), props: p, at: Date.now() });
    if (!played && (name === 'level_start' || name === 'play')) {
      played = true;
      queue.push({ name: 'session_play', props: base, at: Date.now() });
    }
    if (queue.length > 400) queue = queue.slice(-400); // offline for a long time: keep the latest
    store.set(QUEUE, queue);
    schedule();
  }

  // ---- sending: in batches, a few seconds apart, kept on the phone until the server has them
  let timer = null;
  function schedule(ms) {
    if (timer || local) return;
    timer = setTimeout(flush, ms || 4000);
  }
  let me = null;
  async function call(method, path, body) {
    const r = await fetch(SERVER + path, {
      method,
      headers: Object.assign({ 'content-type': 'application/json' }, me ? { authorization: 'Bearer ' + me.token } : {}),
      body: body ? JSON.stringify(body) : undefined,
      keepalive: method === 'POST' && JSON.stringify(body || {}).length < 60000,
    });
    const j = await r.json().catch(() => ({ error: 'The server answered ' + r.status }));
    if (!r.ok) throw Object.assign(new Error(j.error || 'The server answered ' + r.status), { status: r.status });
    return j;
  }
  async function player() {
    // read again: the game's own code may have registered this player meanwhile
    me = me || store.get(PLAYER);
    if (me && me.id && me.token) return me;
    const p = await call('POST', '/v1/players', { game: slug, name: null });
    me = { id: p.id, token: p.token };
    const old = store.get(PLAYER);
    if (old && old.token) me = old; // someone beat us to it: use theirs
    else store.set(PLAYER, me);
    return me;
  }
  async function flush() {
    timer = null;
    if (!queue.length) return;
    const batch = queue.slice(0, 100);
    try {
      await player();
      try {
        await call('POST', '/v1/events', { events: batch });
      } catch (e) {
        if (e.status !== 401) throw e;
        me = null;
        store.set(PLAYER, null); // a lost identity: start a new one
        await player();
        await call('POST', '/v1/events', { events: batch });
      }
      queue = queue.slice(batch.length);
      store.set(QUEUE, queue);
      status = 'sent';
      if (queue.length) schedule(500);
    } catch (e) {
      status = 'Not sent yet: ' + e.message; // kept, and tried again later
      schedule(30000);
    }
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  // ---- remote settings: last known ones at once, fresh ones in the background
  let configReady = Promise.resolve(config);
  if (slug && !local) {
    configReady = fetch(SERVER + '/v1/config?game=' + encodeURIComponent(slug))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config ' + r.status))))
      .then((j) => {
        config = j.config || {};
        store.set(CONFIG, { config, at: Date.now() });
        return config;
      })
      .catch((e) => {
        status = 'Settings not fetched: ' + e.message; // the last known ones stay in use
        return config;
      });
  }
  function setting(key, fallback) {
    const v = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), config);
    return v === undefined || v === null ? fallback : v;
  }

  // ---- sessions, and coming back after a long break counts as a new one
  let hiddenAt = 0;
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) {
      played = false;
      track('session_start', { resumed: true });
    }
  });

  // ---- errors: the first few of a session, the message only
  let errors = 0;
  function error(message) {
    if (errors++ >= 5) return;
    track('error', { message: String(message || 'unknown').slice(0, 300) });
  }
  addEventListener('error', (e) => error(e.message + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
  addEventListener('unhandledrejection', (e) => error('Unhandled: ' + ((e.reason && e.reason.message) || e.reason)));

  window.arcade = {
    track,
    config: setting,
    configReady,
    get status() {
      return status;
    },
    get queued() {
      return queue.length;
    },
    flush,
  };
  track('session_start', {});
})();
