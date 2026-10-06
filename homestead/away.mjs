// Homestead: time away (Claude). Ryan's NEXT-FEATURES #1: the property keeps
// going while the player is away, like FarmVille and Hay Day, so there is a
// reason to come back. It runs Codex's own tick (property.mjs) over the time
// away: no second simulation, the same rules that run while playing.
//
// Time away is measured with the server's clock (clock.mjs), never the
// phone's, so winding the phone's date forward gains nothing. It is capped,
// so the property never plays itself for days: the cap is in game days and
// can be changed from the server (setting homestead away.capDays).
//
// Codex's screen calls: stampSeen(s, now) whenever it saves or the app is
// put away; catchUp(s, now, tick) when the app opens or comes back; shows the
// returned report as the "while you were away" card; and uses nextDeadline(s)
// for the reminder.

export const DAY_SECONDS = 180; // one game day, as in property.mjs tick()
export const CAP_DAYS = 2; // default cap, overridden by the server setting
export const MIN_AWAY = 30; // under half a minute away is not "away"

export function stampSeen(s, serverNow) {
  s.seenAt = Math.round(serverNow);
  return s;
}

// -> null when nothing to catch up, else the report for the card
export function catchUp(s, serverNow, tick, { capDays = CAP_DAYS } = {}) {
  if (!Number.isFinite(s.seenAt)) {
    stampSeen(s, serverNow);
    return null;
  }
  const awaySeconds = Math.max(0, (serverNow - s.seenAt) / 1000);
  stampSeen(s, serverNow);
  if (awaySeconds < MIN_AWAY) return null;
  const applied = Math.min(awaySeconds, Math.max(0, capDays) * DAY_SECONDS);
  const before = { money: s.money, day: s.day, sold: s.stats.sold, harvests: s.stats.harvests, built: s.stats.built, lastEvent: s.events[0]?.id ?? -1 };
  let left = applied;
  while (left > 0) {
    const dt = Math.min(1, left);
    tick(s, dt);
    left -= dt;
  }
  const events = s.events.filter((e) => e.id > before.lastEvent).map((e) => e.text);
  return {
    awaySeconds: Math.round(awaySeconds),
    appliedSeconds: Math.round(applied),
    capped: awaySeconds > applied,
    days: s.day - before.day,
    money: Math.round(s.money - before.money),
    sold: s.stats.sold - before.sold,
    harvests: s.stats.harvests - before.harvests,
    built: s.stats.built - before.built,
    events: events.slice(0, 8),
  };
}

// Game seconds until the next thing finishes, for "your garden is ready" style
// reminders; null when nothing is under way. Jobs are estimated from the work
// left at their stops plus a few seconds of travel for each stop.
export function nextDeadline(s) {
  const times = [];
  for (const b of s.buildings) if (b.planted && b.ready > s.time) times.push({ at: b.ready - s.time, what: b.kind === 'garden' ? 'The garden is ready to pick' : 'A crop is ready to harvest' });
  for (const f of s.buildings.filter(b => b.kind === 'field')) if (f.crop && f.ready > s.time) times.push({ at: f.ready - s.time, what: `The ${f.crop} is ready to harvest` });
  for (const j of s.jobs) {
    if (j.status !== 'active' && j.status !== 'queued') continue;
    const rest = j.stops.slice(j.stage).reduce((t, st, k) => t + (st.work || 0) + (k === 0 ? 0 : 4), 0) - (j.elapsed || 0);
    times.push({ at: Math.max(1, rest), what: `${j.title || 'A job'} is done` });
  }
  if (!times.length) return null;
  return times.sort((a, b) => a.at - b.at)[0];
}
