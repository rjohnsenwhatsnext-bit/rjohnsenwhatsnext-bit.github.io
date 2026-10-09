import { newGame, step, status, hint as nextHint, WALL, GATE, gatesOpen } from './sim.mjs';
import { LEVELS, dailyLevel } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

// One simulation tick is one player action. All board changes go through step.
// Hints are free; no rewarded offer is needed for these chapters.
const $ = id => document.getElementById(id);
const key = 'clearpath.progress.v1';
let saved = { completed: [], daily: '', sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
function storageWarning(text) { $('saveWarning').textContent = text; $('saveWarning').hidden = false; }
try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.completed)) throw new Error('Invalid save');
    saved.completed = data.completed.filter(id => Number.isInteger(id) && id >= 1 && LEVELS.some(level => level.id === id));
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
const chapters = {
  1: { name: 'First Steps', place: 'Find an opening. Make some space.' },
  2: { name: 'Walls', place: 'The sunlit courtyard. Find a way past the stone.' },
  3: { name: 'Sturdy', place: 'The dusk quarry. Crack the shell. Open the path.' },
  4: { name: 'Gates', place: 'The moonlit canal. Make space. Lift the gates.' },
};
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
function nextLevel() { return LEVELS.find(l => !saved.completed.includes(l.id)) || LEVELS[LEVELS.length - 1]; }
function unlocked(index) { return index === 0 || saved.completed.includes(LEVELS[index - 1].id); }
function today() {
  const date = new Date();
  return { key: `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`, seed: Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) / 86400000) };
}
function updateHome() {
  document.body.dataset.chapter = nextLevel().chapter;
  $('progressText').textContent = `${saved.completed.length} / ${LEVELS.length} cleared`;
  $('campaignProgress').max = LEVELS.length;
  $('campaignProgress').value = saved.completed.length;
  const firstDone = LEVELS.slice(0,10).every(item => saved.completed.includes(item.id));
  const wallsDone = LEVELS.slice(10,20).every(item => saved.completed.includes(item.id));
  $('chapterStamp').hidden = !firstDone;
  const sturdyDone = LEVELS.slice(20,30).length === 10 && LEVELS.slice(20,30).every(item => saved.completed.includes(item.id));
  const gatesDone = LEVELS.slice(30,40).length === 10 && LEVELS.slice(30,40).every(item => saved.completed.includes(item.id));
  $('chapterStamp').textContent = gatesDone ? 'Four chapter stamps earned. Forty boards cleared.' : sturdyDone ? 'Sturdy mastered. Chapter 4: Gates is open.' : wallsDone ? 'Walls mastered. Chapter 3: Sturdy is open.' : 'First Steps mastered. Chapter 2: Walls is open.';
  $('play').textContent = saved.completed.length === LEVELS.length ? 'Revisit the finale' : `${saved.completed.length ? 'Continue' : 'Start'} level ${nextLevel().id}`;
  $('dailyButton').innerHTML = (saved.daily === today().key ? 'Daily board cleared' : 'Daily board') + '<span>↗</span>';
}
function selectLevels() {
  $('levelList').replaceChildren();
  LEVELS.forEach((item,index) => {
    if (index % 10 === 0) {
      const heading = document.createElement('div');
      heading.className = 'chapter-heading chapter-' + item.chapter;
      const count = LEVELS.filter(l => l.chapter === item.chapter && saved.completed.includes(l.id)).length;
      heading.innerHTML = `<p class="eyebrow">CHAPTER 0${item.chapter} / ${count} / 10 CLEARED</p><h3>${chapters[item.chapter].name}</h3><p>${chapters[item.chapter].place}</p><small>${unlocked(index) ? 'Chapter open' : `Clear level ${index} to open this chapter`}</small>`;
      $('levelList').append(heading);
    }
    const button = document.createElement('button'), done = saved.completed.includes(item.id);
    button.disabled = !unlocked(index);
    button.classList.toggle('walls-level', item.chapter === 2);
    button.classList.toggle('sturdy-level', item.chapter === 3);
    button.classList.toggle('gates-level', item.chapter === 4);
    button.innerHTML = `<b class="number">${String(item.id).padStart(2,'0')}</b><div>${item.name}<small>${done ? 'Cleared · replay anytime' : button.disabled ? 'Clear the previous board to unlock' : 'Ready when you are'}</small></div><span class="mark">${done ? '✓' : button.disabled ? '○' : '↗'}</span>`;
    button.onclick = () => start(item); $('levelList').append(button);
  });
  show('levels');
}
function start(item, isDaily = false) {
  if (busy) return;
  session++; level = item; daily = isDaily; state = newGame(item, 0); total = state.left;
  document.body.dataset.chapter = item.chapter;
  $('wallLegend').hidden = !state.cells.includes(WALL);
  $('sturdyLegend').hidden = !state.cells.some(cell => cell >= 6 && cell <= 9);
  $('gateLegend').hidden = !state.cells.includes(GATE);
  $('levelLabel').textContent = isDaily ? 'DAILY BOARD · ' + dayKey : `CHAPTER 0${item.chapter} · LEVEL ${item.id} / ${LEVELS.length}`;
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
    cell.disabled = !direction || direction === WALL || direction === GATE; cell.dataset.index = index;
    if (direction === WALL) {
      cell.classList.add('wall');
      cell.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 7H34V33H6ZM6 20H34M20 7V20M14 20V33"/></svg>';
      cell.setAttribute('aria-label', `Row ${Math.floor(index/state.w)+1}, column ${index%state.w+1}, permanent wall`);
    } else if (direction === GATE) {
      const open = gatesOpen(state);
      cell.classList.add('gate');
      cell.classList.toggle('gate-open', open);
      cell.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path class="gate-posts" d="M6 32V8H10M30 8H34V32"/><path class="gate-bars" d="M14 11V29M20 11V29M26 11V29M10 15H30M10 25H30"/><path class="gate-clear" d="M14 21L18 25L27 15"/></svg>';
      cell.setAttribute('aria-label', `Row ${Math.floor(index/state.w)+1}, column ${index%state.w+1}, gate ${open ? 'open, arrows can pass' : 'shut, opens at '+state.gateAt+' arrows left'}`);
    } else if (direction) {
      const sturdy = direction >= 6 && direction <= 9;
      const facing = sturdy ? direction - 5 : direction;
      cell.classList.toggle('sturdy', sturdy);
      cell.innerHTML = arrow(facing) + (sturdy ? '<i class="sturdy-pip" aria-hidden="true"></i>' : '');
      cell.setAttribute('aria-label', `Row ${Math.floor(index/state.w)+1}, column ${index%state.w+1}, ${sturdy ? 'sturdy arrow' : 'arrow'} ${directions[facing]}${sturdy ? ', two taps when clear' : ''}`);
      cell.onclick = () => action({ tap: { x:index%state.w, y:Math.floor(index/state.w) } });
    } else cell.setAttribute('aria-label','Empty cell');
    $('board').append(cell);
  });
  $('remaining').textContent = state.left;
  if (state.cells.includes(GATE)) {
    const open = gatesOpen(state), needed = Math.max(0, state.left - state.gateAt);
    $('gateLegend').classList.toggle('is-open', open);
    $('gateLegend').textContent = open ? 'GATES OPEN: Arrows can pass through. Undo can close them.' : `GATES SHUT: Clear ${needed} more ${needed === 1 ? 'arrow' : 'arrows'}. Open at ${state.gateAt} left.`;
  }
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
  const wereOpen = gatesOpen(state);
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
    $('instruction').textContent = state.last.blockers.some(p => state.cells[p.y * state.w + p.x] === GATE) ? `Blocked by a shut gate. Clear other arrows until ${state.gateAt} remain. Cracking a shell does not lower the count.` : state.last.blockers.some(p => state.cells[p.y * state.w + p.x] === WALL) ? 'Blocked by stone. Walls stay put. Look for an arrow with an open path to the edge.' : 'Blocked. The outlined arrows are in the way. Clear those paths first.';
    track('blocked_tap',{ level:level.id, slips:state.slips });
  } else if (state.last.type === 'crack') {
    tone(); highlight([state.last], 'cracked');
    $('instruction').textContent = 'Shell cracked. The arrow is still here. Tap it again to slide it away.';
  } else if (state.last.type === 'slide') {
    tone(); $('instruction').textContent = state.left ? 'Space made. Find the next clear path.' : 'Every arrow is home.';
    if (!saved.reduced) {
      const cell = $('board').children[state.last.y*state.w+state.last.x];
      cell.innerHTML = arrow(previous); cell.className = 'cell departing';
      cell.style.setProperty('--dx', [0,0,350,0,-350][previous]+'px');
      cell.style.setProperty('--dy', [0,-350,0,350,0][previous]+'px');
    }
  } else if (input.undo) $('instruction').textContent = 'Last move restored, including any shell. Undo is free; used slips stay used.';
  if (wereOpen !== gatesOpen(state)) {
    $('instruction').textContent = gatesOpen(state) ? 'The gates are open. Follow the new paths through the canal.' : 'Move restored. The gates are shut again until enough arrows leave.';
    if (gatesOpen(state)) {
      $('board').querySelectorAll('.gate').forEach(cell => cell.classList.add('gate-lift'));
      tone(true);
    }
  }
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
  const finale = won && !daily && level.id % 10 === 0;
  const followingChapter = finale && chapters[level.chapter + 1];
  $('chapterUnlock').hidden = !finale;
  $('chapterUnlock').textContent = followingChapter
    ? `CHAPTER 0${level.chapter + 1} UNLOCKED: ${followingChapter.name}\n${followingChapter.place}`
    : 'GATES MASTERED\nYour canal stamp is earned. All 40 boards are open to replay.';
  $('chapterUnlock').classList.toggle('quarry-unlock', finale && level.id === 20);
  $('chapterUnlock').classList.toggle('canal-unlock', finale && level.id >= 30);
  $('resultKicker').textContent = won ? finale ? 'CHAPTER COMPLETE' : 'A LITTLE MORE SPACE' : 'A PATH TO TRY AGAIN';
  $('resultTitle').textContent = won ? finale ? `${chapters[level.chapter].name}, mastered.` : 'Beautifully clear.' : 'That path was blocked.';
  $('resultText').textContent = won ? daily ? 'The daily board is clear. A fresh one arrives tomorrow.' : finale ? (followingChapter ? `Chapter ${level.chapter} complete. Your stamp is earned. A new place awaits.` : 'Four chapters complete. Every canal gate opened. Your fourth stamp is earned.') : 'One board lighter. One new challenge ahead.' : 'You used the slip allowance. Restart for a fresh board and use a free hint whenever you like.';
  $('resultStats').textContent = `${total-state.left} / ${total} arrows cleared · ${state.slips} slips`;
  const following = !daily && LEVELS[level.id];
  $('nextGoal').textContent = won ? following ? `Up next: ${following.name}. ${following.objective}` : 'Next goal: try the daily board or revisit a favourite.' : 'Tip: follow the arrow all the way to the edge before tapping.';
  $('next').textContent = won ? following ? `Play level ${following.id}` : daily ? 'Choose a level' : 'Play the daily board' : 'Try again';
  $('next').onclick = () => { if(busy)return; if (!won) start(level,daily); else if(following) start(following); else if(daily) selectLevels(); else startDaily(); };
  $('retry').hidden = !won; $('celebration').textContent = won ? '✦' : '↶';
  if (won && !saved.reduced) for(let i=0;i<(finale?36:18);i++) {
    const piece=document.createElement('i'), angle=i*2.4;
    piece.style.cssText=`--x:${Math.cos(angle)*140}px;--y:${Math.sin(angle)*90}px;--angle:${i*51}deg;--colour:${(level.chapter === 4 || (finale && level.id === 30) ? ['#397d89','#d3ad59','#9ad9ca'] : ['#548164','#e2ad70','#b5d47e'])[i%3]}`;
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
  highlight([point],'hinted'); $('instruction').textContent = state.cells[point.y * state.w + point.x] >= 6 ? 'The green outlined sturdy arrow has a clear path. Tap once to crack, then again to slide.' : 'The green outlined arrow has a clear path. Tap it when you are ready.';
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
