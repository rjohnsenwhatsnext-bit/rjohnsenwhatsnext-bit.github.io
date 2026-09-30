// Sinkhole presentation and private friend matches.
// Claude's solo pacing remains in sim.mjs; draw.mjs owns the illustrated town.
// Element ids and window.__sinkQA are the contract with Codex.
import * as S from './sim.mjs';
import * as C from './campaign.mjs';
import {render,ready,resetDraw,effect} from './draw.mjs';
import {room} from './room.mjs';
import {packAlive,unpackAlive,safeInput,validSnapshot} from './network.mjs';
import { initAds, maybeInterstitial, showRewarded, adsAvailable, bannerOnScreens } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const cv = $('world');
const ctx = cv.getContext('2d');
let W = 0;
let H = 0;
let dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
}
addEventListener('resize', resize);
resize();

// ---- saved bits: best score and name (conveniences only)
const store = {
  get(k, f) {
    try {
      return JSON.parse(localStorage.getItem('sinkhole.' + k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('sinkhole.' + k, JSON.stringify(v));
    } catch {
      /* no storage: the best score just is not kept between launches */
    }
  },
};
$('name').value = store.get('name', 'You');
const showBest = () => ($('homeBest').textContent = store.get('best', 0) ? `Best: ${store.get('best', 0).toLocaleString()}` : '');
showBest();

let toastTimer = 0;
function toast(msg, ms = 1400) {
  $('toast').textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').textContent = ''), ms);
}

// ---- the round
let g = null;
let mission=null,attempt=null,campaign=C.cleanSave(store.get('campaign',null));
let myId=0,online=false,paused=false,roundId='',remoteInput={dx:0,dy:0},lastRemote=0,lastNet=0,lastTick=-1,pendingEvents=[];
let reduced=store.get('motion',matchMedia('(prefers-reduced-motion: reduce)').matches),sound=store.get('sound',true),audioCtx=null;
function unlockAudio(){if(!sound)return;try{audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();}catch{}}
let lastChime=0;
function chime(points){if(performance.now()-lastChime<55)return;lastChime=performance.now();if(!sound||!audioCtx||audioCtx.state!=='running')return;const o=audioCtx.createOscillator(),v=audioCtx.createGain(),now=audioCtx.currentTime;o.type='sine';o.frequency.setValueAtTime(points>50?160:340,now);o.frequency.exponentialRampToValueAtTime(points>50?65:180,now+.12);v.gain.setValueAtTime(.045,now);v.gain.exponentialRampToValueAtTime(.001,now+.14);o.connect(v);v.connect(audioCtx.destination);o.start();o.stop(now+.15);}
let view = 'home';
let headStart = false; // earned from a rewarded ad, used on the next round
let falling = []; // things on their way down, for the drawing only
let floaters = [];
let zoom = 1;
function start(selected=null) {
  mission=selected;attempt=mission?C.newAttempt(mission):null;
  if(net.state.connected||net.state.status!=='offline')net.leave();online=false;myId=0;paused=false;acc=0;resetDraw();letGo();keys.clear();unlockAudio();document.documentElement.requestFullscreen?.().catch(()=>{});
  const name = ($('name').value || 'You').trim().slice(0, 12) || 'You';
  store.set('name', name);
  g = S.newRound(mission?mission.seed:(Math.random() * 2 ** 32) >>> 0, { name, startR: !mission&&headStart ? S.START_R * 1.8 : S.START_R });
  if (headStart&&!mission) toast('Head start!');
  headStart = false;
  falling = [];
  floaters = [];
  show('play');
}
function show(v) {
  view = v;
  if(v!=='play')$('respawn').classList.add('hidden');
  document.body.dataset.view = v;
  $('home').classList.toggle('hidden', v !== 'home');
  $('over').classList.toggle('hidden', v !== 'over');
  $('hud').classList.toggle('hidden', v !== 'play');
}
function finish() {
  $('missionResult').classList.toggle('hidden',!mission);
  if(mission){campaign=C.award(campaign,mission,attempt);store.set('campaign',campaign);const earned=C.medal(mission,attempt);$('missionResult').textContent=earned?['','Bronze','Silver','Gold'][earned]+' medal · '+mission.name+' · '+Math.ceil(attempt.completedAt)+' seconds':mission.name+' · '+C.progress(mission,attempt)+' · Try another route';}

  const me = g.holes[myId];
  const place = S.place(g,myId);
  const best = store.get('best', 0);
  if (me.score > best) store.set('best', me.score);
  $('overPlace').textContent = mission?(attempt.completedAt!==null?'Complete!':'Try again'):ordinal(place);
  $('overPlace').classList.toggle('mission-title',!!mission);
  $('table').classList.toggle('hidden',!!mission);
  $('overScore').textContent = `${me.score.toLocaleString()} points${me.score > best ? ' · a new best!' : best ? ` · best ${best.toLocaleString()}` : ''}`;
  $('table').innerHTML = S.standings(g).map((r) => `<li class="${r.id===myId ? 'you' : ''}">${escape(r.name)} · ${r.score.toLocaleString()}</li>`).join('');
  $('bigger').classList.toggle('hidden', online||!!mission||!adsAvailable());
  $('again').disabled=online&&!net.state.host;
  $('again').textContent=online?(net.state.host?'Rematch together ↗':'Waiting for host’s rematch'):mission?'Retry mission ↗':'Another round ↗';
  show('over');
}
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10] || 'th');
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

$('play').onclick = ()=>start();
$('again').onclick = () => {
  maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e));
  if(online&&net.state.connected)startTogether();else start(mission);
};
$('toHome').onclick = () => {
  endSession();
  showBest();
  show('home');
};
$('bigger').onclick = async () => {
  $('bigger').disabled = true;
  const r = await showRewarded().catch((e) => ({ rewarded: false, reason: e?.message || String(e) }));
  $('bigger').disabled = false;
  if (!r.rewarded) return toast(r.reason ? 'No ad: ' + r.reason : 'The ad did not finish.', 2200);
  headStart = true;
  start();
};

// ---- steering: drag anywhere, the hole heads the way you pull
let pull = null;
const input = { dx: 0, dy: 0 };
cv.addEventListener('pointerdown', (e) => {
  if (view !== 'play'||paused||pull) return;
  pull = { x: e.clientX, y: e.clientY, id: e.pointerId };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!pull || e.pointerId !== pull.id) return;
  const dx = e.clientX - pull.x;
  const dy = e.clientY - pull.y;
  const m = Math.sqrt(dx * dx + dy * dy);
  const full = 50; // pixels of pull for full speed
  input.dx = m < 4 ? 0 : (dx / m) * Math.min(1, m / full);
  input.dy = m < 4 ? 0 : (dy / m) * Math.min(1, m / full);
  // let the anchor follow a long pull, so turning back is quick
  if (m > full * 1.6) {
    pull.x = e.clientX - (dx / m) * full * 1.6;
    pull.y = e.clientY - (dy / m) * full * 1.6;
  }
});
const letGo = () => {
  pull = null;
  input.dx = input.dy = 0;
};
cv.addEventListener('pointerup', letGo);
cv.addEventListener('pointercancel', letGo);
cv.addEventListener('lostpointercapture',letGo);
const keys = new Set();
addEventListener('keydown',e=>{if(view==='play'&&!paused){if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault();keys.add(e.key.toLowerCase());}if(e.key==='Escape'&&view==='play'&&!$('settings').open){e.preventDefault();openSettings();}});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function keyInput() {
  const x = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  const y = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  return x || y ? { dx: x, dy: y } : null;
}

// ---- the loop: fixed rule steps, drawing every frame
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (view === 'play' && g && !g.over && !paused) {
    if(!online||net.state.host)acc += dt;
    while (acc >= S.DT && !g.over) {
      const mate=performance.now()-lastRemote<700?remoteInput:{dx:0,dy:0};
      S.step(g,keyInput()||input,online?{1:mate}:{});
      acc -= S.DT;
      for (const e of g.events){onEvent(e);if(online)pendingEvents.push(e);}
    }
    if (g.over) finish();
    hud();
  }
  if(online&&net.state.connected&&now-lastNet>100){lastNet=now;if(net.state.host&&g){net.send('snapshot',{round:roundId,tick:g.tick,holes:g.holes,alive:packAlive(g.objs),events:pendingEvents,paused,over:g.over});pendingEvents=[];}else if(view==='play')net.send('input',{round:roundId,...(paused?{dx:0,dy:0}:keyInput()||input)});}
  render(ctx,W,H,dpr,g,myId,dt,falling,floaters,{reduced,pull,input,paused});
  requestAnimationFrame(frame);
}
function onEvent(e) {
  if(mission&&e.type==='eat'&&e.hole===myId){const before=attempt.completedAt;C.collect(mission,attempt,g.objs[e.obj].k,g.t);if(before===null&&attempt.completedAt!==null)g.over=true;}
  effect(e,g,myId);
  if (e.type === 'eat') {
    const o = g.objs[e.obj];
    falling.push({o,holeId:e.hole,t:0});
    if(e.hole===myId)chime(e.points);
    if (e.hole === myId && e.points >= 1) floaters.push({x:o.x,y:o.y,text:'+'+e.points,t:0});if(floaters.length>24)floaters.shift();
  } else if (e.type === 'swallow') {
    if (e.hole === myId) toast(`You swallowed ${g.holes[e.victim].name}!`);
    if (e.victim === myId) toast(`${g.holes[e.hole].name} swallowed you!`, 1800);
  }
}
let lastHud = 0;
function hud() {
  if(view!=='play')return;
  if (performance.now() - lastHud < 200) return;
  lastHud = performance.now();
  $('missionHud').classList.toggle('hidden',!mission);
  $('missionHud').textContent=mission?(attempt.completedAt!==null?'✓ '+mission.name+' complete':C.progress(mission,attempt)):'';
  const s = Math.ceil(S.timeLeft(g));
  $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('myScore').textContent = g.holes[myId].score.toLocaleString();
  $('myPlace').textContent = ordinal(S.place(g,myId));
  const me=g.holes[myId];
  const edible=Object.entries(S.KINDS).filter(([k,o])=>o.r<me.r*.92).sort((a,b)=>a[1].r-b[1].r).at(-1);
  $('sizeLabel').textContent=me.r<3?'SMALL APPETITE':me.r<7?'TOWN MENACE':'TOTAL COLLAPSE';
  $('nextSnack').textContent=edible?'You can swallow: '+edible[1].name:'Start with street clutter';
  $('respawn').classList.toggle('hidden',me.out<=0);$('respawn').textContent='Swallowed. Back in '+Math.ceil(me.out)+'…';
  $('top').innerHTML = S.standings(g)
    .slice(0, 3)
    .map((r) => `<li class="${r.id===myId ? 'you' : ''}">${escape(r.name)} ${r.score.toLocaleString()}</li>`)
    .join('');
}

// ---- settings and opt-in shared-town matches
function setPaused(value,broadcast=true){paused=value;letGo();keys.clear();acc=0;if(online&&broadcast)net.send('pause',{round:roundId,value});$('pauseNote').textContent=online?(paused?'Both players are paused.':'Your mate resumed the round.'):'Your round is paused.';}
function openSettings(){if($('settings').open)return;if(view==='play')setPaused(true);$('settingsHome').classList.toggle('hidden',view!=='play');$('settingsFriends').classList.toggle('hidden',view==='play');$('closeSettings').textContent=view==='play'?'Keep swallowing':'Back';$('settings').showModal();}
$('pause').onclick=openSettings;$('openSettings').onclick=openSettings;
$('closeSettings').onclick=()=>{$('settings').close();if(view==='play')setPaused(false);};
$('settings').addEventListener('cancel',e=>{e.preventDefault();$('closeSettings').click();});
$('sound').checked=sound;$('sound').onchange=e=>{sound=e.target.checked;store.set('sound',sound);unlockAudio();};
$('motion').checked=reduced;$('motion').onchange=e=>{reduced=e.target.checked;store.set('motion',reduced);};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});};
function endSession(){if(online)net.send('exit',{});online=false;net.leave();g=null;paused=false;letGo();keys.clear();$('respawn').classList.add('hidden');}
$('settingsHome').onclick=()=>{$('settings').close();endSession();showBest();show('home');};
function openFriends(){if($('settings').open)$('settings').close();if(!$('friends').open)$('friends').showModal();}
$('openFriends').onclick=openFriends;$('settingsFriends').onclick=openFriends;
$('closeFriends').onclick=()=> $('friends').close();
const profile=()=>({name:($('name').value||'Player').trim().slice(0,12)});
function setupRound(seed,names,id){mission=null;attempt=null;roundId=id;online=true;myId=net.state.host?0:1;g=S.newRound(seed,{name:names[0]});g.holes[1].bot=false;g.holes[1].name=names[1];paused=false;acc=0;lastTick=-1;pendingEvents=[];remoteInput={dx:0,dy:0};falling=[];floaters=[];resetDraw();letGo();keys.clear();headStart=false;for(const d of ['settings','friends'])if($(d).open)$(d).close();show('play');hud();}
function startTogether(){if(!net.state.connected||!net.state.host)return;unlockAudio();document.documentElement.requestFullscreen?.().catch(()=>{});const seed=crypto.getRandomValues(new Uint32Array(1))[0],names=[profile().name,net.state.friend.name],id=crypto.randomUUID();setupRound(seed,names,id);net.send('start',{seed,names,id});}
const net=room((type,data)=>{
 if(type==='status'){
  $('roomCode').textContent=data.code?data.code.slice(0,4)+' '+data.code.slice(4):'—';
  $('friendState').textContent=data.error||({offline:'Create a room or enter your mate’s code.',connecting:'Connecting…',hosting:'Room open. Share your code with a mate.',request:(data.friend?.name||'A mate')+' wants to join.',connected:(data.friend?.name||'Your mate')+' is connected. The host starts the round.'}[data.status]||'Waiting for the host to accept…');
  $('inviteRequest').classList.toggle('hidden',data.status!=='request');$('inviteName').textContent=(data.friend?.name||'A mate')+' wants to join your town.';
  $('startTogether').classList.toggle('hidden',!data.connected||!data.host);$('copyCode').disabled=$('shareRoom').disabled=!data.code;
  $('createRoom').disabled=$('joinRoom').disabled=data.status!=='offline';$('leaveRoom').classList.toggle('hidden',data.status==='offline');
 }else if(type==='start'&&!net.state.host&&Number.isInteger(data?.seed)&&Array.isArray(data.names)&&data.names.length===2&&data.names.every(n=>typeof n==='string'&&n.length<=20)&&typeof data.id==='string'&&data.id.length<80){setupRound(data.seed,data.names,data.id);}
 else if(type==='input'&&net.state.host&&data?.round===roundId){const v=safeInput(data);if(v){remoteInput=v;lastRemote=performance.now();}}
 else if(type==='snapshot'&&!net.state.host&&online&&g&&validSnapshot(data,g,roundId,lastTick)){
  lastTick=data.tick;g.tick=data.tick;g.t=data.tick*S.DT;g.holes=data.holes.map(h=>({...h}));const alive=unpackAlive(data.alive,g.objs.length);g.objs.forEach((o,i)=>o.alive=alive[i]);g.over=data.tick>=3600;const wasPaused=paused;paused=!!data.paused;
  // A received snapshot must never send a pause request back to the host.
  if(paused&&!wasPaused&&!$('settings').open){$('settingsHome').classList.remove('hidden');$('settingsFriends').classList.add('hidden');$('closeSettings').textContent='Keep swallowing';$('pauseNote').textContent='Both players are paused.';$('settings').showModal();}if(!paused&&wasPaused&&$('settings').open)$('settings').close();
  if(Array.isArray(data.events))for(const e of data.events.slice(0,300))if(e&&Number.isInteger(e.hole)&&e.hole>=0&&e.hole<8&&(e.type==='eat'&&Number.isInteger(e.obj)&&g.objs[e.obj]||e.type==='swallow'&&Number.isInteger(e.victim)&&g.holes[e.victim]))onEvent(e);
  if(g.over&&view!=='over')finish();else hud();
 }else if(type==='pause'&&online&&data?.round===roundId&&typeof data.value==='boolean'){setPaused(data.value,false);if(paused&&!$('settings').open){$('settingsHome').classList.remove('hidden');$('settingsFriends').classList.add('hidden');$('closeSettings').textContent='Keep swallowing';$('settings').showModal();}else if(!paused&&$('settings').open)$('settings').close();}
 else if(type==='exit'||type==='disconnect'){if(online){online=false;g=null;paused=false;for(const id of ['friends','settings'])if($(id).open)$(id).close();letGo();keys.clear();$('respawn').classList.add('hidden');showBest();show('home');toast('Your mate left. Start a solo round or reconnect.',3500);}}
});
$('createRoom').onclick=()=>net.host(profile());$('joinRoom').onclick=()=>net.join($('joinCode').value,profile());$('acceptFriend').onclick=()=>{unlockAudio();net.accept(profile());};$('declineFriend').onclick=()=>net.decline();$('startTogether').onclick=startTogether;$('leaveRoom').onclick=()=>net.leave();
async function copyInvite(link=false){const code=net.state.code;if(!code)return;const value=link?location.origin+location.pathname+'?room='+code:code;try{await navigator.clipboard.writeText(value);$('friendState').textContent=link?'Invite link copied.':'Room code copied.';}catch{$('friendState').textContent='Your room code is '+code;}}
$('copyCode').onclick=()=>copyInvite();$('shareRoom').onclick=async()=>{if(!net.state.code)return;try{if(navigator.share)await navigator.share({title:'Sinkhole — bring a mate',text:'Join my town: '+net.state.code,url:location.origin+location.pathname+'?room='+net.state.code});else await copyInvite(true);}catch(e){if(e.name!=='AbortError')await copyInvite(true);}};
const invited=new URL(location.href).searchParams.get('room');if(invited&&/^[A-HJ-NP-Z2-9]{8}$/.test(invited)){$('joinCode').value=invited;setTimeout(openFriends,100);}
addEventListener('blur',()=>{letGo();keys.clear();if(view==='play'&&!paused)openSettings();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&view==='play'&&!paused)openSettings();});
ready.then(()=>{});

show('home');
requestAnimationFrame(frame);
bannerOnScreens('view', ['home', 'over']);
initAds().catch((e) => console.warn('Ads unavailable:', e?.message || e));
// read-only view for tests
Object.defineProperty(window, '__sinkQA', {
  get: () => (g ? { view, mission:mission?.id||null, attempt:attempt?JSON.parse(JSON.stringify(attempt)):null, t: g.t, over: g.over, me: { ...g.holes[myId] }, place: S.place(g,myId), paused, online, myId, room:{...net.state}, holes:g.holes.map(h=>({...h})), eaten: g.objs.filter((o) => !o.alive).length } : { view, room:{...net.state} }),
});

function campaignMenu(){
 campaign=C.cleanSave(store.get('campaign',null));
 $('missionList').replaceChildren();
 C.MISSIONS.forEach((m,i)=>{
  const card=document.createElement('button');card.className='mission-card';card.disabled=!C.unlocked(campaign,i);
  const title=document.createElement('strong');title.textContent=String(i+1).padStart(2,'0')+' / '+m.name;
  const detail=document.createElement('span');detail.textContent=m.brief;
  const status=document.createElement('small');status.textContent=card.disabled?'Complete the previous mission to unlock':campaign.medals[m.id]?['','BRONZE','SILVER','GOLD'][campaign.medals[m.id]]+' · Replay for mastery':'READY TO EXPLORE';
  card.append(title,detail,status);
  card.onclick=()=>{ $('missionTitle').textContent=m.name;$('missionBrief').textContent=m.brief+' '+m.hint;$('missionMedals').textContent='Gold: '+m.gold+'s · Silver: '+m.silver+'s · Bronze: finish within 120s';$('missionStart').onclick=()=>{$('missionInfo').close();$('campaign').close();start(m);};$('missionInfo').showModal();};
  $('missionList').append(card);
 });
 if(!$('campaign').open)$('campaign').showModal();
}
$('openCampaign').onclick=campaignMenu;
$('resultsCampaign').onclick=()=>{endSession();showBest();show('home');campaignMenu();};
$('closeCampaign').onclick=()=>$('campaign').close();
$('missionBack').onclick=()=>$('missionInfo').close();
