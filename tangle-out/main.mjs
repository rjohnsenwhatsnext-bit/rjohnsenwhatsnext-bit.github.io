import { newGame, step, status, TICK, DIRS } from './sim.mjs';
import { LEVELS, CHAPTERS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const levels = LEVELS.slice(0, 20), KEY = 'tangleout.progress.v1';
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
function chapter() { return CHAPTERS.find(c => c.id === levels[index].chapter); }
function updateHome() {
  $('home-progress').textContent = `${saved.completed.length} / ${levels.length} cleared on this device`;
  $('campaign').max = levels.length; $('campaign').value = saved.completed.length;
  $('home-chapter').textContent = saved.completed.includes(10) ? 'Rocks and Ice unlocked' : 'Your untangling journey';
  $('badges').textContent = CHAPTERS.filter(c => levels.filter(l => l.chapter === c.id).every(l => saved.completed.includes(l.id))).map(c => `${c.name} badge earned`).join(' \u00b7 ') || 'Clear each chapter to earn its badge.';
  $('play').textContent = state && status(state) === 'playing' ? 'Resume puzzle \u2197' : saved.completed.length === levels.length ? 'Play again \u2197' : `Play level ${levels[nextIndex()].id} \u2197`;
}

function renderLevels() {
  $('level-list').replaceChildren();
  levels.forEach((level, i) => {
    if (i === 0 || levels[i - 1].chapter !== level.chapter) {
      const heading = document.createElement('h3'); heading.className = `chapter-heading chapter-${level.chapter}`;
      const done = levels.filter(l => l.chapter === level.chapter && saved.completed.includes(l.id)).length;
      heading.textContent = `${String(level.chapter).padStart(2, '0')} \u00b7 ${CHAPTERS.find(c => c.id === level.chapter).name}`;
      const detail = document.createElement('small');
      detail.textContent = `${done} / 10 cleared \u00b7 ${done === 10 ? 'Badge earned' : unlocked(i) ? 'Open to explore' : 'Clear level 10 to unlock'}`;
      heading.append(detail); $('level-list').append(heading);
    }
    const b = document.createElement('button'); b.className = `level chapter-${level.chapter}`; b.disabled = !unlocked(i);
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
  document.body.dataset.chapter = levels[i].chapter;
  $('mechanic-key').hidden = levels[i].chapter !== 2;
  $('mechanic-key').textContent = [state.rocks.length ? 'Rock: stays put' : '', state.lines.some(l => l.frozen) ? 'Ice: clear path, then tap twice' : '', state.timeLimit != null ? 'Clock runs during play' : ''].filter(Boolean).join(' \u00b7 ');
  $('level-label').textContent = `${chapter().name.toUpperCase()} / ${String(levels[i].id).padStart(2, '0')}`;
  $('level-name').textContent = levels[i].name; $('play-note').textContent = levels[i].objective;
  $('hint').hidden = !(adsAvailable() && hasUnit('rewarded'));
  show('play'); renderBoard(); updateHUD();
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; }
function renderBoard() {
  const board = $('board'); board.replaceChildren(); board.setAttribute('viewBox', `-0.65 -0.65 ${state.w + .3} ${state.h + .3}`);
  for (let y = 0; y < state.h; y++) for (let x = 0; x < state.w; x++) board.append(svg('circle', { cx: x, cy: y, r: .025, fill: '#d6cebe' }));
  for (const [x, y] of state.rocks || []) {
    const rock = svg('g', { class: 'rock', 'data-rock': `${x},${y}`, role: 'img', 'aria-label': 'Fixed rock' });
    rock.append(svg('path', { d: `M ${x-.3} ${y+.22} L ${x-.35} ${y-.08} L ${x-.12} ${y-.32} L ${x+.21} ${y-.27} L ${x+.34} ${y+.12} L ${x+.13} ${y+.31} Z` }));
    rock.append(svg('path', { d: `M ${x-.22} ${y-.05} L ${x-.06} ${y-.19} L ${x+.17} ${y-.15}`, class: 'rock-facet' }));
    board.append(rock);
  }
  for (const line of state.lines.filter(l => !l.out)) {
    const g = svg('g', { 'data-line': line.id, tabindex: '0', role: 'button', 'aria-label': `${line.frozen ? 'Frozen, clear its path then tap to thaw. ' : ''}Line ${line.id + 1}, points ${['right', 'down', 'left', 'up'][line.dir]}`, class: line.frozen ? 'line frozen' : 'line' });
    const points = line.cells.map(p => p.join(',')).join(' ');
    const [hx, hy] = line.cells.at(-1), [dx, dy] = DIRS[line.dir];
    const bodyPoints = line.cells.length === 1 ? `${hx - dx * .24},${hy - dy * .24} ${hx},${hy}` : points;
    g.style.color = palette[line.id % palette.length];
    g.append(svg('polyline', { points: bodyPoints, class: 'hit' }));
    if (line.frozen) g.append(svg('polyline', { points: bodyPoints, class: 'ice-shell' }));
    g.append(svg('polyline', { points: bodyPoints, class: 'thread' }));
    if (line.frozen) {
      const [tx, ty] = line.cells[0];
      g.append(svg('path', { d: `M ${tx-.14} ${ty} h .28 M ${tx} ${ty-.14} v .28 M ${tx-.1} ${ty-.1} l .2 .2 M ${tx-.1} ${ty+.1} l .2 -.2`, class: 'snowflake' }));
    }
    g.append(svg('polyline', { points: `${hx - dx * .2 + dy * .17},${hy - dy * .2 - dx * .17} ${hx + dx * .07},${hy + dy * .07} ${hx - dx * .2 - dy * .17},${hy - dy * .2 + dx * .17}`, class: 'arrow' }));
    g.onclick = () => act({ tap: { x: hx, y: hy } });
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act({ tap: { x: hx, y: hy } }); } };
    board.append(g);
  }
  decorate();
}
function decorate() {
  for (const rock of $('board').querySelectorAll('.rock')) rock.classList.toggle('blocker', rock.dataset.rock === state.flash?.rock?.join(','));
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
  $('clock').hidden = state.timeLimit == null;
  $('clock').textContent = state.timeLimit == null ? '' : `${Math.max(0, Math.ceil((state.timeLimit - state.tick) / 60))}s`;
  $('clock').classList.toggle('urgent', state.timeLimit != null && state.timeLimit - state.tick <= 600);
  $('board-progress').max = state.lines.length; $('board-progress').value = state.lines.length - left;
  $('undo').disabled = busy || !state.cleared.length || status(state) !== 'playing';
  $('hint').disabled = busy || status(state) !== 'playing';
}
function act(input) {
  if (screen !== 'play' || busy || status(state) !== 'playing') return;
  const previous = state.cleared.length;
  const frozen = state.lines.find(l => l.frozen && input.tap && l.cells.some(([x,y]) => x === input.tap.x && y === input.tap.y));
  step(state, input);
  if (input.undo) { renderBoard(); $('play-note').textContent = 'Line restored. Taps and lives stay the same.'; }
  else if (state.cleared.length > previous) {
    const id = state.cleared.at(-1), line = state.lines[id], el = $('board').querySelector(`[data-line="${id}"]`);
    if (el) { el.removeAttribute('tabindex'); el.setAttribute('aria-hidden', 'true'); el.style.pointerEvents = 'none'; const [dx, dy] = DIRS[line.dir];
      if (!saved.reduced) el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx * (state.w + 2)}px,${dy * (state.h + 2)}px)`, opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove();
      else el.remove();
    }
    tone('clear'); $('play-note').textContent = 'A little more room.';
  } else if (frozen && !frozen.frozen) {
    renderBoard(); tone('clear'); $('play-note').textContent = 'Ice cracked! Tap that line again to slide it out.';
    const thawed = $('board').querySelector(`[data-line="${frozen.id}"]`); thawed?.classList.add('thawed'); thawed?.focus({ preventScroll: true });
  } else if (input.tap && state.flash) { tone('blocked'); $('play-note').textContent = state.flash.rock ? 'The coral rock is in the way. Rocks stay put.' : `Line ${state.flash.blocker + 1} is in the way. Look for the striped coral line.`; }
  else if (input.hint) $('play-note').textContent = `The outlined line ${state.hint + 1} has a clear way out.`;
  decorate(); updateHUD();
  if (status(state) !== 'playing') finishAt = performance.now() + (saved.reduced ? 0 : 550);
}
async function finish() {
  finishAt = 0; const won = status(state) === 'won', finale = won && (index === levels.length - 1 || levels[index + 1].chapter !== levels[index].chapter), nextChapter = finale && index + 1 < levels.length;
  if (won && !saved.completed.includes(levels[index].id)) { saved.completed.push(levels[index].id); save(); }
  $('result-kicker').textContent = won ? finale ? `${chapter().name.toUpperCase()} / COMPLETE` : `LEVEL ${levels[index].id} / CLEAR` : 'A NEW ANGLE';
  $('result-title').textContent = won ? finale ? nextChapter ? 'A new trail opens.' : 'Glacier conquered.' : 'Room to breathe.' : 'Still tangled.';
  $('result-detail').textContent = won ? `${state.lines.length} lines cleared · ${state.taps} taps · ${state.mistakes} blocked` : `${state.timeLimit != null && state.tick >= state.timeLimit ? 'Time is up.' : state.lives === 0 ? 'No lives left.' : 'No taps left.'} Follow each arrow to the edge before you tap.`;
  $('medal').textContent = won ? finale ? '✺' : '✦' : '↶';
  $('medal').className = won ? 'earned' : '';
  $('next-goal').textContent = won ? finale ? `${chapter().name} badge earned. ${nextChapter ? 'Chapter 2 unlocked: Rocks and Ice. Head into the alpine quarry, where stone stays put and frozen lines need thawing.' : 'All 20 levels cleared. Both chapter badges are yours. Return to a favourite and aim for zero blocked taps.'}` : `Next: ${levels[index + 1].name}. ${levels[index + 1].objective}.` : 'Try the same board again. Every line has a way out when you find the right order.';
  $('result').classList.toggle('chapter-celebration', finale);
  $('next').textContent = won ? index === levels.length - 1 ? 'Choose a level \u2197' : nextChapter ? 'Enter Rocks and Ice \u2197' : `Level ${levels[index + 1].id} \u2197` : 'Try again \u2197';
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
$('next').onclick = () => { if (busy) return; if (status(state) === 'won') index === levels.length - 1 ? show('levels') : start(index + 1); else start(index); };
$('replay').onclick = () => start(index);
addEventListener('keydown', e => { if (e.key !== 'Escape' || busy) return; if (screen === 'play') $('pause-open').click(); else if (screen === 'pause') show('play'); else if (screen === 'settings') show(settingsFrom); else if (screen === 'levels') show('home'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && !busy && status(state) === 'playing') show('pause'); });
addEventListener('blur', () => { if (screen === 'play' && !busy && status(state) === 'playing') show('pause'); });
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (screen === 'play' && !busy && !document.hidden) {
    if (finishAt && now >= finishAt) finish();
    else if (status(state) === 'playing') { acc += dt; const flashing = !!state.flash; while (acc >= TICK && status(state) === 'playing') { step(state, null); acc -= TICK; } if (flashing && !state.flash) decorate(); updateHUD(); if (status(state) !== 'playing') finishAt = now + (saved.reduced ? 0 : 550); }
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
