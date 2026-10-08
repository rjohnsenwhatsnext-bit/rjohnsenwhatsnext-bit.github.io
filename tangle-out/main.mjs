import { newGame, step, status, TICK, DIRS } from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const levels = LEVELS.slice(0, 10), KEY = 'tangleout.progress.v1';
let saved = { completed: [], sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
function storageWarning() { $('save-warning').hidden = false; $('save-warning').textContent = 'Progress could not be saved or loaded. Keep this tab open to keep your progress.'; }
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.completed)) throw new Error('Invalid save');
    saved.completed = [...new Set(value.completed.filter(id => levels.some(l => l.id === id)))];
    if (typeof value.sound === 'boolean') saved.sound = value.sound;
    if (typeof value.reduced === 'boolean') saved.reduced = value.reduced;
  }
} catch { storageWarning(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { storageWarning(); } }
let screen = 'home', index = 0, state = null, settingsFrom = 'home', busy = false;
let acc = 0, last = performance.now(), finishAt = 0, audio, noticeTimer;
const palette = ['#176b69', '#b54c38', '#55558c', '#956018'];
function notify(text) { $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 4500); }
function tone(kind) {
  if (!saved.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio(); audio.resume().catch(() => {});
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.connect(gain); gain.connect(audio.destination);
    osc.frequency.setValueAtTime(kind === 'blocked' ? 155 : kind === 'win' ? 660 : 420, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(kind === 'blocked' ? 110 : 880, audio.currentTime + .16);
    gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .24);
    osc.start(); osc.stop(audio.currentTime + .25);
  } catch { /* Sound is optional; it never affects play. */ }
}
function show(name) {
  screen = name; document.body.dataset.screen = name; acc = 0;
  for (const section of document.querySelectorAll('main > section')) section.hidden = section.id !== (name === 'play' ? 'play-screen' : name);
  if (name === 'home') updateHome();
  if (name === 'levels') renderLevels();
  const focus = document.querySelector('main > section:not([hidden]) button:not(:disabled)');
  focus?.focus({ preventScroll: true });
}
function nextIndex() { const n = levels.findIndex(l => !saved.completed.includes(l.id)); return n < 0 ? 0 : n; }
function unlocked(i) { return i === 0 || saved.completed.includes(levels[i - 1].id); }
function updateHome() {
  $('home-progress').textContent = saved.completed.length === 10 ? '✦ Chapter badge earned' : `${saved.completed.length} / 10 cleared on this device`;
  $('campaign').value = saved.completed.length;
  $('play').textContent = state && status(state) === 'playing' ? 'Resume puzzle ↗' : saved.completed.length === 10 ? 'Chapter complete · play again ↗' : `Play level ${levels[nextIndex()].id} ↗`;
}
function renderLevels() {
  $('level-list').replaceChildren();
  levels.forEach((level, i) => {
    const b = document.createElement('button'); b.className = 'level'; b.disabled = !unlocked(i);
    const number = document.createElement('span'), copy = document.createElement('span'), title = document.createElement('strong'), small = document.createElement('small'), mark = document.createElement('span');
    number.className = 'level-number'; number.textContent = String(level.id).padStart(2, '0'); title.textContent = level.name;
    small.textContent = saved.completed.includes(level.id) ? 'Cleared · replay anytime' : unlocked(i) ? level.objective : `Clear level ${level.id - 1} to unlock`;
    mark.textContent = saved.completed.includes(level.id) ? '✓' : unlocked(i) ? '↗' : '○';
    copy.append(title, small); b.append(number, copy, mark); b.onclick = () => start(i); $('level-list').append(b);
  });
}
function start(i) {
  if (busy || !unlocked(i)) return;
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  index = i; state = newGame(levels[i], 0); finishAt = 0;
  $('level-label').textContent = `LOOSE ENDS / ${String(levels[i].id).padStart(2, '0')}`;
  $('level-name').textContent = levels[i].name; $('play-note').textContent = levels[i].objective;
  $('hint').hidden = !(adsAvailable() && hasUnit('rewarded'));
  show('play'); renderBoard(); updateHUD();
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; }
function renderBoard() {
  const board = $('board'); board.replaceChildren(); board.setAttribute('viewBox', `-0.65 -0.65 ${state.w + .3} ${state.h + .3}`);
  for (let y = 0; y < state.h; y++) for (let x = 0; x < state.w; x++) board.append(svg('circle', { cx: x, cy: y, r: .025, fill: '#d6cebe' }));
  for (const line of state.lines.filter(l => !l.out)) {
    const g = svg('g', { 'data-line': line.id, tabindex: '0', role: 'button', 'aria-label': `Line ${line.id + 1}, points ${['right', 'down', 'left', 'up'][line.dir]}`, class: 'line' });
    const points = line.cells.map(p => p.join(',')).join(' ');
    const [hx, hy] = line.cells.at(-1), [dx, dy] = DIRS[line.dir];
    const bodyPoints = line.cells.length === 1 ? `${hx - dx * .24},${hy - dy * .24} ${hx},${hy}` : points;
    g.style.color = palette[line.id % palette.length];
    g.append(svg('polyline', { points: bodyPoints, class: 'hit' }));
    g.append(svg('polyline', { points: bodyPoints, class: 'thread' }));
    g.append(svg('polyline', { points: `${hx - dx * .2 + dy * .17},${hy - dy * .2 - dx * .17} ${hx + dx * .07},${hy + dy * .07} ${hx - dx * .2 - dy * .17},${hy - dy * .2 + dx * .17}`, class: 'arrow' }));
    g.onclick = () => act({ tap: { x: hx, y: hy } });
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act({ tap: { x: hx, y: hy } }); } };
    board.append(g);
  }
  decorate();
}
function decorate() {
  for (const el of $('board').querySelectorAll('.line')) {
    const id = Number(el.dataset.line);
    el.classList.toggle('blocker', state.flash?.blocker === id);
    el.classList.toggle('blocked', state.flash?.line === id);
    el.classList.toggle('hinted', state.hint === id);
  }
}
function updateHUD() {
  const left = state.lines.filter(l => !l.out).length;
  $('remaining').textContent = `${left} ${left === 1 ? 'line' : 'lines'} left`;
  $('limits').textContent = [state.lives === null ? '' : `${state.lives} ${state.lives === 1 ? 'life' : 'lives'}`, state.maxTaps === null ? '' : `${state.maxTaps - state.taps} taps left`].filter(Boolean).join(' · ');
  $('board-progress').max = state.lines.length; $('board-progress').value = state.lines.length - left;
  $('undo').disabled = busy || !state.cleared.length || status(state) !== 'playing';
  $('hint').disabled = busy || status(state) !== 'playing';
}
function act(input) {
  if (screen !== 'play' || busy || status(state) !== 'playing') return;
  const previous = state.cleared.length;
  step(state, input);
  if (input.undo) { renderBoard(); $('play-note').textContent = 'Line restored. Taps and lives stay the same.'; }
  else if (state.cleared.length > previous) {
    const id = state.cleared.at(-1), line = state.lines[id], el = $('board').querySelector(`[data-line="${id}"]`);
    if (el) { el.removeAttribute('tabindex'); el.setAttribute('aria-hidden', 'true'); el.style.pointerEvents = 'none'; const [dx, dy] = DIRS[line.dir];
      if (!saved.reduced) el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx * (state.w + 2)}px,${dy * (state.h + 2)}px)`, opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove();
      else el.remove();
    }
    tone('clear'); $('play-note').textContent = 'A little more room.';
  } else if (input.tap && state.flash) { tone('blocked'); $('play-note').textContent = `Line ${state.flash.blocker + 1} is in the way. Look for the striped coral line.`; }
  else if (input.hint) $('play-note').textContent = `The outlined line ${state.hint + 1} has a clear way out.`;
  decorate(); updateHUD();
  if (status(state) !== 'playing') finishAt = performance.now() + (saved.reduced ? 0 : 550);
}
async function finish() {
  finishAt = 0; const won = status(state) === 'won', finale = won && index === 9;
  if (won && !saved.completed.includes(levels[index].id)) { saved.completed.push(levels[index].id); save(); }
  $('result-kicker').textContent = won ? finale ? 'LOOSE ENDS / COMPLETE' : `LEVEL ${levels[index].id} / CLEAR` : 'A NEW ANGLE';
  $('result-title').textContent = won ? finale ? 'Beautifully untangled.' : 'Room to breathe.' : 'Still tangled.';
  $('result-detail').textContent = won ? `${state.lines.length} lines cleared · ${state.taps} taps · ${state.mistakes} blocked` : `${state.lives === 0 ? 'No lives left.' : 'No taps left.'} Follow each arrow to the edge before you tap.`;
  $('medal').textContent = won ? finale ? '✺' : '✦' : '↶';
  $('medal').className = won ? 'earned' : '';
  $('next-goal').textContent = won ? finale ? 'Loose Ends badge earned. All ten levels are yours to replay. Aim for a clear with no blocked taps next time.' : `Next: ${levels[index + 1].name}. ${levels[index + 1].objective}.` : 'Try the same board again. Every line has a way out when you find the right order.';
  $('next').textContent = won ? finale ? 'Choose a level ↗' : `Level ${levels[index + 1].id} ↗` : 'Try again ↗';
  $('replay').hidden = !won; $('confetti').replaceChildren();
  if (won && !saved.reduced) for (let i = 0; i < (finale ? 40 : 20); i++) { const p = document.createElement('i'); p.style.cssText = `--x:${(i * 37) % 100}%;--delay:${i % 7 * .06}s;--turn:${i * 41}deg;background:${palette[i % 4]}`; $('confetti').append(p); }
  tone(won ? 'win' : 'blocked'); show('result');
  busy = true; $('result').inert = true;
  try { await maybeInterstitial(); } catch { notify('Ad unavailable. You can keep playing.'); }
  finally { busy = false; $('result').inert = false; if (screen === 'result') $('next').focus(); }
}
$('play').onclick = () => { if (busy) return; if (state && status(state) === 'playing') show('play'); else start(nextIndex()); };
$('select').onclick = () => show('levels');
for (const b of document.querySelectorAll('[data-home]')) b.onclick = () => { if (!busy) show('home'); };
$('pause-open').onclick = () => { if (!busy && status(state) === 'playing') show('pause'); };
$('resume').onclick = () => show('play'); $('restart').onclick = () => start(index);
function settings(from) { settingsFrom = from; show('settings'); }
$('settings-open').onclick = () => settings('home'); $('pause-settings').onclick = () => settings('pause');
$('settings-back').onclick = () => show(settingsFrom);
for (const [id, key] of [['sound', 'sound'], ['motion', 'reduced']]) { $(id).checked = saved[key]; $(id).onchange = () => { saved[key] = $(id).checked; document.body.classList.toggle('reduced', saved.reduced); save(); }; }
$('undo').onclick = () => act({ undo: true });
$('hint').onclick = async () => {
  if (busy || screen !== 'play' || status(state) !== 'playing' || !adsAvailable() || !hasUnit('rewarded')) return;
  busy = true; updateHUD(); let reward;
  try { reward = await showRewarded(); } catch { reward = { rewarded: false }; }
  busy = false;
  if (reward.rewarded) act({ hint: true }); else $('play-note').textContent = 'No hint granted. The ad was not completed or was unavailable.';
  updateHUD();
};
$('next').onclick = () => { if (busy) return; if (status(state) === 'won') index === 9 ? show('levels') : start(index + 1); else start(index); };
$('replay').onclick = () => start(index);
addEventListener('keydown', e => { if (e.key !== 'Escape' || busy) return; if (screen === 'play') $('pause-open').click(); else if (screen === 'pause') show('play'); else if (screen === 'settings') show(settingsFrom); else if (screen === 'levels') show('home'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && !busy && status(state) === 'playing') show('pause'); });
addEventListener('blur', () => { if (screen === 'play' && !busy && status(state) === 'playing') show('pause'); });
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (screen === 'play' && !busy && !document.hidden) {
    if (finishAt && now >= finishAt) finish();
    else if (status(state) === 'playing') { acc += dt; const flashing = !!state.flash; while (acc >= TICK) { step(state, null); acc -= TICK; } if (flashing && !state.flash) decorate(); }
  }
  requestAnimationFrame(frame);
}
window.arcadeView = () => ({ screen, level: levels[index].id, state, completed: [...saved.completed] });
document.body.classList.toggle('reduced', saved.reduced);
initAds().catch(() => notify('Ads are unavailable. You can still play.'));
bannerOnScreens('screen', ['home', 'result']);
mountRemoveAds($('menu-actions'), { before: $('settings-open'), className: 'quiet', toast: notify });
mountRemoveAds($('settings-actions'), { before: $('settings-back'), className: 'quiet', toast: notify });
updateHome(); requestAnimationFrame(frame);
