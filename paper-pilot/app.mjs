import {blank,apply,replay,snapFold,trimFor} from './design.mjs';
import {build,flatFacets,fold} from './physics/paper.mjs';
import {model,analyse,createFlight,tune,RIDER} from './physics/flight.mjs';
// paper settles into its glide within a second; the bare patch model does not (see tune in flight.mjs)
tune({settle:1,roll:.3}); // less of it about the nose, so the pilot's lean can bank it
import {scenarios} from './physics/scenarios.mjs';
import {createMansion} from './mansion.mjs';
import {initAds,maybeInterstitial,bannerOnScreens} from './arcade-ads.js';
// a banner on the title screen only: the folding desk and the flight fill the screen
bannerOnScreens('phase',['intro']);

// The folding screen is one sheet of paper, full screen (Ryan, 28 Sep 2026:
// "one big screen, no more windows, a sheet of paper and you drag the spots
// you want to fold"; "once its folded on one side a button says turn over,
// you turn it over fold the other side then a button says fly"). Grab any
// part of the paper and drag it: the crease forms halfway between where you
// grabbed and where your finger is, and the layer you grabbed folds over.
// the flight plays at 80% speed (Ryan: "slow the plane down a bit"); the path it flies is unchanged
const PACE=.8;
const $=id=>document.getElementById(id),KEY='tovelly.paperflight.design.v2';
let ops=[],sheet=blank(),phase='intro',last=performance.now(),time=0,paused=false,flight=null,built=null,plane=null,analysis=null,scene=null,air=true,muted=true,audio=null,best=0,toastTime=0,viewDrag=null,drag=null,edit=null,ideal=4;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.ops)){sheet=replay(saved.ops);ops=saved.ops;}best=Number(localStorage.getItem('tovelly.paperflight.best'))||0;}catch(e){ops=[];sheet=blank();console.warn('Saved paper could not be restored, starting a fresh sheet:',e.message);}
initAds().catch(e=>console.warn('Ads unavailable:',e?.message||e));
function toast(t){$('toast').textContent=t;toastTime=4;}
function save(){try{localStorage.setItem(KEY,JSON.stringify({ops}));}catch{toast('Your paper cannot save on this device. Keep this tab open.');}}
function sound(type){if(muted)return;try{audio??=new AudioContext();audio.resume();const gain=audio.createGain();gain.connect(audio.destination);const osc=audio.createOscillator();osc.type=type==='fold'?'triangle':'sine';osc.frequency.setValueAtTime(type==='fold'?300:700,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(type==='fold'?130:440,audio.currentTime+.13);gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.16);osc.connect(gain);osc.start();osc.stop(audio.currentTime+.2);}catch(e){muted=true;toast('Sound is not available here.');}}
function transition(next){if(next==='launch'){$('distance').textContent='0.0 m / 48 m';$('place').textContent='THE ENTRANCE HALL';}phase=next;document.body.dataset.phase=next;for(const id of ['intro','desk','launch','flight-hud'])$(id).classList.toggle('hidden',id==='flight-hud'?next!=='flight':next!==id);$('pause').disabled=next==='intro';last=performance.now();}

// ---- the two sides: fold side one, turn over, fold side two, fly
const flipAt=()=>ops.findIndex(o=>o.type==='flip');
const foldsBefore=n=>ops.slice(0,n).filter(o=>o.type==='fold').length;
function sides(){const f=flipAt(),all=foldsBefore(ops.length);return f<0?{side:1,one:all,two:0}:{side:2,one:foldsBefore(f),two:all-foldsBefore(f)};}
function renderDesk(){
  const s=sides(),b=$('desk-action');
  if(edit)s[s.side===1?'one':'two']++; // the fold being moved still counts
  const label=s.side===1?(s.one?'Turn over':''):(s.two?'Fly':'');
  b.textContent=label;b.classList.toggle('hidden',!label);
  $('desk-undo').classList.toggle('hidden',!ops.length&&!edit);
  $('desk-hint').textContent=edit?'Drag to move that fold, let go to keep it':s.side===1?(s.one?'Fold more, or turn it over':'Drag the paper to fold it'):(s.two?'Fold more, or fly':'Now fold this side');
  fitPaper();drawPaper();
}
function commit(op){try{if(ops.length>=100)throw Error('That is a lot of folds for one sheet. Fly it, or fold a new sheet.');const next=apply(sheet,op);if(next.facets.length>350)throw Error('The paper is too thick to fold there.');sheet=next;ops.push(op);sound('fold');save();renderDesk();return true;}catch(e){toast(e.message);return false;}}
function newSheet(){ops=[];sheet=blank();edit=null;save();}
// an edit in progress keeps its fold where it is now
function settleEdit(){if(!edit)return;const op=edit.op;edit=null;commit(op);}
$('desk-action').onclick=()=>{
  settleEdit();
  const s=sides();
  if(s.side===1){commit({type:'flip'});return;}
  // each side's last fold is its wing
  const wings=[s.one-1,s.one+s.two-1];
  // test glide it a few times with the tail bent different ways, as anyone does, then throw
  $('desk-action').disabled=true;$('desk-hint').textContent='Trimming the tail…';
  setTimeout(()=>{
    $('desk-action').disabled=false;
    let ready;
    try{const tr=trimFor(sheet,wings);ideal=tr.speed;ready=apply(sheet,{type:'ready',wings,tail:tr.tail});built=build(ready);plane=model(built);analysis=analyse(plane);}
    catch(e){toast('This one will not fly: '+e.message+' Undo a fold or fold a new sheet.');renderDesk();return;}
    $('speed').value=ideal.toFixed(1);
    scene?.setPlane(built,plane);
    transition('launch');
    toast(`Your plane: ${analysis.verdict}.`);
  },30);
};
// Undo (Ryan: "a revert button so you can revert your last move"): takes
// back the last fold, or the turn over. During an edit it drops that fold.
$('desk-undo').onclick=()=>{
  if(edit){edit=null;renderDesk();return;}
  if(!ops.length)return;
  ops.pop();sheet=replay(ops);save();renderDesk();
};
// Edit fold, after a flight (Ryan: "it needs an edit fold button", "the edit
// fold needs to be after youve flown it once"): back to the same paper with
// the last fold held up by a handle where the grabbed spot landed; drag
// anywhere to move it, and the fold follows live. Letting go keeps it.
const reflect=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),q=[a[0]+dx*t,a[1]+dy*t];return [2*q[0]-p[0],2*q[1]-p[1]];};
function startEdit(){
  const op=ops.at(-1);if(edit||op?.type!=='fold')return;
  ops.pop();sheet=replay(ops);save();
  edit={op,p0:op.move,p1:reflect(op.move,op.a,op.b),preview:fold(sheet,op)};
  renderDesk();
}
$('enter').onclick=()=>{transition('desk');renderDesk();};

// ---- drawing the paper
const paper=$('paper'),pg=paper.getContext('2d');let map={scale:1,x:0,y:0};
const point=p=>[map.x+p[0]*map.scale,map.y-p[1]*map.scale];
function unpoint(e){const b=paper.getBoundingClientRect();return [(e.clientX-b.left-map.x)/map.scale,(map.y-(e.clientY-b.top))/map.scale];}
// the paper keeps its size (the whole sheet fits) and stays centred as it
// folds smaller; held still while a finger is down
function fitPaper(){const r=paper.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;const all=flatFacets(sheet).flatMap(f=>f.poly);const minx=Math.min(...all.map(p=>p[0])),maxx=Math.max(...all.map(p=>p[0])),miny=Math.min(...all.map(p=>p[1])),maxy=Math.max(...all.map(p=>p[1]));const top=120,bottom=120;map.scale=Math.min((w-40)/sheet.width,(h-top-bottom)/sheet.length);map.x=w/2-(minx+maxx)/2*map.scale;map.y=top+(h-top-bottom)/2+(miny+maxy)/2*map.scale;}
function inside(poly,p){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function drawPaper(){if(phase!=='desk')return;const r=paper.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);if(paper.width!==Math.round(w*dpr)||paper.height!==Math.round(h*dpr)){paper.width=Math.round(w*dpr);paper.height=Math.round(h*dpr);}pg.setTransform(dpr,0,0,dpr,0,0);
  const bg=pg.createRadialGradient(w*.5,h*.45,20,w*.5,h*.5,Math.max(w,h));bg.addColorStop(0,'#4f6a55');bg.addColorStop(1,'#1b3129');pg.fillStyle=bg;pg.fillRect(0,0,w,h);
  const shown=drag?.preview||edit?.preview||sheet,moving=shown!==sheet?shown.facets.map(f=>f.moved.at(-1)):[];
  const polys=flatFacets(shown).sort((a,b)=>a.z-b.z);
  for(const f of polys){const lifted=moving[f.index];pg.beginPath();f.poly.forEach((p,j)=>{const [x,y]=point(p);j?pg.lineTo(x,y):pg.moveTo(x,y);});pg.closePath();pg.shadowColor='#0718107a';pg.shadowBlur=lifted?22:10;pg.shadowOffsetY=lifted?12:5;const g=pg.createLinearGradient(0,0,w,h);g.addColorStop(0,lifted?'#fffdf4':'#fbf3dc');g.addColorStop(1,lifted?'#efe6cc':'#e4d7b3');pg.fillStyle=g;pg.fill();pg.shadowBlur=0;pg.shadowOffsetY=0;pg.strokeStyle='#b4a77e';pg.lineWidth=1;pg.stroke();}
  pg.setLineDash([3,4]);pg.strokeStyle='#8f845c66';pg.lineWidth=.8;for(const f of shown.folds){pg.beginPath();pg.moveTo(...point(f.a));pg.lineTo(...point(f.b));pg.stroke();}pg.setLineDash([]);
  if(edit&&!drag){const b=point(edit.p1);pg.fillStyle='#ffe7a8';pg.strokeStyle='#7a5a24';pg.lineWidth=2;pg.beginPath();pg.arc(b[0],b[1],13,0,Math.PI*2);pg.fill();pg.stroke();}
  if(drag?.op&&drag.snap){pg.strokeStyle='#e0a93a';pg.lineWidth=2.5;pg.beginPath();pg.moveTo(...point(drag.op.a));pg.lineTo(...point(drag.op.b));pg.stroke();}
  if(drag){const a=point(drag.p0),b=point(drag.shown||drag.p1);pg.strokeStyle='#ffe7a8';pg.lineWidth=2;pg.setLineDash([6,5]);pg.beginPath();pg.moveTo(...a);pg.lineTo(...b);pg.stroke();pg.setLineDash([]);pg.fillStyle='#ffe7a8';pg.beginPath();pg.arc(b[0],b[1],7,0,Math.PI*2);pg.fill();}
}

// ---- folding with a finger
paper.onpointerdown=e=>{
  const p=unpoint(e);
  if(edit){paper.setPointerCapture(e.pointerId);drag={id:e.pointerId,p0:edit.p0,p1:edit.p1,start:p,base:edit.p1,preview:edit.preview,op:edit.op};drawPaper();return;}
  if(!flatFacets(sheet).some(f=>inside(f.poly,p)))return; // only the paper can be grabbed
  paper.setPointerCapture(e.pointerId);drag={id:e.pointerId,p0:p,p1:p,preview:null,op:null};drawPaper();
};
paper.onpointermove=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const at=unpoint(e);drag.p1=drag.start?[drag.base[0]+at[0]-drag.start[0],drag.base[1]+at[1]-drag.start[1]]:at;const [x0,y0]=drag.p0,[x1,y1]=drag.p1,dx=x1-x0,dy=y1-y0;
  drag.preview=null;drag.op=null;drag.shown=null;
  if(Math.hypot(dx,dy)>.006){
    // the crease is halfway between the grabbed spot and the finger, square to the drag
    // lined up with a corner, the centre, an existing crease or square, if close (snapFold)
    const sn=snapFold(sheet,drag.p0,drag.p1),op={type:'fold',a:sn.a,b:sn.b,move:drag.p0,kind:'valley',layers:{grab:drag.p0}};
    if(sn.snap&&sn.snap!==drag.snap)try{navigator.vibrate?.(8);}catch{/* no vibration on this device: the snap still shows */}
    drag.snap=sn.snap;drag.shown=sn.p1;
    try{drag.preview=fold(sheet,op);drag.op=op;}catch{/* this drag does not fold any paper yet: nothing to show until it does */}
  }
  drawPaper();
};
paper.onpointerup=e=>{if(!drag||e.pointerId!==drag.id)return;const op=drag.op||(drag.start?edit.op:null);drag=null;edit=null;if(op)commit(op);else drawPaper();};
paper.onpointercancel=()=>{drag=null;drawPaper();};

window.addEventListener('resize',()=>{if(!drag){fitPaper();drawPaper();}});

// ---- the throw: swipe up, harder for faster, sideways to aim
function throwPlane(){if(phase!=='launch'||!plane)return;flight=createFlight(plane,{speed:Number($('speed').value),pitch:Number($('pitch').value),yaw:Number($('yaw').value),roll:0},scenarios.mansion,{rider:RIDER});transition('flight');sound('throw');fanButtons();toast('Drag to lean the pilot. Tap a fan to switch it.');}
function fanButtons(){$('fan-buttons').replaceChildren();for(const src of scenarios.mansion.airSources.filter(s=>s.type==='fan')){const b=document.createElement('button');b.textContent=`${src.id.replace(' fan','').toUpperCase()} ${flight.air.isOn(src.id,flight.state.t)?'ON':'OFF'}`;b.classList.toggle('off',!flight.air.isOn(src.id,flight.state.t));b.onclick=()=>{if(paused||phase!=='flight')return;const on=flight.toggle(src.id);toast(`${src.id}: ${on?'on':'off'}`);sound('fold');fanButtons();};$('fan-buttons').append(b);}}
$('air-view').onclick=()=>{air=!air;scene.showAir(air);$('air-view').textContent=`Air trails: ${air?'ON':'OFF'}`;};
function end(){const r=flight.result;phase='result';$('flight-hud').classList.add('hidden');const won=r.goals?.passed;best=Math.max(best,r.distance);try{localStorage.setItem('tovelly.paperflight.best',String(best));}catch{toast('Your best distance cannot save on this device.');}$('result-title').textContent=won?'Across the whole house.':r.reason==='hit'?`Caught the ${r.name}.`:'Back to the drawing board.';$('result-stats').textContent=`${r.distance.toFixed(1)} m · ${r.t.toFixed(1)} s`+(r.rider&&!r.rider.on?` · pilot fell off at ${r.rider.lostAt.toFixed(1)} m`:'');const feedback=won?'Your folds, throw and fan choices carried you to the conservatory. Try a different design and see if it can do better.':r.name==='hall doorway'||r.name==='ballroom arch'?'You reached the doorway, but not through its opening. Try a gentler throw.':r.name==='ceiling'?'Too much climb. Try a gentler throw.':r.name==='left wall'||r.name==='right wall'?'The plane drifted off line. Make both wings match.':r.name==='planter'?'Nearly there. You need a little more height over the conservatory planter. Reach the garden fan’s stream.':r.reason==='landed'?'You ran out of height. Broader wings, a gentler throw and reaching the fans can help.':'Try a small change to one fold, then compare the flight.';// what the fold itself did, from the flight model's verdict, so the next fold can fix it
const v=analysis?.verdict||'',why=won?'':/tumbles|stalls/.test(v)?'Your plane is tail heavy, so it flips and stalls. Fold the top corners or the top edge down first: weight at the nose makes it glide. ':/dives/.test(v)?'Your plane is nose heavy, so it dives. Try fewer nose folds, or wider wings. ':/banks|turns/.test(v)?'One wing is doing more than the other, so it turns. Make the second wing match the first: fold it on the same crease. ':'';
$('result-copy').textContent=`${why}${feedback} Best: ${best.toFixed(1)} m.`;$('result').showModal();}
let afterEnd=false;async function leaveResult(target){if(afterEnd)return;afterEnd=true;try{await maybeInterstitial();}catch(e){console.warn('Interstitial not shown:',e?.message||e);}finally{afterEnd=false;}$('result').close();flight=null;if(target==='desk')newSheet();transition(target==='edit'?'desk':target);if(target!=='launch')renderDesk();if(target==='edit')startEdit();}
$('retry').onclick=()=>leaveResult('launch');$('refold').onclick=()=>leaveResult('desk');$('edit-fold').onclick=()=>leaveResult('edit');
$('pause').onclick=()=>{if(phase==='intro'||phase==='result')return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;$('paused').close();last=performance.now();};$('quit').onclick=()=>{paused=false;flight=null;$('paused').close();newSheet();transition('desk');renderDesk();};$('mute').onclick=()=>{muted=!muted;$('mute').textContent='Sound: '+(muted?'off':'on');sound('fold');};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='flight'&&!paused){paused=true;$('paused').showModal();}save();});window.addEventListener('pagehide',save);
$('scene').onpointerdown=e=>{viewDrag={x:e.clientX,y:e.clientY,moved:false};$('scene').setPointerCapture(e.pointerId);};
// in flight, a drag leans the pilot like a stick: up is forward (nose down), sideways banks; 70 px is a full lean
$('scene').onpointermove=e=>{if(!viewDrag)return;if(Math.hypot(e.clientX-viewDrag.x,e.clientY-viewDrag.y)>8)viewDrag.moved=true;if(phase==='flight'&&viewDrag.moved&&!paused)flight?.lean((viewDrag.y-e.clientY)/70,(e.clientX-viewDrag.x)/70);};
// the throw is measured against the speed this plane glides best at: a normal
// flick (150 to 250 px) throws it 1.1 to 1.3 times that; a hard one loops it
$('scene').onpointerup=e=>{if(!viewDrag)return;const up=viewDrag.y-e.clientY,side=e.clientX-viewDrag.x;if(phase==='launch'&&up>30){$('speed').value=(ideal*Math.max(.7,Math.min(1.8,.7+up/400))).toFixed(1);$('yaw').value=Math.round(Math.max(-15,Math.min(15,Math.atan2(side,up)*180/Math.PI)));throwPlane();}else if(phase==='flight'&&viewDrag.moved){flight?.lean(0,0);}else if(phase==='flight'&&!paused&&!viewDrag.moved){const id=scene.pickFan(e.clientX,e.clientY);if(id){flight.toggle(id);fanButtons();toast(id+' switched.');}}viewDrag=null;};
$('scene').onpointercancel=()=>{viewDrag=null;flight?.lean(0,0);};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'&&phase==='launch'){e.preventDefault();$('speed').value=ideal.toFixed(1);throwPlane();}if(e.code==='Escape'&&phase!=='intro'&&phase!=='result')$('pause').click();});
function frame(now){const dt=Math.min(.035,(now-last)/1000);last=now;if(!paused){time+=dt;if(phase==='flight'&&flight){flight.step(dt*PACE);const x=flight.state.pos[0];$('distance').textContent=`${Math.max(0,x).toFixed(1)} m / 48 m`;$('place').textContent=x<10?'THE ENTRANCE HALL':x<24?'THE BALLROOM':x<36?'THE LIBRARY':'THE CONSERVATORY';const milestones=[10,24,36,46];$('checkpoints').querySelectorAll('span').forEach((n,i)=>n.classList.toggle('done',x>=milestones[i]));$('air-tip').textContent=x<10?'Clear the double doors. Rising air waits beyond.':x<16?'Ride the floor vents. Watch the ceiling fan ahead.':x<24?'The ceiling fan blows DOWN. The desk fan pushes forward.':x<36?'Thread the bookshelf gap. Catch the rising air beyond it.':'Catch the garden fan. Clear the planter. Reach the chaise.';if(flight.done)end();}toastTime-=dt;if(toastTime<=0)$('toast').textContent='';}if(scene)scene.draw(phase,flight,time,paused?0:phase==='flight'?dt*PACE:dt);requestAnimationFrame(frame);}
try{scene=await createMansion($('scene'),scenarios.mansion);$('enter').disabled=false;$('enter').textContent=ops.length?'Back to your paper ↗':'Take a sheet of paper ↗';requestAnimationFrame(frame);}catch(e){$('enter').textContent='Unable to load the mansion';document.querySelector('#intro .fine').textContent=e.message+' Try refreshing or a browser with WebGL enabled.';console.error(e);}
// arrow keys lean the pilot too, on a computer
const keysDown=new Set();function keyLean(){if(phase!=='flight')return;flight?.lean((keysDown.has('ArrowUp')?1:0)-(keysDown.has('ArrowDown')?1:0),(keysDown.has('ArrowRight')?1:0)-(keysDown.has('ArrowLeft')?1:0));}
window.addEventListener('keydown',e=>{if(e.code.startsWith('Arrow')){keysDown.add(e.code);keyLean();}});window.addEventListener('keyup',e=>{if(keysDown.delete(e.code))keyLean();});
