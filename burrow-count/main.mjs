import * as S from './sim.mjs';
import { LEVELS } from './levels.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, hasUnit, bannerOnScreens } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const app = document.querySelector('#app');
const chapter = LEVELS;
const chapterNames = {1:'The neighbour trail', 2:'The lantern tunnels', 3:'The amber crossroads', 4:'The heather hilltops', 5:'The crystal warren'};
let selectedClue = null;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let screen = 'home', state = null, index = 0, reward = null, busy = false, settingsFrom = 'home';
let storage, progress = S.newProgress();
const prefs = {sound:true, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, look:'original', hat:false, lantern:false, signpost:false, lookout:false, crest:false};
function warning(text) { const el = document.querySelector('#save-warning'); el.textContent = text; el.hidden = !text; }
function notice(text) { document.querySelector('#notice').textContent = text; }
try {
  storage = localStorage;
  const loaded = S.loadProgress(storage); progress = loaded.progress;
  if (loaded.error) warning(loaded.error);
  const raw = storage.getItem('burrowcount.settings.v1');
  if (raw) { const saved = JSON.parse(raw); for (const key of ['sound','reduced','hat','lantern','signpost','lookout','crest']) if (typeof saved[key] === 'boolean') prefs[key] = saved[key]; if (typeof saved.look === 'string') prefs.look = saved.look; }
} catch { warning('Saved progress or settings could not be read. Keep this game open to keep your progress.'); }
if (!progress.unlocks.includes(prefs.look)) prefs.look = 'original';
if (!progress.unlocks.includes('keeper-hat')) prefs.hat = false;
if (!progress.unlocks.includes('tunnel-lantern')) prefs.lantern = false;
if (!progress.unlocks.includes('crossroads-signpost')) prefs.signpost = false;
if (!progress.unlocks.includes('hilltop-lookout')) prefs.lookout = false;
if (!progress.unlocks.includes('grand-warren-crest')) prefs.crest = false;
const session = Date.now().toString(36);
const returningPlayer = Object.keys(progress.levels).length > 0;
function track(event, data = {}) { try { window.arcade?.track?.(event, {session, returning:returningPlayer, ...data}); } catch { /* Optional telemetry must never interrupt play. */ } }
function save() { const result = S.saveProgress(storage, progress); if (!result.ok) warning(result.error); }
function savePrefs() { try { storage.setItem('burrowcount.settings.v1', JSON.stringify(prefs)); } catch { warning('Settings could not be saved on this device.'); } }
let audio;
function tone(win = false) {
  if (!prefs.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    for (let n = 0; n < (win ? 3 : 1); n++) { const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + n * .11; osc.type = 'sine'; osc.frequency.value = [440,554,659][n]; gain.gain.setValueAtTime(.055,t); gain.gain.exponentialRampToValueAtTime(.001,t+.18); osc.connect(gain).connect(audio.destination); osc.start(t); osc.stop(t+.2); }
  } catch { /* Sound is optional on devices without Web Audio. */ }
}
function critter() { return `<span class="critter ${esc(prefs.look)} ${prefs.hat ? 'hatted' : ''} ${prefs.lantern ? 'lantern-equipped' : ''} ${prefs.signpost ? 'signpost-equipped' : ''} ${prefs.lookout ? 'lookout-equipped' : ''} ${prefs.crest ? 'crest-equipped' : ''}" aria-hidden="true"><i></i><b></b><span class="lantern" hidden></span><span class="signpost" hidden></span><span class="lookout" hidden></span><span class="crest" hidden></span></span>`; }
function button(text, action, cls = '', disabled = false) { return `<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`; }
function heading(kicker, title) { return `<header><p class="eyebrow">${kicker}</p><h1 tabindex="-1">${title}</h1></header>`; }
function nextGoal() { const next = S.nextUnlock(progress); return next ? `<div class="goal"><span>Next look: <b>${esc(next.name)}</b></span><progress value="${next.have}" max="${next.need}" aria-label="Stars towards next look"></progress><small>${next.have} / ${next.need} stars. ${next.left} to go.</small></div>` : `<div class="goal">Every critter colour unlocked! ${S.totalStars(progress)} / ${chapter.length * 3} stars collected.</div>`; }
function resumeIndex() { const next = chapter.findIndex(l => !progress.levels[l.id]); return next < 0 ? 0 : next; }
function show(name, focus = true) {
  screen = name; document.body.dataset.chapter = (['play','pause','result'].includes(name) ? state?.level.chapter : chapter[resumeIndex()].chapter) || 1; document.body.dataset.screen = name; document.body.classList.toggle('reduced', prefs.reduced); notice('');
  if (name === 'home') {
    const cleared = chapter.filter(l=>progress.levels[l.id]).length;
    app.innerHTML = `<section class="home">${heading('TOVELLY • A LITTLE POCKET OF LOGIC','Burrow<br><em>Count</em>')}<div class="woodland" aria-hidden="true"><span class="sun"></span><span class="sprig left"></span><span class="sprig right"></span><div class="burrow">${critter()}</div><span class="pebble one">1</span><span class="pebble two">2</span></div><p class="intro">Find where every critter hides.<br>One region. One critter. All clues happy.</p><div class="stats"><span><b>${cleared}/${chapter.length}</b> burrows cleared</span><span><b>${S.totalStars(progress)} ★</b> stars</span><span><b>${progress.coins}</b> coins</span></div>${nextGoal()}<div class="actions" id="menu-actions">${button(state && S.status(state)==='playing'?'Resume puzzle':cleared===chapter.length?'Revisit the burrows':'Play level '+(resumeIndex()+1),'continue','primary')}${button('Choose a burrow','levels')}${button('Settings & looks','settings','quiet')}</div><p class="footnote">Five trails, fifty burrows<br>Pure logic, no guessing.</p></section>`;
    mountRemoveAds(document.querySelector('#menu-actions'), {className:'quiet', toast:notice});
  } else if (name === 'levels') {
    app.innerHTML = `<section>${heading('YOUR BURROW MAP','Five trails to explore')}<p>Clear each burrow to open the next. Replay any cleared puzzle for free.</p>${[1,2,3,4,5].map(ch => {
      const entries = chapter.map((l,i)=>({l,i})).filter(({l})=>l.chapter===ch), cleared=entries.filter(({l})=>progress.levels[l.id]).length, prize=S.CHAPTER_REWARDS[ch];
      return `<div class="chapter-map chapter-${ch}"><p class="eyebrow">CHAPTER ${ch} / ${cleared} / ${entries.length} CLEARED</p><h2>${chapterNames[ch]}</h2><p>${ch===1?'Numbers count touching critters, including corners.':ch===5?'Enter the crystal warren. Diagonal clues marked x count critters on all four diagonals, right to the edges.':ch===4?'Climb the heather hilltops. Jump clues marked ~ count cells two steps one way and one step sideways.':ch===3?'Follow the amber paths through the mist. Line clues marked + count their whole row and column.':'Follow the lanterns underground. Wide clues marked * count up to two cells away, including diagonals.'}</p>${ch>1?`<p class="chapter-access">${S.isUnlocked(progress,chapter,entries[0].i)?'Trail unlocked. Your next adventure is ready.':'Clear '+esc(chapter[entries[0].i-1].name)+' (level '+entries[0].i+') to open this trail.'}</p>`:''}<div class="level-list">${entries.map(({l,i})=>{const unlocked=S.isUnlocked(progress,chapter,i), earned=progress.levels[l.id]?.stars || 0;return `<button class="level ${earned?'cleared':''}" data-level="${i}" ${unlocked?'':'disabled'}><span class="level-number">${i+1}</span><span><b>${esc(l.name)}</b><small>${unlocked?(earned?'&#9733;'.repeat(earned)+'&#9734;'.repeat(3-earned):(i+1)%10===0?'Chapter finale':'Ready to explore'):'Clear level '+i+' to unlock'}</small></span><span aria-hidden="true">${unlocked?'&rsaquo;':'&bull;'}</span></button>`;}).join('')}</div><div class="goal"><b>${progress.chapters[ch]?'Chapter reward collected':'Your chapter reward'}</b><p>${prize.coins} coins + ${esc(prize.name)}</p><small>${cleared} / ${entries.length} burrows cleared</small></div></div>`;
    }).join('')}${button('Back to menu','home','quiet')}</section>`;
  } else if (name === 'play') renderPlay();
  else if (name === 'pause') app.innerHTML = `<section class="centred">${heading('TAKE YOUR TIME','A quiet moment')}${critter()}<p>Your critters are right where you left them.</p><div class="actions">${button('Resume puzzle','resume','primary')}${button('Settings & looks','settings')}${button('Retry level for free','retry')}${button('Main menu','home','quiet')}</div></section>`;
  else if (name === 'settings') {
    app.innerHTML = `<section>${heading('MAKE YOURSELF AT HOME','Settings & looks')}<label class="setting">Sound <input type="checkbox" data-pref="sound" ${prefs.sound?'checked':''}></label><label class="setting">Reduced motion <input type="checkbox" data-pref="reduced" ${prefs.reduced?'checked':''}></label><h2>Your critters</h2><div class="looks">${[{id:'original',name:'Woodland critters'},...S.UNLOCKS].map(u=>button(esc(u.name)+(prefs.look===u.id?' • Equipped':progress.unlocks.includes(u.id)||u.id==='original'?'':' • '+u.stars+' stars'),'look:'+u.id,'',u.id!=='original'&&!progress.unlocks.includes(u.id))).join('')}</div><label class="setting">Burrow Keeper hat <input type="checkbox" data-pref="hat" ${prefs.hat?'checked':''} ${progress.unlocks.includes('keeper-hat')?'':'disabled'}></label><small>Earn the hat by clearing chapter 1.</small><label class="setting">Tunnel lantern <input type="checkbox" data-pref="lantern" ${prefs.lantern?'checked':''} ${progress.unlocks.includes('tunnel-lantern')?'':'disabled'}></label><small>Clear chapter 2 to carry a glowing lantern.</small><label class="setting">Crossroads signpost <input type="checkbox" data-pref="signpost" ${prefs.signpost?'checked':''} ${progress.unlocks.includes('crossroads-signpost')?'':'disabled'}></label><small>Clear chapter 3 to carry your own little trail marker.</small><label class="setting">Hilltop lookout <input type="checkbox" data-pref="lookout" ${prefs.lookout?'checked':''} ${progress.unlocks.includes('hilltop-lookout')?'':'disabled'}></label><small>Clear chapter 4 to equip a miniature lookout with a summit flag.</small><label class="setting">Grand Warren crest <input type="checkbox" data-pref="crest" ${prefs.crest?'checked':''} ${progress.unlocks.includes('grand-warren-crest')?'':'disabled'}></label><small>Clear chapter 5 to wear a copper crest with a crystal heart.</small><div class="look-preview">${critter()}</div>${nextGoal()}<details><summary>How to play & earn stars</summary><p>Tap a coloured cell to place a critter. Tap it again to lift it, or another cell in its region to move it. Region letters help you tell the colours apart.</p><p>A plain number counts critters in the eight cells around it, including corners. A wide clue marked * counts every cell up to two rows and two columns away. A line clue marked + counts every critter in its whole row and column, with no diagonals. A jump clue marked ~ counts cells two steps in one direction and one step sideways, in any orientation. It does not count touching cells. A diagonal clue marked x counts every critter on its four diagonals, right to the edges. Its row and column do not count. Tap any clue to see its reach. Match every clue and put one critter in each region to win. Going over a clue uses a mistake. Undo is free, but does not refund mistakes.</p><p>Earn one star for clearing, one for no mistakes and one for no hints. First clears earn 10 coins plus 5 per star. Replays earn 5 coins only for each improved star. Coins are a keepsake tally, with no shop in this chapter.</p></details><div class="actions" id="settings-actions">${button('Done','settings-back','primary')}</div></section>`;
    mountRemoveAds(document.querySelector('#settings-actions'), {before:document.querySelector('[data-action="settings-back"]'), className:'quiet', toast:notice});
  } else if (name === 'result') renderResult();
  if (focus) app.querySelector('h1')?.focus({preventScroll:true});
}
function renderPlay() {
  const L = state.level, counts = S.clueCounts(L,state.placed), h=state.hint;
  const activeClue = selectedClue ?? (h?.clue ? L.clues.findIndex(k=>k.r===h.clue[0]&&k.c===h.clue[1]) : null);
  const inspected = selectedClue != null ? L.clues[selectedClue] : null;
  const clueExplanation = inspected ? `${inspected.diag ? 'Diagonal clue (all four diagonals to the edges)' : inspected.jump ? 'Jump clue (two steps then one sideways)' : inspected.line ? 'Line clue (whole row and column)' : inspected.reach > 1 ? 'Wide clue' : 'Neighbour clue'} at row ${inspected.r + 1}, column ${inspected.c + 1}: ${counts[selectedClue]} of ${inspected.n} critters. Outlined cells show the cells it counts. Tap this clue again to hide its reach.` : '';
  const reach = activeClue != null && L.clues[activeClue] ? new Set(S.clueNear(L,L.clues[activeClue])) : new Set();
  app.innerHTML = `<section class="play"><div class="play-top"><span class="eyebrow">BURROW ${index+1} / ${chapter.length}</span>${button('Pause','pause','quiet')}</div>${heading(chapterNames[L.chapter].toUpperCase(),esc(L.name))}<p class="objective">${esc(L.objective)}</p><div class="hud"><span>${state.placed.filter(i=>i>=0).length} / ${L.regionCount} critters</span><span>${S.livesLeft(state)} mistakes left</span></div><div class="board" style="--cols:${L.cols}" role="group" aria-label="Puzzle grid">${L.region.map((g,i)=>{
    const r=Math.floor(i/L.cols),c=i%L.cols,k=L.clues.findIndex(x=>x.r===r&&x.c===c), hintCell=h?.cell[0]===r&&h?.cell[1]===c, hintClue=h?.clue?.[0]===r&&h?.clue?.[1]===c;
    if (g<0) { const clue=L.clues[k], wide=clue.reach>1, line=!!clue.line, jump=!!clue.jump, diag=!!clue.diag; return `<button data-clue="${k}" aria-pressed="${activeClue===k}" class="cell clue ${diag?'diag':jump?'jump':line?'line':wide?'wide':''} ${counts[k]===clue.n?'matched':''} ${counts[k]>clue.n?'over':''} ${hintClue||activeClue===k?'hint-clue':''}" aria-label="Row ${r+1}, column ${c+1}, ${diag?'diagonal ':jump?'jump ':line?'line ':wide?'wide ':''}clue ${clue.n}, currently ${counts[k]}, counts ${diag?'all four diagonals to the edges, not its row or column':jump?'cells two steps one way and one sideways, not touching cells':line?'its whole row and column, no diagonals':`within ${wide?2:1} cells including diagonals`}. Show reach"><b>${clue.n}${diag?'<sup>x</sup>':jump?'<sup>~</sup>':line?'<sup>+</sup>':wide?'<sup>*</sup>':''}</b><small>${counts[k]} ${diag?'on slants':jump?'in reach':line?'in line':'nearby'}</small></button>`; }

    const placed=state.placed[g]===i;
    return `<button class="cell region r${g} ${reach.has(i)?'in-reach':''} ${hintCell?'hint-cell':''}" data-cell="${i}" aria-pressed="${placed}" aria-label="Region ${String.fromCharCode(65+g)}, row ${r+1}, column ${c+1}${placed?', critter placed':''}"><span class="region-label">${String.fromCharCode(65+g)}</span>${placed?critter():'<span class="soil" aria-hidden="true">·</span>'}</button>`;
  }).join('')}</div><p class="board-note">${L.chapter===5?'x Diagonal: slants to the edges. ~ Jump: 2 then 1. + Line: row and column. * Wide: 2 cells. Plain: touching.':L.chapter===4?'~ Jump: 2 steps then 1 sideways. + Line: row and column. * Wide: 2 cells. Plain: touching.':L.chapter===3?'+ Line: whole row and column. * Wide: 2 cells. Plain: touching.':L.chapter===2?'* Wide: up to 2 cells away. Plain: touching cells.':'One critter per letter. Corners count too.'} Tap a clue to see its reach.</p><div class="play-tools">${button('↶ Undo','undo','',!state.history.length)}${button('Show me why','hint')}</div><div class="hint" role="status">${inspected?esc(clueExplanation):h?`<b>${h.kind==='conflict'?'Check':'Try'} row ${h.cell[0]+1}, column ${h.cell[1]+1}</b><br>${esc(h.text)}`:state.events.some(e=>e.type==='mistake')?'That placement goes over a clue. Lift or move a critter, or undo.':L.chapter===5&&index<42?'Tap a copper clue marked x. Follow the outlined cells diagonally in all four directions to the edges. Its row and column do not count. Each region still needs one critter.':L.chapter===4&&index<32?'Tap a purple clue marked ~. Count only the outlined landing cells: two steps up, down, left or right, then one sideways. The cells you pass over do not count. Each region still needs one critter.':L.chapter===3&&index<22?'Tap a teal clue marked +. Its number counts all critters along its row and column, right to the edges. Diagonals do not count. Each region still needs one critter.':L.chapter===2&&index<12?'Tap a gold clue marked * to explore its reach. It counts critters up to two rows and two columns away, including diagonals. Each region still needs just one critter.':index<2?'Tap a coloured square. The small count below each number shows how many critters touch it.':'Hints explain a cell. Using one gives up the no-hint star for this attempt.'}</div></section>`;
}
function renderResult() {
  const won=S.status(state)==='won', big=!!reward?.chapter;
  app.innerHTML=`<section class="centred result ${won?'celebrate':''} ${big?'chapter-win':''}">${heading(big?(state.level.chapter===5?'CAMPAIGN COMPLETE':'CHAPTER COMPLETE'):won?'A HAPPY LITTLE HABITAT':'THERE IS ANOTHER WAY',big?(state.level.chapter===5?'Keeper of the crystal warren':state.level.chapter===4?'Keeper of the hilltops':state.level.chapter===3?'Keeper of the crossroads':state.level.chapter===2?'Light of the tunnels':'Keeper of the burrows'):won?'Everyone is home!':'A fresh pair of eyes')}${critter()}${won?`<div class="stars" aria-label="${reward.stars} out of 3 stars">${'★'.repeat(reward.stars)}<span>${'☆'.repeat(3-reward.stars)}</span></div><p>${reward.firstClear?'First clear':reward.newStars?'New personal best':'A lovely return visit'} • +${reward.coins} coins</p><p>${state.mistakes===0?'✓':'○'} No mistakes &nbsp; ${state.hints===0?'✓':'○'} No hints</p>${big?`<div class="chapter-prize">${reward.chapter.coins} chapter coins + ${esc(reward.chapter.name)}<br><small>Equip your reward in Settings & looks.</small></div>`:''}${big&&state.level.chapter===1?'<div class="trail-reveal"><span aria-hidden="true">&#10022;</span><b>Chapter 2 unlocked</b><p>The lantern tunnels await. Discover wide clues in ten new burrows.</p></div>':''}${big&&state.level.chapter===2?'<div class="trail-reveal crossroads-reveal"><span aria-hidden="true">+</span><b>Chapter 3 unlocked</b><p>The amber crossroads await. Follow whole rows and columns through ten new burrows.</p></div>':''}${big&&state.level.chapter===3?'<div class="trail-reveal crossroads-reveal"><span aria-hidden="true">&#10022;</span><b>Chapter 4 unlocked</b><p>The heather hilltops await. Discover jump clues in ten new burrows. Your Crossroads signpost is ready to equip.</p></div>':''}${big&&state.level.chapter===4?'<div class="trail-reveal hilltop-reveal"><span aria-hidden="true">~</span><b>Chapter 5 unlocked</b><p>The crystal warren awaits. Follow diagonal clues through ten final burrows. Your Hilltop lookout is ready to equip.</p></div>':''}${big&&state.level.chapter===5?'<div class="trail-reveal crystal-reveal"><span aria-hidden="true">&#10023;</span><b>All fifty burrows are home</b><p>Your Grand Warren crest is earned. Equip its crystal heart in Settings & looks, then revisit your favourite burrows.</p></div>':''}${reward.unlocks.length?`<p class="chapter-prize">New critter looks unlocked! Find them in Settings & looks.</p>`:''}`:'<p>You used all your mistakes. Retry for free, or use Show me why to follow the clues.</p>'}${nextGoal()}<div class="actions">${won&&index<chapter.length-1?button('Next: '+esc(chapter[index+1].name),'next','primary'):button(won?'Choose a burrow':'Try again',''+(won?'levels':'retry'),'primary')}${won?button('Replay for free','retry'):''}${won&&adsAvailable()&&hasUnit('rewarded')&&!progress.bonus[state.level.id]?button('Watch an ad • +10 keepsake coins','bonus','quiet'):''}${button('Settings & looks','settings','quiet')}${button('Main menu','home','quiet')}</div>${won&&index===chapter.length-1?'<p class="footnote">Five trails complete! Replay freely to collect all 150 stars.</p>':''}</section>`;
}
function start(i) {
  if (busy || !chapter[i] || !S.isUnlocked(progress,chapter,i)) return;
  index=i; selectedClue=null; state=S.newGame(chapter[i],1); reward=null; tone(); track('level_start',{level:state.level.id}); show('play');
}
async function finish() {
  const won=S.status(state)==='won';
  if(won) { const result=S.recordClear(progress,state.level,state,chapter.filter(l=>l.chapter===state.level.chapter).map(l=>l.id)); progress=result.progress; reward=result.reward; save(); track('earned_reward',{level:state.level.id,coins:reward.coins,new_stars:reward.newStars}); if(reward.chapter) track('chapter_completion',{chapter:state.level.chapter}); }
  track(won?'level_completion':'level_failure',{level:state.level.id,stars:S.stars(state),mistakes:state.mistakes,hints:state.hints}); tone(won); show('result');
  busy=true; app.setAttribute('inert','');
  try { await maybeInterstitial(); } catch { notice('Ad unavailable. You can keep playing.'); } finally { busy=false; app.removeAttribute('inert'); }
}
function input(value) {
  if (busy||screen!=='play'||S.status(state)!=='playing') return;
  const focused=document.activeElement?.dataset.cell;
  const actionFocus=document.activeElement?.dataset.action;
  selectedClue=null; S.step(state,value); tone();
  if(S.status(state)!=='playing') { finish(); return; }
  renderPlay();
  if (value.hint && !state.hint) {
    app.querySelector('.hint').textContent = 'Every region already has a critter, but the clues do not all match. Lift or undo a placement, then ask Show me why again.';
  }
  if (actionFocus) app.querySelector('[data-action=' + actionFocus + ']')?.focus({preventScroll:true});
  if (focused!==undefined) app.querySelector(`[data-cell="${focused}"]`)?.focus({preventScroll:true});
}
app.addEventListener('click',async e=>{
  const b=e.target.closest('button'); if(!b||busy||b.disabled)return;
  if(b.dataset.clue!==undefined){const k=Number(b.dataset.clue);selectedClue=selectedClue===k?null:k;renderPlay();app.querySelector(`[data-clue="${k}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.level!==undefined){start(Number(b.dataset.level));return;}
  if(b.dataset.cell!==undefined){const i=Number(b.dataset.cell);input({place:[Math.floor(i/state.level.cols),i%state.level.cols]});return;}
  const a=b.dataset.action;
  if(a?.startsWith('look:')) { prefs.look=a.slice(5); savePrefs(); show('settings',false);return; }
  if(a==='continue'){if(state&&S.status(state)==='playing')show('play');else start(resumeIndex());}
  else if(a==='resume')show('play');
  else if(a==='retry'){track('retry',{level:state.level.id});start(index);}
  else if(a==='next')start(index+1);
  else if(a==='undo')input({undo:true});
  else if(a==='hint')input({hint:true});
  else if(a==='settings'){settingsFrom=screen;show('settings');}
  else if(a==='settings-back')show(settingsFrom);
  else if(a==='bonus') {
    if(!adsAvailable()||!hasUnit('rewarded')||progress.bonus[state.level.id])return;
    busy=true;app.setAttribute('inert','');let result;
    try {result=await showRewarded();}catch {result={rewarded:false};}
    const bonus=S.rewardedBonus(progress,state.level.id,result?.rewarded?'rewarded':'declined');progress=bonus.progress;
    if(bonus.granted){save();track('earned_reward',{level:state.level.id,coins:bonus.granted,source:'rewarded_ad'});}
    busy=false;app.removeAttribute('inert');show('result');notice(bonus.granted?'10 keepsake coins added.':'No completed ad, so no bonus was granted.');
  } else if(['home','levels','pause'].includes(a))show(a);
});
app.addEventListener('change',e=>{const key=e.target.dataset.pref;if(!key)return;prefs[key]=e.target.checked;savePrefs();document.body.classList.toggle('reduced',prefs.reduced);if(key==='sound')tone();if(key==='hat'||key==='lantern'||key==='signpost'||key==='lookout'||key==='crest')app.querySelector('.look-preview').innerHTML=critter();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){if(screen==='play')show('pause');else if(screen==='pause')show('play');else if(screen==='settings')show(settingsFrom);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play')show('pause');});
addEventListener('blur',()=>{if(screen==='play')show('pause');});
// Inputs advance exactly one sim tick each. There are no timed rules to advance while idle.
window.arcadeView=()=>({screen,level:state?.level.id||chapter[index].id,levelIndex:index,state,stars:S.totalStars(progress)});
show('home');
Promise.resolve(initAds()).catch(()=>notice('Ads are unavailable. Campaign play is still available.'));
bannerOnScreens('screen',['home','result']);
