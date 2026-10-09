import { newGame, step, status } from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const campaign = LEVELS.slice(0, 10);
const colours = ['#79c6b4', '#efbb75', '#d4998a', '#97afd4'];
const key = 'ringlock.progress.v1';
let saved = { wins: {}, sound: true, haptics: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, day: '' };
function storageWarning(text) { $('saveWarning').hidden = false; $('saveWarning').textContent = text; }
try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const data = JSON.parse(raw);
    if (!data || typeof data.wins !== 'object' || data.wins === null) throw new Error('Invalid save');
    for (const level of campaign) if (Number.isInteger(data.wins[level.id]) && data.wins[level.id] >= 0) saved.wins[level.id] = data.wins[level.id];
    for (const name of ['sound', 'haptics', 'reduced']) if (typeof data[name] === 'boolean') saved[name] = data[name];
    if (typeof data.day === 'string') saved.day = data.day;
  }
} catch { storageWarning('Saved progress could not be read. This session can still be played.'); }
function save() {
  try { localStorage.setItem(key, JSON.stringify(saved)); }
  catch { storageWarning('Progress could not be saved on this device. Keep this tab open to keep your progress.'); }
}
const track = (event, data = {}) => window.arcade?.track?.(event, { game: 'ring-lock', ...data });
let screen = 'home', state = null, index = 0, selected = 0, settingsFrom = 'home', busy = false, freeHint = true, audio;
const screens = { home: 'home', levels: 'levels', play: 'playScreen', pause: 'pauseScreen', settings: 'settings', result: 'result' };
function show(name) {
  screen = name; document.body.dataset.screen = name;
  for (const [s, id] of Object.entries(screens)) $(id).hidden = s !== name;
  $('message').textContent = '';
  if (name === 'home') home();
  const focus = $(screens[name]).querySelector('button:not(:disabled)');
  focus?.focus({ preventScroll: true });
}
function notify(text) { $('message').textContent = text; }
function chime(win = false) {
  if (saved.haptics && navigator.vibrate) navigator.vibrate(win ? [15, 40, 25] : 10);
  if (!saved.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio(); audio.resume().catch(() => {});
    const now = audio.currentTime;
    (win ? [523.25, 659.25, 783.99] : [440 + selected * 110]).forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * .09);
      gain.gain.exponentialRampToValueAtTime(.12, now + i * .09 + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + i * .09 + .35);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now + i * .09); oscillator.stop(now + i * .09 + .4);
    });
  } catch { notify('Sound is unavailable on this device.'); }
}
function unlocked(i) { return i === 0 || saved.wins[campaign[i - 1].id] !== undefined; }
function nextIndex() { const i = campaign.findIndex(l => saved.wins[l.id] === undefined); return i < 0 ? 0 : i; }
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function home() {
  const count = Object.keys(saved.wins).length;
  $('progress').textContent = `${count} / 10 locks opened${count === 10 ? ' · First Connections seal earned' : ' · Earn the First Connections seal'}`;
  $('progressBar').style.width = `${count * 10}%`;
  $('play').textContent = state && status(state) === 'playing' ? 'Resume your puzzle' : count === 10 ? 'Play chapter again' : `Play level ${nextIndex() + 1}`;
  $('daily').textContent = saved.day === today() ? 'A little moment of focus, collected today. Come back tomorrow for another.' : 'Your daily ritual: open one lock today. No streak to lose.';
}
function start(i) {
  if (busy || !campaign[i] || !unlocked(i)) return;
  index = i; selected = 0; freeHint = true; state = newGame(campaign[i], 1);
  $('hintNote').textContent = ''; render(); show('play'); track('level_start', { level: campaign[i].id, chapter: 1 });
}
function point(radius, notch, n) { const angle = notch / n * Math.PI * 2 - Math.PI / 2; return [180 + Math.cos(angle) * radius, 180 + Math.sin(angle) * radius]; }
function render() {
  const level = campaign[index];
  $('levelLabel').textContent = `LEVEL ${level.id} / 10`; $('levelName').textContent = level.name;
  $('objective').textContent = level.objective; $('moves').textContent = `${state.movesLeft} moves left`;
  let svg = '<svg viewBox="0 0 360 360" role="img" aria-label="Solid beads rotate into diamond targets"><circle cx="180" cy="180" r="173" fill="#0a2329" stroke="#456366"/><circle cx="180" cy="180" r="26" fill="#24454a"/><text x="180" y="187" text-anchor="middle" fill="#efbb75" font-size="22">✦</text>';
  state.rings.forEach((ring, i) => {
    const r = 148 - i * 32, colour = colours[i], fit = state.pos[i] === ring.target;
    svg += `<circle cx="180" cy="180" r="${r}" fill="none" stroke="${colour}" stroke-opacity="${i === selected ? .8 : .35}" stroke-width="20"/>`;
    for (let notch = 0; notch < ring.n; notch++) { const [x, y] = point(r, notch, ring.n); svg += `<circle cx="${x}" cy="${y}" r="2.5" fill="#102b31"/>`; }
    const [tx, ty] = point(r, ring.target, ring.n), [x, y] = point(r, state.pos[i], ring.n);
    svg += `<path d="M ${tx} ${ty - 12} l 12 12 -12 12 -12 -12 Z" fill="#102b31" stroke="${colour}" stroke-width="2"/><circle class="bead" cx="${x}" cy="${y}" r="8" fill="${fit ? '#fff5da' : colour}" stroke="#102b31" stroke-width="2"/><text x="180" y="${180 + r + 4}" text-anchor="middle" fill="#fff5da" font-size="10">${i + 1}</text>`;
  });
  $('board').innerHTML = svg + '</svg>';
  $('ringPicker').replaceChildren();
  state.rings.forEach((r, i) => {
    const b = document.createElement('button'); b.textContent = `${i + 1}${state.pos[i] === r.target ? ' ✓' : ''}`;
    b.setAttribute('aria-label', `Select ring ${i + 1}${state.pos[i] === r.target ? ', aligned' : ''}`); b.setAttribute('aria-pressed', String(i === selected));
    b.style.color = colours[i]; b.onclick = () => { selected = i; render(); }; $('ringPicker').append(b);
  });
  const links = state.rings[selected].links;
  $('linkNote').textContent = links.length ? `Ring ${selected + 1} also turns ${links.map(([i, dir]) => `ring ${i + 1}${dir < 0 ? ' in reverse' : ''}`).join(' and ')}.` : `Ring ${selected + 1} turns independently.`;
  $('selectedLabel').textContent = `RING ${selected + 1}`;
  $('hint').textContent = freeHint ? 'Replay one hint move · Free' : 'Watch an ad · Replay one hint move';
  $('hint').disabled = !freeHint && !(adsAvailable() && hasUnit('rewarded'));
}
function move(ring, dir) {
  if (screen !== 'play' || busy || status(state) !== 'playing') return;
  selected = ring; step(state, { move: [ring, dir] });
  if (state.events.some(e => e.type === 'notch')) chime();
  render(); if (status(state) !== 'playing') finish();
}
function replayHint() {
  step(state, { hint: true });
  if (!state.hint) { $('hintNote').textContent = 'No solution fits the moves left. Restart to try a different route.'; return false; }
  const { ring, dir } = state.hint;
  $('hintNote').textContent = `Hint replay: ring ${ring + 1}, ${dir > 0 ? 'clockwise' : 'anticlockwise'}, one notch.`;
  track('hint_used', { level: state.levelId }); move(ring, dir); return true;
}
$('hint').onclick = async () => {
  if (busy || screen !== 'play') return;
  if (freeHint) { if (replayHint()) freeHint = false; render(); return; }
  if (!adsAvailable() || !hasUnit('rewarded')) return;
  // Confirm the advertised reward exists before offering an ad on this board.
  step(state, { hint: true });
  if (!state.hint) {
    $('hintNote').textContent = 'No solution fits the moves left. Restart to try a different route.';
    return;
  }
  busy = true; $('hint').disabled = true;
  try {
    const result = await showRewarded(); busy = false;
    if (result.rewarded) replayHint(); else $('hintNote').textContent = result.reason || 'No ad completed. Your puzzle is unchanged.';
  } catch { $('hintNote').textContent = 'The ad is unavailable. Try again later.'; }
  finally { busy = false; render(); }
};
function finish() {
  const won = status(state) === 'won';
  if (won) { saved.wins[state.levelId] = Math.min(saved.wins[state.levelId] ?? Infinity, state.movesMade); saved.day = today(); save(); chime(true); }
  track('level_complete', { level: state.levelId, chapter: 1, won, outcome: status(state), moves: state.movesMade, hints: state.hints });
  $('resultKicker').textContent = won ? 'EVERYTHING IN ITS PLACE' : 'A DIFFERENT TURN AWAITS';
  $('resultTitle').textContent = won ? index === 9 ? 'The lock is open.' : 'A lovely little fit.' : 'Out of moves.';
  $('resultNote').textContent = won ? `Level ${state.levelId} complete in ${state.movesMade} moves. ${state.movesLeft} to spare.` : 'The pattern is not aligned yet. Restart with a fresh move budget.';
  $('resultSeal').textContent = won ? index === 9 ? '✺' : '✓' : '↶';
  $('nextGoal').textContent = won ? index < 9 ? `Next: ${campaign[index + 1].name}. ${campaign[index + 1].objective}` : 'First Connections seal earned. All ten locks opened. Later chapters are not available yet.' : 'Try working backwards from the targets. Your free hint returns on restart.';
  $('next').textContent = won ? index < 9 ? `Next level · ${index + 2}` : 'View your collection' : 'Try again';
  $('retry').hidden = !won; show('result');
  $('celebration').replaceChildren();
  if (won && !saved.reduced) for (let i = 0; i < (index === 9 ? 40 : 22); i++) {
    const p = document.createElement('i'), angle = i * 2.4;
    p.style.cssText = `--colour:${colours[i % 4]};--x:${Math.cos(angle) * 180}px;--y:${90 + Math.sin(angle) * 170}px;--angle:${i * 31}deg`;
    $('celebration').append(p);
  }
  busy = true;
  Promise.resolve(maybeInterstitial()).catch(() => notify('The ad is unavailable. You can keep playing.')).finally(() => { busy = false; });
}
function levels() {
  $('levelGrid').replaceChildren();
  campaign.forEach((level, i) => { const button = document.createElement('button'); const best = saved.wins[level.id]; button.innerHTML = `<strong>${String(level.id).padStart(2, '0')} ${best !== undefined ? '✓' : ''}</strong>${level.name}<small>${best !== undefined ? `Best: ${best} moves` : unlocked(i) ? 'Ready to open' : `Open level ${i} first`}</small>`; button.disabled = !unlocked(i); button.onclick = () => start(i); $('levelGrid').append(button); });
  show('levels');
}
$('play').onclick = () => { if (busy) return; if (state && status(state) === 'playing') show('play'); else start(nextIndex()); };
$('levelsButton').onclick = levels;
$('pause').onclick = () => { if (!busy) show('pause'); };
$('resume').onclick = () => { if (!busy) show('play'); };
$('restart').onclick = $('retry').onclick = () => start(index);
$('next').onclick = () => { if (busy) return; if (status(state) === 'won' && index === 9) levels(); else start(status(state) === 'won' ? index + 1 : index); };
for (const b of document.querySelectorAll('[data-home]')) b.onclick = () => { if (!busy) show('home'); };
function settings(from) { settingsFrom = from; show('settings'); }
$('settingsButton').onclick = () => settings('home'); $('pauseSettings').onclick = () => settings('pause');
$('settingsBack').onclick = () => show(settingsFrom);
for (const name of ['sound', 'haptics', 'reduced']) { $(name).checked = saved[name]; $(name).onchange = () => { saved[name] = $(name).checked; document.body.classList.toggle('reduced', saved.reduced); save(); }; }
$('left').onclick = () => move(selected, -1); $('right').onclick = () => move(selected, 1);
let drag = null;
$('board').onpointerdown = e => {
  if (screen !== 'play' || busy) return;
  const rect = $('board').getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * 360 - 180, y = (e.clientY - rect.top) / rect.width * 360 - 180;
  const ring = Math.round((148 - Math.hypot(x, y)) / 32);
  if (ring < 0 || ring >= state.rings.length) return;
  selected = ring; drag = { id: e.pointerId, angle: Math.atan2(y, x), ring }; $('board').setPointerCapture(e.pointerId); render();
};
$('board').onpointerup = e => {
  if (!drag || drag.id !== e.pointerId) return;
  const rect = $('board').getBoundingClientRect(), angle = Math.atan2(e.clientY - rect.top - rect.width / 2, e.clientX - rect.left - rect.width / 2);
  const delta = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle)), ring = drag.ring; drag = null;
  if (Math.abs(delta) > .16) move(ring, delta > 0 ? 1 : -1);
};
$('board').onpointercancel = () => { drag = null; };
addEventListener('keydown', e => {
  if (busy || /INPUT/.test(e.target.tagName)) return;
  if (e.key === 'Escape') { if (screen === 'play') show('pause'); else if (screen === 'pause') show('play'); else if (screen === 'settings') show(settingsFrom); return; }
  if (screen !== 'play') return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') move(selected, e.key === 'ArrowLeft' ? -1 : 1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { selected = (selected + (e.key === 'ArrowUp' ? 1 : state.rings.length - 1)) % state.rings.length; render(); }
});
function autoPause() { drag = null; if (screen === 'play' && !busy) show('pause'); }
addEventListener('blur', autoPause); document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.arcadeView = () => ({ screen, level: state?.levelId || campaign[nextIndex()].id, chapter: 1, state: state ? JSON.parse(JSON.stringify(state)) : null, selected, completed: Object.keys(saved.wins).length });
document.body.classList.toggle('reduced', saved.reduced);
initAds(); bannerOnScreens('screen', ['home', 'result']);
mountRemoveAds($('homeActions'), { before: $('settingsButton'), className: 'ghost', toast: notify });
mountRemoveAds($('settingsActions'), { before: $('settingsBack'), className: 'ghost', toast: notify });
home();
