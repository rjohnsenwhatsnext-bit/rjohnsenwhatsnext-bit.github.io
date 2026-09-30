// Leap Legends: screens, input, saving, ads and the game loop. The rules live
// in sim.mjs (the run) and economy.mjs (wallet, lives, gear); drawing in
// draw.mjs; purchases in billing.mjs.
import { createRun, step, revive, score } from './sim.mjs';
import * as E from './economy.mjs';
import { drawWorld, drawAvatar, drawGear, artReady } from './draw.mjs';
import { presentation, setupSettings, fullscreen, unlockSound, sound } from './presentation.mjs';
import { createSteering } from './steering.mjs';
import { billing } from './billing.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable } from './arcade-ads.js';
import { net, track, flush, postScore, fetchLeague, setName, leagueLine, ordinal } from './net.mjs';

const $ = (id) => document.getElementById(id);
const KEY = 'leaplegends.v1';
let S = load();
let run = null;
let dir = 0;
let adRevivedThisRun = false;
let doubled = false;
let countdown = 0; // seconds left to decide on a revive
let shopBack = 'home'; // where the shop's Back goes: the game over screen if opened from it
let t = 0;
let last = performance.now();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.coins === 'number') return { ...E.fresh(Date.now()), ...saved };
  } catch (e) {
    console.warn('Save could not be read, starting fresh:', e.message);
  }
  return E.fresh(Date.now());
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    toast('Progress cannot save on this device.');
  }
}
let toastT = 0;
function toast(msg) {
  $('toast').textContent = msg;
  toastT = 3;
}
function show(id) {
  document.body.dataset.view = id || 'run';
  for (const s of ['home', 'over', 'shop', 'noLives', 'daily', 'season', 'leagueScreen']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
  refresh();
}
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function refresh() {
  S = E.tickLives(S, Date.now());
  $('coins').textContent = S.coins.toLocaleString();
  $('gems').textContent = S.gems.toLocaleString();
  const now = Date.now();
  const cap = E.maxLives(S, now);
  $('lives').innerHTML = Array.from({ length: Math.max(cap, S.lives) }, (_, i) => `<span class="${i < S.lives ? '' : 'empty'}">♥</span>`).join('');
  const next = E.nextLifeIn(S, now);
  $('lifeTimer').textContent = S.lives >= cap ? 'Lives full' : `Next life in ${mmss(next)}`;
  // the offers: a real 48 hour starter pack, the piggy bank, the season, VIP
  const left = E.starterLeft(S, now);
  $('starterBanner').classList.toggle('hidden', !left);
  if (left) $('starterBanner').textContent = `Starter pack: ${E.STARTER.gems} gems, Blaze and spring boots · ends in ${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m`;
  $('piggyText').textContent = `${S.piggy || 0}`;
  $('piggyFill').style.width = `${Math.round(((S.piggy || 0) / E.PIGGY.cap) * 100)}%`;
  $('piggy').classList.toggle('ready', E.piggyReady(S));
  const se = E.ensureSeason(S, now).season;
  $('seasonBtn').textContent = `Season · tier ${E.seasonTier(se)}/${E.SEASON.tiers}${claimable(se) ? ' · rewards!' : ''}`;
  $('vipBadge').classList.toggle('hidden', !E.isVip(S, now));
  $('league').textContent = leagueLine();
  $('noLivesTimer').textContent = mmss(next);
  $('bests').textContent = S.best ? `Best ${Math.floor(S.best)} m · this week ${Math.floor(S.week === E.weekOf(Date.now()) ? S.weekBest : 0)} m` : 'How high can you go?';
  $('dailyDot').classList.toggle('hidden', !E.dailyReady(S, Date.now()));
  const hero = $('hero').getContext('2d');
  hero.clearRect(0, 0, 320, 320);
  drawAvatar(hero, S.avatar, 160, 174, 94, { t: presentation.reduced ? 0 : t });
}

// ---- a run
function play() {
  S = E.tickLives(S, Date.now());
  if (S.lives <= 0) return showNoLives();
  fullscreen();
  unlockSound();
  steering.clear(); dir = 0;
  toastT = 0; $('toast').textContent = '';
  S = E.startRun(S, Date.now());
  save();
  track('run_start', { lives: S.lives, gear: S.gear, avatar: S.avatar, gems: S.gems });
  run = createRun({ seed: (Date.now() & 0x7fffffff) >>> 0, gear: S.gear });
  adRevivedThisRun = false;
  doubled = false;
  show(null);
}
function gameOver() {
  const h = score(run);
  const before = { best: S.best, week: S.week === E.weekOf(Date.now()) ? S.weekBest : 0 };
  $('over').classList.toggle('new-best', h > before.best);
  if (h > before.best) sound('best');
  $('overHeight').textContent = `${h} m`;
  $('overTitle').textContent = run.cause === 'hazard' ? 'Spiked!' : 'The storm got you';
  // the nudge: how close it was, so one more go feels worth it
  let nudge = '';
  if (h > before.best && before.best) nudge = `New best! ${h - Math.floor(before.best)} m higher than ever.`;
  else if (before.best && before.best - h < 40) nudge = `Only ${Math.ceil(before.best - h)} m off your best!`;
  else if (before.week && before.week - h < 40 && h <= before.week) nudge = `${Math.ceil(before.week - h)} m off your best this week.`;
  $('overNudge').textContent = nudge + (run.coinsTaken ? ` ${run.coinsTaken} coin${run.coinsTaken === 1 ? '' : 's'}.` : '');
  const cost = E.reviveCost(run.revives);
  // five seconds to decide, then it is gone
  countdown = 5;
  $('reviveAd').classList.toggle('hidden', adRevivedThisRun || !adsAvailable());
  $('reviveGems').textContent = `Keep going: ${cost} gems`;
  $('reviveGems').disabled = S.gems < cost;
  $('doubleCoins').textContent = `Watch an ad: double your ${run.coinsTaken} coins`;
  $('doubleCoins').classList.toggle('hidden', !run.coinsTaken || doubled || !adsAvailable());
  $('overGains').textContent = `+${Math.floor(h / E.PIGGY.metresPerGem)} gems into your piggy bank · +${h} season xp`;
  show('over');
}
function claimable(se) {
  const tier = E.seasonTier(se);
  for (let i = 1; i <= tier; i++) if (!se.free.includes(i) || (se.premium && !se.paid.includes(i))) return true;
  return false;
}
function finishRun() {
  countdown = 0;
  const coins = run.coinsTaken * (doubled ? 2 : 1);
  const height = score(run);
  track('run_end', { height, cause: run.cause, coins, revives: run.revives, seconds: Math.round(run.t), doubled });
  postScore(height).then(() => refresh());
  flush();
  S = E.endRun(S, { height, coins }, Date.now());
  if (S.newBest) toast('New best!');
  save();
  run = null;
  show('home');
  // no interstitial for anyone who paid to turn ads off
  if (!E.adsOff(S, Date.now())) maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e));
}
$('play').onclick = play;
$('overDone').onclick = finishRun;
$('reviveAd').onclick = async () => {
  const r = await showRewarded().catch((e) => ({ error: e?.message || String(e) }));
  track('ad_offer', { what: 'revive', watched: Boolean(r?.rewarded) });
  if (r?.rewarded) {
    countdown = 0;
    adRevivedThisRun = true;
    track('revive', { method: 'ad', revives: run.revives });
    revive(run);
    show(null);
  } else toast(r?.error ? 'The ad did not load. Try gems, or try again.' : 'Watch to the end to keep going.');
};
$('reviveGems').onclick = () => {
  try {
    const cost = E.reviveCost(run.revives);
    S = E.payRevive(S, run.revives);
    save();
    track('revive', { method: 'gems', cost, revives: run.revives });
    countdown = 0;
    revive(run);
    show(null);
  } catch (e) {
    toast(e.message);
    countdown = 0; // they are shopping for gems: the clock stops, the run waits
    openShop('gems', 'over');
  }
};
$('doubleCoins').onclick = async () => {
  const r = await showRewarded().catch((e) => ({ error: e?.message || String(e) }));
  if (r?.rewarded) {
    doubled = true;
    $('doubleCoins').classList.add('hidden');
    toast(`Doubled: ${run.coinsTaken * 2} coins`);
  } else toast('The ad did not finish, so no double this time.');
};

// ---- out of lives
function showNoLives() {
  track('out_of_lives', { gems: S.gems });
  $('lifeAd').classList.toggle('hidden', !adsAvailable());
  $('refillGems').textContent = `Refill lives: ${E.REFILL_GEMS} gems`;
  $('refillGems').disabled = S.gems < E.REFILL_GEMS;
  $('refillBuy').textContent = `Refill lives · ${billing.label('lives_refill')}`;
  show('noLives');
}
$('lifeAd').onclick = async () => {
  const r = await showRewarded().catch((e) => ({ error: e?.message || String(e) }));
  if (r?.rewarded) {
    S = E.addLife(S);
    save();
    show('home');
    toast('+1 life');
  } else toast('The ad did not finish.');
};
$('refillGems').onclick = () => {
  try {
    S = E.refillWithGems(S);
    save();
    show('home');
  } catch (e) {
    toast(e.message);
  }
};
$('refillBuy').onclick = () => buy('lives_refill', 'home');
$('closeNoLives').onclick = () => show('home');

// ---- buying
async function buy(id, after) {
  try {
    track('buy_tap', { product: id });
    const r = await billing.buy(id);
    S = E.grant(S, id, r.token, Date.now());
    track('buy', { product: id, preview: Boolean(r.preview) });
    save();
    toast(r.preview ? 'Preview: added free, nothing was charged.' : 'Thank you!');
    if (after) show(after);
    else renderShop();
  } catch (e) {
    toast(e.message);
  }
}

// ---- the shop
let tab = 'gear';
function openShop(which = 'gear', back = 'home') {
  tab = which;
  track('shop_open', { tab: which, from: back });
  shopBack = back;
  show('shop');
  renderShop();
}
function renderShop() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const body = $('shopBody');
  body.innerHTML = '';
  if (tab === 'gear') {
    for (const [key, g] of Object.entries(E.GEAR)) {
      const lvl = S.gear[key] || 0;
      const maxed = lvl >= E.MAX_LEVEL;
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.gear = key;
      el.innerHTML = `<b>${g.name} <span class="levels">${'●'.repeat(lvl)}${'○'.repeat(E.MAX_LEVEL - lvl)}</span></b><small>${g.what}</small><div class="buy"></div>`;
      const gearIcon = document.createElement('canvas'); gearIcon.width = gearIcon.height = 80; gearIcon.className = 'gear-icon'; gearIcon.setAttribute('aria-hidden', 'true');
      drawGear(gearIcon.getContext('2d'), key); el.querySelector('b').prepend(gearIcon);
      const box = el.querySelector('.buy');
      if (maxed) box.textContent = 'Maxed';
      else {
        const c = document.createElement('button');
        c.textContent = `${E.upgradeCost(key, lvl).toLocaleString()} coins`;
        c.disabled = S.coins < E.upgradeCost(key, lvl);
        c.onclick = () => act(() => E.upgrade(S, key, 'coins'));
        const gm = document.createElement('button');
        gm.className = 'gem';
        gm.textContent = `${E.upgradeGems(key, lvl)} gems`;
        gm.onclick = () => act(() => E.upgrade(S, key, 'gems'), 'gems');
        box.append(c, gm);
      }
      body.append(el);
    }
  } else if (tab === 'avatars') {
    const grid = document.createElement('div');
    grid.className = 'avatars';
    for (const a of E.AVATARS) {
      const owned = S.avatars.includes(a.id);
      const el = document.createElement('div');
      el.className = 'avatar' + (S.avatar === a.id ? ' on' : '') + (a.season || a.gems ? ' premium' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      drawAvatar(cv.getContext('2d'), a.id, 64, 68, 36, { t: presentation.reduced ? 0 : t });
      const b = document.createElement('button');
      b.textContent = S.avatar === a.id ? 'Using' : owned ? 'Use' : a.season ? `Pass · tier ${a.season}` : a.gems ? `${a.gems} gems` : `${(a.coins || 0).toLocaleString()} coins`;
      if (a.gems && !owned) b.className = 'gem';
      b.onclick = () => !owned && a.season ? openSeason() : act(() => E.buyAvatar(S, a.id), a.gems ? 'gems' : null);
      el.append(cv, Object.assign(document.createElement('span'), { textContent: a.name }), Object.assign(document.createElement('small'), { className: 'rarity', textContent: a.season ? 'Season exclusive' : a.gems ? 'Gem collection' : 'Sky explorer' }), b);
      grid.append(el);
    }
    body.append(grid);
  } else {
    const packs = [
      ['gems_small', `${E.PRODUCTS.gems_small.gems} gems`, ''],
      ['gems_medium', `${E.PRODUCTS.gems_medium.gems} gems`, 'Popular'],
      ['gems_large', `${E.PRODUCTS.gems_large.gems} gems`, 'Best value'],
      ['remove_ads', 'Remove ads', S.adsOff ? 'Owned' : 'No more ads between runs'],
      ['lives_refill', 'Refill lives', 'Straight back to full'],
      ['vip_weekly', 'VIP · weekly', E.isVip(S, Date.now()) ? `Active for ${Math.ceil((S.vipUntil - Date.now()) / 86400000)} more days` : 'No ads, double coins, a sixth life'],
      ['season_pass', 'Season pass', E.ensureSeason(S, Date.now()).season.premium ? 'Owned this season' : 'The paid track: gems, coins and three avatars you cannot buy'],
      ['piggy_bank', `Smash the piggy bank: ${S.piggy || 0} gems`, E.piggyReady(S) ? 'Every gem you have saved' : `Opens at ${E.PIGGY.min} gems`],
    ];
    if (E.starterLeft(S, Date.now())) packs.unshift(['starter_pack', 'Starter pack', `${E.STARTER.gems} gems, Blaze and a level of spring boots · once only`]);
    for (const [id, name, tag] of packs) {
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.product = id;
      el.innerHTML = `<b>${name}</b><small>${tag}</small><div class="buy"></div>`;
      const b = document.createElement('button');
      b.className = 'gem';
      b.textContent = billing.label(id);
      b.disabled = (id === 'remove_ads' && S.adsOff) || (id === 'piggy_bank' && !E.piggyReady(S)) || (id === 'season_pass' && E.ensureSeason(S, Date.now()).season.premium);
      b.onclick = () => buy(id);
      el.querySelector('.buy').append(b);
      body.append(el);
    }
    if (billing.mode() === 'preview') body.append(Object.assign(document.createElement('p'), { className: 'note', textContent: 'This is the web preview: purchases here are free and nothing is charged.' }));
  }
}
function act(fn, needs) {
  try {
    S = fn();
    save();
    refresh();
    renderShop();
  } catch (e) {
    toast(e.message);
    if (needs === 'gems' && /gems/.test(e.message)) {
      tab = 'gems';
      renderShop();
    }
  }
}
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => ((tab = b.dataset.tab), renderShop())));
$('openShop').onclick = () => openShop('gear');
$('closeShop').onclick = () => {
  if (shopBack === 'over' && run) {
    const cost = E.reviveCost(run.revives);
    $('reviveGems').disabled = S.gems < cost;
    show('over');
  } else show('home');
};

// ---- daily reward
function openDaily() {
  const ready = E.dailyReady(S, Date.now());
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = S.daily.last === yesterday || S.daily.last === new Date().toISOString().slice(0, 10) ? S.daily.streak : 0;
  const todayIndex = ready ? streak % 7 : (streak - 1) % 7;
  $('dailyDays').innerHTML = E.DAILY.map((d, i) => `<div class="${i < (ready ? streak % 7 : todayIndex + 1) ? 'done' : ''} ${i === todayIndex && ready ? 'today' : ''}">Day ${i + 1}<br>${d.coins}c${d.gems ? `<br>${d.gems}g` : ''}</div>`).join('');
  $('freezeInfo').textContent = `Streak freezes: ${S.freezes || 0} of ${E.FREEZE.max}. Each one saves your streak for a missed day.`;
  $('buyFreeze').textContent = `Buy a freeze: ${E.FREEZE.gems} gems`;
  $('buyFreeze').disabled = (S.freezes || 0) >= E.FREEZE.max;
  $('claimDaily').disabled = !ready;
  $('claimDaily').textContent = ready ? 'Claim' : 'Come back tomorrow';
  show('daily');
}
$('openDaily').onclick = openDaily;
$('claimDaily').onclick = () => {
  try {
    const r = E.claimDaily(S, Date.now());
    track('daily_claim', { streak: r.streak, froze: r.frozeUsed || 0 });
    S = r.state;
    save();
    toast(`Day ${r.streak}: +${r.reward.coins} coins${r.reward.gems ? `, +${r.reward.gems} gems` : ''}`);
    openDaily();
  } catch (e) {
    toast(e.message);
  }
};
$('closeDaily').onclick = () => show('home');
$('buyFreeze').onclick = () => {
  try {
    S = E.buyFreeze(S);
    save();
    openDaily();
  } catch (e) {
    toast(e.message);
  }
};

// ---- the season pass
function openSeason() {
  S = E.ensureSeason(S, Date.now());
  const se = S.season;
  const showcase = $('seasonHeroes'); showcase.innerHTML = '';
  for (const a of E.AVATARS.filter(a => a.season)) {
    const figure = document.createElement('figure'), cv = document.createElement('canvas'); cv.width = cv.height = 160;
    drawAvatar(cv.getContext('2d'), a.id, 80, 86, 46, { t: presentation.reduced ? 0 : t });
    figure.append(cv, Object.assign(document.createElement('figcaption'), { textContent: `${a.name} · tier ${a.season}` })); showcase.append(figure);
  }
  const tier = E.seasonTier(se);
  const days = Math.ceil(E.seasonEndsIn(Date.now()) / 86400000);
  $('seasonInfo').textContent = `Tier ${tier} of ${E.SEASON.tiers} · ${se.xp % E.SEASON.xpPerTier}/${E.SEASON.xpPerTier} xp to the next · every metre is an xp · ends in ${days} days`;
  $('buyPass').classList.toggle('hidden', se.premium);
  $('buyPass').textContent = `Unlock the season pass · ${billing.label('season_pass')}`;
  const list = $('tiers');
  list.innerHTML = '';
  const label = (r) => [r.avatar ? E.AVATARS.find((a) => a.id === r.avatar).name : '', r.gems ? `${r.gems} gems` : '', r.coins ? `${r.coins} coins` : ''].filter(Boolean).join(' + ');
  for (let i = 1; i <= E.SEASON.tiers; i++) {
    const row = document.createElement('div');
    row.className = 'tier' + (i > tier ? ' locked' : '');
    const f = document.createElement('button');
    f.textContent = se.free.includes(i) ? 'Claimed' : label(E.seasonReward(i, 'free'));
    f.disabled = i > tier || se.free.includes(i);
    f.onclick = () => claimTier(i, 'free');
    const pd = document.createElement('button');
    pd.className = 'paid';
    pd.textContent = se.paid.includes(i) ? 'Claimed' : (se.premium ? '' : '🔒 ') + label(E.seasonReward(i, 'paid'));
    pd.disabled = i > tier || se.paid.includes(i);
    pd.onclick = () => claimTier(i, 'paid');
    row.append(Object.assign(document.createElement('b'), { textContent: i }), f, pd);
    list.append(row);
  }
  show('season');
}
function claimTier(i, track) {
  try {
    S = E.claimSeason(S, i, track, Date.now());
    save();
    openSeason();
  } catch (e) {
    toast(e.message);
    if (/season pass/.test(e.message)) $('buyPass').scrollIntoView({ behavior: 'smooth' });
  }
}
$('seasonBtn').onclick = openSeason;
$('closeSeason').onclick = () => show('home');
$('buyPass').onclick = async () => {
  await buy('season_pass');
  openSeason();
};
$('piggy').onclick = () => openShop('gems');
$('starterBanner').onclick = () => openShop('gems');

// ---- steering: hold either half, drag in either direction, or use arrows/A/D
const steering = createSteering();
const steer = () => { dir = steering.direction; };
const world = $('world');
world.addEventListener('pointerdown', (e) => {
  if (presentation.paused || document.body.dataset.view !== 'run') return;
  e.preventDefault();
  // Input must still work on browsers without pointer capture support.
  try { world.setPointerCapture?.(e.pointerId); } catch {}
  steering.down(e.pointerId, e.clientX, innerWidth);
  steer();
});
world.addEventListener('pointermove', (e) => {
  steering.move(e.pointerId, e.clientX);
  steer();
});
// Captured pointers can leave the canvas while still pressed. Only an actual
// release, cancellation or lost capture should end a held movement.
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) world.addEventListener(ev, (e) => { steering.up(e.pointerId); steer(); });
addEventListener('pointerup', e => { steering.up(e.pointerId); steer(); });
world.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', (e) => {
  if (presentation.paused) return;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
    if (document.body.dataset.view !== 'run') return;
    e.preventDefault();
    steering.keyDown(e.code); steer();
  }
  if (e.code === 'Space' && !run && !$('home').classList.contains('hidden')) { e.preventDefault(); play(); }
});
addEventListener('keyup', (e) => {
  if (steering.keyUp(e.code)) steer();
});

// ---- the loop
const g = world.getContext('2d');
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!presentation.paused) t += dt;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (world.width !== Math.round(innerWidth * dpr) || world.height !== Math.round(innerHeight * dpr)) {
    world.width = Math.round(innerWidth * dpr);
    world.height = Math.round(innerHeight * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const inRun = run && !run.dead && document.body.dataset.view === 'run' && !presentation.paused;
  if (inRun) {
    const eventStart = run.events.length;
    step(run, dt, dir);
    for (const event of run.events.slice(eventStart)) sound(event.type);
    $('height').textContent = `${score(run)} m`;
    $('runCoins').textContent = run.coinsTaken;
    $('shieldHud').textContent = run.player.shield ? `🛡 ${run.player.shield}` : '';
    if (run.dead) gameOver();
  }
  drawWorld(g, innerWidth, innerHeight, run, { avatar: S.avatar, t, dir, reduced: presentation.reduced });
  if (countdown > 0 && !$('over').classList.contains('hidden') && !presentation.paused) {
    countdown -= dt;
    $('countdown').textContent = countdown > 0 ? Math.ceil(countdown) : '';
    if (countdown <= 0) finishRun();
  } else $('countdown').textContent = '';
  toastT -= dt;
  if (toastT <= 0) $('toast').textContent = '';
  // the lives timer ticks on the home and out-of-lives screens
  if (!run && Math.floor(t) !== Math.floor(t - dt)) refresh();
  requestAnimationFrame(frame);
}

initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
setupSettings({ isRunning: () => !!run && !run.dead, clearInput: () => { steering.clear(); dir = 0; }, endRun: () => { if (run) finishRun(); } });
artReady.then(() => { refresh(); if (!$('shop').classList.contains('hidden')) renderShop(); });
show('home');
if (E.dailyReady(S, Date.now())) toast('Your daily reward is ready');
requestAnimationFrame(frame);

// ---- the weekly league (the server holds the real groups)
async function openLeague() {
  track('league_open');
  show('leagueScreen');
  $('leagueInfo').textContent = 'Loading your group…';
  $('leagueTable').innerHTML = '';
  const l = await fetchLeague(true);
  renderLeague(l);
}
function renderLeague(l) {
  $('leagueName').value = net.player?.name || '';
  if (!l) {
    $('leagueInfo').textContent = `The league could not be reached. ${net.status}`;
    return;
  }
  const days = Math.max(1, Math.ceil(l.endsIn / 86400000));
  $('leagueTitle').textContent = `${l.league} league`;
  if (!l.joined) {
    $('leagueInfo').textContent = `Climb this week to join a group of up to 30 real players. The top go up a league, the bottom go down. Ends in ${days} day${days === 1 ? '' : 's'}.`;
    $('leagueTable').innerHTML = '';
    return;
  }
  $('leagueInfo').textContent = `${l.group.length} real player${l.group.length === 1 ? '' : 's'} this week · top ${l.promote || 0} go up${l.relegate ? `, bottom ${l.relegate} go down` : ''} · ends in ${days} day${days === 1 ? '' : 's'}`;
  const table = $('leagueTable');
  table.innerHTML = '';
  const n = l.group.length;
  for (const r of l.group) {
    const li = document.createElement('li');
    li.className = (r.me ? 'me ' : '') + (l.promote && r.rank <= l.promote ? 'up' : l.relegate && r.rank > n - l.relegate ? 'down' : '');
    li.innerHTML = `<span class="rank">${ordinal(r.rank)}</span><span class="who"></span><span class="m">${r.best} m</span>`;
    li.querySelector('.who').textContent = r.name + (r.me ? ' (you)' : '');
    table.append(li);
  }
}
$('league').onclick = openLeague;
$('league').setAttribute('role', 'button');
$('league').tabIndex = 0;
$('closeLeague').onclick = () => show('home');
$('saveName').onclick = async () => {
  try {
    const name = await setName($('leagueName').value);
    toast(`You are ${name} on the board`);
    renderLeague(await fetchLeague(true));
  } catch (e) {
    toast(e.message);
  }
};

track('session_start', { runs: S.runs, best: Math.floor(S.best), gems: S.gems, vip: E.isVip(S, Date.now()), adsOff: S.adsOff, preview: billing.mode() === 'preview' });
flush();
fetchLeague(true).then(() => refresh());
