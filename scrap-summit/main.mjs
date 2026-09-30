// Scrap Summit: input, camera, drawing, saving and the ghost. The climb rules
// are sim.mjs and the mountain is mountain.mjs; Codex will replace the look.
import './store.mjs'; // first: the Outfitter needs ScrapSummitBilling when it starts
import { createClimb, step, height, DT, BODY_R, HEAD_R, ARM } from './sim.mjs';
import { buildMountain, ROUTE_ID, LEVELS } from './rocky-mountain.mjs';
import { drawScene, artReady } from './draw.mjs';
import { createFriends } from './friends.mjs';
import { initWardrobe } from './wardrobe-ui.mjs';
import { routeProgress, expeditionTitle, drawGuide, forcedAdsAllowed } from './expedition.mjs';
import { initAds, bannerOnScreens, maybeInterstitial, showRewarded, adsAvailable } from './arcade-ads.js';
// a banner on the menu and the summit screen, never on the mountain
bannerOnScreens('view', ['home', 'summit']);

const $ = (id) => document.getElementById(id);
let selected=ROUTE_ID;
try{selected=localStorage.getItem('scrapsummit.level')||ROUTE_ID;}catch{}
let world = buildMountain(selected);
let KEY = 'scrapsummit.' + world.id; // old route saves remain untouched

// ---- saving: the climb is its inputs (the sim replays them exactly), stored
// as whole 1/256ths in an Int16Array, base64 in local storage
function pack(inputs) {
  const a = new Int16Array(inputs.length);
  for (let i = 0; i < inputs.length; i++) a[i] = Math.round(inputs[i] * 256);
  let s = '';
  const b = new Uint8Array(a.buffer);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function unpack(str) {
  const bin = atob(str);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return Array.from(new Int16Array(b.buffer), (v) => v / 256);
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) return { best: s.best || 0, bestTime: s.bestTime || null, summits: s.summits || 0, guideSeconds: Number.isFinite(s.guideSeconds)?Math.max(0,Math.min(45,s.guideSeconds)):0, guideUsed:!!s.guideUsed, bestGuided:!!s.bestGuided, ghost: s.ghost ? unpack(s.ghost) : null, current: s.current ? unpack(s.current) : null };
  } catch (e) {
    console.warn('Save could not be read, starting fresh:', e.message);
  }
  return { best: 0, bestTime: null, summits: 0, ghost: null, current: null };
}
let save = load();
let guideSeconds=save.guideSeconds||0,guideUsed=!!save.guideUsed,adBusy=false,stamps=routeProgress(world,save).earned;
let sound=true,audio=null;try{sound=JSON.parse(localStorage.getItem('scrapsummit.sound')||'true');}catch{}
function unlockSound(){if(!sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}}
function rewardSound(){if(!sound||!audio)return;[440,554,660].forEach((f,i)=>{const o=audio.createOscillator(),v=audio.createGain(),t=audio.currentTime+i*.085;o.frequency.value=f;v.gain.setValueAtTime(.045,t);v.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(v);v.connect(audio.destination);o.start(t);o.stop(t+.26);});}
function persist() {
  if (climb && !climb.top) save.current = climb.inputs.slice();
  try {
    localStorage.setItem(KEY, JSON.stringify({ guideSeconds,guideUsed,bestGuided:!!save.bestGuided,best: save.best, bestTime: save.bestTime, summits: save.summits, ghost: save.ghost ? pack(save.ghost) : null, current: save.current ? pack(save.current) : null }));
  } catch {
    toast('Your climb cannot save on this device.');
  }
}
let toastT = 0;
function toast(m) {
  $('toast').textContent = m;
  toastT = 3;
}

// ---- state
let climb = null;
let ghost = null; // { c, inputs, i }
let aim = [0.9, -0.3];
let running = false;
let acc = 0;
let lastSave = 0;

function newGhost() {
  if (!$('ghostOn').checked || !save.ghost) return null;
  return { c: createClimb(world), inputs: save.ghost, i: 0 };
}
function start(fresh) {
  if(adBusy)return;unlockSound();
  if(fresh||(!climb&&!save.current)||climb?.top){guideSeconds=0;guideUsed=false;}
  stamps=routeProgress(world,save).earned;
  if (!fresh && climb && !climb.top) { /* resume the paused climb in memory */ }
  else if (fresh || !save.current) climb = createClimb(world);
  else {
    // pick up where you left off: replay the saved inputs (the sim is exact)
    climb = createClimb(world);
    for (let i = 0; i < save.current.length / 2; i++) step(climb, world, [save.current[2 * i], save.current[2 * i + 1]]);
  }
  aim = [climb.head.ox, climb.head.oy];
  ghost = newGhost();
  if (ghost) for (let i = 0; i < climb.steps && ghost.i < ghost.inputs.length / 2; i++, ghost.i++) step(ghost.c, world, [ghost.inputs[2 * ghost.i], ghost.inputs[2 * ghost.i + 1]]);
  acc = 0; drag = null;
  document.documentElement.requestFullscreen?.().catch(() => {});
  running = true;
  document.body.dataset.view = 'run';
  $('home').classList.add('hidden');
  $('summit').classList.add('hidden');
}
function home() {
  document.body.dataset.view = 'home';
  running = false;
  persist();
  const cont = climb && !climb.top;
  $('play').textContent = cont || save.current ? 'Keep climbing' : 'Climb';
  $('homeStats').textContent = save.best ? `Highest ${save.best.toFixed(1)} m${save.bestTime ? ` · best summit ${clock(save.bestTime)}${save.bestGuided?' (guided)':''}` : ''}${save.summits ? ` · summits ${save.summits}` : ''}` : '';
  $('levelSelect').value=world.id;
  $('levelDescription').textContent=(world.level.difficulty?'Difficulty '+world.level.difficulty+'/10 · ':'')+world.level.description;
  $('routeHeight').textContent=Math.round(world.summit)+' m';
  $('nextLevel').textContent=LEVELS.findIndex(l=>l.id===world.id)<LEVELS.length-1?'Next mountain ↗':'Choose mountain';
  updateProgress();
  $('home').classList.remove('hidden');
}
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
$('play').onclick = () => start(false);
$('again').onclick = () => summitTransition(()=>start(true));
for(const [label,list] of [['New expeditions · easiest to hardest',LEVELS.filter(l=>l.difficulty)],['Classic mountains',LEVELS.filter(l=>!l.difficulty)]]){const group=document.createElement('optgroup');group.label=label;for(const level of list){const option=document.createElement('option');option.value=level.id;option.textContent=(level.difficulty?String(level.difficulty).padStart(2,'0')+' / ':'')+level.name+' · '+Math.round(level.height)+' m';group.append(option);}$('levelSelect').append(group);}
function selectLevel(id){
 persist();friends.leave();world=buildMountain(id);KEY='scrapsummit.'+world.id;save=load();guideSeconds=save.guideSeconds||0;guideUsed=!!save.guideUsed;stamps=routeProgress(world,save).earned;climb=null;ghost=null;remote=null;running=false;acc=0;drag=null;cam={x:world.start[0],y:world.start[1]+2};
 try{localStorage.setItem('scrapsummit.level',world.id);}catch{}
 $('summit').classList.add('hidden');home();
}
$('levelSelect').onchange=e=>selectLevel(e.target.value);
$('nextLevel').onclick=()=>summitTransition(()=>{const i=LEVELS.findIndex(l=>l.id===world.id);selectLevel(LEVELS[(i+1)%LEVELS.length].id);});
$('menu').onclick = () => openPanel('settings');
// Touch browsers may suppress a compatibility click just after a canvas drag.
// Opening the pause panel is idempotent, so handle the direct pointer release.
$('menu').addEventListener('pointerup', e => { if(e.pointerType==='touch')openPanel('settings'); });

// ---- input: drag anywhere and the hammer head moves with your finger, one to
// one with the world; let go and it stays where you left it
const cv = $('world');
let drag = null;
let scale = 60;
cv.addEventListener('pointerdown', (e) => {
  if (!running || drag) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: climb.head.ox, ay: climb.head.oy };
});
cv.addEventListener('pointermove', (e) => {
  if (!running || !drag || e.pointerId !== drag.id) return;
  aim = [drag.ax + (e.clientX - drag.x) / scale, drag.ay - (e.clientY - drag.y) / scale];
  // keep the aim near reach, so a long drag does not store up slack
  const l = Math.sqrt(aim[0] * aim[0] + aim[1] * aim[1]);
  const reach=world.armMax??ARM.max;
  if (l > reach) aim = [(aim[0] * reach) / l, (aim[1] * reach) / l];
  // Rebase after every move: reversing a long swipe responds immediately.
  drag.x=e.clientX;drag.y=e.clientY;drag.ax=aim[0];drag.ay=aim[1];
});
const up = (e) => {
  if (drag && e.pointerId === drag.id) drag = null;
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('lostpointercapture', up);
addEventListener('pointerup', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
// a mouse: the head follows the pointer around the body, like the original
let mouse = false;
cv.addEventListener('mousemove', (e) => {
  if (!running || !mouse || drag) return;
  const w = innerWidth;
  const h = innerHeight;
  const bodyX=(climb.body.x-cam.x)*scale+w/2,bodyY=h*.55-(climb.body.y-cam.y)*scale;
  aim = [(e.clientX-bodyX)/scale,-(e.clientY-bodyY)/scale];
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    mouse = !mouse;
    toast(mouse ? 'Mouse mode: the hammer follows the pointer' : 'Drag mode');
  }
});

// ---- rendering (all geometry comes from the authored collision world)
const g = cv.getContext('2d');
let cam = { x: world.start[0], y: world.start[1] + 2 };
let remote = null;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { reduced = JSON.parse(localStorage.getItem('scrapsummit.motion') || String(reduced)); } catch {}
function draw() {
  const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  g.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(w,h)/7.5;
  drawScene(g,w,h,{world,cam,scale,climb,ghost,friend:remote,appearance:wardrobe.current(),reduced,t:climb?.t||0,menu:!$('home').classList.contains('hidden')});
  if(document.body.dataset.view==='run'&&!friends.state.connected)drawGuide(g,w,h,world,climb,cam,scale,guideSeconds);
}

// ---- the loop: fixed 120 Hz steps, so every device climbs the same
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running && climb) {
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      step(climb, world, aim);
      guideSeconds=Math.max(0,guideSeconds-DT);
      if (ghost && ghost.i < ghost.inputs.length / 2) {
        step(ghost.c, world, [ghost.inputs[2 * ghost.i], ghost.inputs[2 * ghost.i + 1]]);
        ghost.i++;
      }
      if (climb.top) {
        reachSummit();
        break;
      }
    }
    const hgt = height(climb, world);
    $('height').textContent = `${Math.max(0, climb.body.y - world.start[1]).toFixed(1)} m`;
    $('section').textContent = world.sectionAt(climb.body.y).name + (hgt > 0.5 ? ` · best ${hgt.toFixed(1)} m` : '');
    $('clock').textContent = clock(climb.t);
    if (hgt > save.best) save.best = hgt;
    const progress=routeProgress(world,save);
    if(progress.earned>stamps){stamps=progress.earned;if(!climb.top)celebrate(progress.badges[stamps-1].name+' cleared');persist();}
    $('routeGoal').textContent=progress.next?'NEXT BADGE · '+progress.next.name+' · '+Math.ceil(progress.next.target)+' m':'ALL SECTIONS CLEARED';
    $('guideClock').textContent=guideSeconds>0&&!friends.state.connected?'Terrain guide · '+Math.ceil(guideSeconds)+'s':'';
    if (now - lastSave > 5000) {
      lastSave = now;
      persist();
    }
  }
  if (running && climb) {
    // the camera leans towards where the hammer is reaching
    const tx = climb.body.x + climb.head.ox * 0.3;
    const ty = climb.body.y + 1 + climb.head.oy * 0.3;
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  }
  if (climb && now - lastPose > 100) {
    lastPose = now; friends.pose({x:climb.body.x,y:climb.body.y,ox:climb.head.ox,oy:climb.head.oy,t:climb.t,paused:!running,appearance:wardrobe.current()});
  }
  if (remote && friends.state.connected) $('mateStatus').textContent = remote.name + ' · ' + Math.max(0, remote.y-world.start[1]).toFixed(1) + ' m' + (remote.paused ? ' · paused' : '');
  draw();
  toastT -= dt;
  if (toastT <= 0) $('toast').textContent = '';
  requestAnimationFrame(frame);
}
function reachSummit() {
  running = false;
  save.summits++;
  save.best=Math.max(save.best,height(climb,world));
  celebrate(world.level.name+' conquered');
  $('summitSeal').textContent='▲';
  $('summitSeal').classList.toggle('still',reduced);
  const t = climb.t;
  const first = !save.bestTime;
  const beat = save.bestTime && t < save.bestTime;
  if (first || beat) {
    save.bestTime = t;
    save.bestGuided=guideUsed;
    save.ghost = climb.inputs.slice(); // the fastest climb becomes the ghost to race
  }
  $('summitTime').textContent = clock(t);
  $('summitReward').textContent='7 / 7 section badges · Summit seal earned'+(guideUsed?' · Guide-assisted climb':'');
  $('summitNote').textContent = first ? 'Your first summit. Your climb is now the ghost to beat.' : beat ? 'A new best. The ghost is now this climb.' : `Best is ${clock(save.bestTime)}.`;
  friends.pose({x:climb.body.x,y:climb.body.y,ox:climb.head.ox,oy:climb.head.oy,t:climb.t,paused:true,appearance:wardrobe.current()});
  save.current = null;
  persist();
  document.body.dataset.view = 'summit';
  $('summit').classList.remove('hidden');
}
// until there is a summit, the ghost is the highest climb so far
addEventListener('pagehide', () => {
  if (climb && !save.bestTime && (!save.ghostHeight || height(climb, world) > save.ghostHeight)) {
    save.ghost = climb.inputs.slice();
    save.ghostHeight = height(climb, world);
  }
  persist();
});

// ---- local settings and opt-in live invitations
let resumeAfterPanel=false,lastPose=0;
function openPanel(id){if(adBusy)return;if(['settings','friends','shop','passport'].some(id=>$(id).open))return;resumeAfterPanel=running;running=false;drag=null;acc=0;if(id==='settings')updateGuideOffer();$(id).showModal();}
function closePanel(id){if(adBusy)return;$(id).close();running=resumeAfterPanel&&!!climb;drag=null;acc=0;}
$('closeSettings').onclick=()=>closePanel('settings');
$('openSettings').onclick=()=>openPanel('settings');
$('settingsHome').onclick=()=>{if(adBusy)return;resumeAfterPanel=false;closePanel('settings');home();};
$('restart').onclick=()=>{if(adBusy)return;resumeAfterPanel=false;closePanel('settings');start(true);};
$('motion').checked=reduced;
$('motion').onchange=e=>{reduced=e.target.checked;try{localStorage.setItem('scrapsummit.motion',JSON.stringify(reduced));}catch{}};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});};
$('openFriends').onclick=()=>openPanel('friends');
$('settingsFriends').onclick=()=>{if(adBusy)return;closePanel('settings');openPanel('friends');};
$('closeFriends').onclick=()=>closePanel('friends');
for(const id of ['settings','friends','shop','passport'])$(id).addEventListener('cancel',e=>{e.preventDefault();closePanel(id);});
addEventListener('blur',()=>{drag=null;if(running)openPanel('settings');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)openPanel('settings');});
addEventListener('keydown',e=>{if(e.code==='Escape'&&running){e.preventDefault();openPanel('settings');}});
const friends=createFriends({
 getRoute:()=>world.id,
 onPose:p=>{remote=p;},
 onStart:()=>{for(const id of ['settings','friends','shop','passport'])if($(id).open)$(id).close();resumeAfterPanel=false;start(true);toast('Race on. See you at the summit.');},
 onRequest:()=>{$('inviteRequest').classList.remove('hidden');},
 onChange:s=>{
  $('roomCode').textContent=s.code?s.code.slice(0,4)+' '+s.code.slice(4):'—';
  $('friendState').textContent=s.error||({offline:'Create a private room or join your mate.',connecting:'Connecting…',hosting:'Room open. Share this code with your mate.',request:s.friend+' wants to join you.',waiting:'Waiting for your mate to accept…',connected:s.friend+' is connected.'}[s.status]||'Not connected.');
  $('shareRoom').disabled=!s.code;$('copyCode').disabled=!s.code;
  $('startTogether').classList.toggle('hidden',!s.connected||!s.host);
  $('leaveRoom').classList.toggle('hidden',['offline','error'].includes(s.status));
  $('createRoom').disabled=['connecting','hosting','connected','request','waiting'].includes(s.status);
  $('joinRoom').disabled=['connecting','hosting','connected','request','waiting'].includes(s.status);
  $('inviteRequest').classList.toggle('hidden',s.status!=='request'||!s.friend);
  $('inviteName').textContent=s.friend+' wants to climb with you.';
  $('mateStatus').classList.toggle('hidden',!s.connected);$('mateStatus').textContent=s.connected?s.friend+' · connected':'';
 }
});
$('createRoom').onclick=()=>friends.host($('playerName').value);
$('joinRoom').onclick=()=>friends.join($('joinCode').value,$('playerName').value);
$('acceptFriend').onclick=()=>friends.accept();$('declineFriend').onclick=()=>friends.decline();
$('startTogether').onclick=()=>friends.start();$('leaveRoom').onclick=()=>friends.leave();
async function copyRoom(link=false){const code=friends.state.code;if(!code)return;const text=link?location.origin+location.pathname+'?room='+code:code;try{await navigator.clipboard.writeText(text);$('friendState').textContent=link?'Invite link copied.':'Room code copied.';}catch{$('friendState').textContent='Your room code is '+code;}}
$('copyCode').onclick=()=>copyRoom();
$('shareRoom').onclick=async()=>{const code=friends.state.code;if(!code)return;const url=location.origin+location.pathname+'?room='+code;try{if(navigator.share)await navigator.share({title:'Climb Scrap Summit with me',text:'Join my private climb: '+code,url});else await copyRoom(true);}catch(e){if(e.name!=='AbortError')await copyRoom(true);}};
const invited=new URL(location.href).searchParams.get('room');
if(invited&&/^[A-HJ-NP-Z2-9]{8}$/.test(invited)){$('joinCode').value=invited;setTimeout(()=>openPanel('friends'),100);}
const wardrobe=initWardrobe({open:openPanel,close:closePanel});
artReady.then(draw);

initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
home();
requestAnimationFrame(frame);

function readRoute(id){try{return JSON.parse(localStorage.getItem('scrapsummit.'+id)||'{}')||{};}catch{return {};}}
function updateProgress(){
 const routes=LEVELS.map(l=>routeProgress(buildMountain(l.id),l.id===world.id?save:readRoute(l.id)));
 const p=routeProgress(world,save);
 $('progressSummary').textContent=expeditionTitle(routes)+' · '+routes.reduce((n,r)=>n+r.earned,0)+' / '+routes.reduce((n,r)=>n+r.total,0)+' badges';
 $('nextGoal').textContent=p.next?'Next: '+p.next.name+' at '+Math.ceil(p.next.target)+' m':'Summit sealed. Race your ghost or choose another mountain.';
}
function celebrate(label){
 $('achievement').textContent='✦ '+label;
 $('achievement').classList.remove('earned');void $('achievement').offsetWidth;
 $('achievement').classList.toggle('still',reduced);$('achievement').classList.add('earned');rewardSound();
 clearTimeout(celebrate.timer);celebrate.timer=setTimeout(()=>$('achievement').classList.remove('earned'),3200);
}
function showPassport(){
 updateProgress();$('passportRoutes').replaceChildren();
 for(const level of LEVELS){
  const w=buildMountain(level.id),p=routeProgress(w,level.id===world.id?save:readRoute(level.id));
  const card=document.createElement('section');card.className='passport-route';
  const title=document.createElement('h3');title.textContent=level.name;
  const seal=document.createElement('span');seal.className='peak-seal'+(p.won?' earned':'');seal.textContent=p.won?'▲ SUMMIT SEALED':'△ SUMMIT AWAITS';
  const list=document.createElement('ol');
  for(const badge of p.badges){const item=document.createElement('li');item.className=badge.earned?'claimed':'';item.textContent=(badge.earned?'✦ ':'○ ')+badge.name+' · '+Math.ceil(badge.target)+' m';list.append(item);}
  card.append(title,seal,list);$('passportRoutes').append(card);
 }
 $('passportTitle').textContent=$('progressSummary').textContent;openPanel('passport');$('passport').scrollTop=0;$('passport').focus({preventScroll:true});
}
$('openPassport').onclick=showPassport;$('summitPassport').onclick=showPassport;$('closePassport').onclick=()=>closePanel('passport');
$('sound').checked=sound;$('sound').onchange=e=>{sound=e.target.checked;try{localStorage.setItem('scrapsummit.sound',JSON.stringify(sound));}catch{}unlockSound();};
function updateGuideOffer(){
 const eligible=!!climb&&!climb.top&&!guideUsed&&!friends.state.connected&&adsAvailable();
 $('rewardGuide').disabled=!eligible||adBusy;
 $('guideOffer').textContent=guideUsed?'Your terrain guide has been used on this climb.':friends.state.connected?'Terrain guides are for solo climbs.':!climb||climb.top?'Start a solo climb to use a terrain guide.':!adsAvailable()?'Rewarded ads are available in the phone app.':'Optional: watch an ad for 45 seconds of highlighted terrain. Gold marks normal grip; blue marks slick terrain. No guaranteed holds.';
}
$('rewardGuide').onclick=async()=>{
 if(adBusy||!climb||climb.top||guideUsed||friends.state.connected||!adsAvailable())return;
 adBusy=true;running=false;drag=null;acc=0;persist();updateGuideOffer();
 try{const result=await showRewarded();if(result.rewarded&&!friends.state.connected){guideSeconds=45;guideUsed=true;persist();toast('Terrain guide ready. Keep climbing to use it.');}else toast(result.reason||'No reward this time.');}
 catch{toast('No ad available. You can keep climbing.');}
 finally{adBusy=false;updateGuideOffer();}
};
async function summitTransition(next){
 if(adBusy)return;adBusy=true;persist();$('again').disabled=$('nextLevel').disabled=true;
 try{if(!friends.state.connected&&await forcedAdsAllowed(globalThis.ScrapSummitBilling))await maybeInterstitial();}
 catch{toast('No ad this time.');}
 finally{adBusy=false;$('again').disabled=$('nextLevel').disabled=false;next();}
}
