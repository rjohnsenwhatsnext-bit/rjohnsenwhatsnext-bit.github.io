// Merge Mine: the screen (Claude's placeholder; Codex owns the look).
// The rules are logic.mjs. This file only reads the state, turns taps and
// drags into rule calls, and shows what came back. Element ids and the
// window.__mergeQA hook are the contract with Codex's styling and tests.
import * as M from './logic.mjs';
import { itemArt, burst, reveal, sound, initSettings } from './visual.mjs';
import { initAds, showRewarded, adsAvailable, bannerOnScreens } from './arcade-ads.js';
import { createTutorial } from './tutorial.mjs';

const $ = (id) => document.getElementById(id);
const KEY = 'mergemine.save';
let S;
let selected = -1;
let saveProblem = '';

// ---- saving
function loadSave() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    saveProblem = 'This phone cannot keep a save: ' + e.message;
  }
  if (!raw) return M.newGame((Math.random() * 2 ** 32) >>> 0);
  try {
    return M.load(raw);
  } catch (e) {
    // a save that does not fit is kept aside, not thrown away
    try {
      localStorage.setItem(KEY + '.broken', raw);
    } catch { /* the save could not be read either: nothing more to keep */ }
    saveProblem = 'Your old save could not be read (' + e.message + '), so this is a fresh mine. The old one is kept.';
    return M.newGame((Math.random() * 2 ** 32) >>> 0);
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    saveProblem = 'Progress is not being saved: ' + e.message;
    toast(saveProblem);
  }
}

// ---- small helpers
let toastTimer = 0;
function toast(msg, ms = 1600) {
  $('toast').textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').textContent = ''), ms);
}
const label = (it) => (M.isGen(it) ? M.GENERATORS[it.g].name : M.itemName(it));
function tile(it) {
  const d = document.createElement('div');
  d.title=label(it);
  if (M.isGen(it)) {
    d.className = 'item gen';
    d.innerHTML = `<img src="${itemArt(it)}" alt="${label(it)}" draggable="false"><small>⚡</small>`;
  } else {
    d.className = `item c-${it.c}`;
    d.innerHTML = `<img src="${itemArt(it)}" alt="${label(it)}" draggable="false"><em>${it.l}</em>`;
  }
  return d;
}

// ---- drawing the state
function renderBar(now = Date.now()) {
  M.tickEnergy(S, now);
  $('energyN').textContent = S.energy;
  const next = M.nextEnergyIn(S, now);
  $('energyT').textContent = next ? `+1 in ${Math.floor(next / 60000)}:${String(Math.floor((next % 60000) / 1000)).padStart(2, '0')}` : 'full';
  $('coinsN').textContent = S.coins.toLocaleString();
  const lvl = M.level(S);
  $('lvlN').textContent = 'Lv ' + lvl;
  const a = M.xpForLevel(lvl);
  const b = M.xpForLevel(lvl + 1);
  $('xpBar').firstElementChild.style.width = `${Math.round(((S.xp - a) / (b - a)) * 100)}%`;
  $('site').disabled = false;
  $('site').textContent = S.coins >= M.nextProject(S).cost ? 'The mine: build!' : 'The mine';
}
function renderOrders() {
  const box = $('orders');
  box.innerHTML = '';
  S.orders.forEach((o, k) => {
    const ready = Boolean(M.orderCells(S, o));
    const el = document.createElement('div');
    el.className = 'order' + (ready ? ' ready' : '');
    el.dataset.order = k;
    const used = new Set();
    const wants = o.want
      .map((w) => {
        const i = S.board.findIndex((x, j) => !used.has(j) && M.isItem(x) && x.c === w.c && x.l === w.l);
        if (i >= 0) used.add(i);
        return `<span title="${M.itemName(w)}" class="want c-${w.c}${i >= 0 ? ' have' : ''}"><img src="${itemArt(w)}" alt="${M.itemName(w)}"><em>${w.l}</em>${i>=0?'<b>✓</b>':''}</span>`;
      })
      .join('');
    el.innerHTML = `<div class="customer"><img src="assets/person-${M.CUSTOMERS.indexOf(o.who)}.webp" alt=""><span class="who">${o.who.replace('The ','')}</span></div><div class="wants">${wants}</div><small>◈ ${o.coins}${o.chest ? ' + crate' : ''}</small>`;
    const b = document.createElement('button');
    b.textContent = ready ? 'Deliver' : 'Collect items';
    b.disabled = !ready;
    b.onclick = () => fill(k);
    el.append(b);
    box.append(el);
  });
}
function renderBoard(flash = {}) {
  const board = $('board');
  board.innerHTML = '';
  S.board.forEach((it, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (i === selected ? ' sel' : '');
    cell.dataset.i = i;
    cell.setAttribute('role','button');cell.tabIndex=0;cell.setAttribute('aria-label',it?label(it):`Empty cell ${i+1}`);
    cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(selected>=0&&selected!==i&&M.isItem(S.board[selected]))drop(selected,i);else tapCell(i)}};
    if (it) {
      const t = tile(it);
      if (flash[i]) t.classList.add(flash[i]);
      cell.append(t);
    }
    board.append(cell);
  });
}
function renderInfo() {
  const it = S.board[selected];
  const sell = $('sell');
  if (!it) {
    $('infoText').textContent = saveProblem || 'Drag two the same together. Tap a generator to dig.';
    sell.classList.add('hidden');
    return;
  }
  if (M.isGen(it)) $('infoText').textContent = `${label(it)}: tap for ${M.CHAINS[M.GENERATORS[it.g].chain][0].toLowerCase()} and better. One energy a tap.`;
  else if (it.c === 'chest') $('infoText').textContent = `${label(it)}: tap it again to open. Two the same make a bigger one.`;
  else {
    const top = it.l >= M.maxLevel(it.c);
    $('infoText').textContent = `${label(it)} (level ${it.l} of ${M.maxLevel(it.c)})${top ? ', the best there is' : `. Two make a ${M.CHAINS[it.c][it.l]}`}`;
  }
  const canSell = M.isItem(it) && it.c !== 'chest';
  sell.classList.toggle('hidden', !canSell);
  if (canSell) sell.textContent = `Sell for ${M.sellValue(it)}`;
}
function render(flash) {
  renderBar();
  renderOrders();
  renderBoard(flash);
  renderInfo();
  tut?.paint();
}

// ---- actions
function tapCell(i) {
  const it = S.board[i];
  if (M.isGen(it)) {
    const r = M.tapGenerator(S, i);
    if (!r.ok) {
      if (r.energy) openEnergy();
      else toast(r.reason);
      return;
    }
    selected = -1;
    save();
    tut.event('tap');
    const flash = { [r.cell]: 'pop' };
    if (r.bonus) {
      flash[r.bonus.cell] = 'lucky';
      toast('A crate fell out!');
    }
    return render(flash);
  }
  if (M.isItem(it) && it.c === 'chest' && selected === i) {
    const r = M.openChest(S, i);
    selected = -1;
    save();
    tut.event('open');
    const bits = [];
    if (r.drops.length) bits.push(`${r.drops.length} piece${r.drops.length > 1 ? 's' : ''}`);
    if (r.coins) bits.push(`${r.coins} coins`);
    if (r.energy) bits.push(`${r.energy} energy`);
    toast(bits.join(', ') || 'Empty!', 2000);
    reveal(bits.join(' · ') || 'Empty');
    return render(Object.fromEntries(r.drops.map((d) => [d.cell, 'pop'])));
  }
  selected = it ? i : -1;
  renderBoard();
  renderInfo();
  tut?.paint();
}
function drop(from, to) {
  const r = M.move(S, from, to);
  if (r.kind === 'none') return renderBoard();
  selected = r.kind === 'merge' ? to : -1;
  save();
  if (r.kind === 'merge') tut.event('merge');
  if (r.lucky) toast('Lucky strike! Up two!', 2000);
  if (r.levelUp) announceLevel(r.levelUp);
  render(r.kind === 'merge' ? { [to]: r.lucky ? 'lucky' : 'pop' } : {});
  if(r.kind==='merge')burst(to,r.lucky?'lucky':'merge');
}
function fill(k) {
  const r = M.fillOrder(S, k);
  if (!r.ok) return toast(r.reason);
  save();
  tut.event('fill');
  toast(`+${r.coins} coins`);
  if (r.levelUp) announceLevel(r.levelUp);
  render(r.chestCell >= 0 ? { [r.chestCell]: 'lucky' } : {});
  sound('build');
}
function announceLevel(l) {
  const gens = l.generators.map((g) => M.GENERATORS[g].name);
  toast(`Level ${l.level}!${gens.length ? ' New: ' + gens.join(', ') : ''}`, 2600);
}
$('sell').onclick = () => {
  const r = M.sell(S, selected);
  if (!r.ok) return toast(r.reason);
  selected = -1;
  save();
  toast(`+${r.coins} coins`);
  render();
};

// ---- dragging: press on a piece, move, let go over another cell. A press
// that does not move is a tap.
let drag = null;
$('board').addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const i = Number(cell.dataset.i);
  drag = { from: i, x: e.clientX, y: e.clientY, moved: false, ghost: null, over: -1 };
  $('board').setPointerCapture(e.pointerId);
});
$('board').addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8 && M.isItem(S.board[drag.from])) {
    drag.moved = true;
    drag.ghost = tile(S.board[drag.from]);
    drag.ghost.classList.add('ghost');
    document.body.append(drag.ghost);
  }
  if (!drag.moved) return;
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top = e.clientY + 'px';
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
  const over = under ? Number(under.dataset.i) : -1;
  if (over !== drag.over) {
    document.querySelector('.cell.drop')?.classList.remove('drop');
    if (over >= 0 && over !== drag.from) under.classList.add('drop');
    drag.over = over;
  }
});
function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.ghost?.remove();
  if (!d.moved) return tapCell(d.from);
  if (d.over >= 0) drop(d.from, d.over);
  else render();
}
$('board').addEventListener('pointerup', endDrag);
$('board').addEventListener('pointercancel', () => {
  drag?.ghost?.remove();
  drag = null;
  render();
});

// ---- the mine site
let viewingArea=null;
function renderSite() {
  const p = M.nextProject(S);
  const a=viewingArea??S.area,stage=a<S.area?5:S.built,past=a<S.area;
  $('areaName').textContent = M.areaName(a).toUpperCase();
  $('siteArt').src=`assets/stage-${Math.min(a,4)*6+stage}.webp`;
  $('siteArt').alt=`${M.areaName(a)}: ${stage} of 5 projects completed`;
  $('siteStage').textContent=past?'AREA COMPLETE':`${stage} / 5 PROJECTS COMPLETE`;
  const areaTabs=[...Array.from({length:Math.min(S.area+1,5)},(_,i)=>i),...(S.area>=5?[S.area]:[])];
  $('siteAreas').innerHTML=areaTabs.map(i=>`<button data-area="${i}" class="${i===a?'active':''}" aria-label="${M.areaName(i)}">${i+1}</button>`).join('');
  for(const btn of $('siteAreas').children)btn.onclick=()=>{viewingArea=Number(btn.dataset.area);renderSite()};
  $('projName').textContent = p.name;
  $('projNote').textContent = S.coins >= p.cost ? `${p.cost} coins. You have ${S.coins}.` : `${p.cost} coins. ${p.cost - S.coins} to go: fill orders to earn them.`;
  $('projDots').innerHTML = Array.from({ length: M.PROJECTS_PER_AREA }, (_, k) => `<i class="${k < S.built ? 'done' : ''}"></i>`).join('');
  $('build').disabled = S.coins < p.cost;
  $('build').textContent=`Build · ${p.cost} coins`;
  if(past){$('projName').textContent='A job well done';$('projNote').textContent='Every project completed. Your mine keeps growing.';$('build').classList.add('hidden')}else $('build').classList.remove('hidden');
  $('projDots').innerHTML=Array.from({length:5},(_,k)=>`<i title="${M.projectName(a,k)}" class="${k<stage?'done':''}"></i>`).join('');
}
$('site').onclick = () => {
  viewingArea=null;
  renderSite();
  $('siteDlg').showModal();
  tut.event('site');
};
$('closeSite').onclick = () => $('siteDlg').close();
$('build').onclick = () => {
  const r = M.build(S);
  if (!r.ok) return toast(r.reason);
  save();
  toast(r.areaDone ? `${r.areaDone} is done! A strongbox for you.` : `${r.project.name}: done!`, 2600);
  sound('build');if(r.areaDone)viewingArea=S.area-1;
  if (r.levelUp) setTimeout(() => announceLevel(r.levelUp), 2600);
  renderSite();
  render();
};

// ---- energy
function openEnergy() {
  const next = M.nextEnergyIn(S);
  $('energyNote').textContent = `One energy comes back every ${M.ENERGY.regenMs / 60000} minutes, even with the game shut. Next in ${Math.ceil(next / 60000)} min.`;
  $('adEnergy').classList.toggle('hidden', !adsAvailable());
  $('energyDlg').showModal();
}
$('energy').onclick = openEnergy;
$('closeEnergy').onclick = () => $('energyDlg').close();
$('adEnergy').onclick = async () => {
  $('adEnergy').disabled = true;
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  $('adEnergy').disabled = false;
  if (!r.rewarded) return toast(r.reason ? 'No ad: ' + r.reason : 'The ad did not finish, so no energy.', 2400);
  M.adEnergy(S);
  save();
  $('energyDlg').close();
  toast(`+${M.ENERGY.ad} energy`);
  render();
};

// ---- screens
function show(view) {
  document.body.dataset.view = view;
  $('home').classList.toggle('hidden', view !== 'home');
  $('game').classList.toggle('hidden', view !== 'play');
  if (view === 'play') render();
  else tut?.paint();
}
$('play').onclick = () => {show('play');document.documentElement.requestFullscreen?.().catch(()=>{});};
initSettings(()=>show('home'));
setInterval(() => document.body.dataset.view === 'play' && renderBar(), 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S) render();
});

S = loadSave();
save();
// declared after the first render functions: they check it exists
var tut = createTutorial(() => S);
$('replayTutorial').onclick = () => {
  $('settingsDlg').close();
  show('play');
  tut.restart();
};
if (saveProblem) toast(saveProblem, 4000);
bannerOnScreens('view', ['home', 'play']);
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
// read-only view for tests: a copy, so a test cannot change the game
Object.defineProperty(window, '__mergeQA', { get: () => ({ state: JSON.parse(JSON.stringify(S)), view: document.body.dataset.view, tutorial: tut.step }) });
