// The Line: the page (Claude, a plain but finished prototype on sim.mjs; Codex
// owns the final look). Fixed 60 Hz steps, so play is exactly the sim's.
//
// Analytics (window.arcade.track, shell/telemetry.js): run_start, run_end
// (score, distance, seconds, cause, trails and density at the start, erases,
// which earlier run killed you and how old it was, whether it was a high score
// attempt), erase_used, retry (how fast), reset_board, ad offers and results.
// Enough to find where players stop and what density keeps them.
// Ads never touch the first five runs and never sit between Retry and play.
import * as S from './sim.mjs';
import {loadPrefs,validLook,makeAudio,backdrop,runner} from './presentation.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const track = (e, d = {}) => window.arcade && window.arcade.track && window.arcade.track(e, d);
const KEY = 'theline.board.v1';
const cv = $('c'), cx = cv.getContext('2d');
const cache = document.createElement('canvas'), cc = cache.getContext('2d');
const prefs=loadPrefs(localStorage,matchMedia('(prefers-reduced-motion: reduce)').matches);
const sound=makeAudio(prefs);let paused=false,adBusy=false,lockerFrom='home',focusBefore=null;
const clearInput=()=>{steer=0;eraseNow=false;pointers.clear();};
function savePrefs(){try{localStorage.setItem('theline.look.v1',JSON.stringify(prefs));}catch{}document.body.classList.toggle('reduced',prefs.reduced);}
function screen(name){document.body.dataset.screen=name;}

// ---- the saved board
let board;
try { board = localStorage.getItem(KEY) ? S.loadBoard(localStorage.getItem(KEY)) : S.newBoard('personal'); }
catch (e) { board = S.newBoard('personal'); console.error('[the line] saved board could not be read: ' + e.message); }
function save() {
  try { localStorage.setItem(KEY, S.serialiseBoard(board)); }
  catch (e) { $('saveWarning').textContent = 'Your maze could not be saved on this device. Keep this tab open to keep playing.'; $('saveWarning').classList.remove('hidden'); }
}

// ---- screen and arena
let scale = 1, ox = 0, oy = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = cache.width = innerWidth * dpr; cv.height = cache.height = innerHeight * dpr;
  scale = Math.min(cv.width / (S.W + 0.4), cv.height / (S.H + 1.6));
  ox = cv.width / 2; oy = cv.height / 2 + 0.4 * scale;
  paintCache();
}
const X = (x) => ox + x * scale, Y = (y) => oy - y * scale;
addEventListener('resize', resize);

// old lines are drawn once into a cache: brighter for recent runs, dimmer for
// older ones, ghosts (faded, harmless) barely there
function paintCache() {
  cc.clearRect(0, 0, cache.width, cache.height);
  cc.lineCap = cc.lineJoin = 'round';
  const live = board.runs.filter((r) => !r.retired).length;
  let liveIndex = 0;
  board.runs.forEach((line) => {
    const p = line.pts;
    if (p.length < 4) return;
    let alpha, width, glow;
    if (line.retired) { alpha = 0.06; width = 1.5; glow = 0; }
    else { const age = live - 1 - liveIndex++; alpha = Math.max(0.2, 0.62 - age * 0.05); width = 2.2; glow = 6; }
    cc.strokeStyle = line.retired ? 'rgba(70,106,126,.13)' : `rgba(73,190,211,${alpha})`;
    cc.lineWidth = width * dpr;
    cc.shadowColor = 'rgba(73,200,220,.4)'; cc.shadowBlur = glow * dpr;
    cc.beginPath();
    let drawing = false;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (line.gone.has(i / 2)) { drawing = false; continue; }
      if (!drawing) { cc.moveTo(X(p[i]), Y(p[i + 1])); drawing = true; }
      cc.lineTo(X(p[i + 2]), Y(p[i + 3]));
    }
    cc.stroke();
  });
  cc.shadowBlur = 0;
}

// ---- input: hold the left half to turn left, the right half to turn right
let steer = 0, eraseNow = false;
const pointers = new Map();
function steerFromPointers() {
  let s = 0;
  for (const x of pointers.values()) s = x < innerWidth / 2 ? -1 : 1; // the latest finger wins
  steer = s;
}
cv.addEventListener('pointerdown', (e) => { if(paused||!run||run.over)return; cv.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId, e.clientX); steerFromPointers(); e.preventDefault(); });
cv.addEventListener('pointermove', (e) => { if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, e.clientX); steerFromPointers(); } });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { pointers.delete(e.pointerId); steerFromPointers(); });
addEventListener('keydown', (e) => {
  if(e.key==='Escape'){e.preventDefault();if(!$('locker').classList.contains('hidden'))$('closeLocker').click();else if(!$('settings').classList.contains('hidden'))$('closeSettings').click();else $('gear').click();return;}
  if(paused||adBusy||e.target.tagName==='INPUT')return;
  if(/BUTTON|SUMMARY/.test(e.target.tagName)&&[' ','Enter'].includes(e.key))return;
  if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  if (e.key === 'ArrowLeft') steer = -1; else if (e.key === 'ArrowRight') steer = 1;
  else if (e.key === ' ' && run && !run.over) eraseNow = true;
  else if ((e.key === 'Enter' || e.key === ' ') && (!run || run.over)) start();
});
addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') steer = 0; });
$('erase').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (run && !run.over && !paused) eraseNow = true; sound('erase'); });
$('erase').onclick=(e)=>{if(e.detail===0&&run&&!run.over&&!paused)eraseNow=true;};

// ---- runs
let run = null, acc = 0, last = performance.now(), diedAt = 0, nextBonusErase = 0, shake = 0;
const particles = [], fading = [];
function start() {
  if(adBusy)return;
  sound('start');document.activeElement?.blur();document.documentElement.requestFullscreen?.().catch(()=>{});
  if(run&&!run.over){paused=false;clearInput();acc=0;last=performance.now();$('home').classList.add('hidden');$('settings').classList.add('hidden');screen('run');return;}
  paused=false;clearInput();validLook(prefs,S.unlocked(board));screen('run');
  board = S.boardFor(board, new Date().toISOString().slice(0, 10));
  run = S.newRun(board);
  for (let i = 0; i < nextBonusErase; i++) S.grantErase(run);
  nextBonusErase = 0;
  steer = 0; acc = 0; last = performance.now();
  for (const id of ['home', 'over', 'settings']) $(id).classList.add('hidden');
  $('erase').disabled = false;
  if (diedAt) track('retry', { after_ms: Math.round(performance.now() - diedAt) });
  track('run_start', { run: board.totalRuns + 1, trails: run.trailsAtStart, density: Number(run.density.toFixed(3)), mode: board.mode });
}
$('play').onclick = start;
$('retry').onclick = start;

function died() {
  diedAt = performance.now();
  const d = run.events.find((e) => e.type === 'death');
  clearInput();screen('over');sound('death');const previousUnlocks=new Set(S.unlocked(board).map(x=>x.id));
  for (let i = 0; i < (prefs.reduced?0:46); i++) {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.2, sp = 2 + Math.random() * 5;
    particles.push({ x: d.x, y: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5 });
  }
  shake = prefs.reduced?0:0.35;
  if (prefs.haptics && navigator.vibrate) navigator.vibrate([18,25,30]);
  const prevBest = board.best;
  const hitAge = run.hitRun >= 0 ? board.runs.length - run.hitRun : null;
  const r = S.finish(board, run);
  save();
  paintCache();
  track('run_end', { score: r.score, distance: Number(r.distance.toFixed(1)), seconds: Number(r.seconds.toFixed(1)), cause: r.cause, hit_run_age: hitAge,
    trails: r.trails, density: Number(r.density.toFixed(3)), erased_segments: r.erased, faded: r.faded.length, best_attempt: prevBest > 0 && r.score >= prevBest * 0.8, new_best: r.isBest });
  $('overScore').textContent = r.score;
  $('overNote').textContent = r.isBest ? 'A new personal best. Leave another mark.' : `Best ${board.best} · Your next run starts here.`;
  $('resultKicker').textContent=run.cause==='edge'?'THE EDGE WINS THIS ONE':run.hitRun>=0?'YOUR PAST CAUGHT UP':'YOU CROSSED YOUR OWN PATH';
  const earned=S.unlocked(board).filter(x=>!previousUnlocks.has(x.id));$('unlockNotice').classList.toggle('hidden',!earned.length);$('unlockNotice').textContent=earned.map(x=>'UNLOCKED · '+x.name).join(' / ');if(earned.length)sound('unlock');updateHome();
  $('overStats').textContent = `${board.runs.filter((x) => !x.retired).length} lines in your maze · run ${board.totalRuns}`;
  // rewarded offers, never in the first five runs
  const offers = board.totalRuns > 5 && adsAvailable();
  $('cont').classList.toggle('hidden', !(offers && !run.revived && r.score >= 100));
  $('twoErase').classList.toggle('hidden', !offers);
  $('over').classList.remove('hidden');
  if (board.totalRuns > 5) maybeInterstitial().then((x) => x !== 'not due' && track('ad_interstitial', { result: x }));
}
$('cont').onclick = async () => {
  track('ad_offer', { kind: 'continue' });
  if(adBusy)return;adBusy=true;let r;try{r=await showRewarded();}catch{r={rewarded:false,reason:'Ad unavailable. Try again later.'};}finally{adBusy=false;}
  track('ad_reward', { kind: 'continue', rewarded: r.rewarded });
  if (!r.rewarded) { $('overNote').textContent = r.reason || 'No ad this time.'; return; }
  // the line that was added at death comes off again; the run picks up where it was
  board.runs.pop(); board.totalRuns -= 1; board.totalDistance -= run.dist;
  S.revive(run); run.grid = S.buildGrid(board); paintCache();
  $('over').classList.add('hidden');screen('run');paused=false;clearInput();
  acc = 0; last = performance.now();
};
$('twoErase').onclick = async () => {
  track('ad_offer', { kind: 'second_erase' });
  if(adBusy)return;adBusy=true;let r;try{r=await showRewarded();}catch{r={rewarded:false,reason:'Ad unavailable. Try again later.'};}finally{adBusy=false;}
  track('ad_reward', { kind: 'second_erase', rewarded: r.rewarded });
  if (r.rewarded) { nextBonusErase = 1; $('twoErase').classList.add('hidden'); $('overNote').textContent = 'Next run starts with two erases.'; }
  else $('overNote').textContent = r.reason || 'No ad this time.';
};

// ---- settings, collection and pause (presentation only)
function updateHome(){
 $('homeBest').textContent=board.best;$('homeLines').textContent=board.runs.length;
 $('collectionCount').textContent=S.unlocked(board).length+' / '+S.MILESTONES.length;
 $('play').innerHTML=(run&&!run.over?'RESUME YOUR RUN':'ENTER THE MAZE')+' <span>↗</span>';
}
function pause(){if(adBusy)return;paused=true;clearInput();focusBefore=document.activeElement;$('stats').textContent=`${board.totalRuns} runs · ${Math.round(board.totalDistance)} m travelled · best ${board.best}`;$('settingsTitle').innerHTML=(run&&!run.over?'PAUSED':'SETTINGS')+'<span>.</span>';$('settings').classList.remove('hidden');$('closeSettings').focus();}
$('gear').onclick=pause;
$('closeSettings').onclick=()=>{if(adBusy)return;$('settings').classList.add('hidden');paused=document.body.dataset.screen!=='run';clearInput();acc=0;last=performance.now();focusBefore?.focus();};
function goHome(){if(adBusy)return;paused=true;clearInput();for(const id of ['settings','over','locker'])$(id).classList.add('hidden');$('home').classList.remove('hidden');screen('home');updateHome();$('play').focus();}
$('resultHome').onclick=goHome;$('settingsHome').onclick=goHome;
$('resetBoard').onclick=()=>{
 if(!confirm('Delete every line in your maze and end the current attempt? Best score and lifetime totals stay.'))return;
 track('reset_board',{runs:board.runs.length,density:Number(S.densityOf(board).toFixed(3))});board.runs=[];run=null;save();paintCache();goHome();
};
for(const [id,key] of [['soundToggle','sound'],['hapticToggle','haptics'],['motionToggle','reduced']]){$(id).checked=prefs[key];$(id).onchange=()=>{prefs[key]=$(id).checked;savePrefs();if(key==='sound'&&prefs.sound)sound('click');};}
function collection(){
 const allowed=new Set(S.unlocked(board).map(x=>x.unlock));validLook(prefs,S.unlocked(board));$('cosmetics').replaceChildren();
 for(const m of S.MILESTONES){const kind=m.unlock.split('-')[0],value=m.kind==='runs'?board.totalRuns:m.kind==='distance'?board.totalDistance:board.best,owned=allowed.has(m.unlock),selected=prefs[kind]===m.unlock;
 const row=document.createElement('div');row.className='cosmetic';const badge=document.createElement('span');badge.className='swatch';badge.textContent=kind==='trail'?'〰':kind==='dot'?'◉':'✳';const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small'),meter=document.createElement('meter'),button=document.createElement('button');name.textContent=m.name;detail.textContent=owned?'Unlocked':`${Math.min(m.at,Math.floor(value)).toLocaleString()} / ${m.at.toLocaleString()} ${m.kind==='distance'?'metres':m.kind==='best'?'best score':'runs'}`;meter.min=0;meter.max=m.at;meter.value=Math.min(value,m.at);meter.setAttribute('aria-label',m.name+' progress');text.append(name,detail);if(!owned)text.append(meter);button.textContent=selected?'EQUIPPED':owned?'EQUIP':'LOCKED';button.disabled=!owned||selected;button.onclick=()=>{prefs[kind]=m.unlock;savePrefs();sound('click');collection();};row.append(badge,text,button);$('cosmetics').append(row);}
}
function openCollection(from){lockerFrom=from;paused=true;clearInput();collection();$('locker').classList.remove('hidden');$('closeLocker').focus();}
$('openLocker').onclick=()=>openCollection('home');$('settingsLocker').onclick=()=>openCollection('settings');
$('closeLocker').onclick=()=>{$('locker').classList.add('hidden');$(lockerFrom==='home'?'openLocker':'settingsLocker').focus();};
$('defaultLook').onclick=()=>{for(const kind of ['trail','dot','death'])prefs[kind]='original';savePrefs();collection();};
addEventListener('blur',()=>{clearInput();if(run&&!run.over&&!paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(run&&!run.over)pause();}});
// Keep keyboard focus inside an open dialog.
document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const modal=!$('locker').classList.contains('hidden')?$('locker'):!$('settings').classList.contains('hidden')?$('settings'):null;if(!modal)return;const items=[...modal.querySelectorAll('button:not(:disabled),input,summary')].filter(x=>x.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});

// ---- drawing
function draw(dt) {
  cx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(cx,cv.width,cv.height,scale,X,Y);
  if (shake > 0) { shake -= dt; const k = shake * 18 * dpr; cx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
  // the arena edge, closing in on very long runs
  const inset = run ? S.insetAt(run.dist) : 0;
  cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.lineWidth = 1.5 * dpr;
  cx.strokeRect(X(-S.W / 2 + inset), Y(S.H / 2 - inset), (S.W - 2 * inset) * scale, (S.H - 2 * inset) * scale);
  cx.drawImage(cache, 0, 0);
  // erased stretches fading out
  for (const f of fading) {
    f.t -= dt;
    cx.strokeStyle = `rgba(255,255,255,${Math.max(0, f.t / 0.6)})`; cx.lineWidth = 3 * dpr; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(X(f.ax), Y(f.ay)); cx.lineTo(X(f.bx), Y(f.by)); cx.stroke();
  }
  while (fading.length && fading[0].t <= 0) fading.shift();
  if(run)runner(cx,run,{X,Y,scale,dpr,R:S.R,prefs,time:performance.now()/1000});
  for (const q of particles) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94;
    cx.fillStyle = `rgba(214,255,120,${Math.max(0, q.life)})`;
    if(prefs.death==='death-ripple'){cx.strokeStyle=`rgba(198,255,61,${Math.max(0,q.life)*.5})`;cx.lineWidth=dpr;cx.beginPath();cx.arc(X(q.x),Y(q.y),(1.2-q.life)*14*dpr,0,Math.PI*2);cx.stroke();}else if(prefs.death==='death-shatter'){cx.save();cx.translate(X(q.x),Y(q.y));cx.rotate(q.life*5);cx.beginPath();cx.moveTo(-3*dpr,3*dpr);cx.lineTo(0,-7*dpr);cx.lineTo(3*dpr,3*dpr);cx.fill();cx.restore();}else cx.fillRect(X(q.x)-2*dpr,Y(q.y)-2*dpr,4*dpr,4*dpr);
  }
  while (particles.length && particles[0].life <= 0) particles.shift();
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (run && !run.over && !paused && !document.hidden && !adBusy) {
    acc += dt;
    while (acc >= S.DT && !run.over) {
      S.step(run, { steer, erase: eraseNow });
      if (eraseNow) {
        const ev = run.events.find((e) => e.type === 'erase');
        if (ev) {
          for (const [r, i] of ev.removed) { const pts = board.runs[r].pts; fading.push({ ax: pts[i * 2], ay: pts[i * 2 + 1], bx: pts[i * 2 + 2], by: pts[i * 2 + 3], t: 0.6 }); }
          paintCache();
          track('erase_used', { removed: ev.removed.length, at: Number(run.dist.toFixed(1)), density: Number(S.densityOf(board).toFixed(3)) });
        }
        eraseNow = false;
      }
      acc -= S.DT;
      if (run.over) died();
    }
    $('erase').disabled = run.erases < 1; $('eraseLabel').textContent=run.erases?'ERASE · '+run.erases:'ERASE USED';
    $('score').textContent = S.scoreOf(run.dist);
  }
  $('best').textContent = 'BEST ' + board.best;
  draw(dt);
  requestAnimationFrame(frame);
}

resize();
initAds();
validLook(prefs,S.unlocked(board));savePrefs();updateHome();
requestAnimationFrame(frame);
