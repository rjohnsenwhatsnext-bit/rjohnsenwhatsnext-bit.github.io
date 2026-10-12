import * as S from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const $ = id => document.getElementById(id);
const colours = { r: 'Red', b: 'Blue', g: 'Green', y: 'Yellow' };
let storage;
function warning(message) { $('save-warning').textContent = message; $('save-warning').hidden = false; }
try { storage = localStorage; } catch { warning('Device storage is unavailable. Progress cannot be saved.'); }
const loaded = S.loadProgress(storage);
let progress = loaded.progress;
if (loaded.error) warning(loaded.error);
const prefs = { sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, gold: false };
try { const saved = JSON.parse(storage?.getItem('depotrush.settings.v1') || '{}'); for (const key of Object.keys(prefs)) if (typeof saved[key] === 'boolean') prefs[key] = saved[key]; } catch { warning('Settings could not be read. Default settings are in use.'); }
function savePrefs() { try { storage.setItem('depotrush.settings.v1', JSON.stringify(prefs)); } catch { warning('Settings could not be saved on this device.'); } applyPrefs(); }
function save() { const result = S.saveProgress(storage, progress); if (!result.ok) warning(result.error); return result.ok; }
function applyPrefs() { document.body.classList.toggle('reduced', prefs.reduced); document.body.classList.toggle('gold', prefs.gold && progress.unlocks.includes(S.CHAPTER_SKIN)); }
let screen = 'home', index = 0, state = null, pending = null, accumulator = 0, last = performance.now(), settingsFrom = 'home', adBusy = false, rewardUsed = false;
const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const returning = Object.keys(progress.stars).length > 0;
function track(event, data = {}) { window.arcade?.track?.(event, { game: 'depotrush', session, returning, level: LEVELS[index].id, ...data }); }
let audio;
function tone(won = false) { if (!prefs.sound) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination); o.frequency.setValueAtTime(won ? 523 : 330, audio.currentTime); o.frequency.exponentialRampToValueAtTime(won ? 1046 : 440, audio.currentTime + .13); g.gain.setValueAtTime(.045, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .22); o.start(); o.stop(audio.currentTime + .23); } catch { /* Audio is optional; the game remains playable. */ } }
function show(name) { pending = null; accumulator = 0; last = performance.now(); screen = name; document.body.dataset.screen = name; for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== name; if (name === 'home') home(); if (name === 'levels') levelSelect(); const focus = $(name).querySelector('button:not(:disabled)'); focus?.focus({ preventScroll: true }); }
function goal() { const n = S.nextUnlock(progress, LEVELS); return n.complete ? 'Gold Depot unlocked! Chapter 2 is unlocked for a future update. Replay any stop for three stars.' : `${n.done} / ${n.total} stops cleared. Clear all ten for Gold Depot and 50 bonus coins.`; }
function home() { $('home-stars').textContent = Object.values(progress.stars).reduce((a, b) => a + b, 0); $('home-coins').textContent = progress.coins; $('home-goal').textContent = goal(); $('chapter-progress').value = S.nextUnlock(progress, LEVELS).done; $('goal-title').textContent = progress.unlocks.includes(S.CHAPTER_SKIN) ? 'Gold Depot is yours' : 'Your next unlock: Gold Depot'; const next = LEVELS.findIndex(l => !progress.stars[l.id]); $('continue').textContent = next < 0 ? 'Replay the morning →' : `Play stop ${next + 1} →`; }
function levelSelect() { $('level-grid').replaceChildren(); LEVELS.forEach((level, i) => { const b = document.createElement('button'); const stars = progress.stars[level.id] || 0; b.className = 'level-card'; b.disabled = !S.isUnlocked(progress, LEVELS, i); b.innerHTML = `<span class="stop-number">${String(i + 1).padStart(2, '0')}</span><b>${level.name}</b><small>${b.disabled ? 'Clear the previous stop' : stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : i === 9 ? 'CHAPTER FINALE' : 'Ready to depart'}</small>`; b.onclick = () => start(i); $('level-grid').append(b); }); }
function start(i) { if (adBusy || !S.isUnlocked(progress, LEVELS, i)) return; index = i; state = S.newGame(LEVELS[i], 1); rewardUsed = false; $('ad-note').textContent = ''; $('play-note').textContent = 'No timer. Take your time.'; $('level-number').textContent = `MORNING DEPOT · STOP ${i + 1} / 10`; $('level-name').textContent = LEVELS[i].name; $('objective').textContent = LEVELS[i].objective; show('play'); render(); track('level_start'); }
function bus(b, extra = '') { return `<div class="bus ${b.colour} ${extra}"><div class="windscreen"><span>${b.colour.toUpperCase()}</span><i></i></div><span class="bus-seats">${b.load || 0}/${b.seats}</span><div class="headlights"></div></div>`; }
function render() {
 const oldFocus = document.activeElement?.dataset.lane;
 $('passenger-count').textContent = `${state.queue.length} passengers left`;
 $('tap-count').textContent = Number.isFinite(state.maxTaps) ? `${state.taps} / ${state.maxTaps} taps` : `${state.taps} dispatches`;
 $('passengers').innerHTML = state.queue.slice(0, 12).map((c, i) => `<span class="person ${c} ${i === 0 ? 'front' : ''}" aria-label="${colours[c]} passenger">${c.toUpperCase()}</span>`).join('') + (state.queue.length > 12 ? `<span class="more">+${state.queue.length - 12}</span>` : '');
 $('bays').innerHTML = state.bays.map((b, i) => `<div class="bay" aria-label="Bay ${i + 1}: ${b ? `${colours[b.colour]}, ${b.load} of ${b.seats} seats filled` : 'empty'}">${b ? bus(b) : '<span>↑</span><small>FREE BAY</small>'}</div>`).join('');
 $('lanes').style.setProperty('--lanes', state.lanes.length);
 $('lanes').innerHTML = state.lanes.map((lane, i) => `<button class="lane" data-lane="${i}" aria-label="Lane ${i + 1}${lane[0] ? `, dispatch ${colours[lane[0].colour]} bus with ${lane[0].seats} seats` : ', empty'}" ${!lane.length ? 'disabled' : ''}><span class="lane-number">${i + 1}</span>${lane.map((b, j) => bus(b, j === 0 ? 'front-bus' : 'queued')).join('')}${!lane.length ? '<span class="empty-lane">CLEAR</span>' : ''}</button>`).join('');
 $('undo').disabled = !state.history.length;
 if (oldFocus !== undefined) $('lanes').querySelector(`[data-lane="${oldFocus}"]`)?.focus({ preventScroll: true });
}
$('lanes').onclick = e => { const lane = e.target.closest('[data-lane]'); if (lane && screen === 'play' && !pending) pending = { tap: Number(lane.dataset.lane) }; };
function undo() { if (adBusy || !state?.history.length) return; show('play'); pending = { undo: true }; track('undo'); }
$('undo').onclick = undo; $('result-undo').onclick = undo;
async function finish() {
 const won = S.status(state) === 'won'; let earned, saved = false;
 if (won) { earned = S.completeLevel(progress, LEVELS, LEVELS[index], state.taps); progress = earned.progress; saved = save(); track('level_completion', { taps: state.taps, stars: earned.stars, first_clear: earned.firstClear }); if (earned.coins) track('earned_reward', { coins: earned.coins, unlocks: earned.unlocks }); if (earned.chapterComplete) track('chapter_completion', { chapter: 1 }); tone(true); } else track('level_failure', { taps: state.taps, cause: 'jam' });
 $('result-kicker').textContent = won ? earned.chapterComplete ? 'MORNING DEPOT COMPLETE' : 'EVERYONE ABOARD' : 'THE LOT IS JAMMED';
 $('result-symbol').textContent = won ? '★'.repeat(earned.stars) + '☆'.repeat(3 - earned.stars) : '↶';
 $('result-title').textContent = won ? earned.chapterComplete ? 'A golden morning.' : 'Next stop: possibility.' : 'A fresh move awaits.';
 $('result-detail').textContent = won ? `${LEVELS[index].name} cleared in ${state.taps} dispatches. Three stars at ${LEVELS[index].par} or fewer.` : 'No matching bus can reach the front passenger. Take back a dispatch or try again for free.';
 $('result-earned').textContent = won ? earned.chapterComplete ? `+${earned.coins} coins · Gold Depot finish unlocked! Equip it in Settings.` : earned.firstClear ? `First clear! +${earned.coins} coins. ${saved ? 'Your stars are saved.' : 'Stars earned for this session. Device save failed.'}` : 'Replay complete. Best stars kept; first-clear coins are awarded once.' : 'No penalty. Free undo, as often as you need.';
 $('result-goal').textContent = goal(); $('result-undo').hidden = won; $('next').hidden = !won; $('next').textContent = index < LEVELS.length - 1 ? `Next: ${LEVELS[index + 1].name} →` : 'Explore your stops →'; $('retry').textContent = won ? 'Replay this stop' : 'Retry this stop';
 $('reward').hidden = !won || !adsAvailable() || !hasUnit('rewarded');
 $('confetti').innerHTML = won ? Array.from({ length: earned.chapterComplete ? 28 : 12 }, (_, i) => `<i style="--i:${i};left:${(i * 37) % 100}%"></i>`).join('') : '';
 show('result'); adBusy = true;
 try { await maybeInterstitial(); } catch { $('ad-note').textContent = 'Ad unavailable. Your result is unchanged.'; } finally { adBusy = false; }
}
$('reward').onclick = async () => { if (adBusy || rewardUsed || !adsAvailable() || !hasUnit('rewarded')) return; adBusy = true; $('reward').disabled = true; track('ad_offer', { reward: '20 coins' }); try { const result = await showRewarded(); const grant = S.grantRewardedAd(progress, result.rewarded === true ? 'completed' : 'failed'); if (grant.coins) { progress = grant.progress; save(); rewardUsed = true; track('earned_reward', { coins: grant.coins, source: 'rewarded_ad' }); $('ad-note').textContent = '20 coins added.'; } else $('ad-note').textContent = 'No completed ad. No coins added.'; } catch { $('ad-note').textContent = 'Ad unavailable. No coins added.'; } finally { adBusy = false; $('reward').disabled = false; $('reward').hidden = rewardUsed; } };
function retry() { if (adBusy) return; track('retry'); start(index); }
$('retry').onclick = retry; $('pause-retry').onclick = retry;
$('continue').onclick = () => start(Math.max(0, LEVELS.findIndex(l => !progress.stars[l.id])));
$('select').onclick = () => show('levels');
$('next').onclick = () => { if (!adBusy) index < LEVELS.length - 1 ? start(index + 1) : show('levels'); };
for (const b of document.querySelectorAll('[data-home]')) b.onclick = () => { if (!adBusy) show('home'); };
$('pause-open').onclick = () => show('pause'); $('resume').onclick = () => show('play');
function settings() { if (adBusy) return; settingsFrom = screen; for (const key of ['sound', 'gold']) $(key).checked = prefs[key]; $('motion').checked = prefs.reduced; $('gold').disabled = !progress.unlocks.includes(S.CHAPTER_SKIN); $('gold-note').textContent = $('gold').disabled ? 'Clear all ten stops to unlock' : 'Unlocked! Gold trim, original matching colours.'; show('settings'); }
$('settings-open').onclick = settings; $('pause-settings').onclick = settings;
$('settings-back').onclick = () => show(settingsFrom);
for (const [id, key] of [['sound', 'sound'], ['motion', 'reduced'], ['gold', 'gold']]) $(id).onchange = () => { prefs[key] = $(id).checked; savePrefs(); if (key === 'sound') tone(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && !adBusy) { if (screen === 'play') show('pause'); else if (screen === 'pause') show('play'); else if (screen === 'settings') show(settingsFrom); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') show('pause'); });
addEventListener('blur', () => { if (screen === 'play') show('pause'); });
function frame(now) { accumulator += Math.min(now - last, 150); last = now; if (screen === 'play' && state && !adBusy) { let changed = false; while (accumulator >= S.TICK_MS && screen === 'play') { S.step(state, pending); pending = null; accumulator -= S.TICK_MS; if (state.events.length) { changed = true; if (state.events.some(e => e.type === 'tap')) tone(); $('play-note').textContent = state.events.some(e => e.type === 'refused') ? 'Wait for a free bay, or undo a dispatch.' : state.events.some(e => e.type === 'undo') ? 'Dispatch undone. Try another route.' : 'Match the front passenger first.'; } if (S.status(state) !== 'playing') { render(); finish(); break; } } if (changed && screen === 'play') render(); } else accumulator = 0; requestAnimationFrame(frame); }
window.arcadeView = () => ({ screen, level: index + 1, levelId: LEVELS[index].id, state: state ? S.cloneState(state) : null });
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 5000); }
mountRemoveAds($('home-actions'), { className: 'quiet', toast });
mountRemoveAds($('settings-actions'), { before: $('settings-back'), className: 'quiet', toast });
applyPrefs(); home(); initAds(); bannerOnScreens('screen', ['home', 'result']); requestAnimationFrame(frame);
