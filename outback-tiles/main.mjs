import * as S from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const KEY = 'outbacktiles.progress.v1';
let saved = { cleared: [], sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
function storageWarning() { $('saveWarning').hidden = false; $('saveWarning').textContent = 'Progress could not be saved or read. Keep this tab open to keep your progress.'; }
try {
  const value = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (value) saved = { cleared: Array.isArray(value.cleared) ? value.cleared.filter(n => Number.isInteger(n) && n >= 1 && n <= LEVELS.length) : [], sound: value.sound !== false, reduced: typeof value.reduced === 'boolean' ? value.reduced : saved.reduced };
} catch { storageWarning(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { storageWarning(); } }
let screen = 'home', settingsFrom = 'home', state = null, index = 0, busy = false, audio, toastTimer;
const chapterName = l => ['The Bush Track', 'The Red Centre', 'The Wet Season', 'The Long Paddock'][l.chapter - 1];
const chapterReward = l => ['Boab Crown', 'Red Centre Gold', 'Thunderhead Crest', 'Southern Cross'][l.chapter - 1];
function theme(l) { document.body.dataset.chapter = l.chapter; }
const names = ['Gum leaf', 'Wattle', 'Waratah', 'Sun', 'Waterhole', 'Boomerang', 'Mountain', 'Grass tree', 'Seed pod', 'Southern stars', 'Banksia', 'Boab'];
const drawings = [
 '<path d="M21 51Q45 35 43 9Q17 16 21 51Z" fill="#457664"/><path d="M21 51L38 20"/>',
 '<path d="M31 53V18M31 38L15 28M31 32L47 20"/><g fill="#dfa72d" stroke="none"><circle cx="17" cy="23" r="8"/><circle cx="34" cy="14" r="8"/><circle cx="46" cy="29" r="8"/><circle cx="26" cy="37" r="7"/></g>',
 '<path d="M32 55V36M32 49L18 41M32 47L46 40"/><path d="M14 29L18 15L26 21L32 8L38 21L46 15L50 29Q47 45 32 44Q17 43 14 29" fill="#ba4b3a"/>',
 '<g stroke="#c98925"><circle cx="32" cy="32" r="13" fill="#efb947"/><path d="M32 6V12M32 52V58M6 32H12M52 32H58M13 13L18 18M46 46L51 51M13 51L18 46M46 18L51 13"/></g>',
 '<path d="M32 8Q12 31 14 41Q16 56 32 56Q48 56 50 41Q52 31 32 8Z" fill="#438caa"/><path d="M22 39Q20 46 29 48" stroke="#f9edcd"/>',
 '<path d="M11 48L28 12Q31 7 35 13L55 48L44 43L31 25L20 44Z" fill="#ae653b"/>',
 '<path d="M5 49L24 16L35 34L43 22L59 49Z" fill="#b96b4b"/><path d="M18 27L24 16L30 27" stroke="#f7dfbb"/>',
 '<path d="M31 54L33 28M32 30L10 19M32 30L16 9M32 30L33 7M32 30L48 9M32 30L56 22M32 30L8 33M32 30L54 37" stroke="#52725a"/><path d="M26 54L29 35H36L39 54" fill="#72503b"/>',
 '<ellipse cx="32" cy="32" rx="16" ry="24" fill="#97613f"/><path d="M32 12V52M22 23L32 28L43 22M21 36L32 40L43 35" stroke="#edd09b"/>',
 '<g fill="#486c92" stroke="#486c92"><path d="M31 5L34 13L42 16L34 19L31 27L28 19L20 16L28 13ZM15 28L17 33L22 35L17 37L15 42L13 37L8 35L13 33ZM43 28L45 34L51 36L45 38L43 44L41 38L35 36L41 34ZM30 42L32 47L37 49L32 51L30 57L28 51L23 49L28 47Z"/></g>',
 '<path d="M32 56V42M32 52L17 44M32 52L47 45"/><rect x="22" y="9" width="20" height="34" rx="10" fill="#d3903c"/><path d="M24 17H40M23 24H41M23 31H41M26 38H38" stroke="#8a5937"/>',
 '<path d="M21 54Q28 39 26 27L15 17M26 27L28 11M37 27L49 15M37 27L37 10M37 27Q35 42 44 54Z" fill="#ad724c"/><path d="M12 18Q10 7 25 10Q32 1 39 10Q54 6 54 19Q43 26 33 20Q22 26 12 18" fill="#65845c"/>'
];
function face(n) { return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#496353" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${drawings[n % drawings.length]}</svg>`; }
function tell(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4200); }
function tone(win = false) {
  if (!saved.sound) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination); o.type = 'sine'; o.frequency.setValueAtTime(win ? 660 : 440, audio.currentTime); o.frequency.exponentialRampToValueAtTime(win ? 990 : 660, audio.currentTime + .12); g.gain.setValueAtTime(.07, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .25); o.start(); o.stop(audio.currentTime + .26); } catch { /* Audio support is optional. */ }
}
function unlocked(i) { return i === 0 || saved.cleared.includes(LEVELS[i - 1].id); }
function nextIndex() { const i = LEVELS.findIndex(l => !saved.cleared.includes(l.id)); return i < 0 ? LEVELS.length - 1 : i; }
function show(name) {
  if (busy) return;
  if (name === 'settings') settingsFrom = screen;
  screen = name; document.body.dataset.screen = name;
  document.querySelectorAll('.page').forEach(p => p.hidden = p.id !== name);
  if (name === 'home' || name === 'levels') menu();
  if (name === 'play') { theme(LEVELS[index]); requestAnimationFrame(render); }
  $(name).querySelector('button')?.focus({ preventScroll: true });
}
function menu() {
  const count = new Set(saved.cleared).size, next = LEVELS[nextIndex()];
  theme(next);
  $('progressText').textContent = `${count} / ${LEVELS.length}`; $('campaign').max = LEVELS.length; $('campaign').value = count;
  $('journeyName').textContent = chapterName(next);
  const rewards = $('earnedRewards');
  rewards.replaceChildren();
  for (const [id, title] of [[10, 'Boab Crown'], [20, 'Red Centre Gold'], [30, 'Thunderhead Crest'], [40, 'Southern Cross']]) {
    if (!saved.cleared.includes(id)) continue;
    const badge = document.createElement('span');
    badge.className = 'earned-reward';
    badge.textContent = `${title} earned`;
    rewards.append(badge);
  }
  rewards.hidden = !rewards.childElementCount;
  $('nextGoal').textContent = count === LEVELS.length ? 'All four chapter rewards earned. Your whole trail is yours to replay.' : `Next: ${next.name}. ${next.goal}.`;
  $('continue').textContent = state && S.status(state) === 'playing' ? 'Resume your stack' : count === LEVELS.length ? 'Return to Southern Cross' : `Play level ${next.id}`;
  $('levelList').replaceChildren();
  for (const chapter of [...new Set(LEVELS.map(l => l.chapter))]) {
    const levels = LEVELS.filter(l => l.chapter === chapter), complete = levels.filter(l => saved.cleared.includes(l.id)).length;
    const group = document.createElement('section'); group.className = `chapter chapter-${chapter}`;
    const open = unlocked(LEVELS.indexOf(levels[0]));
    group.innerHTML = `<div class="chapter-landscape" aria-hidden="true"></div><p class="eyebrow">CHAPTER ${chapter} / ${complete} OF ${levels.length} CLEARED</p><h3>${chapterName(levels[0])}</h3><p class="chapter-description">${chapter === 1 ? 'Follow the trail to earn your Boab Crown.' : chapter === 2 ? open ? 'Gold in the red earth. Earn your Red Centre Gold.' : 'Clear Boab Crown, level 10, to unlock the red earth.' : chapter === 4 ? open ? 'Follow the dusk sky. Build runs of matching pairs to earn your Southern Cross.' : 'Clear Thunderhead, level 30, to unlock The Long Paddock.' : open ? 'Rain over the billabong. Balance your goal with limited wrong pairs and tries to earn the Thunderhead Crest.' : 'Clear Uluru Gold, level 20, to unlock The Wet Season.'}</p>`;
    for (const l of levels) {
      const i = LEVELS.indexOf(l), cleared = saved.cleared.includes(l.id), b = document.createElement('button');
      b.className = 'level'; b.disabled = !unlocked(i);
      if (i === nextIndex() && !cleared) { b.classList.add('next-level'); b.setAttribute('aria-current', 'step'); }
      b.innerHTML = `<span class="level-number">${l.id}</span><span><b>${l.name}</b><small>${l.goal}${l.hints ? ` / ${l.hints} starting hints` : ''}</small></span><span>${cleared ? 'Cleared' : b.disabled ? 'Locked' : 'Next'}</span>`;
      b.onclick = () => start(i); group.append(b);
    }
    $('levelList').append(group);
  }
}
function start(i) { if (busy || !unlocked(i)) return; index = i; try { state = S.newGame(LEVELS[i], Date.now() >>> 0); } catch { tell('This stack could not be dealt. Choose another level or try again.'); return; } show('play'); render(); }
function render() {
  if (!state) return;
  const l = LEVELS[index], free = new Set(S.freeTiles(state)), pairs = S.matchesAvailable(state);
  $('levelNumber').textContent = `${chapterName(l).toUpperCase()} / ${l.id} OF ${LEVELS.length}`; $('levelName').textContent = l.name; $('goal').textContent = l.goal;
  $('goldGuide').hidden = l.objective !== 'gold';
  const guideKey = `${l.id}:${state.gold}`;
  if ($('goldFaces').dataset.level !== guideKey) {
    $('goldFaces').dataset.level = guideKey;
    $('goldFaces').innerHTML = Array.from({ length: state.gold }, (_, n) => `<span class="gold-example" role="img" aria-label="Gold ${names[n]}">${face(n)}<span aria-hidden="true">&#9670;</span></span>`).join('');
  }
  $('left').textContent = state.pairsLeft; $('available').textContent = pairs; $('availableBox').classList.toggle('warning', pairs <= 1);
  $('objectiveCount').textContent = l.objective === 'streak' ? `${state.streak}/${l.limit}` : l.objective === 'gold' ? S.goldLeft(state) : l.objective === 'turns' ? Math.max(0, l.limit - state.turns) : l.objective === 'mistakes' ? `${state.mistakes}/${l.limit}` : state.pairsCleared;
  $('objectiveLabel').textContent = l.objective === 'streak' ? 'PAIRS IN A ROW' : l.objective === 'gold' ? 'GOLD TILES LEFT' : l.objective === 'turns' ? 'TRIES LEFT' : l.objective === 'mistakes' ? 'WRONG PAIRS' : 'CLEARED';
  const caps = [];
  if (state.maxMistakes != null) caps.push({ label: 'Wrong pairs left', left: Math.max(0, state.maxMistakes - state.mistakes) });
  if (state.maxTurns != null) caps.push({ label: 'Tries left', left: Math.max(0, state.maxTurns - state.turns) });
  $('limits').hidden = !caps.length;
  $('limits').innerHTML = caps.map(cap => `<span class="${cap.left <= 1 ? 'tight' : ''}">${cap.label} <b>${cap.left}</b></span>`).join('');
  $('chapterGuide').hidden = l.chapter < 3;
  $('streakGuide').hidden = l.objective !== 'streak';
  $('streakProgress').max = l.limit || 1;
  $('streakProgress').value = state.streak;
  $('streakBest').textContent = `Best run: ${state.bestStreak}. A wrong pair resets your run to zero. Undo keeps your run.`;
  $('chapterGuide').textContent = state.maxMistakes != null && state.maxMistakes === state.mistakes
    ? 'No wrong pairs left. Your next wrong pair ends this stack.'
    : 'Meet the goal within every limit. Undo does not refund tries or wrong pairs.';
  $('guidance').textContent = pairs === 0 ? 'No free pairs. Shuffle to open a new route.' : pairs === 1 ? 'One free pair left. Look at what it will uncover.' : l.objective === 'gold' ? 'Match identical gold-marked faces. Plain tiles can stay; clear them to reach gold.' : index < 3 ? 'Free means nothing on top and one side open.' : 'Choose a pair that opens up the stack.';
  const space = $('boardSpace'), board = $('board');
  const maxX = Math.max(...state.tiles.map(t => t.x + 2)), maxY = Math.max(...state.tiles.map(t => t.y + 2)), maxZ = Math.max(...state.tiles.map(t => t.z));
  const unit = Math.min((space.clientWidth - 16) / (maxX + maxZ * .15), (space.clientHeight - 18) / (maxY * 1.22 + maxZ * .2), 42);
  board.style.width = `${(maxX + maxZ * .15) * unit}px`; board.style.height = `${(maxY * 1.22 + maxZ * .2) * unit}px`;
  const focused = document.activeElement?.dataset.tile;
  board.replaceChildren();
  for (const t of state.tiles) { if (!t.alive) continue; const b = document.createElement('button'); b.className = 'tile' + (t.face < state.gold ? ' gold-tile' : '') + (!free.has(t.id) ? ' blocked' : '') + (state.picked === t.id ? ' selected' : '') + (state.hint?.includes(t.id) ? ' hinted' : ''); b.dataset.tile = t.id; b.setAttribute('aria-label', `${t.face < state.gold ? 'Gold, ' : ''}${names[t.face]} tile ${t.id + 1}, ${free.has(t.id) ? 'free' : 'blocked'}`); b.setAttribute('aria-pressed', String(state.picked === t.id)); b.style.cssText = `left:${(t.x + t.z * .15) * unit}px;top:${(t.y * 1.22 + (maxZ - t.z) * .2) * unit}px;width:${unit * 1.94}px;height:${unit * 2.32}px;z-index:${t.z + 1}`; b.innerHTML = face(t.face) + (t.face < state.gold ? '<span class="gold-mark" aria-hidden="true">&#9670;</span>' : ''); b.onclick = () => send({ pick: t.id }); board.append(b); }
  if (focused !== undefined) board.querySelector(`[data-tile="${focused}"]`)?.focus({ preventScroll: true });
  for (const kind of ['undo', 'hint', 'shuffle']) { const n = state[`${kind === 'undo' ? 'undos' : kind === 'hint' ? 'hints' : 'shuffles'}Left`]; $(kind).textContent = `${kind[0].toUpperCase() + kind.slice(1)} ${n ? '· ' + n : rewardAvailable() ? '· Ad' : '· 0'}`; $(kind).disabled = busy || (!n && !rewardAvailable()) || (kind === 'undo' && !state.history.length); }
}
function burst() { if (saved.reduced) return; const layer = $('sparkles'); layer.replaceChildren(); for (let i = 0; i < 16; i++) { const p = document.createElement('i'); p.style.cssText = `--dx:${Math.cos(i * 2.4) * 120}px;--dy:${Math.sin(i * 2.4) * 100}px;--r:${i * 47}deg`; layer.append(p); } }
function send(input) { if (busy || screen !== 'play') return; S.step(state, input); render(); const event = state.events[0]; if (event?.type === 'match') { tone(); burst(); } if (event?.type === 'mismatch') tell(state.objective === 'streak' ? 'Different faces. Run reset to zero. Your cleared pairs stay cleared.' : 'Different faces. Try another pair.'); if (event?.type === 'blocked') tell('That tile needs an open side and nothing on top.'); if (S.status(state) !== 'playing') finish(); }
async function finish() {
  const won = S.status(state) === 'won', l = LEVELS[index];
  if (won) { if (!saved.cleared.includes(l.id)) saved.cleared.push(l.id); save(); tone(true); }
  const finale = l.id % 10 === 0, next = LEVELS[index + 1];
  $('resultKicker').textContent = won ? finale ? `${chapterReward(l).toUpperCase()} EARNED` : chapterName(l).toUpperCase() : 'A DIFFERENT ROUTE NEXT TIME';
  $('resultTitle').textContent = won ? finale ? 'Chapter complete!' : l.objective === 'streak' ? 'What a run!' : l.objective === 'gold' ? 'All gold found!' : 'Beautifully paired.' : 'Stack stopped.';
  $('resultDetail').textContent = won ? `${l.name} complete.${l.objective === 'gold' ? ' Every gold tile is cleared. Plain tiles can stay.' : ''}` : ({ stuck: 'No matching free pairs remain.', turns: 'You have used every try.', mistakes: 'Too many wrong pairs this time.', streak: 'The stack is clear, but your run fell short. Match the required pairs in a row to win.' }[S.cause(state)]);
  $('resultStats').textContent = `${state.pairsCleared} pairs cleared / ${state.turns} tries / ${state.mistakes} wrong pairs${l.objective === 'streak' ? ` / best run ${state.bestStreak} of ${l.limit}` : ''}`;
  $('resultNext').textContent = won ? next ? `${finale ? `Chapter ${next.chapter} unlocked: ${chapterName(next)}! ` : ''}Next: ${next.name}. ${next.goal}.` : 'All 40 stops cleared. Four chapter rewards are yours. Return tomorrow for a fresh deal. More chapters are not available yet.' : 'Every new deal has a clearing route. Look for pairs that free the tiles below.';
  $('unlockCard').hidden = !(won && finale);
  $('unlockCard').dataset.chapter = next && finale ? next.chapter : l.chapter;
  $('unlockCard').innerHTML = `<span class="eyebrow">${next ? 'NEW COUNTRY TO EXPLORE' : 'CHAPTER REWARD'}</span><h3>${next ? chapterName(next) : chapterReward(l)}</h3><p>${next ? next.chapter === 2 ? 'Ten new stops. Find the gold-marked pairs, with starting hints to help you.' : next.chapter === 4 ? 'Ten stops beneath the evening sky. Match pairs in a row, without a wrong pair breaking your run. Earn your Southern Cross.' : 'Ten rain-soaked stops. Meet your goal while watching wrong pairs and tries. Your Thunderhead Crest awaits.' : 'From Hot Run to Southern Cross. The Long Paddock is complete and all four chapters are yours to replay.'}</p>`;
  $('next').hidden = !won; $('next').textContent = next ? finale ? `Enter ${chapterName(next)}` : 'On to the next stop' : 'Explore all four chapters';
  $('rescue').hidden = won || S.cause(state) !== 'stuck' || !rewardAvailable();
  $('medal').textContent = won ? finale ? '\u265b' : '\u2726' : '\u21bb';
  $('result').classList.toggle('finale', won && finale);
  show('result'); $('result').classList.toggle('celebrate', won); busy = true;
  try { await maybeInterstitial(); } catch { tell('The ad was unavailable. You can keep playing.'); } finally { busy = false; }
}
function rewardAvailable() { return adsAvailable() && hasUnit('rewarded'); }
async function help(kind, rescue = false) {
  if (busy || !state) return;
  const key = { undo: 'undosLeft', hint: 'hintsLeft', shuffle: 'shufflesLeft' }[kind];
  if (!rescue && state[key] > 0) { send({ [kind]: true }); return; }
  if (!rewardAvailable()) return;
  if (!confirm(`Watch an ad to receive 1 ${kind}${rescue ? ' and continue this stack' : ''}?`)) return;
  busy = true; let result;
  try { result = await showRewarded(); } catch { result = { rewarded: false }; } finally { busy = false; }
  if (!result.rewarded) { tell('No reward earned. Your stack has not changed.'); return; }
  S.step(state, { grant: kind }); if (rescue) show('play'); send({ [kind]: true });
}
$('continue').onclick = () => state && S.status(state) === 'playing' ? show('play') : start(nextIndex());
$('pause').onclick = () => show('paused'); $('resume').onclick = () => show('play');
$('retry').onclick = () => start(index); $('next').onclick = () => index < LEVELS.length - 1 ? start(index + 1) : show('levels');
$('rescue').onclick = () => help('shuffle', true);
for (const kind of ['undo', 'hint', 'shuffle']) $(kind).onclick = () => help(kind);
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
$('settingsBack').onclick = () => show(settingsFrom);
for (const [id, key] of [['sound', 'sound'], ['motion', 'reduced']]) { $(id).checked = saved[key]; $(id).onchange = () => { saved[key] = $(id).checked; document.body.classList.toggle('reduced', saved.reduced); save(); }; }
document.body.classList.toggle('reduced', saved.reduced);
addEventListener('resize', () => { if (screen === 'play') render(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { if (screen === 'play') show('paused'); else if (screen === 'paused') show('play'); else if (screen === 'settings') show(settingsFrom); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && !busy) show('paused'); });
window.arcadeView = () => ({ screen, level: LEVELS[index].id, state: state ? JSON.parse(JSON.stringify(state)) : null });
mountRemoveAds($('homePurchases'), { className: 'quiet', toast: tell });
mountRemoveAds($('settingsPurchases'), { className: 'quiet', toast: tell });
initAds(); bannerOnScreens('screen', ['home', 'result']); menu();
