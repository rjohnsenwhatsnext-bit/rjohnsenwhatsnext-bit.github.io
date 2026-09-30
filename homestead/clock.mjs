// A clock the phone's settings cannot wind forward (Claude). Farm timers are
// the whole game, so moving the phone's date ahead must not grow crops.
// The server says what time it is; after that, time is counted with
// performance.now(), which runs steadily whatever the clock setting says.
// If the server cannot be reached, the last difference between the server
// and the phone is used, and the clock is marked as not checked.
const SERVER = 'https://api-production-50fc.up.railway.app';
const KEY = 'homestead.clock';

let base = null; // { server, perf }
let lastOffset = 0;
try {
  lastOffset = Number(JSON.parse(localStorage.getItem(KEY))?.offset) || 0;
} catch {
  lastOffset = 0; // no storage: until the server answers, the phone's own clock is used
}
export const clock = {
  checked: false,
  problem: '',
  now() {
    return base ? base.server + (performance.now() - base.perf) : Date.now() + lastOffset;
  },
  async sync() {
    try {
      const sent = performance.now();
      const r = await fetch(SERVER + '/v1/time', { cache: 'no-store' });
      if (!r.ok) throw new Error('the server answered ' + r.status);
      const { now } = await r.json();
      const back = performance.now();
      base = { server: now + (back - sent) / 2, perf: back };
      lastOffset = base.server - Date.now();
      try {
        localStorage.setItem(KEY, JSON.stringify({ offset: lastOffset }));
      } catch {
        /* no storage: the server's time is still used for this session */
      }
      clock.checked = true;
      clock.problem = '';
    } catch (e) {
      clock.problem = 'Time not checked with the server: ' + (e.message || e);
    }
    return clock.checked;
  },
};
