// Brick Blast: the screen, dragging, the miner's feature, sound and ads.
// The rules are logic.mjs. Old school underground (Ryan: "old school
// underground mining theme, with a little old school miner and old school
// dynamite filling up and old rail cart"). Original painted assets are in
// paint.mjs; this file preserves the rule calls and feature timing.
import {createPaint,artReady} from './paint.mjs';
import { newGame, place, fits, SHAPES, SIZE, planBlast, detonate, reviveBlast, winTier, checkOver } from './logic.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, bannerOnScreens } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const cv = $('game');
const g2 = cv.getContext('2d');
const paint=createPaint(g2);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let prefs={sound:true,motion:!reduced.matches};
try{prefs={...prefs,...JSON.parse(localStorage.getItem('brickblast.settings')||'{}')}}catch{}
const motion=()=>prefs.motion&&!reduced.matches;
const KEY = 'brickblast.v1';
let best = 0;
try {
  best = Number(JSON.parse(localStorage.getItem(KEY) || '{}').best) || 0;
} catch (e) {
  console.warn('Save unreadable:', e.message);
}
const saveBest = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ best }));
  } catch {
    /* private mode: the best score lasts this session */
  }
};

// ore colours for the six brick kinds: base, dark, fleck
const ORE = [
  null,
  ['#4a4540', '#2c2926', '#15120f'], // coal
  ['#a35a2c', '#6b3515', '#4fb38e'], // copper, with a green bloom
  ['#8f3d2b', '#5a2016', '#c97a5a'], // iron
  ['#8d949b', '#5c6268', '#f4f6f8'], // silver
  ['#c9962a', '#8a5f10', '#fff1a8'], // gold
  ['#3c6f86', '#22414f', '#7ff0ff'], // opal
];

let game = null;
let view = 'home';
let disp = null; // the board as drawn (lags the rules board during a blast)
let shownScore = 0;
let shake = 0;
let parts = [];
let blasts = [];
let floats = [];
let banner = null; // big text: { text, sub, t }
let miner = null; // { x, y, tx, ty, state, t, facing }
let sticks = []; // dynamite on the board: { r, c, big, lit }
let cart = { x: 0, glow: 0 };
let drag = null;
let revived = false;
let t = 0;
let L = {};

// ---- layout
function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth;
  const H = innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H*dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bannerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ad-banner')) || 0;
  const trayH = Math.min(145, H * .18);
  const cell = Math.max(16,Math.floor(Math.min((W-40)/SIZE,(H-170-trayH-bannerH-30)/SIZE,70)));
  const bw=cell*SIZE;
  const top=Math.max(164,Math.floor((H-bw-trayH-bannerH)*.5+12));
  L={W,H,cell,bx:Math.round((W-bw)/2),by:top,bw,trayX:Math.round((W-bw)/2),trayW:bw,trayY:top+bw+16,trayH,cartY:top-64};
}

// ---- sound: made here, nothing to load
let ac = null;
function audio() {
  if(!prefs.sound)return null;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
  return ac;
}
function tone(freq, dur, type = 'triangle', vol = 0.06, when = 0) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const v = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  v.gain.setValueAtTime(vol, a.currentTime + when);
  v.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur);
  o.connect(v).connect(a.destination);
  o.start(a.currentTime + when);
  o.stop(a.currentTime + when + dur + 0.02);
}
function noise(dur, vol = 0.25, lp = 900) {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const v = a.createGain();
  f.type = 'lowpass';
  f.frequency.value = lp;
  v.gain.value = vol;
  s.buffer = b;
  s.connect(f).connect(v).connect(a.destination);
  s.start();
}
const sfx = {
  place: () => tone(180, 0.08, 'square', 0.04),
  clear: (lines, streak) => [0, 4, 7, 12, 16].slice(0, 2 + lines).forEach((s, i) => tone(330 * 2 ** ((s + streak) / 12), 0.25, 'triangle', 0.05, i * 0.06)),
  stick: (i) => tone(520 + i * 30, 0.06, 'square', 0.03),
  fuse: () => noise(1.1, 0.06, 6000),
  boom: (big) => {
    noise(big ? 0.9 : 0.55, big ? 0.5 : 0.35, big ? 500 : 800);
    tone(big ? 55 : 70, 0.4, 'sine', 0.2);
  },
  tick: (i) => tone(600 + (i % 12) * 40, 0.04, 'square', 0.02),
  win: () => [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(262 * 2 ** (s / 12), 0.35, 'triangle', 0.05, i * 0.08)),
};

// ---- drawing
function drawWorld(){paint.world(L,game,view,t,cart,motion())}
function brick(x,y,size,k,alpha=1){paint.brick(x,y,size,k,alpha)}
function drawBoard() {
  const { bx, by, cell } = L;
  g2.fillStyle = '#091315';
  g2.fillRect(bx - 4, by - 4, cell * SIZE + 8, cell * SIZE + 8);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      g2.fillStyle = (r + c) % 2 ? '#172425' : '#1c2b2c';
      g2.fillRect(bx + c * cell + 1, by + r * cell + 1, cell - 2, cell - 2);
      const k = disp?.[r][c];
      if (k) brick(bx + c * cell, by + r * cell, cell, k);
    }
  // the drag ghost, and the lines it would clear
  if (drag?.at) {
    const sh = SHAPES[game.tray[drag.i].shape];
    const ok = fits(game.board, sh, drag.at.r, drag.at.c);
    if (ok) {
      const b = game.board.map((row) => row.slice());
      for (const [dr, dc] of sh) b[drag.at.r + dr][drag.at.c + dc] = 9;
      g2.fillStyle = '#f1b53a33';
      for (let k = 0; k < SIZE; k++) {
        if (b[k].every(Boolean)) g2.fillRect(bx, by + k * cell, cell * SIZE, cell);
        if (b.every((row) => row[k])) g2.fillRect(bx + k * cell, by, cell, cell * SIZE);
      }
      for (const [dr, dc] of sh) brick(bx + (drag.at.c + dc) * cell, by + (drag.at.r + dr) * cell, cell, game.tray[drag.i].colour, 0.45);
    }
  }
  paint.sticks(L,sticks,t);
}
function drawTray() {
  if (!game) return;
  const slot = L.trayW / 3;
  for (let i = 0; i < 3; i++) {
    const p = game.tray[i];
    if (!p || drag?.i === i) continue;
    const sh = SHAPES[p.shape];
    const s = Math.min(L.cell * 0.55, (L.trayH - 20) / 5);
    const w = (Math.max(...sh.map((x) => x[1])) + 1) * s;
    const h = (Math.max(...sh.map((x) => x[0])) + 1) * s;
    const ok = fitsAnywhereCached(i);
    for (const [dr, dc] of sh) brick(L.trayX + slot * i + slot / 2 - w / 2 + dc * s, L.trayY + L.trayH / 2 - h / 2 + dr * s, s, p.colour, ok ? 1 : 0.35);
  }
  if (drag) {
    const p = game.tray[drag.i];
    const sh = SHAPES[p.shape];
    for (const [dr, dc] of sh) brick(drag.x + dc * L.cell, drag.y + dr * L.cell, L.cell, p.colour, 0.95);
  }
}
const fitsAnywhereCached = (i) => {
  const p = game.tray[i];
  if (!p) return false;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(game.board, SHAPES[p.shape], r, c)) return true;
  return false;
};
function drawMiner(){paint.miner(L,miner,t,motion())}
function drawEffects(dt) {
  blasts=blasts.filter(b=>(b.life-=dt)>0);
  for(const b of blasts){
    const u=1-b.life/b.max,rad=b.size*(.25+u*1.2);
    g2.save();g2.globalAlpha=(1-u)*(motion()?1:.45);
    const fire=g2.createRadialGradient(b.x,b.y,0,b.x,b.y,rad);
    fire.addColorStop(0,'#fff9dccc');fire.addColorStop(.2,'#ffce57bb');fire.addColorStop(.5,'#e96e2588');fire.addColorStop(1,'#a7350000');
    g2.globalCompositeOperation='lighter';g2.fillStyle=fire;g2.beginPath();g2.arc(b.x,b.y,rad,0,Math.PI*2);g2.fill();
    g2.strokeStyle='#ffd788';g2.lineWidth=2*(1-u);g2.beginPath();g2.arc(b.x,b.y,rad*.82,0,Math.PI*2);g2.stroke();g2.restore();
  }
  parts = parts.filter((p) => (p.life -= dt) > 0);
  for (const p of parts) {
    p.vy += 900 * dt * (p.grav ?? 1);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    g2.globalAlpha = Math.min(1, p.life * 2);
    g2.fillStyle = p.col;
    g2.save();g2.translate(p.x,p.y);g2.rotate(p.life*5);g2.beginPath();g2.moveTo(-p.s,0);g2.lineTo(0,-p.s*.7);g2.lineTo(p.s,p.s*.4);g2.lineTo(0,p.s);g2.closePath();g2.fill();g2.restore();
  }
  g2.globalAlpha = 1;
  floats = floats.filter((f) => (f.life -= dt) > 0);
  g2.textAlign = 'center';
  for (const f of floats) {
    f.y -= 40 * dt;
    g2.globalAlpha = Math.min(1, f.life * 2);
    g2.font = `800 ${f.size}px system-ui`;
    g2.fillStyle = f.col;
    g2.fillText(f.text, f.x, f.y);
  }
  g2.globalAlpha = 1;
  if (banner) {
    banner.t += dt;
    const k = Math.min(1, banner.t * 4);
    g2.save();
    g2.translate(L.W / 2, L.by + L.bw / 2);
    g2.scale(motion()?0.6+0.4*k+Math.sin(banner.t*8)*.02:1,motion()?0.6+0.4*k:1);
    g2.textAlign = 'center';
    g2.shadowColor = '#000';
    g2.shadowBlur = 22;
    g2.fillStyle='#071214dc';g2.fillRect(-L.bw*.5,-54,L.bw,118);
    g2.strokeStyle='#ce9a4b';g2.lineWidth=2;g2.strokeRect(-L.bw*.5,-54,L.bw,118);
    g2.font = `900 ${Math.min(58, L.W / 7)}px Georgia`;
    g2.fillStyle = '#f1b53a';
    g2.fillText(banner.text, 0, 0);
    if (banner.sub) {
      g2.font = '800 30px system-ui';
      g2.fillStyle = '#fff4d6';
      g2.fillText(banner.sub, 0, 44);
    }
    g2.restore();
  }
}
function hud() {
  shownScore += (game.score - shownScore) * 0.2;
  if (Math.abs(game.score - shownScore) < 1) shownScore = game.score;
  g2.textAlign = 'center';
  g2.fillStyle = '#f3e3c3';
  g2.font = '900 38px Georgia';
  g2.fillText(Math.round(shownScore).toLocaleString(), L.W / 2, 44);
  g2.font = '700 12px system-ui';
  g2.fillStyle = '#bfa27a';
  g2.fillText(`BEST ${Math.max(best, game.score).toLocaleString()}`, L.W / 2, 62);
  if (game.streak > 1 && view === 'play') {
    g2.fillStyle = '#f1b53a';
    g2.font = '800 14px system-ui';
    g2.fillText(`COMBO ×${Math.min(game.streak, 10)}`, L.bx+40, 42);
  }
}
function burst(x, y, n, cols, speed = 300) {
  if(n>=16&&speed>=420)blasts.push({x,y,size:L.cell*(n>=30?2.5:1.7),life:.65,max:.65});
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, s: 2 + Math.random() * 4, life: 0.6 + Math.random() * 0.6, col: cols[i % cols.length] });
  }
}
const cellXY = (r, c) => [L.bx + c * L.cell + L.cell / 2, L.by + r * L.cell + L.cell / 2];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// ---- a round
function start() {
  game = newGame((Date.now() & 0x7fffffff) >>> 0);
  disp = game.board.map((r) => r.slice());
  shownScore = 0;
  revived = false;
  sticks = [];
  miner = null;
  // a test hook, only with #blast in the address: the cart starts nearly full
  if (location.hash === '#blast') {
    game.meter = game.meterMax - 1;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) game.board[r][c] = r === SIZE - 1 ? (c < SIZE - 1 ? 1 + (c % 6) : 0) : (r * 5 + c * 3) % 4 === 0 ? 0 : 1 + ((r + c) % 6);
    for (let c = 0; c < SIZE; c++) game.board[3][c] = 0;
    game.tray = [{ shape: 0, colour: 5 }, null, null];
    disp = game.board.map((row) => row.slice());
  }
  setView('play');
}
function setView(v) {
  view = v;
  document.body.dataset.view = v === 'feature' ? 'play' : v;
  $('home').classList.toggle('hidden', v !== 'home');
  $('over').classList.toggle('hidden', v !== 'over');
}
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.textContent = ''), 1400);
}

async function afterPlace(res) {
  if (res.lines) {
    sfx.clear(res.lines, res.streak);
    shake = Math.min(12, 3 + res.lines * 3);
    for (const k of res.rows) for (let c = 0; c < SIZE; c++) burst(...cellXY(k, c), 3, ['#c8b89a', '#8a7358', '#f1b53a']);
    for (const k of res.cols) for (let r = 0; r < SIZE; r++) burst(...cellXY(r, k), 3, ['#c8b89a', '#8a7358', '#f1b53a']);
    floats.push({ text: `+${res.points}`, x: L.W / 2, y: L.by + L.bw / 2, size: 22 + res.lines * 6, col: '#fff1c2', life: 1.1 });
    if (res.lines >= 3) toast(['', '', '', 'Triple!', 'Huge!', 'Unreal!'][Math.min(5, res.lines)]);
  } else sfx.place();
  disp = game.board.map((r) => r.slice());
  if (res.blastReady) await feature();
  if (game.over) return gameOver();
}

// The feature: the cart is full, the miner hops out, plants the sticks,
// runs for cover and it all goes up.
async function feature() {
  setView('feature');
  const meterBefore = game.meterMax;
  const plan = planBlast(game);
  cart.glow = 1;
  sfx.win();
  banner = { text: 'CART FULL!', t: 0 };
  await wait(900);
  banner = null;
  // out of the cart and down onto the face
  const start = [L.W - 80, L.cartY];
  miner = { x: start[0], y: start[1], facing: -1, state: 'run' };
  const tiers = [
    [6, 'BIG BLAST!'],
    [10, 'MEGA BLAST!'],
    [18, 'MOTHER LODE!'],
  ];
  for (let i = 0; i < plan.sticks.length; i++) {
    const s = plan.sticks[i];
    const [tx, ty] = cellXY(s.r, s.c);
    await runTo(tx, ty + L.cell * 0.3, i < 3 ? 260 : 170);
    miner.state = 'plant';
    sticks.push({ ...s, lit: false });
    sfx.stick(i);
    // the tier shows as it climbs past each mark: he keeps going
    for (const [n, text] of tiers) if (i + 1 === n) banner = { text, t: 0 };
    await wait(i < 3 ? 140 : 90);
    miner.state = 'run';
  }
  // run for cover off the edge, light up
  await runTo(-40, L.by - 10, 300);
  miner = null;
  banner = null;
  for (const s of sticks) s.lit = true;
  sfx.fuse();
  await wait(1100);
  const res = detonate(game, plan);
  let total = 0;
  for (const b of res.booms) {
    sticks = sticks.filter((s) => !(s.r === b.r && s.c === b.c));
    for (const [r, c] of b.hit) {
      disp[r][c] = 0;
      burst(...cellXY(r, c), 5, ['#ffb13b', '#ff6a1a', '#6b5a48', '#3a2e24'], 380);
    }
    burst(...cellXY(b.r, b.c), b.big ? 30 : 16, ['#fff1a8', '#ffb13b', '#ff5a1a'], b.big ? 600 : 420);
    sfx.boom(b.big);
    shake = b.big ? 16 : 9;
    total += b.points;
    floats.push({ text: `+${b.points}`, x: cellXY(b.r, b.c)[0], y: cellXY(b.r, b.c)[1], size: 18, col: '#ffd35a', life: 0.9 });
    await wait(b.big ? 260 : 160);
  }
  disp = game.board.map((r) => r.slice());
  // the win tier, with the count up
  const tier = winTier(total, meterBefore);
  if (tier) {
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      banner = { text: `${tier.toUpperCase()} WIN`, sub: `+${Math.round((total * i) / steps).toLocaleString()}`, t: 1 };
      sfx.tick(i);
      await wait(45);
    }
    sfx.win();
    await wait(900);
  } else {
    banner = { text: plan.tier.toUpperCase(), sub: `+${total}`, t: 0 };
    await wait(900);
  }
  banner = null;
  cart.glow = 0;
  setView('play');
}
function runTo(x, y, speed) {
  return new Promise((res) => {
    miner.tx = x;
    miner.ty = y;
    miner.speed = speed * (L.cell / 40);
    miner.done = res;
  });
}

function gameOver() {
  if (game.score > best) {
    best = game.score;
    saveBest();
  }
  $('overScore').textContent = game.score.toLocaleString();
  $('overNote').textContent = game.score >= best ? 'A new best!' : `Best ${best.toLocaleString()}`;
  $('revive').classList.toggle('hidden', revived || !adsAvailable());
  setView('over');
}
$('revive').onclick = async () => {
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  if (!r?.rewarded) return toast(r?.reason ? 'The ad did not load' : 'Watch to the end to keep going');
  revived = true;
  setView('feature');
  const res = reviveBlast(game);
  for (const b of res.booms) {
    for (const [rr, cc] of b.hit) {
      disp[rr][cc] = 0;
      burst(...cellXY(rr, cc), 6, ['#ffb13b', '#ff6a1a', '#6b5a48']);
    }
    sfx.boom(true);
    shake = 14;
    await wait(220);
  }
  disp = game.board.map((row) => row.slice());
  setView('play');
  if (game.over) gameOver();
};
$('again').onclick = () => {
  maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e));
  start();
};
$('play').onclick = () => {
  audio();
  document.documentElement.requestFullscreen?.().catch(()=>{});
  start();
};
$('toHome').onclick = () => {
  $('homeBest').textContent = best ? `Best ${best.toLocaleString()}` : '';
  setView('home');
};

// ---- dragging a piece: it rides above the finger so you can see where it goes
cv.addEventListener('pointerdown', (e) => {
  if (view !== 'play' || !game || $('settingsPanel').open || drag) return;
  if (e.clientY < L.trayY || e.clientY > L.trayY+L.trayH || e.clientX<L.trayX || e.clientX>L.trayX+L.trayW) return;
  const i = Math.floor((e.clientX-L.trayX) / (L.trayW / 3));
  if (!game.tray[i]) return;
  audio();
  cv.setPointerCapture(e.pointerId);
  drag = { i, id: e.pointerId };
  moveDrag(e);
});
function moveDrag(e) {
  const sh = SHAPES[game.tray[drag.i].shape];
  const w = (Math.max(...sh.map((x) => x[1])) + 1) * L.cell;
  const h = (Math.max(...sh.map((x) => x[0])) + 1) * L.cell;
  drag.x = e.clientX - w / 2;
  drag.y = e.clientY - h - L.cell * 1.2;
  const c = Math.round((drag.x - L.bx) / L.cell);
  const r = Math.round((drag.y - L.by) / L.cell);
  drag.at = fits(game.board, sh, r, c) ? { r, c } : null;
}
cv.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.id) moveDrag(e);
});
cv.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.at) return;
  const res = place(game, d.i, d.at.r, d.at.c);
  afterPlace(res);
});
cv.addEventListener('pointercancel', () => (drag = null));

// ---- the loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  layout();
  g2.save();
  if (shake > 0 && motion()) {
    g2.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake = Math.max(0, shake - dt * 40);
  }
  drawWorld();
  if (game) {
    drawBoard();
    drawTray();
    if (miner && miner.tx !== undefined) {
      const dx = miner.tx - miner.x;
      const dy = miner.ty - miner.y;
      const d = Math.hypot(dx, dy);
      const step = miner.speed * dt;
      if (d <= step) {
        miner.x = miner.tx;
        miner.y = miner.ty;
        const done = miner.done;
        miner.tx = undefined;
        miner.done = null;
        done?.();
      } else {
        miner.x += (dx / d) * step;
        miner.y += (dy / d) * step;
        miner.facing = dx < 0 ? -1 : 1;
      }
    }
    drawMiner();
    hud();
  }
  drawEffects(dt);
  g2.restore();
  requestAnimationFrame(frame);
}

$('settings').onclick=()=>{drag=null;$('sound').checked=prefs.sound;$('motion').checked=prefs.motion;$('settingsPanel').showModal()};
$('closeSettings').onclick=()=>$('settingsPanel').close();
for(const key of ['sound','motion'])$(key).onchange=()=>{prefs[key]=$(key).checked;if(key==='sound'&&!prefs.sound)ac?.suspend();try{localStorage.setItem('brickblast.settings',JSON.stringify(prefs))}catch{}};
await artReady;
Object.defineProperty(window,'__brickQA',{get:()=>({view,game:game?JSON.parse(JSON.stringify(game)):null,L:{...L},miner:miner?{x:miner.x,y:miner.y,state:miner.state}:null,sticks:sticks.length,prefs:{...prefs},banner:banner?.text||null})});
layout();
$('homeBest').textContent = best ? `Best ${best.toLocaleString()}` : '';
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
bannerOnScreens('view', ['home', 'over']);
requestAnimationFrame(frame);
