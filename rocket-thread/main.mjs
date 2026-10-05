// Rocket Thread: a plain mechanics prototype on the real rules (sim.mjs), so the
// feel can be tried on a phone now. Shapes only; Codex owns the look and will
// replace this drawing. Fixed 60 Hz steps, so the flight is the sim's exactly.
import * as S from './sim.mjs';
import { initAds, maybeInterstitial } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const cv = $('c'), cx = cv.getContext('2d');
const BEST = 'rocketthread.best';
let run = null, hold = false, acc = 0, last = 0, best = 0;
try { best = Number(localStorage.getItem(BEST)) || 0; } catch { best = 0; }

function resize() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resize); resize();
const down = (e) => { if (run && !run.over) { hold = true; e.preventDefault(); } };
const up = () => { hold = false; };
cv.addEventListener('pointerdown', down);
addEventListener('pointerup', up); addEventListener('pointercancel', up);

function start() {
  run = S.newRun((Math.random() * 2 ** 32) >>> 0);
  hold = false; acc = 0; last = performance.now();
  $('panel').classList.add('hidden');
  window.arcade && window.arcade.track && window.arcade.track('level_start', { mode: 'endless' });
}
$('go').onclick = start;
$('best').textContent = best ? `Best ${best}` : '';
initAds();

async function over() {
  if (run.score > best) { best = run.score; try { localStorage.setItem(BEST, String(best)); } catch { /* best not kept on this phone */ } }
  window.arcade && window.arcade.track && window.arcade.track('level_fail', { mode: 'endless', score: run.score });
  $('msg').textContent = `You threaded ${run.score}.`;
  $('best').textContent = `Best ${best}`;
  $('go').textContent = 'Again';
  $('panel').classList.remove('hidden');
  await maybeInterstitial();
}

function draw() {
  const w = cv.width, h = cv.height;
  const scale = w / S.SHAFT; // the shaft fills the width
  const camY = run ? run.y : 0;
  const X = (x) => (x + S.SHAFT / 2) * scale;
  const Y = (y) => h * 0.72 - (y - camY) * scale; // rocket sits low on the screen
  cx.fillStyle = '#0d1424'; cx.fillRect(0, 0, w, h);
  if (!run) return;
  const c = run.course, t = run.t;
  cx.fillStyle = '#2b3c66';
  for (const o of c.gates) {
    const g = S.gateAt(o, t);
    cx.fillRect(0, Y(o.y + o.thick), X(g.x - g.w / 2), o.thick * scale);
    cx.fillRect(X(g.x + g.w / 2), Y(o.y + o.thick), w, o.thick * scale);
  }
  for (const o of c.tunnels) {
    for (let y = o.y0; y < o.y1; y += 0.5) {
      const tn = S.tunnelAt(o, y);
      cx.fillRect(0, Y(y + 0.5), X(tn.c - tn.w / 2), 0.5 * scale + 1);
      cx.fillRect(X(tn.c + tn.w / 2), Y(y + 0.5), w, 0.5 * scale + 1);
    }
  }
  cx.strokeStyle = '#ff6a3d'; cx.lineWidth = 0.35 * scale; cx.lineCap = 'round';
  for (const o of c.spinners) { const s = S.spinnerAt(o, t); cx.beginPath(); cx.moveTo(X(s.ax), Y(s.ay)); cx.lineTo(X(s.bx), Y(s.by)); cx.stroke(); }
  cx.fillStyle = 'rgba(120,200,255,.08)';
  for (const o of c.winds) cx.fillRect(0, Y(o.y1), w, (o.y1 - o.y0) * scale);
  cx.fillStyle = '#ffd23d';
  for (const cell of c.cells) if (!run.gotCells.includes(cell.id)) { cx.beginPath(); cx.arc(X(cell.x), Y(cell.y), 0.25 * scale, 0, 7); cx.fill(); }
  // the rocket: a triangle pointing along its tilt
  cx.save(); cx.translate(X(run.x), Y(run.y)); cx.rotate(run.tilt);
  cx.fillStyle = run.crashed ? '#ff3344' : '#ffffff';
  cx.beginPath(); cx.moveTo(0, -S.R * scale * 1.4); cx.lineTo(S.R * scale, S.R * scale); cx.lineTo(-S.R * scale, S.R * scale); cx.closePath(); cx.fill();
  if (run.holding || !run.over) { cx.fillStyle = '#ff6a3d'; cx.fillRect(-S.R * scale * 0.4, S.R * scale, S.R * scale * 0.8, S.R * scale * (0.6 + Math.random() * 0.5)); }
  cx.restore();
}

function frame(now) {
  if (run && !run.over) {
    acc += Math.min(0.1, (now - last) / 1000);
    while (acc >= S.DT && !run.over) {
      S.step(run, { hold });
      acc -= S.DT;
      for (const e of run.events) {
        if (e.type === 'zone') $('zone').textContent = e.zone.name;
        if (e.type === 'crash') over();
      }
    }
    $('score').textContent = run.score;
  }
  last = now;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
