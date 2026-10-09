import { newGame, step, status, hint as nextHint } from './sim.mjs';
import { LEVELS, dailyLevel } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

// One simulation tick is one player action. All board changes go through step.
// Hints are free; no rewarded offer is needed for this first chapter.
const $ = id => document.getElementById(id);
const key = 'clearpath.progress.v1';
let saved = { completed: [], daily: '', sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
function storageWarning(text) { $('saveWarning').textContent = text; $('saveWarning').hidden = false; }
try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.completed)) throw new Error('Invalid save');
    saved.completed = data.completed.filter(id => Number.isInteger(id) && id >= 1 && id <= 10);
    saved.completed = [...new Set(saved.completed)];
    saved.daily = typeof data.daily === 'string' ? data.daily : '';
    if (typeof data.sound === 'boolean') saved.sound = data.sound;
    if (typeof data.reduced === 'boolean') saved.reduced = data.reduced;
  }
} catch { storageWarning('Saved progress could not be read. You can still play, but earlier progress may be unavailable.'); }
function save() {
  try { localStorage.setItem(key, JSON.stringify(saved)); }
  catch { storageWarning('Progress could not be saved on this device. Keep this tab open to keep your progress.'); }
}
let screen = 'home', state = null, level = null, daily = false, settingsFrom = 'home', busy = false, total = 0, session = 0;
let dayKey = '', toastTimer, audio;
const directions = ['', 'up', 'right', 'down', 'left'];
const track = (event, detail = {}) => window.arcade?.track?.(event, { game: 'clear-path', ...detail });
const panels = { home:'home', levels:'levels', play:'playScreen', pause:'pause', settings:'settings', over:'over' };
window.arcadeView = () => ({ screen, level: level?.id || 0, chapter: level?.chapter || 1, daily, remaining: state?.left, slips: state?.slips, state: state ? JSON.parse(JSON.stringify(state)) : null });
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3200); }
function tone(win = false) {
  if (!saved.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio = audio || new Audio(); audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(win ? 660 : 440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(win ? 990 : 580, audio.currentTime + .12);
    gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .23);
    oscillator.start(); oscillator.stop(audio.currentTime + .24);
  } catch { /* Audio is optional; gameplay remains available. */ }
}
function show(name) {
  screen = name; document.body.dataset.screen = name;
  Object.entries(panels).forEach(([key, id]) => $(id).hidden = key !== name);
  if (name === 'home') updateHome();
  if (name !== 'play') $(panels[name]).querySelector('button')?.focus({ preventScroll: true });
}
function nextLevel() { return LEVELS.find(l => !saved.completed.includes(l.id)) || LEVELS[9]; }
function unlocked(index) { return index === 0 || saved.completed.includes(LEVELS[index - 1].id); }
function today() {
  const date = new Date();
  return { key: `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`, seed: Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) / 86400000) };
}
function updateHome() {
  $('progressText').textContent = `${saved.completed.length} / 10 cleared`;
  $('campaignProgress').value = saved.completed.length;
  $('chapterStamp').hidden = saved.completed.length !== 10;
  $('play').textContent = saved.completed.length === 10 ? 'Revisit the finale' : `${saved.completed.length ? 'Continue' : 'Start'} level ${nextLevel().id}`;
  $('dailyButton').innerHTML = (saved.daily === today().key ? 'Daily board cleared' : 'Daily board') + '<span>↗</span>';
}
function selectLevels() {
  $('levelList').replaceChildren();
  LEVELS.slice(0,10).forEach((item,index) => {
    const button = document.createElement('button'), done = saved.completed.includes(item.id);
    button.disabled = !unlocked(index);
    button.innerHTML = `<b class="number">${String(item.id).padStart(2,'0')}</b><div>${item.name}<small>${done ? 'Cleared · replay anytime' : button.disabled ? 'Clear the previous board to unlock' : 'Ready when you are'}</small></div><span class="mark">${done ? '✓' : button.disabled ? '○' : '↗'}</span>`;
    button.onclick = () => start(item); $('levelList').append(button);
  });
  show('levels');
}
function start(item, isDaily = false) {
  if (busy) return;
  session++; level = item; daily = isDaily; state = newGame(item, 0); total = state.left;
  $('levelLabel').textContent = isDaily ? 'DAILY BOARD · ' + dayKey : `CHAPTER 01 · LEVEL ${item.id} / 10`;
  $('levelName').textContent = item.name;
  $('instruction').textContent = item.objective;
  render(); show('play');
  $('board').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  track('level_start', { level: item.id, chapter: item.chapter, daily });
}
function arrow(direction) { return `<svg viewBox="0 0 40 40" aria-hidden="true" style="transform:rotate(${(direction-1)*90}deg)"><path d="M20 31V9M10 19L20 9L30 19"/></svg>`; }
function render() {
  $('board').style.gridTemplateColumns = `repeat(${state.w},1fr)`;
  $('board').replaceChildren();
  state.cells.forEach((direction,index) => {
    const cell = document.createElement('button'); cell.className = 'cell' + (direction ? '' : ' empty');
    cell.disabled = !direction; cell.dataset.index = index;
    if (direction) {
      cell.innerHTML = arrow(direction); cell.setAttribute('aria-label', `Row ${Math.floor(index/state.w)+1}, column ${index%state.w+1}, arrow ${directions[direction]}`);
      cell.onclick = () => action({ tap: { x:index%state.w, y:Math.floor(index/state.w) } });
    } else cell.setAttribute('aria-label','Empty cell');
    $('board').append(cell);
  });
  $('remaining').textContent = state.left;
  const allowance = Math.max(0,state.maxSlips-state.slips);
  $('slips').textContent = allowance ? `${allowance} ${allowance === 1 ? 'slip' : 'slips'} left` : 'Next blocked tap ends the board';
  $('slips').classList.toggle('last-chance', allowance === 0);
  $('boardProgress').max = total; $('boardProgress').value = total - state.left;
  $('undo').disabled = !state.history.length || status(state) !== 'playing';
}
function highlight(points, className) {
  points.forEach(p => $('board').children[p.y*state.w+p.x]?.classList.add(className));
}
function action(input) {
  if (screen !== 'play' || busy || status(state) !== 'playing') return;
  const previous = input.tap ? state.cells[input.tap.y*state.w+input.tap.x] : 0;
  step(state,input); render();
  // Rebuilding the board must not strand keyboard players on the document.
  if (status(state) === 'playing') {
    const point = input.tap || state.last;
    const sameCell = $('board').children[point.y * state.w + point.x];
    const focusCell = sameCell && !sameCell.disabled ? sameCell : $('board').querySelector('button:not(:disabled)');
    focusCell?.focus({ preventScroll: true });
  }
  if (state.last.type === 'blocked') {
    highlight(state.last.blockers,'blocker');
    $('instruction').textContent = 'Blocked. The outlined arrows are in the way. Clear those paths first.';
    track('blocked_tap',{ level:level.id, slips:state.slips });
  } else if (state.last.type === 'slide') {
    tone(); $('instruction').textContent = state.left ? 'Space made. Find the next clear path.' : 'Every arrow is home.';
    if (!saved.reduced) {
      const cell = $('board').children[state.last.y*state.w+state.last.x];
      cell.innerHTML = arrow(previous); cell.className = 'cell departing';
      cell.style.setProperty('--dx', [0,0,350,0,-350][previous]+'px');
      cell.style.setProperty('--dy', [0,-350,0,350,0][previous]+'px');
    }
  } else if (input.undo) $('instruction').textContent = 'Arrow restored. Undo is free; used slips stay used.';
  if (status(state) !== 'playing') {
    busy = true; const currentSession = session;
    setTimeout(() => { if (currentSession !== session) return; busy = false; finish(); }, saved.reduced ? 0 : state.last.type === 'blocked' ? 1100 : 380);
  }
}
function finish() {
  const won = status(state) === 'won';
  if (won) {
    if (daily) saved.daily = dayKey;
    else if (!saved.completed.includes(level.id)) saved.completed.push(level.id);
    save(); track('level_complete',{level:level.id,chapter:level.chapter,daily,slips:state.slips,ticks:state.ticks}); tone(true);
  }
  track('level_end',{level:level.id,won,daily,slips:state.slips});
  const finale = won && !daily && level.id === 10;
  $('resultKicker').textContent = won ? finale ? 'CHAPTER COMPLETE' : 'A LITTLE MORE SPACE' : 'A PATH TO TRY AGAIN';
  $('resultTitle').textContent = won ? finale ? 'First Steps, mastered.' : 'Beautifully clear.' : 'That path was blocked.';
  $('resultText').textContent = won ? daily ? 'Today’s board is clear. A fresh one arrives tomorrow.' : finale ? 'Ten boards cleared. Your First Steps stamp is earned.' : 'One board lighter. One new challenge ahead.' : 'You used the slip allowance. Restart for a fresh board and use a free hint whenever you like.';
  $('resultStats').textContent = `${total-state.left} / ${total} arrows cleared · ${state.slips} slips`;
  const following = !daily && LEVELS[level.id];
  $('nextGoal').textContent = won ? following ? `Up next: ${following.name}. ${following.objective}` : 'Next goal: try the daily board or revisit a favourite.' : 'Tip: follow the arrow all the way to the edge before tapping.';
  $('next').textContent = won ? following ? `Play level ${following.id}` : daily ? 'Choose a level' : 'Play the daily board' : 'Try again';
  $('next').onclick = () => { if(busy)return; if (!won) start(level,daily); else if(following) start(following); else if(daily) selectLevels(); else startDaily(); };
  $('retry').hidden = !won; $('celebration').textContent = won ? '✦' : '↶';
  if (won && !saved.reduced) for(let i=0;i<(finale?36:18);i++) {
    const piece=document.createElement('i'), angle=i*2.4;
    piece.style.cssText=`--x:${Math.cos(angle)*140}px;--y:${Math.sin(angle)*90}px;--angle:${i*51}deg;--colour:${['#548164','#e2ad70','#b5d47e'][i%3]}`;
    $('celebration').append(piece);
  }
  show('over');
  busy=true;
  Promise.resolve().then(() => maybeInterstitial()).catch(() => toast('No ad this time.')).finally(() => { busy=false; });
}
function startDaily() { if(busy)return; const day=today(); dayKey=day.key; start(dailyLevel(day.seed),true); }
function home() { if(busy)return; session++; show('home'); }
function settings(from) { if(busy)return; settingsFrom=from; show('settings'); }
$('play').onclick=()=>start(nextLevel()); $('dailyButton').onclick=startDaily; $('levelsButton').onclick=selectLevels;
$('settingsButton').onclick=()=>settings('home'); $('pauseSettings').onclick=()=>settings('pause');
$('settingsBack').onclick=()=>show(settingsFrom);
$('pauseButton').onclick=()=>{if(!busy)show('pause');}; $('resume').onclick=()=>show('play');
$('restart').onclick=()=>start(level,daily); $('retry').onclick=()=>start(level,daily);
document.querySelectorAll('[data-home]').forEach(button=>button.onclick=home);
$('undo').onclick=()=>action({undo:true});
$('hint').onclick=()=>{
  if(busy || screen!=='play' || status(state)!=='playing')return;
  const point=nextHint(state); if(!point)return;
  highlight([point],'hinted'); $('instruction').textContent='The green outlined arrow has a clear path. Tap it when you are ready.';
  track('hint_used',{level:level.id});
};
$('sound').checked=saved.sound; $('motion').checked=saved.reduced;
document.body.classList.toggle('reduced',saved.reduced);
$('sound').onchange=()=>{saved.sound=$('sound').checked;save();tone();};
$('motion').onchange=()=>{saved.reduced=$('motion').checked;document.body.classList.toggle('reduced',saved.reduced);save();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play'&&!busy)show('pause');});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||busy)return;
  if(screen==='play')show('pause');else if(screen==='pause')show('play');else if(screen==='settings')show(settingsFrom);else home();
});
mountRemoveAds($('menuActions'),{className:'quiet',toast});
mountRemoveAds($('settingsActions'),{before:$('settingsBack'),className:'quiet',toast});
initAds(); bannerOnScreens('screen',['home','over']); updateHome();
