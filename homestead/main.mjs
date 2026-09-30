// Homestead: the screen (Claude's placeholder; Codex owns the look).
// The rules are logic.mjs; the time is clock.mjs (checked with the server,
// so winding the phone's clock forward does not grow anything).
import * as S from './logic.mjs';
import { clock } from './clock.mjs';
import { initAds, showRewarded, adsAvailable, bannerOnScreens } from './arcade-ads.js';
import { remindersAvailable, remindersOn, enableReminders, disableReminders, remindAt } from './arcade-engage.js';

const $ = (id) => document.getElementById(id);
const KEY = 'homestead.save';
const now = () => clock.now();
const track = (name, props) => window.arcade?.track(name, props);
let st;
let saveProblem = '';

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    saveProblem = 'This phone cannot keep a save: ' + e.message;
  }
  if (!raw) return S.newStation((Math.random() * 2 ** 32) >>> 0, now());
  try {
    return S.load(raw);
  } catch (e) {
    try {
      localStorage.setItem(KEY + '.broken', raw);
    } catch { /* the broken save could not be kept either */ }
    saveProblem = `Your old save could not be read (${e.message}), so this is a new station. The old one is kept.`;
    return S.newStation((Math.random() * 2 ** 32) >>> 0, now());
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch (e) {
    saveProblem = 'Progress is not being saved: ' + e.message;
  }
}
let toastTimer = 0;
function toast(msg, ms = 1700) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}
const left = (t) => {
  const s = Math.max(0, Math.ceil((t - now()) / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
const bar = (start, end) => `<div class="bar"><i style="width:${Math.min(100, Math.max(0, ((now() - start) / (end - start)) * 100))}%"></i></div>`;
function after(r, what) {
  if (!r.ok) return toast(r.reason);
  if (r.got) toast([].concat(r.got).map((g) => `+${g.n} ${S.itemName(g.item).toLowerCase()}`).join(', '));
  if (r.coins) toast(`+${r.coins} coins`);
  if (r.levelUp) {
    toast(`Level ${r.levelUp.level}!${r.levelUp.unlocked.length ? ' New: ' + r.levelUp.unlocked.join(', ') : ''}`, 2800);
    track('unlock', { what: `level ${r.levelUp.level}` });
  }
  if (!played) {
    played = true;
    track('play', {});
  }
  if (what) track(what, {});
  save();
  render();
}
let played = false;

// ---- drawing
function render() {
  const t = now();
  S.fillOrders(st, t);
  $('coins').textContent = st.coins.toLocaleString();
  const lvl = S.level(st);
  $('lvl').textContent = `LEVEL ${lvl}`;
  const a = S.xpForLevel(lvl);
  const b = S.xpForLevel(lvl + 1);
  $('xp').firstElementChild.style.width = `${Math.round(((st.xp - a) / (b - a)) * 100)}%`;
  $('note').textContent = saveProblem || clock.problem;

  $('paddocks').innerHTML = st.paddocks
    .map((p, i) => {
      if (!p.crop) return `<button class="tile empty" data-p="${i}">Empty<br><small>tap to plant</small></button>`;
      const c = S.CROPS[p.crop];
      const ready = t >= p.ready;
      return `<button class="tile${ready ? ' ready' : ''}" data-p="${i}"><b>${c.name}</b>${ready ? '<small>ready: tap to harvest</small>' : `<small>${left(p.ready)}</small>${bar(p.ready - c.grow, p.ready)}`}</button>`;
    })
    .join('');

  const jobs = st.mill
    .map((j, k) => {
      const f = S.FEEDS[j.feed];
      const ready = t >= j.ready;
      return `<button class="tile${ready ? ' ready' : ''}" data-mill="${k}"><b>${f.name}</b>${ready ? '<small>ready: tap to collect</small>' : `<small>${left(j.ready)}</small>${bar(j.ready - f.time, j.ready)}`}</button>`;
    })
    .join('');
  const recipes = Object.entries(S.FEEDS)
    .filter(([, f]) => f.level <= lvl)
    .map(([id, f]) => `<button data-make="${id}">${f.name}: ${Object.entries(f.needs).map(([n, q]) => `${q} ${S.itemName(n).toLowerCase()}`).join(' + ')}</button>`)
    .join('');
  $('mill').innerHTML = `${jobs || '<p class="small">Nothing milling.</p>'}<div class="row">${st.mill.length < st.millSlots ? recipes : '<p class="small">The mill is full: collect or wait.</p>'}</div>`;

  $('animals').innerHTML = Object.entries(S.ANIMALS)
    .filter(([, an]) => an.level <= lvl)
    .flatMap(([kind, an]) =>
      st.animals[kind].map((x, i) => {
        const ready = x.fed && t >= x.ready;
        const label = !x.fed ? `<small>hungry: tap to feed (1 ${S.itemName(an.eats).toLowerCase()})</small>` : ready ? `<small>tap to collect ${S.itemName(an.gives).toLowerCase()}</small>` : `<small>${left(x.ready)}</small>${bar(x.ready - an.time, x.ready)}`;
        return `<button class="tile${ready ? ' ready' : ''}" data-a="${kind}:${i}"><b>${an.name}</b>${label}</button>`;
      }),
    )
    .join('');

  $('orders').innerHTML = st.orders
    .map((o, k) => {
      if (o.wait) return `<div class="order waiting"><small>A new order comes in ${left(o.wait)}</small></div>`;
      const ready = S.canFill(st, o);
      const want = Object.entries(o.want)
        .map(([id, n]) => `<span class="${(st.shed[id] || 0) >= n ? 'have' : 'short'}">${n} ${S.itemName(id).toLowerCase()} (${st.shed[id] || 0})</span>`)
        .join('<br>');
      return `<div class="order${ready ? ' ready' : ''}"><div class="want">${want}</div><small>${o.coins} coins · ${o.xp} xp</small><div class="row"><button data-fill="${k}" ${ready ? '' : 'disabled'}>Load it</button><button data-skip="${k}">Skip</button></div></div>`;
    })
    .join('');

  const buys = [
    [`Another paddock · ${S.paddockCost(st.paddocks.length + 1)}`, 'paddock', st.paddocks.length < S.MAX_PADDOCKS],
    [`Mill slot · ${S.millSlotCost(st.millSlots + 1)}`, 'mill', st.millSlots < S.MILL_MAX],
    ...Object.entries(S.ANIMALS)
      .filter(([, an]) => an.level <= lvl)
      .map(([k, an]) => [`Another ${an.name.toLowerCase()} · ${S.animalCost(k, st.animals[k].length + 1)}`, 'animal:' + k, st.animals[k].length < an.max]),
  ];
  $('buy').innerHTML = buys.filter(([, , open]) => open).map(([label, what]) => `<button data-buy="${what}">${label}</button>`).join('') || '<p class="small">All built for now.</p>';
}

// ---- tapping
let waitTarget = null;
document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el || document.body.dataset.view !== 'play') return;
  const t = now();
  const d = el.dataset;
  if (d.p !== undefined) {
    const i = Number(d.p);
    const p = st.paddocks[i];
    if (!p.crop) return openPicker(i);
    if (t >= p.ready) return after(S.harvest(st, i, t));
    return openWait({ paddock: i }, `${S.CROPS[p.crop].name}: ${left(p.ready)} to go`, p.sped);
  }
  if (d.mill !== undefined) {
    const j = st.mill[Number(d.mill)];
    if (t >= j.ready) return after(S.collectMill(st, t));
    return openWait({ mill: Number(d.mill) }, `${S.FEEDS[j.feed].name}: ${left(j.ready)} to go`, j.sped);
  }
  if (d.make) return after(S.mill(st, d.make, t));
  if (d.a) {
    const [kind, i] = d.a.split(':');
    const x = st.animals[kind][Number(i)];
    if (!x.fed) return after(S.feed(st, kind, Number(i), t));
    if (t >= x.ready) return after(S.collect(st, kind, Number(i), t));
    return openWait({ animal: [kind, Number(i)] }, `${S.ANIMALS[kind].name}: ${left(x.ready)} to go`, x.sped);
  }
  if (d.fill !== undefined) return after(S.fillOrder(st, Number(d.fill), t), 'order');
  if (d.skip !== undefined) return after(S.skipOrder(st, Number(d.skip), t));
  if (d.buy) {
    const r = d.buy === 'paddock' ? S.buyPaddock(st) : d.buy === 'mill' ? S.buyMillSlot(st) : S.buyAnimal(st, d.buy.split(':')[1]);
    if (r.ok) toast(`Spent ${r.cost} coins`);
    return after(r, 'build');
  }
});

// planting
let pickFor = -1;
function openPicker(i) {
  pickFor = i;
  $('pickList').innerHTML = Object.entries(S.CROPS)
    .map(([id, c]) => `<button data-crop="${id}" ${c.level > S.level(st) ? 'disabled' : ''}>${c.name} · ${Math.round(c.grow / 60e3)} min${c.level > S.level(st) ? ` · level ${c.level}` : ''}</button>`)
    .join('');
  $('picker').showModal();
}
$('pickList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-crop]');
  if (!b) return;
  $('picker').close();
  after(S.plant(st, pickFor, b.dataset.crop, now()));
});
$('closePicker').onclick = () => $('picker').close();

// waiting, and halving a wait for a watched ad
function openWait(target, text, sped) {
  waitTarget = target;
  $('waitNote').textContent = text;
  $('speed').classList.toggle('hidden', !adsAvailable() || sped);
  $('waitDlg').showModal();
}
$('closeWait').onclick = () => $('waitDlg').close();
$('speed').onclick = async () => {
  $('speed').disabled = true;
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  $('speed').disabled = false;
  $('waitDlg').close();
  if (!r.rewarded) return toast(r.reason ? 'No ad: ' + r.reason : 'The ad did not finish, so no speed up.', 2400);
  const s = S.speedUp(st, waitTarget, now()); // once per timer: a second callback finds it sped up
  if (s.ok) track('speed_up', {});
  after(s.ok ? { ok: true } : s);
};

// the shed, and reminders
$('shedBtn').onclick = () => {
  const items = Object.entries(st.shed).filter(([, n]) => n > 0);
  $('shedList').innerHTML = items.length ? items.map(([id, n]) => `<span>${S.itemName(id)}</span><b>${n}</b>`).join('') : '<span class="small">Empty.</span>';
  $('remind').classList.toggle('hidden', !remindersAvailable());
  $('remind').textContent = remindersOn() ? 'Reminders on · turn off' : 'Remind me when things are ready';
  $('shed').showModal();
};
$('closeShed').onclick = () => $('shed').close();
$('remind').onclick = async () => {
  try {
    if (remindersOn()) {
      await disableReminders();
      $('remindNote').textContent = 'No more reminders.';
    } else {
      const r = await enableReminders();
      $('remindNote').textContent = r.on ? 'You will get one when the next thing is ready.' : r.reason;
    }
  } catch (e) {
    $('remindNote').textContent = 'Reminders could not be set: ' + (e.message || e);
  }
  $('shedBtn').onclick();
};
// when the game is put away, one reminder for the next thing that finishes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    const at = S.nextReady(st, now());
    if (at) remindAt({ title: 'Your station needs you', body: 'Something is ready on the station.', at: new Date(Date.now() + (at - now())) }).catch((e) => console.warn('Reminder not set:', e?.message || e));
  } else clock.sync().then(render);
});

// ---- screens
function show(v) {
  document.body.dataset.view = v;
  $('home').classList.toggle('hidden', v !== 'home');
  $('game').classList.toggle('hidden', v !== 'play');
  if (v === 'play') render();
}
$('play').onclick = () => show('play');

st = load();
save();
clock.sync().then(() => document.body.dataset.view === 'play' && render());
setInterval(() => document.body.dataset.view === 'play' && !document.querySelector('dialog[open]') && render(), 1000);
bannerOnScreens('view', ['home', 'play']);
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
Object.defineProperty(window, '__homesteadQA', { get: () => ({ state: JSON.parse(JSON.stringify(st)), now: now(), checked: clock.checked }) });
