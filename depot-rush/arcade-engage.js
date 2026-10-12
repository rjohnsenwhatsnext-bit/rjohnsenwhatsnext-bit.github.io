// Reminders and the rating prompt (Claude, 29 Sep 2026). Ryan's playbook
// additions 2 and 3: opt-in reminders, at most one a day, only for something
// real; and Google's in-app review asked at a happy moment, never after a loss.
//
// Reminders use @capacitor/local-notifications, included only in games with
// game.json "reminders": true (it adds the notification permission). The
// rating prompt uses @capacitor-community/in-app-review. In a browser both
// quietly report that they are not available; nothing is faked.

const cap = () => globalThis.Capacitor;
const native = () => Boolean(cap()?.isNativePlatform?.());
const plugins = {};
function plugin(name) {
  if (!native()) return null;
  const c = cap();
  if (plugins[name]) return plugins[name];
  if (c.isPluginAvailable && c.isPluginAvailable(name) && c.registerPlugin) plugins[name] = c.registerPlugin(name);
  return plugins[name] || null;
}
const store = {
  get(k, f) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* no storage: the choice is asked again next launch, nothing else breaks */
    }
  },
};
const game = () => (globalThis.ARCADE_GAME && globalThis.ARCADE_GAME.slug) || 'game';
const track = (name, props) => globalThis.arcade?.track?.(name, props);

// ---- reminders
export const remindersAvailable = () => Boolean(plugin('LocalNotifications'));
export const remindersOn = () => remindersAvailable() && store.get(`${game()}.reminders`, false) === true;

// The player tapped "remind me": ask the phone, remember the answer.
// -> { on: true } or { on: false, reason }
export async function enableReminders() {
  const LN = plugin('LocalNotifications');
  if (!LN) return { on: false, reason: 'Reminders work in the app from Google Play.' };
  let p = await LN.checkPermissions();
  if (p.display !== 'granted') p = await LN.requestPermissions();
  const on = p.display === 'granted';
  store.set(`${game()}.reminders`, on);
  track('reminders', { on });
  return on ? { on } : { on, reason: 'Notifications are turned off for this game in the phone settings.' };
}
export async function disableReminders() {
  store.set(`${game()}.reminders`, false);
  track('reminders', { on: false });
  const LN = plugin('LocalNotifications');
  if (LN) await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
}

// One reminder per kind, replacing any earlier one, so there is never more
// than one waiting. kind 1: the daily one; kind 2: a one-off (energy full).
export async function remindTomorrow({ title, body, hour = 8 }) {
  if (!remindersOn()) return false;
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(hour, 0, 0, 0);
  return put(1, title, body, at);
}
export async function remindAt({ title, body, at }) {
  if (!remindersOn() || !(at instanceof Date) || at <= new Date()) return false;
  // never in the small hours: move it to 8 am
  if (at.getHours() < 8 || at.getHours() >= 21) {
    if (at.getHours() >= 21) at.setDate(at.getDate() + 1);
    at.setHours(8, 0, 0, 0);
  }
  return put(2, title, body, at);
}
async function put(id, title, body, at) {
  const LN = plugin('LocalNotifications');
  await LN.cancel({ notifications: [{ id }] });
  await LN.schedule({ notifications: [{ id, title, body, schedule: { at, allowWhileIdle: false } }] });
  return true;
}

// ---- the rating prompt: after a win, once the player has won a few times,
// and not again for three months. Google decides whether it actually shows.
export async function askForRating({ wins }) {
  const R = plugin('InAppReview');
  if (!R || wins < 3) return false;
  const last = store.get(`${game()}.ratingAskedAt`, 0);
  if (Date.now() - last < 90 * 24 * 60 * 60 * 1000) return false;
  store.set(`${game()}.ratingAskedAt`, Date.now());
  track('rating_prompt', { wins });
  await R.requestReview();
  return true;
}
