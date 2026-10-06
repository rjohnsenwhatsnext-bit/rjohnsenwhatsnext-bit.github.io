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
import { initAds, maybeInterstitial, showRewarded, adsAvailable } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const track = (e, d = {}) => window.arcade && window.arcade.track && window.arcade.track(e, d);
const KEY = 'theline.board.v1';
const cv = $('c'), cx = cv.getContext('2d');
const cache = document.createElement('canvas'), cc = cache.getContext('2d');

// ---- the saved board
let board;
try { board = localStorage.getItem(KEY) ? S.loadBoard(localStorage.getItem(KEY)) : S.newBoard('personal'); }
catch (e) { board = S.newBoard('personal'); console.error('[the line] saved board could not be read: ' + e.message); }
function save() {
  try { localStorage.setItem(KEY, S.serialiseBoard(board)); }
  catch (e) { $('overNote').textContent = 'This phone would not save your maze (' + e.message + '). It is kept until you close the game.'; }
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
    cc.strokeStyle = `rgba(198,255,61,${alpha})`;
    cc.lineWidth = width * dpr;
    cc.shadowColor = 'rgba(198,255,61,.6)'; cc.shadowBlur = glow * dpr;
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
cv.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, e.clientX); steerFromPointers(); e.preventDefault(); });
cv.addEventListener('pointermove', (e) => { if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, e.clientX); steerFromPointers(); } });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { pointers.delete(e.pointerId); steerFromPointers(); });
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') steer = -1; else if (e.key === 'ArrowRight') steer = 1;
  else if (e.key === ' ' && run && !run.over) eraseNow = true;
  else if ((e.key === 'Enter' || e.key === ' ') && (!run || run.over)) start();
});
addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') steer = 0; });
$('erase').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (run && !run.over) eraseNow = true; });

// ---- runs
let run = null, acc = 0, last = performance.now(), diedAt = 0, nextBonusErase = 0, shake = 0;
const particles = [], fading = [];
function start() {
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
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.2, sp = 2 + Math.random() * 5;
    particles.push({ x: d.x, y: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5 });
  }
  shake = 0.35;
  if (navigator.vibrate) navigator.vibrate(60);
  const prevBest = board.best;
  const hitAge = run.hitRun >= 0 ? board.runs.length - run.hitRun : null;
  const r = S.finish(board, run);
  save();
  paintCache();
  track('run_end', { score: r.score, distance: Number(r.distance.toFixed(1)), seconds: Number(r.seconds.toFixed(1)), cause: r.cause, hit_run_age: hitAge,
    trails: r.trails, density: Number(r.density.toFixed(3)), erased_segments: r.erased, faded: r.faded.length, best_attempt: prevBest > 0 && r.score >= prevBest * 0.8, new_best: r.isBest });
  $('overScore').textContent = r.score;
  $('overNote').textContent = r.isBest ? 'New best.' : `Best ${board.best}`;
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
  const r = await showRewarded();
  track('ad_reward', { kind: 'continue', rewarded: r.rewarded });
  if (!r.rewarded) { $('overNote').textContent = r.reason || 'No ad this time.'; return; }
  // the line that was added at death comes off again; the run picks up where it was
  board.runs.pop(); board.totalRuns -= 1; board.totalDistance -= run.dist;
  S.revive(run); run.grid = S.buildGrid(board); paintCache();
  $('over').classList.add('hidden');
  acc = 0; last = performance.now();
};
$('twoErase').onclick = async () => {
  track('ad_offer', { kind: 'second_erase' });
  const r = await showRewarded();
  track('ad_reward', { kind: 'second_erase', rewarded: r.rewarded });
  if (r.rewarded) { nextBonusErase = 1; $('twoErase').classList.add('hidden'); $('overNote').textContent = 'Next run starts with two erases.'; }
  else $('overNote').textContent = r.reason || 'No ad this time.';
};

// ---- settings
$('gear').onclick = () => {
  $('stats').textContent = `${board.totalRuns} runs · ${Math.round(board.totalDistance)} m travelled · best ${board.best}`;
  $('settings').classList.remove('hidden');
};
$('closeSettings').onclick = () => $('settings').classList.add('hidden');
$('resetBoard').onclick = () => {
  if (!confirm('Delete every line in your maze? This cannot be undone. Your best score and totals stay.')) return;
  track('reset_board', { runs: board.runs.length, density: Number(S.densityOf(board).toFixed(3)) });
  board.runs = [];
  save(); paintCache();
  $('settings').classList.add('hidden');
};

// ---- drawing
function draw(dt) {
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#050607'; cx.fillRect(0, 0, cv.width, cv.height);
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
  if (run) {
    // the current line, brightest of all
    const p = run.pts;
    cx.lineCap = cx.lineJoin = 'round';
    cx.strokeStyle = '#c6ff3d'; cx.lineWidth = 3 * dpr; cx.shadowColor = '#c6ff3d'; cx.shadowBlur = 14 * dpr;
    cx.beginPath(); cx.moveTo(X(p[0]), Y(p[1]));
    for (let i = 2; i < p.length; i += 2) cx.lineTo(X(p[i]), Y(p[i + 1]));
    if (!run.over) cx.lineTo(X(run.x), Y(run.y));
    cx.stroke();
    if (!run.over) {
      cx.fillStyle = '#f4ffd9'; cx.shadowBlur = 24 * dpr;
      cx.beginPath(); cx.arc(X(run.x), Y(run.y), S.R * scale, 0, Math.PI * 2); cx.fill();
    }
    cx.shadowBlur = 0;
  }
  for (const q of particles) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94;
    cx.fillStyle = `rgba(214,255,120,${Math.max(0, q.life)})`;
    cx.fillRect(X(q.x) - 2 * dpr, Y(q.y) - 2 * dpr, 4 * dpr, 4 * dpr);
  }
  while (particles.length && particles[0].life <= 0) particles.shift();
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (run && !run.over) {
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
    $('erase').disabled = run.erases < 1;
    $('score').textContent = S.scoreOf(run.dist);
  }
  $('best').textContent = 'BEST ' + board.best;
  draw(dt);
  requestAnimationFrame(frame);
}

resize();
initAds();
if (board.totalRuns > 0) $('play').textContent = 'PLAY';
requestAnimationFrame(frame);
