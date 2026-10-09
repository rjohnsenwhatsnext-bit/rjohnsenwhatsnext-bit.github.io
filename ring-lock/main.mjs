import { newGame, step, status, canTurn } from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const campaign = LEVELS.slice(0, 50);
const colours = ['#79c6b4', '#efbb75', '#d4998a', '#97afd4', '#c4a4db'];
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
function theme(chapter) {
  document.body.dataset.chapter = chapter;
  $('chapterPlace').textContent = chapter === 5 ? '05 / THE DAWN OBSERVATORY' : chapter === 4 ? '04 / THE GATEHOUSE' : chapter === 3 ? '03 / THE TIDAL GARDEN' : chapter === 2 ? '02 / THE BRASS VAULT' : '01 / THE BEGINNING';
}
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
  theme(saved.wins[40] !== undefined ? 5 : saved.wins[30] !== undefined ? 4 : saved.wins[20] !== undefined ? 3 : saved.wins[10] !== undefined ? 2 : 1);
  $('homeChapter').textContent = saved.wins[40] !== undefined ? 'CHAPTER 05 / THE DAWN OBSERVATORY' : saved.wins[30] !== undefined ? 'CHAPTER 04 / THE GATEHOUSE' : saved.wins[20] !== undefined ? 'CHAPTER 03 / THE TIDAL GARDEN' : saved.wins[10] !== undefined ? 'CHAPTER 02 / GATES AND GEARS' : 'CHAPTER 01 / FIRST CONNECTIONS';
  $('progress').textContent = `${count} / ${campaign.length} locks opened. ${saved.wins[50] !== undefined ? 'Dawn Keeper seal earned. Collection complete' : saved.wins[40] !== undefined ? 'Gatehouse Keeper seal earned' : saved.wins[30] !== undefined ? 'Tidal Pathfinder seal earned' : saved.wins[20] !== undefined ? 'Vault Keeper seal earned' : saved.wins[10] !== undefined ? 'First Connections seal earned' : 'Earn the First Connections seal'}`;
  $('progressBar').style.width = `${count / campaign.length * 100}%`;
  $('play').textContent = state && status(state) === 'playing' ? 'Resume your puzzle' : count === campaign.length ? 'Play collection again' : `Play level ${nextIndex() + 1}`;
  $('daily').textContent = saved.day === today() ? 'A little moment of focus, collected today. Come back tomorrow for another.' : 'Your daily ritual: open one lock today. No streak to lose.';
}
function start(i) {
  if (busy || !campaign[i] || !unlocked(i)) return;
  index = i; selected = 0; freeHint = true; state = newGame(campaign[i], 1);
  $('hintNote').textContent = ''; render(); show('play'); track('level_start', { level: campaign[i].id, chapter: campaign[i].chapter });
}
function point(radius, notch, n) { const angle = notch / n * Math.PI * 2 - Math.PI / 2; return [180 + Math.cos(angle) * radius, 180 + Math.sin(angle) * radius]; }
function render() {
  const level = campaign[index];
  theme(level.chapter);
  $('playChapter').textContent = level.chapter === 5 ? 'THE DAWN OBSERVATORY / RATCHETS' : level.chapter === 4 ? 'THE GATEHOUSE / CLEAR THE JAMS' : level.chapter === 3 ? 'THE TIDAL GARDEN / BLOCKED NOTCHES' : level.chapter === 2 ? 'THE BRASS VAULT / GATES AND GEARS' : 'FIRST CONNECTIONS';
  $('levelLabel').textContent = `LEVEL ${level.id} / ${campaign.length}`; $('levelName').textContent = level.name;
  $('objective').textContent = level.objective; $('moves').textContent = `${state.movesLeft} moves left`;
  let svg = '<svg viewBox="0 0 360 360" role="img" aria-label="Solid beads rotate into diamond targets"><circle cx="180" cy="180" r="173" fill="#0a2329" stroke="#456366"/><circle cx="180" cy="180" r="12" fill="#24454a"/><text x="180" y="187" text-anchor="middle" fill="#efbb75" font-size="14">✦</text>';
  state.rings.forEach((ring, i) => {
    const r = 148 - i * 28, colour = colours[i], fit = state.pos[i] === ring.target;
    svg += `<circle cx="180" cy="180" r="${r}" fill="none" stroke="${colour}" stroke-opacity="${i === selected ? .8 : .35}" stroke-width="18" ${ring.fixed ? 'stroke-dasharray="3 5"' : ''}/>`;
    for (let notch = 0; notch < ring.n; notch++) { const [x, y] = point(r, notch, ring.n); svg += `<circle cx="${x}" cy="${y}" r="2.5" fill="#102b31"/>`; }
    // Tangential chevrons show the permitted direct turn, away from notch markers.
    if (ring.oneWay) {
      const angle = 45, radians = angle * Math.PI / 180;
      const ax = 180 + Math.cos(radians) * r, ay = 180 + Math.sin(radians) * r;
      svg += `<g transform="translate(${ax} ${ay}) rotate(${angle + (ring.oneWay > 0 ? 90 : -90)})"><circle r="8" fill="#172e38"/><path d="M -4 -4 L 1 0 L -4 4 M 1 -4 L 6 0 L 1 4" fill="none" stroke="#fff0b9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    // Crossed coral stops mark forbidden direct landings, not barriers to links.
    for (const notch of ring.block || []) {
      const [bx, by] = point(r, notch, ring.n);
      svg += `<circle cx="${bx}" cy="${by}" r="9" fill="#352735" stroke="#ffaf9f" stroke-width="2"/><path d="M ${bx - 4} ${by - 4} l 8 8 m 0 -8 l -8 8" fill="none" stroke="#ffcfbc" stroke-width="2.5"/>`;
    }
    // A square key marker is separate from the diamond alignment target.
    for (const dependent of state.rings) if (dependent.gate?.ring === i) {
      const [gx, gy] = point(r + 13, dependent.gate.at, ring.n);
      svg += `<rect x="${gx - 6}" y="${gy - 6}" width="12" height="12" fill="none" stroke="#fff5da" stroke-width="2"/>`;
    }
    // Triangular jam triggers sit outside the track, distinct from gate squares.
    for (const dependent of state.rings) if (dependent.jam?.ring === i) {
      const [jx, jy] = point(r + 13, dependent.jam.at, ring.n);
      const active = state.pos[i] === dependent.jam.at;
      svg += `<path d="M ${jx} ${jy - 7} l 7 13 -14 0 Z" fill="${active ? '#ffc18c' : '#302b40'}" stroke="#ffc18c" stroke-width="2"/>`;
    }
    const [tx, ty] = point(r, ring.target, ring.n), [x, y] = point(r, state.pos[i], ring.n);
    svg += `<path d="M ${tx} ${ty - 12} l 12 12 -12 12 -12 -12 Z" fill="#102b31" stroke="${colour}" stroke-width="2"/><circle class="bead" cx="${x}" cy="${y}" r="8" fill="${fit ? '#fff5da' : colour}" stroke="#102b31" stroke-width="2"/><text x="180" y="${180 + r + 4}" text-anchor="middle" fill="#fff5da" font-size="10">${i + 1}</text>`;
  });
  $('board').innerHTML = svg + '</svg>';
  $('ringPicker').replaceChildren();
  state.rings.forEach((r, i) => {
    const b = document.createElement('button'); b.textContent = `${i + 1}${r.oneWay ? r.oneWay > 0 ? ' \u21bb' : ' \u21ba' : ''}${r.jam ? state.pos[r.jam.ring] === r.jam.at ? ' J' : ' C' : ''}${r.fixed ? ' F' : r.gate ? canTurn(state.pos, state.rings, i) ? ' O' : ' L' : r.step > 1 ? ' x' + r.step : ''}${state.pos[i] === r.target ? ' \u2713' : ''}`;
    b.setAttribute('aria-label', `Select ring ${i + 1}${r.oneWay ? r.oneWay > 0 ? ', clockwise ratchet' : ', anticlockwise ratchet' : ''}${r.jam ? state.pos[r.jam.ring] === r.jam.at ? ', jammed' : ', jam clear' : ''}${r.fixed ? ', fixed' : r.gate ? canTurn(state.pos, state.rings, i) ? ', gate open' : ', gate closed' : r.step > 1 ? ', jumps ' + r.step + ' notches' : ''}${state.pos[i] === r.target ? ', aligned' : ''}`); b.setAttribute('aria-pressed', String(i === selected));
    b.style.color = colours[i]; b.onclick = () => { selected = i; render(); }; $('ringPicker').append(b);
  });
  const ring = state.rings[selected], links = ring.links;
  const available = !ring.gate || state.pos[ring.gate.ring] === ring.gate.at;
  $('ruleNote').textContent = ring.fixed ? 'Fixed ring: only linked neighbours can move it.' :
    `${ring.step > 1 ? `Jumps ${ring.step} notches per turn. ` : ''}${ring.gate ? `Gate ${available ? 'open' : 'closed'}: ring ${ring.gate.ring + 1} must sit at notch ${ring.gate.at} (the square). Now at ${state.pos[ring.gate.ring]}.` : ''}`;
  if (ring.oneWay) $('ruleNote').textContent += ` Ratchet: turn ${ring.oneWay > 0 ? 'clockwise' : 'anticlockwise'} only. Links can drag it either way. Wrong-way turns cost no move.`;
  if (ring.jam) $('ruleNote').textContent += ` ${state.pos[ring.jam.ring] === ring.jam.at ? 'Jammed' : 'Jam clear'}: ring ${ring.jam.ring + 1} at notch ${ring.jam.at} (the triangle) stops this ring. Now at ${state.pos[ring.jam.ring]}. Move it off to turn directly; links still work. Top is notch 0, counting clockwise.`;
  if (ring.block?.length) $('ruleNote').textContent += ` Crossed stops: notch ${ring.block.join(', ')}. Direct turns cannot land there; links can. Top is notch 0, counting clockwise.`;
  $('left').setAttribute('aria-disabled', String(!canTurn(state.pos, state.rings, selected, -1)));
  $('right').setAttribute('aria-disabled', String(!canTurn(state.pos, state.rings, selected, 1)));
  $('linkNote').textContent = links.length ? `Ring ${selected + 1} also turns ${links.map(([i, dir]) => `ring ${i + 1}${dir < 0 ? ' in reverse' : ''}`).join(' and ')}.` : ring.fixed ? 'Select a linked neighbour to turn this ring.' : `Ring ${selected + 1} has no outgoing links.`;
  $('selectedLabel').textContent = `RING ${selected + 1}`;
  $('hint').textContent = freeHint ? 'Replay one hint move · Free' : 'Watch an ad · Replay one hint move';
  $('hint').disabled = !freeHint && !(adsAvailable() && hasUnit('rewarded'));
}
function move(ring, dir) {
  if (screen !== 'play' || busy || status(state) !== 'playing') return;
  selected = ring; step(state, { move: [ring, dir] });
  if (state.events.some(e => e.type === 'notch')) chime();
  render();
  if (state.events.some(e => e.type === 'blocked')) {
    notify(`${$('ruleNote').textContent} No move used.`);
    if (saved.haptics && navigator.vibrate) navigator.vibrate([8, 35, 8]);
  } else notify('');
  if (status(state) !== 'playing') finish();
}
function replayHint() {
  step(state, { hint: true });
  if (!state.hint) { $('hintNote').textContent = 'No solution fits the moves left. Restart to try a different route.'; return false; }
  const { ring, dir } = state.hint;
  $('hintNote').textContent = `Hint replay: ring ${ring + 1}, ${dir > 0 ? 'clockwise' : 'anticlockwise'}, ${state.rings[ring].step || 1} ${(state.rings[ring].step || 1) === 1 ? 'notch' : 'notches'}.`;
  track('hint_used', { level: state.levelId }); move(ring, dir); return true;
}
$('hint').onclick = async () => {
  if (busy || screen !== 'play') return;
  if (freeHint) { if (replayHint()) freeHint = false; if (screen === 'play') render(); return; }
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
  finally { busy = false; if (screen === 'play') render(); }
};
function finish() {
  const won = status(state) === 'won', finale = (index + 1) % 10 === 0;
  const chapterUnlock = won && finale && index < campaign.length - 1 && saved.wins[state.levelId] === undefined;
  if (won) { saved.wins[state.levelId] = Math.min(saved.wins[state.levelId] ?? Infinity, state.movesMade); saved.day = today(); save(); chime(true); }
  track('level_complete', { level: state.levelId, chapter: campaign[index].chapter, won, outcome: status(state), moves: state.movesMade, hints: state.hints });
  $('resultKicker').textContent = won && index === campaign.length - 1 ? 'COLLECTION COMPLETE / DAWN KEEPER' : won ? chapterUnlock ? `CHAPTER ${campaign[index].chapter + 1} UNLOCKED` : finale ? 'CHAPTER COMPLETE' : 'EVERYTHING IN ITS PLACE' : 'A DIFFERENT TURN AWAITS';
  $('resultTitle').textContent = won ? finale ? index === 49 ? 'The dawn is yours.' : index === 39 ? 'The gatehouse is yours.' : index === 29 ? 'The way is open.' : index === 19 ? 'The vault is yours.' : 'The lock is open.' : 'A lovely little fit.' : 'Out of moves.';
  $('resultNote').textContent = won ? `Level ${state.levelId} complete in ${state.movesMade} moves. ${state.movesLeft} to spare.` : 'The pattern is not aligned yet. Restart with a fresh move budget.';
  $('resultSeal').textContent = won ? finale ? '✺' : '✓' : '↶';
  $('nextGoal').textContent = won ? index < campaign.length - 1 ? `${index === 39 ? 'Gatehouse Keeper seal earned. Enter the Dawn Observatory. ' : index === 29 ? 'Tidal Pathfinder seal earned. Enter the Gatehouse. ' : index === 19 ? 'Vault Keeper seal earned. Enter the Tidal Garden. ' : index === 9 ? 'First Connections seal earned. Enter the Brass Vault. ' : ''}Next: ${campaign[index + 1].name}. ${campaign[index + 1].objective}` : 'Dawn Keeper seal earned. All 50 locks opened across five chapters. Revisit your collection to find a shorter solution, or return tomorrow for your daily ritual.' : 'Try working backwards from the targets. Your free hint returns on restart.';
  $('next').textContent = won ? index < campaign.length - 1 ? `Next level · ${index + 2}` : 'View your collection' : 'Try again';
  $('result').classList.toggle('finale', won && finale);
  if (chapterUnlock) theme(campaign[index].chapter + 1);
  $('retry').hidden = !won; show('result');
  $('celebration').replaceChildren();
  if (won && !saved.reduced) for (let i = 0; i < (finale ? 48 : 22); i++) {
    const p = document.createElement('i'), angle = i * 2.4;
    p.style.cssText = `--colour:${colours[i % colours.length]};--x:${Math.cos(angle) * 180}px;--y:${90 + Math.sin(angle) * 170}px;--angle:${i * 31}deg`;
    $('celebration').append(p);
  }
  busy = true;
  Promise.resolve(maybeInterstitial()).catch(() => notify('The ad is unavailable. You can keep playing.')).finally(() => { busy = false; });
}
function levels() {
  $('levelGrid').replaceChildren();
  campaign.forEach((level, i) => {
    if (i % 10 === 0) {
      const heading = document.createElement('h3'); heading.className = 'chapterHeading'; heading.dataset.chapter = level.chapter;
      const completed = campaign.filter(l => l.chapter === level.chapter && saved.wins[l.id] !== undefined).length;
      heading.textContent = `${level.chapter === 1 ? '01 / First Connections' : level.chapter === 2 ? '02 / Gates and Gears' : level.chapter === 3 ? '03 / The Tidal Garden' : level.chapter === 4 ? '04 / The Gatehouse' : '05 / The Dawn Observatory'} / ${completed}/10${i > 0 && !unlocked(i) ? ` / Open level ${i} to enter` : ''}`;
      $('levelGrid').append(heading);
    }
    const button = document.createElement('button'); const best = saved.wins[level.id]; button.innerHTML = `<strong>${String(level.id).padStart(2, '0')} ${best !== undefined ? '✓' : ''}</strong>${level.name}<small>${best !== undefined ? `Best: ${best} moves` : unlocked(i) ? 'Ready to open' : `Open level ${i} first`}</small>`; button.dataset.chapter = level.chapter; button.disabled = !unlocked(i); button.onclick = () => start(i); $('levelGrid').append(button); });
  show('levels');
}
$('play').onclick = () => { if (busy) return; if (state && status(state) === 'playing') { theme(campaign[index].chapter); show('play'); } else start(nextIndex()); };
$('levelsButton').onclick = levels;
$('pause').onclick = () => { if (!busy) show('pause'); };
$('resume').onclick = () => { if (!busy) show('play'); };
$('restart').onclick = $('retry').onclick = () => start(index);
$('next').onclick = () => { if (busy) return; if (status(state) === 'won' && index === campaign.length - 1) levels(); else start(status(state) === 'won' ? index + 1 : index); };
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
  const ring = Math.round((148 - Math.hypot(x, y)) / 28);
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
window.arcadeView = () => ({ screen, level: state?.levelId || campaign[nextIndex()].id, chapter: campaign[state ? index : nextIndex()].chapter, state: state ? JSON.parse(JSON.stringify(state)) : null, selected, completed: Object.keys(saved.wins).length });
document.body.classList.toggle('reduced', saved.reduced);
initAds(); bannerOnScreens('screen', ['home', 'result']);
mountRemoveAds($('homeActions'), { before: $('settingsButton'), className: 'ghost', toast: notify });
mountRemoveAds($('settingsActions'), { before: $('settingsBack'), className: 'ghost', toast: notify });
home();
