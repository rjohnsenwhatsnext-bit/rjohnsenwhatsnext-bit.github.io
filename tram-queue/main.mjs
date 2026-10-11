import * as S from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

// One rules tick per player decision. All board and reward changes belong to sim.
const app = document.getElementById('app');
const names = ['Coral', 'Ocean', 'Honey', 'Violet'];
const symbols = ['●', '◆', '▲', '✚'];
const arrows = { U: '↑', D: '↓', L: '←', R: '→' };
const directions = { U: 'up', D: 'down', L: 'left', R: 'right' };
let storage, progress = S.emptyProgress(), prefs = { sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, gold: true };
function warning(text) { const el = document.getElementById('saveWarning'); el.textContent = text; el.hidden = false; }
try {
  storage = localStorage;
  const loaded = S.loadProgress(storage); progress = loaded.progress;
  if (loaded.error) warning(loaded.error);
  const saved = JSON.parse(storage.getItem('tramqueue.settings.v1') || 'null');
  if (saved) for (const key of ['sound', 'reduced', 'gold']) if (typeof saved[key] === 'boolean') prefs[key] = saved[key];
} catch { warning('Saved data could not be read. Keep this tab open to keep your progress.'); }
let screen = 'home', from = 'home', index = 0, state = null, reward = null, busy = false, audio;
const session = Date.now().toString(36);
const track = (event, data = {}) => window.arcade?.track?.(event, { session, ...data });
track('session_start', { returning: Object.keys(progress.cleared).length > 0 });
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const button = (action, label, cls = '', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const badge = c => `<span class="route c${c}" aria-label="${names[c]}">${symbols[c]}</span>`;
const stars = n => `<span class="stars" aria-label="${n} of 3 stars">${'★'.repeat(n)}<span>${'☆'.repeat(3 - n)}</span></span>`;
const clearCount = () => LEVELS.filter(l => l.id in progress.cleared).length;
const nextIndex = () => { const i = LEVELS.findIndex(l => !(l.id in progress.cleared)); return i < 0 ? 0 : i; };
function say(text) { document.getElementById('notice').textContent = text; }
function sound(win = false) {
  if (!prefs.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
    const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination);
    o.type = 'sine'; o.frequency.setValueAtTime(win ? 660 : 440, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(win ? 990 : 570, audio.currentTime + .12);
    g.gain.setValueAtTime(.045, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .22);
    o.start(); o.stop(audio.currentTime + .23);
  } catch { say('Sound is unavailable on this device. You can keep playing.'); }
}
function unlockCard() {
  const n = S.nextUnlock(progress, LEVELS);
  return `<div class="ticket"><span class="ticket-icon">✦</span><div><strong>${n ? 'Next stop: ' + esc(n.name) : 'Gold livery unlocked'}</strong><p>${n ? `${n.have} / ${n.need} stops cleared · +50 tokens at completion` : 'Your trams now wear a gold roof trim.'}</p><progress value="${clearCount()}" max="10" aria-label="Chapter progress"></progress></div></div>`;
}
function header(label, action = 'home', text = '← Menu') { return `<header>${button(action, text, 'quiet')}<span>${label}</span></header>`; }
function render(focus = false) {
  document.body.dataset.screen = screen;
  document.body.classList.toggle('reduced', prefs.reduced);
  document.body.classList.toggle('gold', prefs.gold && progress.unlocks.includes('livery-gold'));
  if (screen === 'home') app.innerHTML = `<header><b>TOVELLY</b>${button('settings', 'Settings', 'quiet')}</header><section class="home"><p class="eyebrow">A LITTLE TOWN. A LOVELY PUZZLE.</p><h1>Tram<br><span>Queue</span><i>01</i></h1><img class="hero" src="assets/town.svg" alt="Colourful trams winding through a leafy town"><p class="tagline">Send each tram to its stop.<br>Clear the queue, no dead ends.</p><div class="totals"><span><b>${clearCount()}/10</b> stops cleared</span><span><b>${Object.values(progress.cleared).reduce((a,b) => a+b,0)}/30</b> stars</span></div>${button('continue', clearCount() === 10 ? 'Ride the loop again →' : `Play stop ${nextIndex() + 1} →`, 'primary')}${button('levels', 'Choose a stop', 'secondary')}${unlockCard()}<div id="purchase"></div><p class="fine">CHAPTER 1 · TOWN LOOP<br>Ten stops. Free undo. Take your time.</p></section>`;
  if (screen === 'levels') app.innerHTML = `${header('ROUTE MAP')}<section><p class="eyebrow">CHAPTER 01</p><h2>Town Loop</h2><p>Learn the lines. Find your flow.</p><div class="level-list">${LEVELS.map((l,i) => button('level', `<span class="stop-number">${i+1}</span><span><strong>${esc(l.name)}</strong><small>${l.id in progress.cleared ? stars(progress.cleared[l.id]) : S.isLevelUnlocked(progress,LEVELS,i) ? 'Ready to depart' : 'Clear stop ' + i + ' to unlock'}</small></span><span>${S.isLevelUnlocked(progress,LEVELS,i) ? '→' : '○'}</span>`, 'level', `data-index="${i}" ${S.isLevelUnlocked(progress,LEVELS,i) ? '' : 'disabled'}`)).join('')}</div>${unlockCard()}<p class="fine">Chapters 2 to 5 and the daily challenge are not in this version.</p></section>`;
  if (screen === 'play') renderPlay();
  if (screen === 'pause') app.innerHTML = `${header('TAKE YOUR TIME', 'resume', '← Resume')}<section class="sheet"><p class="eyebrow">STOP ${index+1}</p><h2>Parked for<br>a moment.</h2><p>Your trams will wait right here.</p>${button('resume','Keep going →','primary')}${button('retry','Retry this stop','secondary')}${button('settings','Settings','secondary')}${button('home','Main menu','quiet')}</section>`;
  if (screen === 'settings') app.innerHTML = `${header('SETTINGS','back','← Back')}<section class="sheet"><h2>Your ride.</h2><label class="setting">Sound <input data-pref="sound" type="checkbox" ${prefs.sound?'checked':''}></label><label class="setting">Reduced motion <input data-pref="reduced" type="checkbox" ${prefs.reduced?'checked':''}></label>${progress.unlocks.includes('livery-gold') ? `<label class="setting">Gold roof trim <input data-pref="gold" type="checkbox" ${prefs.gold?'checked':''}></label>` : unlockCard()}<p>Three stars: clear without undo or reshuffle, and stay within the stop's parking target. Recovery is always free.</p><p><b>${progress.tokens} tokens earned</b><br>Tokens mark first clears. There is no token shop in chapter 1.</p><div id="purchase"></div>${button('back','Done','primary')}</section>`;
  if (screen === 'result') {
    const won = S.status(state) === 'won';
    app.innerHTML = `${header('STOP '+(index+1))}<section class="sheet result ${won?'celebrate':''}"><p class="eyebrow">${won ? reward.chapterReward ? 'TOWN LOOP COMPLETE' : 'ALL ABOARD' : 'TIME TO RETHINK'}</p><div class="result-art" aria-hidden="true">${won?'✦':'↶'}</div><h2>${won ? reward.chapterReward ? 'A golden finish.' : 'Lovely timing!' : 'A little jam.'}</h2>${won ? stars(reward.stars) : ''}<p>${won ? `${state.qi} passengers matched. ${state.parks} parks.` : state.maxParks !== undefined && state.parks > state.maxParks ? 'Parking limit reached. Undo your last move and try another route.' : 'The lanes are stuck. Undo a move or reshuffle the remaining queue for free.'}</p>${won ? `<div class="reward">${reward.firstClear ? `+${reward.tokens} tokens${reward.chapterReward ? ' · Gold livery unlocked!' : ' · First clear'}` : 'Replay complete · Best stars saved'}</div>${unlockCard()}${button(index < LEVELS.length-1 ? 'next' : 'levels', index < LEVELS.length-1 ? `Next: ${esc(LEVELS[index+1].name)} →` : 'Replay for more stars →','primary')}` : `${button('undo','Undo last move · Free','primary')}${button('shuffle','Reshuffle queue · Free','secondary')}`}${button('retry','Play this stop again','secondary')}${button('levels','Route map','quiet')}<p class="fine">${won && index === 9 ? 'Chapter 2 is not available in this version.' : won ? `Three-star target: ${state.par} parks, no undo or reshuffle.` : 'No ad needed to continue.'}</p></section>`;
  }
  const purchase = document.getElementById('purchase');
  if (purchase) mountRemoveAds(purchase, { className:'secondary', toast:say });
  app.inert = busy;
  if (focus) { const heading = app.querySelector('h1,h2'); if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); } }
}
function renderPlay() {
  const l = LEVELS[index], rest = state.queue.slice(state.qi);
  app.innerHTML = `${header(`STOP ${String(index+1).padStart(2,'0')} / 10`,'pause','Ⅱ Pause')}<section class="play"><div class="play-title"><h2>${esc(l.name)}</h2><b>${state.qi}/${state.queue.length}</b></div><p class="objective">${esc(l.objective)}</p><div class="platform"><div class="platform-label"><b>NEXT TO BOARD</b><span>${rest.length} waiting</span></div><div class="queue">${rest.map((c,i)=>`<div class="passenger ${i===0?'front':''}">${badge(c)}<small>${i===0?'NEXT':i+1}</small></div>`).join('')}</div></div><div class="lanes-label"><b>HOLDING LANES</b><span>${state.held.length}/${state.lanes} occupied</span></div><div class="lanes">${Array.from({length:state.lanes},(_,i)=>`<div class="lane">${state.held[i] === undefined ? '<span>EMPTY</span>' : badge(state.trams[state.held[i]].c)}</div>`).join('')}</div><div class="board" style="--cols:${state.w};--rows:${state.h}" aria-label="Tram yard">${Array.from({length:state.w*state.h},(_,i)=>`<span class="track-cell" style="grid-column:${i%state.w+1};grid-row:${Math.floor(i/state.w)+1}"></span>`).join('')}${state.trams.filter(t=>t.where==='board').map(t=>`<button class="tram c${t.c}" data-action="tap" data-id="${t.id}" style="grid-column:${t.x+1};grid-row:${t.y+1}" aria-label="${names[t.c]} tram ${t.id+1}, facing ${directions[t.d]}"><span class="tram-windows"></span><span class="tram-mark">${symbols[t.c]} <b>${arrows[t.d]}</b></span><span class="tram-lights"></span></button>`).join('')}</div><p class="yard-note">Follow the arrows. Trams need a clear path out.</p><div class="play-tools">${button('undo','↶ Undo','secondary',state.history.length?'':'disabled')}${button('shuffle','⇄ Reshuffle','secondary')}</div><p class="fine">${state.maxParks !== undefined ? `Parks: ${state.parks} / ${state.maxParks} allowed` : `Parks: ${state.parks}`} · ★★★ target: ${state.par} parks<br>Undo and reshuffle are always free.</p></section>`;
}
function go(next) { screen = next; say(''); render(true); window.scrollTo(0,0); }
function start(i) {
  if (!LEVELS[i] || !S.isLevelUnlocked(progress,LEVELS,i)) return;
  document.documentElement.requestFullscreen?.().catch(()=>{});
  index = i; state = S.newGame(LEVELS[i], 1); reward = null;
  track('level_start',{level:LEVELS[i].id}); go('play');
}
function act(input) {
  S.step(state,input);
  const e = state.events.at(-1), st = S.status(state);
  const messages = { blocked:'Another tram is in the way. Follow its arrow first.', 'lanes-full':'The lanes are full. Match the next passenger or undo.', 'nothing-to-undo':'No moves to undo yet.', undo:'Move undone. Try a new route.', shuffle:'Queue reshuffled. A fresh route is ready.', parked:'Tram parked. It will board when its colour is next.', served:'All aboard!' };
  if (st === 'won') {
    reward = S.recordClear(progress,LEVELS[index],state,LEVELS); progress = reward.progress;
    const saved = S.saveProgress(storage,progress); if (!saved.ok) warning(saved.error);
    track('level_complete',{level:LEVELS[index].id,stars:reward.stars});
    if (reward.firstClear) track('earned_reward',{level:LEVELS[index].id,tokens:reward.tokens});
    if (reward.chapterReward) track('chapter_complete',{chapter:1});
    sound(true); go('result');
    // Shell owns frequency caps. No ad is attached to retry, undo or rewards.
    busy = true; app.inert = true;
    Promise.resolve().then(()=>maybeInterstitial()).catch(()=>say('No ad available. Your reward is already saved.')).finally(()=>{busy=false;app.inert=false;});
  } else {
    if (st === 'lost') { track('level_failure',{level:LEVELS[index].id}); go('result'); }
    else { screen = 'play'; render(); }
    say(e?.type === 'shuffle-refused' ? e.reason === 'park-limit' ? 'Undo a move to get back within the parking limit.' : 'There is still a winning route. Try another tram or use undo.' : messages[e?.type] || '');
    if (e?.type === 'served' || e?.type === 'parked') sound();
  }
}
app.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b || busy) return;
  const a = b.dataset.action;
  if (a === 'tap') { if(screen==='play') act({tap:Number(b.dataset.id)}); }
  else if (a === 'undo' || a === 'shuffle') act({[a]:true});
  else if (a === 'continue') start(nextIndex());
  else if (a === 'level') start(Number(b.dataset.index));
  else if (a === 'next') start(index+1);
  else if (a === 'retry') { track('retry',{level:LEVELS[index].id}); start(index); }
  else if (a === 'settings') { from = screen; go('settings'); }
  else if (a === 'back') go(from);
  else if (a === 'resume') go('play');
  else go(a);
});
app.addEventListener('change', e => {
  const key = e.target.dataset.pref; if (!key) return;
  prefs[key] = e.target.checked;
  try { storage.setItem('tramqueue.settings.v1',JSON.stringify(prefs)); } catch { warning('Settings could not be saved. They will last only for this visit.'); }
  document.body.classList.toggle('reduced',prefs.reduced);
  document.body.classList.toggle('gold',prefs.gold && progress.unlocks.includes('livery-gold'));
});
addEventListener('keydown', e => { if(e.key==='Escape' && !busy) { if(screen==='play') go('pause'); else if(screen==='pause') go('play'); else if(screen==='settings') go(from); } });
document.addEventListener('visibilitychange',()=>{if(document.hidden && screen==='play') go('pause');});
// Read-only recorder snapshot, never a second route into the rules.
window.arcadeView = () => ({screen,level:LEVELS[index].id,levelNumber:index+1,state:state ? JSON.parse(JSON.stringify(state)) : null});
render();
initAds();
bannerOnScreens('screen',['home','result']);
