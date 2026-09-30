import * as P from './property.mjs';
import {PropertyMap} from './property-map.mjs';
import {initAds,adsAvailable,bannerOnScreens,showRewarded,maybeInterstitial} from './arcade-ads.js';
const $=id=>document.getElementById(id),KEY='homestead.property.v1';
let warning='',s,prefs={sound:false,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
try{const raw=localStorage.getItem(KEY);s=raw?P.validate(raw):P.fresh();prefs={...prefs,...JSON.parse(localStorage.getItem(KEY+'.settings')||'{}')};}catch(e){s=P.fresh();warning='Your property save could not be read. The original has been preserved; this session will not overwrite it.';}
let selected=1,speed=1,panel='',selectedBuilding=null,toastTimer,adBusy=false,surveyUntil=0,played=false;
const track=(name,props={})=>window.arcade?.track(name,{mode:'property',level:P.level(s),...props});
function save(){if(warning)return;try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){warning='Progress cannot be saved on this device. Keep this page open.';track('save_failure',{message:'local storage unavailable'});}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3600);}
function sound(){if(!prefs.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=520;g.gain.value=.03;o.connect(g).connect(ctx.destination);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.15);o.start();o.stop(ctx.currentTime+.18);o.onended=()=>ctx.close();}catch{}}
function after(r){if(!r.ok){toast(r.reason);return false;}if(!played){played=true;track('play');}sound();save();hud();if(panel)renderPanel();return true;}
function confirm(title,text,fn){$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmYes').onclick=()=>{$('confirm').close();fn();};$('confirm').showModal();}
$('confirmNo').onclick=()=>$('confirm').close();
const map=new PropertyMap($('world'),()=>s,pick=>{
 if(pick.worker){selected=pick.worker;map.selected=selected;hud();return;}
 if(pick.place){
 const reason=P.canPlace(s,pick.place,pick.x,pick.y);if(reason)return toast(reason);
 const def=P.BUILDINGS[pick.place],cost=def.cost-(pick.place==='dam'&&s.vehicles.includes('excavator')?1200:0);
 confirm('Build '+def.name+'?',P.cash(cost)+' including materials'+(pick.place==='dam'&&!s.vehicles.includes('excavator')?' and excavator hire':'')+'. '+s.workers.find(w=>w.id===selected).name+' will collect what is needed and work on this site.',()=>{
 if(after(P.place(s,selected,pick.place,pick.x,pick.y))){cancelPlace();toast('Project marked out. Your worker is on the job.');track('build',{what:pick.place});}
 });return;
 }
 if(pick.building){selectedBuilding=pick.building;map.activeBuilding=pick.building;openPanel('inspect');return;}
 if(pick.ground){if(after(P.assign(s,selected,'walk',pick.ground))){closePanel();toast('Move queued.');}}
});
function cancelPlace(){map.placement=null;$('placement').hidden=true;document.body.dataset.placing='false';}
$('cancelPlace').onclick=cancelPlace;
$('zoomIn').onclick=()=>map.zoom=Math.min(2.5,map.zoom*1.2);
$('zoomOut').onclick=()=>map.zoom=Math.max(.35,map.zoom/1.2);
$('fit').onclick=()=>map.fit();
$('focusWorker').onclick=()=>{map.focus(s.workers.find(w=>w.id===selected));openPanel('jobs');};
function closePanel(){panel='';$('panel').hidden=true;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.remove('on'));}
$('closePanel').onclick=closePanel;
function openPanel(name){panel=name;cancelPlace();$('panel').hidden=false;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('on',b.dataset.panel===name));renderPanel();}
const img=art=>art>=0?'<img src="assets/farm-'+art+'.webp" alt="">':'<span style="font-size:35px;text-align:center">▧</span>';
function item(title,description,art,label,action,disabled=false){return '<article class="item">'+img(art)+'<div><h3>'+title+'</h3><p>'+description+'</p><button '+action+(disabled?' disabled':'')+'>'+label+'</button></div></article>';}
const button=(text,action)=>'<button class="wide" '+action+'>'+text+'</button>';
function renderPanel(){
 const body=$('panelBody');let title='',html='';
 if(panel==='build'){
 title='Make it your own';html='<p class="panel-note">Choose a project, then tap its position on your land. Your selected worker builds it.</p>';
 for(const [kind,d] of Object.entries(P.BUILDINGS))html+=item(d.name,d.description,d.art,P.cash(d.cost),'data-project="'+kind+'"');
 }
 if(panel==='vehicles'){
 title='Tools of the trade';html='<p class="panel-note">Purchased vehicles arrive at your entrance. Workers collect them automatically for suitable jobs.</p>';
 for(const [kind,v] of Object.entries(P.VEHICLES))html+=item(v.name,v.description,v.art,s.vehicles.includes(kind)?'Owned':P.cash(v.cost),'data-vehicle="'+kind+'"',s.vehicles.includes(kind));
 }
 if(panel==='livestock'){
 title='Look after the mob';
 const avg=s.animals.length?Math.round(s.animals.reduce((n,a)=>n+a.condition,0)/s.animals.length):0;
 html='<div class="ledger"><span>Livestock</span><b>'+s.animals.length+' head · '+avg+'% condition</b></div><div class="ledger"><span>Hay / water</span><b>'+s.hay+' bales / '+Math.round(s.water)+' units</b></div>';
 html+=item('Beef cattle','Start a herd. A fenced paddock and water supply are required.',12,'Buy one · $900','data-stock="cattle"');
 html+=item('Merino sheep','A smaller investment for your first paddock.',13,'Buy one · $240','data-stock="sheep"');
 const paddocks=s.buildings.filter(b=>b.kind==='paddock'&&b.built);
 html+='<p class="panel-note">Stock deliveries go to the least crowded paddock. Grass recovers with rest and rain; hungry or thirsty animals lose condition. Weight gain happens daily.</p>';
 for(const [i,p] of paddocks.entries()){
 html+='<h3>Paddock '+(i+1)+' � '+s.animals.filter(a=>a.paddock===p.id&&!a.yarded).length+' head</h3><p class="panel-note">Pasture '+Math.round(p.pasture??100)+'% � '+P.occupancy(s,p.id)+'/8 spaces allocated</p>';
 html+=button('Feed by ute � 2 bales + $20','data-task="feed" data-paddock="'+p.id+'"');
 html+=button('Muster by horse � $5','data-task="muster" data-target="horse" data-paddock="'+p.id+'"');
 html+=button('Muster by bike � $35','data-task="muster" data-target="bike" data-paddock="'+p.id+'"');
 for(const [n,dest] of paddocks.entries())if(dest.id!==p.id)html+=button('Move mob to paddock '+(n+1)+' � horse � $5','data-task="rotate" data-paddock="'+p.id+'" data-destination="'+dest.id+'"');
 }
 html+='<p class="panel-note">Yarded stock: '+s.animals.filter(a=>a.yarded).length+'. Sell up to four head per trip. Transport: '+(s.vehicles.includes('truck')?'$60 using your truck':'$180 hired carrier')+', plus 4% selling fees. Your worker loads and delivers them before payment.</p>';
 html+=button('Send stock to meatworks','data-task="sell" data-target="meatworks"');
 html+=button('Send stock to saleyards','data-task="sell" data-target="saleyards"');
 html+=button('Order 8 hay bales + 60 water · $400','data-action="supplies"');
 }
 if(panel==='jobs'){
 title='People & jobs';const w=s.workers.find(w=>w.id===selected);
 html='<p class="panel-note">Selected: '+w.name+'. Up to five jobs per worker. Vehicles are shared, so a second worker waits until equipment is free.</p>';
 for(const j of s.jobs.filter(j=>j.worker===selected))html+='<div class="job"><b>'+j.title+'</b><small>'+(j.status==='active'?j.stops[j.stage]?.label||'Finishing':j.status==='blocked'?'Access blocked. Leave clear ground beside projects.':'Queued')+'</small>'+(j.status==='queued'?button('Cancel waiting job','data-cancel-job="'+j.id+'"'):'')+'</div>';
 if(!s.jobs.some(j=>j.worker===selected))html+='<p class="panel-note">Nothing queued. Tap land to walk there, or choose a project or livestock task.</p>';
 html+=item('Hire a farmhand','Adds another selectable worker. $120 wages per game day. Up to four workers in this slice.',14,'Hire · $1,800','data-action="hire"',s.workers.length>=4);
 }
 if(panel==='property'){
 title='Your property';html='<div class="ledger"><span>Available funds</span><b>'+P.cash(s.money)+'</b></div><div class="ledger"><span>Land / level</span><b>'+s.acres+' acres / '+P.level(s)+'</b></div><div class="ledger"><span>Produce crates</span><b>'+s.produce+'</b></div><div class="ledger"><span>Loan outstanding</span><b>'+P.cash(s.debt)+'</b></div>';
 html+='<div class="ledger"><span>Unpaid wages</span><b>'+P.cash(s.wageArrears||0)+'</b></div>';
 html+=button('Stock farm shop with produce','data-task="shop"');
 html+=button(s.extent===23?'32 acres owned':'Buy neighbouring land · $9,000','data-action="expand"');
 if(!s.repayments&&!s.debt)html+=button('View starter loan terms','data-action="loan"');
 if(s.debt)html+=button('Repay loan in full · '+P.cash(s.debt),'data-action="repay"');
 html+='<p class="panel-note">The first three buildings earn $1,000. Your first feed run earns $800. Your first livestock sale earns $1,500. Camp income needs a caravan and water. Dams collect water on rainy days.</p>';
 html+='<h3 style="font-size:13px">Around the property</h3>'+s.events.slice(0,8).map(e=>'<div class="event">'+e.text+'</div>').join('');
 }
 if(panel==='inspect'){
 const b=s.buildings.find(b=>b.id===selectedBuilding);if(!b)return closePanel();const d=P.BUILDINGS[b.kind];title=d.name;
 html='<div style="text-align:center">'+img(d.art)+'</div><p class="panel-note">'+d.description+'</p>';
 if(!b.built)html+='<div class="job"><b>Under construction</b><small>Your assigned worker is completing this project.</small></div>';
 else if(b.kind==='garden'){html+=button(b.planted?'Harvest vegetables':'Plant vegetables · $40 + 5 water','data-task="'+(b.planted?'harvest':'plant')+'" data-building="'+b.id+'"');html+='<p class="panel-note">'+(b.planted?(s.time>=b.ready?'Ready to harvest.':Math.ceil(b.ready-s.time)+' game seconds until ready.'):'A crop takes 55 game seconds once planted. Each harvest gives four crates.')+'</p>';}
 else if(b.kind==='shop')html+=button('Stock shop · '+s.produce+' crates','data-task="shop"');
 else if(b.kind==='paddock'||b.kind==='yards'||b.kind==='shed')html+=button('Manage livestock & feeding','data-panel="livestock"');
 else if(b.kind==='dam')html+='<p class="panel-note">Stored rainwater: '+(b.water||0)+' units. Rain arrives every third game day. Tank deliveries cover dry periods.</p>';
 else if(b.kind==='camp')html+='<p class="panel-note">'+(P.ready(s,'caravan')&&s.water>0?'Open to campers · $220 per game day.':'Needs a completed caravan and water before guests can stay.')+'</p>';
 }
 $('panelTitle').textContent=title;body.innerHTML=html;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
 if(d.panel){openPanel(d.panel);return;}
 if(d.speed!==undefined){speed=Number(d.speed);hud();return;}
 if(d.worker){selected=Number(d.worker);map.selected=selected;map.focus(s.workers.find(w=>w.id===selected));hud();if(panel)renderPanel();return;}
 if(d.project){closePanel();map.placement=d.project;$('placement').hidden=false;$('placeName').textContent=P.BUILDINGS[d.project].name+' · '+P.cash(P.BUILDINGS[d.project].cost);document.body.dataset.placing='true';return;}
 if(d.vehicle){const v=P.VEHICLES[d.vehicle];confirm('Buy '+v.name+'?',P.cash(v.cost)+'. '+v.description,()=>after(P.buyVehicle(s,d.vehicle)));return;}
 if(d.stock){after(P.buyStock(s,d.stock));return;}
 if(d.cancelJob){after(P.cancelJob(s,Number(d.cancelJob)));return;}
 if(d.task){if(after(P.assign(s,selected,d.task,d.paddock?{paddock:Number(d.paddock),vehicle:d.target,destination:Number(d.destination)}:d.building?Number(d.building):d.target))){toast('Job queued for '+s.workers.find(w=>w.id===selected).name+'.');}return;}
 if(d.action){
 if(d.action==='loan')return confirm('A head start, with repayments','Receive $12,000 now. Total repayment $13,200: $440 per game day for 30 days. Repayments are taken from available cash; unpaid balances carry forward. No real money is involved.',()=>after(P.loan(s)));
 if(d.action==='hire')return confirm('Hire a farmhand?','$1,800 recruitment and $120 wages each game day. They work independently using your shared equipment.',()=>after(P.hire(s)));
 if(d.action==='expand')return confirm('Buy the neighbouring acreage?','$9,000 to expand from 8 to 32 acres. This is the land limit in this first playable slice.',()=>{if(after(P.expand(s)))map.fit();});
 if(d.action==='repay')return confirm('Clear your loan?',P.cash(s.debt)+' from available funds. Future repayments stop.',()=>after(P.repay(s)));
 if(d.action==='supplies')after(P.supplies(s));
 }
});
function hud(){
 $('money').textContent=P.cash(s.money);$('acres').textContent=s.acres+' acres · Level '+P.level(s);$('day').textContent='Day '+s.day+' · '+s.weather;
 const w=s.workers.find(w=>w.id===selected),jobs=s.jobs.filter(j=>j.worker===selected),j=jobs[0];
 $('workerName').textContent=w.name;$('workerStatus').textContent=j?j.stops[j.stage]?.label||'Finishing up':'Ready · select a task';$('jobCount').textContent=jobs.length;
 const workers=s.workers.map(w=>w.id).join();if($('workers').dataset.ids!==workers){$('workers').innerHTML=s.workers.length>1?s.workers.map(w=>'<button data-worker="'+w.id+'" aria-label="Select '+w.name+'">'+w.name[0]+'</button>').join(''):'';$('workers').dataset.ids=workers;}
 document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('on',Number(b.dataset.speed)===speed));
 if(s.stats.built<3){$('goal').textContent='Set down roots';$('goalNote').textContent='Build three projects · '+s.stats.built+'/3 · earn $1,000.';}
 else if(!s.stats.fed){$('goal').textContent='Look after your first herd';$('goalNote').textContent='Paddock + water + shed + ute. Complete a feed run.';}
 else if(!s.stats.sold){$('goal').textContent='Your first livestock sale';$('goalNote').textContent='Build yards. Muster by horse or bike. Load a truck.';}
 else{$('goal').textContent='Make this place your own';$('goalNote').textContent='Grow produce, welcome campers and buy more land.';}
 $('saveWarning').hidden=!warning;if(warning)$('saveWarning').textContent=warning;
}
$('play').onclick=()=>{document.body.dataset.view='play';$('home').hidden=true;$('game').hidden=false;map.resize();map.fit();if(map.w<650){map.zoom=.75;map.cx=7.8;map.cy=9.2;}hud();document.documentElement.requestFullscreen?.().catch(()=>{});};
$('settingsBtn').onclick=()=>{$('sound').checked=prefs.sound;$('motion').checked=prefs.motion;$('survey').hidden=!adsAvailable();$('settings').showModal();};
$('closeSettings').onclick=()=>$('settings').close();
for(const id of ['sound','motion'])$(id).onchange=()=>{prefs[id]=$(id).checked;try{localStorage.setItem(KEY+'.settings',JSON.stringify(prefs));}catch{toast('Settings could not be saved.');}};
$('menu').onclick=async()=>{save();$('settings').close();adBusy=true;document.body.inert=true;document.body.dataset.view='ad';try{await maybeInterstitial();}catch{}finally{adBusy=false;document.body.inert=false;document.body.dataset.view='home';$('game').hidden=true;$('home').hidden=false;}};
$('survey').onclick=async()=>{if(adBusy)return;adBusy=true;$('survey').disabled=true;document.body.inert=true;try{const r=await showRewarded();if(r.rewarded){surveyUntil=s.time+60;toast('Aerial survey active: gold marks show road frontage and low catchment.');track('survey');}}catch{toast('Ad unavailable. Your property is unchanged.');}finally{adBusy=false;$('survey').disabled=false;document.body.inert=false;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('pagehide',save);
let last=performance.now(),lastUI=0,lastSave=0,lastEvent=s.events[0]?.id;
function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;
 const active=document.body.dataset.view==='play'&&!document.hidden&&!document.querySelector('dialog[open]')&&!adBusy;
 if(active)P.tick(s,dt*speed);
 if(document.body.dataset.view==='play'){
 map.draw(prefs.motion?now:0);
 if(surveyUntil>s.time){for(const p of [[2,6,'ROAD FRONTAGE'],[9,12,'LOW CATCHMENT']])map.label(...p,true);}
 if(now-lastUI>300){hud();lastUI=now;}
 if(now-lastSave>3000){save();lastSave=now;}
 if(s.events[0]?.id!==lastEvent){lastEvent=s.events[0]?.id;toast(s.events[0].text);sound();if(panel)renderPanel();save();track('property_progress',{built:s.stats.built,sold:s.stats.sold});}
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
bannerOnScreens('view',['home','play']);initAds().catch(()=>{});
Object.defineProperty(window,'__homesteadPropertyQA',{get:()=>({state:JSON.parse(JSON.stringify(s)),selected,speed,point:(x,y)=>map.point(x,y)})});
// The original clock-protected crop game remains available at legacy.html.
