// Don't Touch Red: a plain mechanics prototype on the real rules (sim.mjs), so
// the feel can be tried on a phone now. Shapes only; Codex owns the look and
// will replace this drawing. Fixed 60 Hz steps, so the game is the sim's exactly.
import * as S from './sim.mjs';
import { initAds, maybeInterstitial } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const cv = $('c'), cx = cv.getContext('2d');
const BEST = 'donttouchred.best';
let w = null, tap = 0, acc = 0, last = 0, best = 0;
try { best = Number(localStorage.getItem(BEST)) || 0; } catch { best = 0; }

function resize() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resize); resize();
// left half of the screen bends the path left, right half right
cv.addEventListener('pointerdown', (e) => { if (w && !w.over) { tap = e.clientX < innerWidth / 2 ? -1 : 1; e.preventDefault(); } });

function start() {
  w = S.newGame((Math.random() * 2 ** 32) >>> 0);
  tap = 0; acc = 0; last = performance.now();
  $('panel').classList.add('hidden');
  window.arcade && window.arcade.track && window.arcade.track('level_start', { mode: 'endless' });
}
$('go').onclick = start;
$('best').textContent = best ? `Best ${best}` : '';
initAds();

async function over() {
  if (w.score > best) { best = w.score; try { localStorage.setItem(BEST, String(best)); } catch { /* best not kept on this phone */ } }
  window.arcade && window.arcade.track && window.arcade.track('level_fail', { mode: 'endless', score: w.score });
  $('msg').textContent = `${w.score} points, ${Math.floor(w.t)} seconds.`;
  $('best').textContent = `Best ${best}`;
  $('go').textContent = 'Again';
  $('panel').classList.remove('hidden');
  await maybeInterstitial();
}

function draw() {
  const cw = cv.width, ch = cv.height;
  cx.fillStyle = '#111'; cx.fillRect(0, 0, cw, ch);
  const scale = Math.min(cw / (S.W + 0.6), ch / (S.H + 2.2));
  const ox = cw / 2, oy = ch / 2 + 0.6 * scale;
  const X = (x) => ox + x * scale, Y = (y) => oy - y * scale;
  cx.strokeStyle = '#3a3a3a'; cx.lineWidth = 0.08 * scale;
  cx.strokeRect(X(-S.W / 2), Y(S.H / 2), S.W * scale, S.H * scale);
  if (!w) return;
  for (const o of w.reds) {
    const warning = o.age < S.WARN;
    const flash = warning ? (Math.floor(o.age * 8) % 2 ? 0.25 : 0.6) : 1;
    cx.globalAlpha = flash;
    cx.fillStyle = cx.strokeStyle = '#ff2d46';
    if (o.kind === 'block' || o.kind === 'bar') cx.fillRect(X(o.x - o.hw), Y(o.y + o.hh), 2 * o.hw * scale, 2 * o.hh * scale);
    else if (o.kind === 'chaser') { cx.beginPath(); cx.arc(X(o.x), Y(o.y), 0.4 * scale, 0, 7); cx.fill(); }
    else if (o.kind === 'laser') { const [ax, ay, bx, by] = S.laserEnds(o, o.age); cx.lineWidth = 0.16 * scale; cx.beginPath(); cx.moveTo(X(ax), Y(ay)); cx.lineTo(X(bx), Y(by)); cx.stroke(); }
    else {
      const hw = S.W / 2, hh = S.H / 2; cx.lineWidth = 0.2 * scale; cx.beginPath();
      if (o.side === 0) { cx.moveTo(X(o.a), Y(-hh)); cx.lineTo(X(o.b), Y(-hh)); }
      if (o.side === 1) { cx.moveTo(X(hw), Y(o.a)); cx.lineTo(X(hw), Y(o.b)); }
      if (o.side === 2) { cx.moveTo(X(o.a), Y(hh)); cx.lineTo(X(o.b), Y(hh)); }
      if (o.side === 3) { cx.moveTo(X(-hw), Y(o.a)); cx.lineTo(X(-hw), Y(o.b)); }
      cx.stroke();
    }
  }
  cx.globalAlpha = 1;
  cx.fillStyle = '#ffd23d';
  for (const g of w.golds) { cx.beginPath(); cx.arc(X(g.x), Y(g.y), S.GOLD_R * scale, 0, 7); cx.fill(); }
  cx.fillStyle = w.over ? '#ff2d46' : '#fff';
  cx.beginPath(); cx.arc(X(w.x), Y(w.y), S.R * scale, 0, 7); cx.fill();
}

function frame(now) {
  if (w && !w.over) {
    acc += Math.min(0.1, (now - last) / 1000);
    while (acc >= S.DT && !w.over) {
      S.step(w, { tap });
      tap = 0;
      acc -= S.DT;
      if (w.events.some((e) => e.type === 'hit')) over();
    }
    $('hud').textContent = w.score;
  }
  last = now;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
