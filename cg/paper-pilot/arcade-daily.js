// A reason to come back, shared by the games (Ryan, 5 Nov 2026: "give people a reason to play").
// Built from Merge Mine's retention: a seven step gift calendar that moves one step per day
// played and never resets on a missed day (the playbook bans punitive streaks), and three small
// jobs a day. Everything pays in the game's own helper token, the thing that lets a player keep
// going without watching an ad. The rules are plain functions with no screen; mountDaily is the
// card. The day is the phone's own date. Saved on the phone only: nothing here is sent anywhere.

export const GIFTS = [1, 1, 2, 1, 2, 2, 5];
export const JOB_PAY = 1;
export const ALL_JOBS_PAY = 2;

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

export function cleanDaily(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { tokens: count(r.tokens), step: count(r.step) % GIFTS.length, claimed: typeof r.claimed === 'string' ? r.claimed : '', daysClaimed: count(r.daysClaimed),
    jobsDay: typeof r.jobsDay === 'string' ? r.jobsDay : '', jobs: Array.isArray(r.jobs) ? r.jobs.filter((j) => j && typeof j.kind === 'string').map((j) => ({ kind: j.kind, goal: count(j.goal), have: count(j.have), done: !!j.done })) : [], bonus: !!r.bonus };
}
export const canClaim = (s, day) => s.claimed !== day;
/** Today's gift: the tokens it paid, or 0 if already taken. A missed day costs nothing. */
export function claim(s, day) {
  if (!canClaim(s, day)) return 0;
  const pay = GIFTS[s.step];
  s.tokens += pay;
  s.step = (s.step + 1) % GIFTS.length;
  s.claimed = day;
  s.daysClaimed += 1;
  return pay;
}
function dayHash(day) {
  let h = 2166136261;
  for (const ch of String(day)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
/** The same three jobs all day; a new day starts new ones. pool: [{ kind, goal }]. */
export function jobsFor(s, day, pool, howMany = 3) {
  if (s.jobsDay === day) return s.jobs;
  const left = pool.slice(), picked = [];
  let h = dayHash(day);
  while (picked.length < howMany && left.length) {
    const at = h % left.length;
    picked.push({ kind: left[at].kind, goal: left[at].goal, have: 0, done: false });
    left.splice(at, 1);
    h = Math.imul(h ^ 0x9e3779b1, 16777619) >>> 0;
  }
  s.jobsDay = day; s.jobs = picked; s.bonus = false;
  return picked;
}
function settle(s, job) {
  if (job.done || job.have < job.goal) return 0;
  job.done = true;
  s.tokens += JOB_PAY;
  let paid = JOB_PAY;
  if (!s.bonus && s.jobs.length && s.jobs.every((j) => j.done)) { s.bonus = true; s.tokens += ALL_JOBS_PAY; paid += ALL_JOBS_PAY; }
  return paid;
}
/** Adds to a counting job. Returns the tokens that paid, 0 usually. */
export function bump(s, day, pool, kind, by = 1) {
  jobsFor(s, day, pool);
  let paid = 0;
  for (const job of s.jobs) if (job.kind === kind && !job.done) { job.have = Math.min(job.goal, job.have + by); paid += settle(s, job); }
  return paid;
}
/** For a best-in-one-go job: the highest reached counts, not the sum. */
export function reach(s, day, pool, kind, value) {
  jobsFor(s, day, pool);
  let paid = 0;
  for (const job of s.jobs) if (job.kind === kind && !job.done) { job.have = Math.min(job.goal, Math.max(job.have, Math.floor(value))); paid += settle(s, job); }
  return paid;
}
export function spend(s) {
  if (s.tokens < 1) return false;
  s.tokens -= 1;
  return true;
}

/** The saved state and a small API, so a game never handles the storage. */
export function createDaily(key, pool, { track = () => {}, today = dayKey, storage = globalThis.localStorage } = {}) {
  let s = cleanDaily(null), saveFailed = false;
  try { s = cleanDaily(JSON.parse(storage.getItem(key) || 'null')); }
  catch { saveFailed = true; }
  const save = () => { try { storage.setItem(key, JSON.stringify(s)); saveFailed = false; } catch { saveFailed = true; } };
  const listeners = new Set();
  const changed = () => { save(); listeners.forEach((fn) => fn()); };
  return {
    pool, on: (fn) => listeners.add(fn),
    get state() { return s; }, get saveFailed() { return saveFailed; },
    get tokens() { return s.tokens; }, get canClaim() { return canClaim(s, today()); },
    get jobs() { const before = s.jobsDay; const jobs = jobsFor(s, today(), pool); if (before !== s.jobsDay) save(); return jobs; },
    claim() { const pay = claim(s, today()); if (pay) { track('daily_gift', { step: s.step, tokens: pay, days: s.daysClaimed }); changed(); } return pay; },
    bump(kind, by = 1) { const pay = bump(s, today(), pool, kind, by); if (pay) track('daily_job', { kind, tokens: pay, bonus: s.bonus }); changed(); return pay; },
    reach(kind, value) { const pay = reach(s, today(), pool, kind, value); if (pay) track('daily_job', { kind, tokens: pay, bonus: s.bonus }); changed(); return pay; },
    spend() { const ok = spend(s); if (ok) changed(); return ok; },
  };
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STYLE = `.daily-dialog{max-width:420px;width:calc(100% - 28px);border:2px solid var(--daily-accent,#ffc531);border-radius:18px;padding:18px;background:var(--daily-bg,#17132e);color:#fff;font-family:system-ui,sans-serif}.daily-dialog::backdrop{background:#000a}.daily-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.daily-head h2{margin:0;font-size:1.3rem}dialog.daily-dialog button.daily-close{background:none;border:0;color:#fff;font-size:1.6rem;min-height:40px;padding:0 8px;cursor:pointer}.daily-have{font-weight:800;color:var(--daily-accent,#ffc531);margin:6px 0 12px}.daily-week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:12px}.daily-week span{display:grid;justify-items:center;padding:6px 0;border-radius:9px;background:#ffffff14;font-size:.72rem;font-weight:700}.daily-week b{font-size:1rem}.daily-week .done{background:var(--daily-accent,#ffc531);color:#191529}.daily-week .now{outline:2px solid var(--daily-accent,#ffc531)}dialog.daily-dialog button.daily-claim{width:100%;min-height:50px;border:0;border-radius:13px;background:var(--daily-accent,#ffc531);color:#191529;font-weight:800;font-size:1.05rem;cursor:pointer}dialog.daily-dialog button.daily-claim:disabled{opacity:.55}.daily-job{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;margin-top:10px}.daily-bar{grid-column:1/-1;height:8px;border-radius:5px;background:#ffffff1f;overflow:hidden}.daily-bar i{display:block;height:100%;background:var(--daily-accent,#ffc531)}.daily-job.done span{opacity:.65;text-decoration:line-through}.daily-note{font-size:.82rem;opacity:.8;margin:12px 0 0}.daily-warn{color:#ffb4a8}.daily-badge{display:inline-block;margin-left:7px;padding:1px 8px;border-radius:9px;background:#ff4d6d;color:#fff;font-size:.74rem;font-weight:800}`;

/** The rewards button and card. jobText(job) words a job; tokenWord(n) words the token. */
export function mountDaily({ host, before = null, buttonClass = '', store, jobText, tokenWord, tokenHelp }) {
  if (!document.getElementById('daily-style')) { const st = document.createElement('style'); st.id = 'daily-style'; st.textContent = STYLE; document.head.append(st); }
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'dailyOpen'; button.className = buttonClass;
  host.insertBefore(button, before);
  const dialog = document.createElement('dialog');
  dialog.className = 'daily-dialog';
  document.body.append(dialog);
  const paintButton = () => { button.innerHTML = `Daily rewards${store.canClaim ? '<span class="daily-badge">1 to open</span>' : ''}`; };
  function paint() {
    const s = store.state, jobs = store.jobs, ready = store.canClaim;
    const week = (ready ? s.step : (s.step + 6) % 7);
    dialog.innerHTML = `<div class="daily-head"><h2>Daily rewards</h2><button type="button" class="daily-close" aria-label="Close">×</button></div>
      <p class="daily-have">You have ${esc(tokenWord(s.tokens))}</p>
      <div class="daily-week">${[1, 2, 3, 4, 5, 6, 7].map((n, i) => `<span class="${i < s.step || (!ready && i === week) ? 'done' : ''} ${ready && i === s.step ? 'now' : ''}">Day ${n}<b>+${[1, 1, 2, 1, 2, 2, 5][i]}</b></span>`).join('')}</div>
      <button type="button" class="daily-claim" ${ready ? '' : 'disabled'}>${ready ? `Open today's gift` : 'Come back tomorrow for the next one'}</button>
      <h3 style="margin:16px 0 0;font-size:1rem">Today's jobs</h3>
      ${jobs.map((j) => `<div class="daily-job ${j.done ? 'done' : ''}"><span>${esc(jobText(j))}</span><strong>${j.done ? 'Done' : `${j.have}/${j.goal}`}</strong><div class="daily-bar"><i style="width:${j.goal ? Math.round((j.have / j.goal) * 100) : 0}%"></i></div></div>`).join('')}
      <p class="daily-note">Each job pays +1, and all three pay +2 more. ${esc(tokenHelp)} Miss a day and you lose nothing.</p>
      ${store.saveFailed ? '<p class="daily-note daily-warn">This phone could not save your rewards, so they may be lost when the game closes.</p>' : ''}`;
    dialog.querySelector('.daily-close').onclick = () => dialog.close();
    const c = dialog.querySelector('.daily-claim');
    c.onclick = () => { if (store.claim()) paint(); };
  }
  button.onclick = () => { paint(); dialog.showModal(); };
  store.on(() => { paintButton(); if (dialog.open) paint(); });
  paintButton();
  return { button, open: () => button.onclick(), refresh: paintButton };
}
