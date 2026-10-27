// Brick Blast: the screen, dragging, the miner's feature, sound and ads.
// The rules are logic.mjs. Old school underground (Ryan: "old school
// underground mining theme, with a little old school miner and old school
// dynamite filling up and old rail cart"). Original painted assets are in
// paint.mjs; this file preserves the rule calls and feature timing.
import {createPaint,artReady} from './paint.mjs';
import { newGame, place, fits, SHAPES, SIZE, planBlast, detonate, reviveBlast, winTier, checkOver } from './logic.mjs';
import { MISSIONS, applyMission } from './missions.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = (id) => document.getElementById(id);
const trackMission = (event, extra = {}) => {
  if (missionIndex < 0) return;
  try { window.arcade?.track(event, { level: missionIndex + 1, mode: 'mine_missions', ...extra }); } catch {}
};
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
let missionIndex = -1;
let missionLines = 0;
let missionDouble = false;
let missionBlasts = 0;
let clearedMissions = 0;
try { clearedMissions = Math.min(MISSIONS.length, Math.max(0, Math.floor(Number(localStorage.getItem('brickblast.missions.v1')) || 0))); } catch {}
let view = 'home';
let disp = null; // the board as drawn (lags the rules board during a blast)
let shownScore = 0;
let shake = 0;
let parts = [];
let blasts = [];
let smoke = [];
let flash = 0;
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
    noise(0.11, big ? 0.22 : 0.16, 4200);
    noise(big ? 1.15 : 0.8, big ? 0.34 : 0.24, big ? 370 : 500);
    tone(big ? 48 : 62, big ? 0.65 : 0.48, 'sine', big ? 0.19 : 0.14);
  },
  tick: (i) => tone(600 + (i % 12) * 40, 0.04, 'square', 0.02),
  win: () => [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(262 * 2 ** (s / 12), 0.35, 'triangle', 0.05, i * 0.08)),
};

// ---- drawing
function drawWorld(){paint.world(L,game,view,t,cart,motion(),flash)}
function brick(x,y,size,k,alpha=1){paint.brick(x,y,size,k,alpha)}
function drawBoard() {
  const { bx, by, cell } = L;
  g2.fillStyle = '#091315';
  g2.fillRect(bx - 4, by - 4, cell * SIZE + 8, cell * SIZE + 8);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const x=bx+c*cell,y=by+r*cell;
      g2.fillStyle=(r+c)%2?'#192627':'#1e2c2c';
      g2.fillRect(x+1,y+1,cell-2,cell-2);
      g2.fillStyle='#57727225';g2.fillRect(x+2,y+2,cell-4,1);
      g2.fillStyle='#01090b48';g2.fillRect(x+2,y+cell-3,cell-4,1);
      if((r*13+c*7)%6===0){g2.strokeStyle='#6b89721b';g2.lineWidth=1;g2.beginPath();g2.moveTo(x+cell*.18,y+cell*.72);g2.lineTo(x+cell*.29,y+cell*.58);g2.lineTo(x+cell*.38,y+cell*.63);g2.stroke()}
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
  if(flash>0){g2.fillStyle=`rgba(255,209,137,${Math.min(.18,flash*.16)})`;g2.fillRect(0,0,L.W,L.H);flash=Math.max(0,flash-dt*2.4)}
  blasts=blasts.filter(b=>(b.life-=dt)>0);
  for(const b of blasts){
    const u=1-b.life/b.max,rad=b.size*(.3+u*1.4),ignite=Math.min(1,u/.12)*Math.pow(1-u,1.3);
    g2.save();g2.globalCompositeOperation='lighter';
    const fire=g2.createRadialGradient(b.x,b.y,0,b.x,b.y,rad);
    fire.addColorStop(0,`rgba(255,252,225,${.7*(1-u)})`);fire.addColorStop(.23,`rgba(255,166,49,${.56*(1-u)})`);fire.addColorStop(.65,`rgba(201,64,15,${.27*(1-u)})`);fire.addColorStop(1,'rgba(104,35,8,0)');
    g2.fillStyle=fire;g2.beginPath();g2.arc(b.x,b.y,rad,0,Math.PI*2);g2.fill();g2.restore();
    paint.blast(b.x,b.y,b.size*(.8+u*1.9),ignite*(motion()?.86:.65),b.angle+u*.14);
    g2.save();g2.globalAlpha=(1-u)*(motion()?.75:.45);g2.strokeStyle=u<.35?'#fff1b2':'#e89a51';g2.lineWidth=Math.max(1,3.2*(1-u));g2.beginPath();g2.arc(b.x,b.y,b.size*(.22+u*1.7),0,Math.PI*2);g2.stroke();g2.restore();
  }
  smoke=smoke.filter(p=>(p.life-=dt)>0);
  for(const p of smoke){p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.grow*dt;const a=(p.life/p.max)*p.opacity;const cloud=g2.createRadialGradient(p.x,p.y,p.r*.1,p.x,p.y,p.r);cloud.addColorStop(0,`rgba(65,61,55,${a})`);cloud.addColorStop(.55,`rgba(38,42,40,${a*.65})`);cloud.addColorStop(1,'rgba(27,32,33,0)');g2.fillStyle=cloud;g2.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2)}
  parts = parts.filter((p) => (p.life -= dt) > 0);
  for (const p of parts) {
    p.vy += 900 * dt * (p.grav ?? 1);
    p.vx *= Math.max(.7,1-dt*.6);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    g2.globalAlpha = Math.min(1,p.life*2);
    g2.save();g2.translate(p.x,p.y);g2.rotate(p.rot+p.spin*(p.max-p.life));
    if(p.kind==='ember'){g2.globalCompositeOperation='lighter';g2.strokeStyle=p.col;g2.lineWidth=Math.max(1,p.s*.45);g2.beginPath();g2.moveTo(0,0);g2.lineTo(-p.vx*.018,-p.vy*.018);g2.stroke();g2.fillStyle='#ffe5a0';g2.fillRect(-1,-1,2,2)}
    else{g2.fillStyle=p.col;g2.beginPath();g2.moveTo(-p.s,0);g2.lineTo(-p.s*.25,-p.s*.85);g2.lineTo(p.s*.85,-p.s*.45);g2.lineTo(p.s,p.s*.6);g2.lineTo(0,p.s);g2.closePath();g2.fill();g2.fillStyle='#ffbb6170';g2.beginPath();g2.moveTo(-p.s,0);g2.lineTo(-p.s*.25,-p.s*.85);g2.lineTo(p.s*.85,-p.s*.45);g2.closePath();g2.fill()}
    g2.restore();
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
  const explosive=n>=16&&speed>=420;
  if(explosive){const max=n>=30?1.05:.82;blasts.push({x,y,size:L.cell*(n>=30?2.6:1.9),life:max,max,angle:Math.random()*Math.PI*2});blasts=blasts.slice(-12);flash=Math.max(flash,n>=30?.8:.55);if(motion())for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2,v=20+Math.random()*65,max=.8+Math.random()*.85;smoke.push({x:x+Math.cos(a)*10,y:y+Math.sin(a)*10,vx:Math.cos(a)*v,vy:Math.sin(a)*v-38,r:L.cell*(.28+Math.random()*.18),grow:L.cell*(.4+Math.random()*.5),life:max,max,opacity:.25+Math.random()*.18})}smoke=smoke.slice(-60)}
  for (let i = 0; i < (motion()?n:Math.ceil(n*.3)); i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    const max=.55+Math.random()*.85;
    parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-155,s:2+Math.random()*4,life:max,max,col:cols[i%cols.length],kind:explosive&&i%3===0?'ember':'rock',rot:Math.random()*6.28,spin:(Math.random()-.5)*13});
  }
  parts=parts.slice(-280);
}
const cellXY = (r, c) => [L.bx + c * L.cell + L.cell / 2, L.by + r * L.cell + L.cell / 2];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// ---- a round
function start(index = -1) {
  missionIndex = index;
  missionLines = 0;
  missionDouble = false;
  missionBlasts = 0;
  game = newGame((Date.now() & 0x7fffffff) >>> 0);
  if (missionIndex >= 0) applyMission(game, missionIndex);
  disp = game.board.map((r) => r.slice());
  shownScore = 0;
  revived = false;
  sticks = [];
  miner = null;
  // a test hook, only with #blast in the address: the cart starts nearly full
  if (missionIndex < 0 && location.hash === '#blast') {
    game.meter = game.meterMax - 1;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) game.board[r][c] = r === SIZE - 1 ? (c < SIZE - 1 ? 1 + (c % 6) : 0) : (r * 5 + c * 3) % 4 === 0 ? 0 : 1 + ((r + c) % 6);
    for (let c = 0; c < SIZE; c++) game.board[3][c] = 0;
    game.tray = [{ shape: 0, colour: 5 }, null, null];
    disp = game.board.map((row) => row.slice());
  }
  updateMissionHud();
  setView('play');
  trackMission('level_start');
}
function setView(v) {
  view = v;
  document.body.dataset.view = v === 'feature' ? 'play' : v;
  $('home').classList.toggle('hidden', v !== 'home');
  $('over').classList.toggle('hidden', v !== 'over');
  $('missionEnd').classList.toggle('hidden', v !== 'missionEnd');
  $('missionHud').hidden = missionIndex < 0 || (v !== 'play' && v !== 'feature');
}
function updateMissionHud() {
  if (missionIndex < 0) return;
  const m = MISSIONS[missionIndex];
  $('missionName').textContent = `JOB ${missionIndex + 1} · ${m.title.toUpperCase()}`;
  $('missionGoal').textContent = m.objective;
  $('missionMoves').textContent = `${Math.max(0, m.moves - game.moves)} moves left`;
}
function finishMission(won) {
  const m = MISSIONS[missionIndex];
  trackMission(won ? 'level_complete' : 'level_fail', { moves: game.moves });
  if (won && clearedMissions < missionIndex + 1) {
    clearedMissions = missionIndex + 1;
    try { localStorage.setItem('brickblast.missions.v1', String(clearedMissions)); }
    catch { trackMission('save_failure'); }
    if (clearedMissions < MISSIONS.length) trackMission('unlock', { unlocked: clearedMissions + 1 });
  }
  $('missionResultLabel').textContent = won ? 'MINE JOB COMPLETE' : 'THE SHIFT IS OVER';
  $('missionResultTitle').textContent = won ? m.title : 'Try another route';
  $('missionResultNote').textContent = won
    ? missionIndex + 1 < MISSIONS.length ? `You opened Job ${missionIndex + 2}. ${MISSIONS[missionIndex + 1].objective}.` : 'All three mine jobs cleared. Classic mode is always open.'
    : `${m.objective}. Choose your placements carefully and try again.`;
  $('missionNext').classList.toggle('hidden', !won || missionIndex + 1 >= MISSIONS.length);
  $('missionProgress').textContent = `${clearedMissions}/${MISSIONS.length} cleared`;
  setView('missionEnd');
}
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.textContent = ''), 1400);
}

async function afterPlace(res) {
  if (missionIndex >= 0) {
    missionLines += res.lines;
    missionDouble ||= res.lines >= 2;
    updateMissionHud();
  }
  if (res.lines) {
    sfx.clear(res.lines, res.streak);
    shake = Math.min(12, 3 + res.lines * 3);
    for (const k of res.rows) for (let c = 0; c < SIZE; c++) burst(...cellXY(k, c), 3, ['#c8b89a', '#8a7358', '#f1b53a']);
    for (const k of res.cols) for (let r = 0; r < SIZE; r++) burst(...cellXY(r, k), 3, ['#c8b89a', '#8a7358', '#f1b53a']);
    floats.push({ text: `+${res.points}`, x: L.W / 2, y: L.by + L.bw / 2, size: 22 + res.lines * 6, col: '#fff1c2', life: 1.1 });
    if (res.lines >= 3) toast(['', '', '', 'Triple!', 'Huge!', 'Unreal!'][Math.min(5, res.lines)]);
  } else sfx.place();
  disp = game.board.map((r) => r.slice());
  if (res.blastReady) {
    await feature();
    if (missionIndex >= 0) missionBlasts++;
  }
  if (missionIndex >= 0) {
    const m = MISSIONS[missionIndex];
    const won = m.target === 'lines' ? missionLines >= m.count : m.target === 'double' ? missionDouble : missionBlasts >= m.count;
    if (won || game.moves >= m.moves || game.over) return finishMission(won);
  }
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
  if (missionIndex >= 0) return finishMission(false);
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
  start(-1);
};
$('play').onclick = () => {
  audio();
  document.documentElement.requestFullscreen?.().catch(()=>{});
  start(-1);
};
$('missionsOpen').onclick = () => {
  const list = $('missionList');
  list.replaceChildren();
  MISSIONS.forEach((m, i) => {
    const button = document.createElement('button');
    const text = document.createElement('span');
    const title = document.createElement('strong');
    const detail = document.createElement('small');
    title.textContent = `${i + 1}. ${m.title}`;
    detail.textContent = m.objective;
    text.append(title, detail);
    const status = document.createElement('small');
    status.textContent = i < clearedMissions ? 'CLEARED' : i === clearedMissions ? 'PLAY' : 'LOCKED';
    button.append(text, status);
    button.disabled = i > clearedMissions;
    button.onclick = () => { $('missionPicker').close(); audio(); document.documentElement.requestFullscreen?.().catch(() => {}); start(i); };
    list.append(button);
  });
  $('missionPicker').showModal();
};
$('missionsClose').onclick = () => $('missionPicker').close();
$('missionRetry').onclick = () => { trackMission('level_retry'); start(missionIndex); };
$('missionNext').onclick = () => start(missionIndex + 1);
$('missionHome').onclick = () => { missionIndex = -1; game = null; $('missionHud').hidden = true; setView('home'); };
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
// not a top-level await: Android WebViews before Chrome 89 refuse the whole module for one
artReady.then(()=>{
Object.defineProperty(window,'__brickQA',{get:()=>({view,game:game?JSON.parse(JSON.stringify(game)):null,L:{...L},miner:miner?{x:miner.x,y:miner.y,state:miner.state}:null,sticks:sticks.length,prefs:{...prefs},banner:banner?.text||null})});
layout();
$('homeBest').textContent = best ? `Best ${best.toLocaleString()}` : '';
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
bannerOnScreens('view', ['home', 'over']);
requestAnimationFrame(frame);

// Remove ads, A$4.99 (shell/noads.js), on settings. Only in the app.
mountRemoveAds($('settingsPanel'), { toast });
});
