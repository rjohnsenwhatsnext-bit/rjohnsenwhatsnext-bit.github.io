import * as F from './fields.mjs';
import * as Stages from './stages.mjs';
import {claimDaily} from './daily.mjs';
import {farmPanel} from './property-farm-ui.mjs';
import {propertyTime} from './property-time.mjs';
import {daylight} from './property-life.mjs';
import {PropertyAudio} from './property-audio.mjs';
import * as P from './property.mjs';
import {PropertyMap} from './property-map.mjs';
import {initAds,adsAvailable,bannerOnScreens,showRewarded,maybeInterstitial} from './arcade-ads.js';
const $=id=>document.getElementById(id),KEY='homestead.property.v1';
let warning='',s,prefs={sound:false,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
try{const raw=localStorage.getItem(KEY);s=raw?P.validate(raw):P.fresh();prefs={...prefs,...JSON.parse(localStorage.getItem(KEY+'.settings')||'{}')};}catch(e){s=P.fresh();warning='Your property save could not be read. The original has been preserved; this session will not overwrite it.';}
const ambience=new PropertyAudio();let displayedMoney=s.money;
let selected=1,speed=1,panel='',selectedBuilding=null,toastTimer,adBusy=false,surveyUntil=0,played=false;
const track=(name,props={})=>window.arcade?.track(name,{mode:'property',level:P.level(s),...props});
function save(){if(warning)return;propertyClock.stamp();try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){warning='Progress cannot be saved on this device. Keep this page open.';track('save_failure',{message:'local storage unavailable'});}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3600);}
function sound(){if(!prefs.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=520;g.gain.value=.03;o.connect(g).connect(ctx.destination);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.15);o.start();o.stop(ctx.currentTime+.18);o.onended=()=>ctx.close();}catch{}}
function after(r){if(!r.ok){toast(r.reason);return false;}if(!played){played=true;track('play');}sound();checkStage();save();hud();if(panel)renderPanel();return true;}
function confirm(title,text,fn){$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmYes').onclick=()=>{$('confirm').close();fn();};$('confirm').showModal();}
$('confirmNo').onclick=()=>$('confirm').close();
const map=new PropertyMap($('world'),()=>s,pick=>{
 if(pick.land){showLand(pick.land);return;}
 if(pick.fence){const f=pick.fence;if(fieldPath){const path=fieldPath;if(f.w<2||f.h<2||f.w>8||f.h>8)return toast('Fields must be between 2 and 8 squares per side.');const reason=P.canPlace(s,'field',f.x,f.y,f.w,f.h);if(reason)return toast(reason);confirm('Lay out this '+F.PATHS[path].name.toLowerCase()+' field?',f.w+' × '+f.h+' squares · '+P.cash(f.w*f.h*F.FIELD_SQUARE_COST)+'. Your worker clears and marks out the field.',()=>{if(after(P.assign(s,selected,'layField',{...f,path})))cancelPlace();});return;}const reason=P.canPlace(s,'paddock',f.x,f.y,f.w,f.h);if(reason||f.w<2||f.h<2||f.w>10||f.h>10)return toast(reason||'Drag a paddock between 2 and 10 squares on each side.');const cost=(f.w+f.h)*180+160;confirm('Build this paddock fence?',f.w+' by '+f.h+' squares. '+P.cash(cost)+' for posts, wire and a gate. Your worker builds each section before stock can use it.',()=>{if(after(P.fencePlan(s,selected,f.x,f.y,f.w,f.h)))cancelPlace();});return;}
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
let fieldPath=null;
function cancelPlace(){fieldPath=null;map.fieldLayout=false;map.placement=null;map.fenceStart=null;map.fenceEnd=null;map.landMode=false;$('placement').hidden=true;document.body.dataset.placing='false';}
$('cancelPlace').onclick=cancelPlace;
$('zoomIn').onclick=()=>map.zoom=Math.min(2.5,map.zoom*1.2);
$('zoomOut').onclick=()=>map.zoom=Math.max(.35,map.zoom/1.2);
$('fit').onclick=()=>map.fit();
$('focusWorker').onclick=()=>{map.focus(s.workers.find(w=>w.id===selected));openPanel('jobs');};
function closePanel(){panel='';$('panel').hidden=true;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.remove('on'));}
$('closePanel').onclick=closePanel;
function showLand(id){
 const p=P.PARCELS.find(p=>p.id===id);if(!p)return;
 if(s.land.includes(id))return toast('You own '+p.name+'.');
 confirm('Buy '+p.name+'?',P.cash(p.cost)+' for 8 acres. '+(P.adjacent(s,p)?'This block joins your property.':'Buy an adjoining block first.'),()=>{if(after(P.buyLand(s,id))){track('land_purchased',{parcel:id,acres:s.acres});map.fit();if(panel)renderPanel();}});
}
function openPanel(name){panel=name;cancelPlace();$('panel').hidden=false;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('on',b.dataset.panel===name));renderPanel();}
const img=art=>art>=0?'<img src="assets/farm-'+art+'.webp" alt="">':'<span style="font-size:35px;text-align:center">▧</span>';
function item(title,description,art,label,action,disabled=false){return '<article class="item">'+img(art)+'<div><h3>'+title+'</h3><p>'+description+'</p><button '+action+(disabled?' disabled':'')+'>'+label+'</button></div></article>';}
const button=(text,action)=>'<button class="wide" '+action+'>'+text+'</button>';
function renderPanel(){
 const body=$('panelBody');let title='',html='';
 if(panel==='build'){
 title='Make it your own';html='<p class="panel-note">Choose a project, then tap its position on your land. Your selected worker builds it.</p>';
 html+=button('Fields & crops','data-panel="fields"');
 html+=button('Lay out fencing - drag a paddock','data-fencing="true"');
 html+='<p class="panel-note">Drag from one corner to the other. Posts, wire and a gate cost $90 per fence section plus $160. Your worker then builds around the perimeter.</p>';
 for(const [kind,d] of Object.entries(P.BUILDINGS))if(kind!=='paddock'&&kind!=='field')html+=item(d.name,d.description,d.art,P.cash(d.cost),'data-project="'+kind+'"');
 }
 if(panel==='vehicles'){
 title='Tools of the trade';html=button('Farm machinery','data-panel="machinery"')+'<p class="panel-note">Purchased vehicles arrive at your entrance. Workers collect them automatically for suitable jobs.</p>';
 for(const [kind,v] of Object.entries(P.VEHICLES))html+=item(v.name,v.description,v.art,s.vehicles.includes(kind)?'Owned':P.cash(v.cost),'data-vehicle="'+kind+'"',s.vehicles.includes(kind));
 }
 if(panel==='livestock'){
 title='Look after the mob';
 const avg=s.animals.length?Math.round(s.animals.reduce((n,a)=>n+a.condition,0)/s.animals.length):0;
 html='<div class="ledger"><span>Livestock</span><b>'+s.animals.length+' head · '+avg+'% condition</b></div><div class="ledger"><span>Hay / water</span><b>'+s.hay+' bales / '+Math.round(s.water)+' units</b></div>';
 html+=item('Beef cattle','Start a herd. A fenced paddock and water supply are required.',12,'Buy one · $900','data-stock="cattle"');
 html+=item('Merino sheep','A smaller investment for your first paddock.',13,'Buy one · $240','data-stock="sheep"');
 const paddocks=s.buildings.filter(b=>b.kind==='paddock'&&b.built);
 html+='<p class="panel-note">Paddock stock graze for themselves. Rotate them to rest the grass. Hay feeding is only needed for stock held in the yards; keep water supplied.</p>';
 for(const [i,p] of paddocks.entries()){
 html+='<h3>Paddock '+(i+1)+' · '+s.animals.filter(a=>a.paddock===p.id&&!a.yarded).length+' head</h3><p class="panel-note">Pasture '+Math.round(p.pasture??100)+'% · '+P.occupancy(s,p.id)+'/'+P.capacity(p)+' spaces allocated</p>';
 html+=button('Muster by horse · $5','data-task="muster" data-target="horse" data-paddock="'+p.id+'"');
 html+=button('Muster by bike · $35','data-task="muster" data-target="bike" data-paddock="'+p.id+'"');
 for(const [n,dest] of paddocks.entries())if(dest.id!==p.id)html+=button('Move mob to paddock '+(n+1)+' · horse · $5','data-task="rotate" data-paddock="'+p.id+'" data-destination="'+dest.id+'"');
 }
 html+='<p class="panel-note">Yarded stock: '+s.animals.filter(a=>a.yarded).length+'. Sell up to four head per trip. Transport: '+(s.vehicles.includes('truck')?'$60 using your truck':'$180 hired carrier')+', plus 4% selling fees. Your worker loads and delivers them before payment.</p>';
 html+=button('Feed yarded livestock - ute, 2 bales + $20','data-task="feed"');
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
 html+=button('Stages & daily jobs','data-panel="progress"')+button('Fields & crops','data-panel="fields"');
 html+=button('Stock farm shop with produce','data-task="shop"');
 html+=button('Surrounding land - '+s.acres+' / 72 acres','data-panel="land"');
 html+=button('Campground bookings & visitors','data-panel="camping"');
 if(!s.repayments&&!s.debt)html+=button('View starter loan terms','data-action="loan"');
 if(s.debt)html+=button('Repay loan in full · '+P.cash(s.debt),'data-action="repay"');
 html+='<p class="panel-note">The first three buildings earn $1,000. Your first feed run earns $800. Your first livestock sale earns $1,500. Campers pay on arrival. Open a campsite with any completed home and water. Dams collect water on rainy days.</p>';
 html+='<h3 style="font-size:13px">Around the property</h3>'+s.events.slice(0,8).map(e=>'<div class="event">'+e.text+'</div>').join('');
 }
 if(panel==='land'){
 title='Room to grow';html='<p class="panel-note">Buy blocks adjoining your land. Each block adds eight acres. Purchased land can be built on immediately.</p>';
 html+='<div class="land-grid">';
 for(const id of ['nw','north','ne','west','home','east','sw','south','se']){const p=P.PARCELS.find(p=>p.id===id),owned=s.land.includes(id);html+='<button data-land="'+id+'" '+(owned?'disabled':'')+' class="'+(owned?'owned':'')+'"><b>'+p.name+'</b><small>'+(owned?'Owned':P.cash(p.cost))+'</small></button>';}
 html+='</div>'+button('View blocks on the map','data-land-map="true"');
 }
 if(panel==='camping'){
 title='Campground';html='<div class="ledger"><span>Bookings / income</span><b>'+s.campGuests+' / '+P.cash(s.campIncome)+'</b></div><p class="panel-note">Guests arrive at varying times, pay $90 at check-in, stay a while and drive out. Each site hosts one travelling party. A home and water are required. Closing a site stops new bookings.</p>';
 const camps=s.buildings.filter(b=>b.kind==='camp'&&b.built);
 if(!camps.length)html+=button('Build your first campsite','data-project="camp"');
 for(const [i,b] of camps.entries()){const v=s.visitors.find(v=>v.camp===b.id);html+='<h3>Campsite '+(i+1)+'</h3><p class="panel-note">'+(v?v.status==='staying'?'Guests staying - paid '+P.cash(v.fee):v.status==='arriving'?'Guests driving in':'Guests heading home':P.hasHome(s)&&s.water>=2?'Vacant - waiting for a booking':'Needs a home and water')+'</p>'+button(b.open===false?'Open for bookings':'Close to new bookings','data-camp="'+b.id+'" data-open="'+(b.open===false)+'"');}
 }
 if(panel==='inspect'){
 const b=s.buildings.find(b=>b.id===selectedBuilding);if(!b)return closePanel();const d=P.BUILDINGS[b.kind];title=d.name;
 html='<div style="text-align:center">'+img(d.art)+'</div><p class="panel-note">'+d.description+'</p>';
 if(!b.built)html+='<div class="job"><b>Under construction</b><small>Your assigned worker is completing this project.</small></div>';
 else if(b.kind==='field')html+=button('Manage this field','data-panel="fields"');
 else if(b.kind==='garden'){html+=button(b.planted?'Harvest vegetables':'Plant vegetables · $40 + 5 water','data-task="'+(b.planted?'harvest':'plant')+'" data-building="'+b.id+'"');html+='<p class="panel-note">'+(b.planted?(s.time>=b.ready?'Ready to harvest.':Math.ceil(b.ready-s.time)+' game seconds until ready.'):'A crop takes 55 game seconds once planted. Each harvest gives four crates.')+'</p>';}
 else if(b.kind==='shop')html+=button('Stock shop · '+s.produce+' crates','data-task="shop"');
 else if(b.kind==='paddock'||b.kind==='yards'||b.kind==='shed')html+=button('Manage livestock & feeding','data-panel="livestock"');
 else if(b.kind==='dam')html+='<p class="panel-note">Stored rainwater: '+(b.water||0)+' units. Rain arrives every third game day. Tank deliveries cover dry periods.</p>';
 else if(b.kind==='camp')html+=button('Manage bookings & visitors','data-panel="camping"');
 }
 const farm=farmPanel(s,panel,propertyClock.dayKey);if(farm){title=farm.title;html=farm.html;}
 $('panelTitle').textContent=title;body.innerHTML=html;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
 if(d.clockRetry){propertyClock.sync();return;}
 if(d.dailyClaim){if(!propertyClock.dayKey)return toast('Connect to check today’s date first.');const r=claimDaily(s,propertyClock.dayKey);if(after(r))toast('Daily jobs paid · '+P.cash(r.reward));return;}
 if(d.machine){const m=F.MACHINES[d.machine];confirm('Buy '+m.name+'?',P.cash(m.cost)+' from your property funds. Available for compatible field jobs.',()=>after(F.buyMachine(s,d.machine)));return;}
 if(d.fieldPath){closePanel();fieldPath=d.fieldPath;map.fieldLayout=true;map.placement='fence';$('placement').hidden=false;$('placeName').textContent='Lay out '+F.PATHS[fieldPath].name.toLowerCase();$('placeHint').textContent='Drag a rectangle, 2–8 squares per side · $150 per square.';document.body.dataset.placing='true';return;}
 if(d.fieldFocus){const field=s.buildings.find(b=>b.id===Number(d.fieldFocus));closePanel();map.activeBuilding=field.id;map.focus({x:field.x+field.w/2,y:field.y+field.h/2});return;}
 if(d.fieldTask){const target={field:Number(d.field),crop:d.crop},quote=F.fieldJob(s,s.workers.find(w=>w.id===selected),d.fieldTask,target);if(quote?.reason)return toast(quote.reason);confirm(quote.job.title,P.cash(quote.cost)+' from your funds. The selected worker will carry out or arrange the job.',()=>after(P.assign(s,selected,d.fieldTask,target)));return;}
 if(d.deliver){const quote=F.deliveryJob(s,d.deliver);if(quote.reason)return toast(quote.reason);confirm('Deliver '+d.deliver+'?',P.cash(quote.cost)+' transport cost. Payment arrives after delivery.',()=>after(P.assign(s,selected,'deliver',{what:d.deliver})));return;}
 if(d.land){showLand(d.land);return;}
 if(d.landMap){closePanel();map.landMode=true;map.fit();$('placement').hidden=false;$('placeName').textContent='Tap a neighbouring block to buy';$('placeHint').textContent='Drag to look around. Gold labels show available land.';return;}
 if(d.camp){after(P.setCamp(s,Number(d.camp),d.open==='true'));return;}
 if(d.fencing){closePanel();map.landMode=false;map.placement='fence';$('placement').hidden=false;$('placeName').textContent='Draw your paddock';$('placeHint').textContent='Drag from one corner to the opposite corner, then release.';document.body.dataset.placing='true';return;}
 if(d.panel){openPanel(d.panel);return;}
 if(d.speed!==undefined){speed=Number(d.speed);hud();return;}
 if(d.worker){selected=Number(d.worker);map.selected=selected;map.focus(s.workers.find(w=>w.id===selected));hud();if(panel)renderPanel();return;}
 if(d.project){closePanel();map.landMode=false;$('placeHint').textContent='Tap land to mark a site. Drag to look around.';map.placement=d.project;$('placement').hidden=false;$('placeName').textContent=P.BUILDINGS[d.project].name+' · '+P.cash(P.BUILDINGS[d.project].cost);document.body.dataset.placing='true';return;}
 if(d.vehicle){const v=P.VEHICLES[d.vehicle];confirm('Buy '+v.name+'?',P.cash(v.cost)+'. '+v.description,()=>{if(after(P.buyVehicle(s,d.vehicle)))track('vehicle_purchased',{vehicle:d.vehicle});});return;}
 if(d.stock){if(after(P.buyStock(s,d.stock)))track('livestock_purchased',{kind:d.stock});return;}
 if(d.cancelJob){after(P.cancelJob(s,Number(d.cancelJob)));return;}
 if(d.task){if(after(P.assign(s,selected,d.task,d.paddock?{paddock:Number(d.paddock),vehicle:d.target,destination:Number(d.destination)}:d.building?Number(d.building):d.target))){toast('Job queued for '+s.workers.find(w=>w.id===selected).name+'.');}return;}
 if(d.action){
 if(d.action==='loan')return confirm('A head start, with repayments','Receive $12,000 now. Total repayment $13,200: $440 per game day for 30 days. Repayments are taken from available cash; unpaid balances carry forward. No real money is involved.',()=>{if(after(P.loan(s)))track('loan_taken',{amount:12000});});
 if(d.action==='hire')return confirm('Hire a farmhand?','$1,800 recruitment and $120 wages each game day. They work independently using your shared equipment.',()=>after(P.hire(s)));
 if(d.action==='repay')return confirm('Clear your loan?',P.cash(s.debt)+' from available funds. Future repayments stop.',()=>after(P.repay(s)));
 if(d.action==='supplies')after(P.supplies(s));
 }
});
function hud(){
 displayedMoney=s.money>displayedMoney?displayedMoney+(s.money-displayedMoney)*.42:s.money;if(Math.abs(displayedMoney-s.money)<1)displayedMoney=s.money;$('money').textContent=P.cash(displayedMoney);$('acres').textContent=s.acres+' acres · Level '+P.level(s);$('day').textContent='Day '+s.day+' · '+daylight(s).name+' · '+s.weather+' · '+F.seasonOf(s);
 const w=s.workers.find(w=>w.id===selected),jobs=s.jobs.filter(j=>j.worker===selected),j=jobs[0];
 $('workerName').textContent=w.name;$('workerStatus').textContent=j?j.stops[j.stage]?.label||'Finishing up':'Ready · select a task';$('jobCount').textContent=jobs.length;
 const workers=s.workers.map(w=>w.id).join();if($('workers').dataset.ids!==workers){$('workers').innerHTML=s.workers.length>1?s.workers.map(w=>'<button data-worker="'+w.id+'" aria-label="Select '+w.name+'">'+w.name[0]+'</button>').join(''):'';$('workers').dataset.ids=workers;}
 document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('on',Number(b.dataset.speed)===speed));
 const next=Stages.nextStage(s);$('goal').textContent=next?'Grow into a '+next.name.toLowerCase():'Your big station';$('goalNote').textContent=next?next.needs.filter(n=>!n.done).map(n=>n.text).join(' · '):'Your land. Your way.';
 $('saveWarning').hidden=!warning;if(warning)$('saveWarning').textContent=warning;
}
$('play').onclick=()=>{if(propertyClock.busy)toast('Checking time away… your property will be ready in a moment.');ambience.enable(prefs.sound);document.body.dataset.view='play';$('home').hidden=true;$('game').hidden=false;map.resize();map.fit();if(map.w<650){map.zoom=.75;map.cx=7.8;map.cy=9.2;}hud();document.documentElement.requestFullscreen?.().catch(()=>{});};
$('settingsBtn').onclick=()=>{$('sound').checked=prefs.sound;$('motion').checked=prefs.motion;$('survey').hidden=!adsAvailable();$('settings').showModal();};
$('closeSettings').onclick=()=>$('settings').close();
for(const id of ['sound','motion'])$(id).onchange=()=>{prefs[id]=$(id).checked;if(id==='sound')ambience.enable(prefs.sound);try{localStorage.setItem(KEY+'.settings',JSON.stringify(prefs));}catch{toast('Settings could not be saved.');}};
$('menu').onclick=async()=>{save();$('settings').close();adBusy=true;document.body.inert=true;document.body.dataset.view='ad';try{await maybeInterstitial();}catch{}finally{adBusy=false;document.body.inert=false;document.body.dataset.view='home';$('game').hidden=true;$('home').hidden=false;}};
$('survey').onclick=async()=>{if(adBusy)return;adBusy=true;$('survey').disabled=true;document.body.inert=true;try{const r=await showRewarded();if(r.rewarded){surveyUntil=s.time+60;toast('Aerial survey active: gold marks show road frontage and low catchment.');track('survey');}}catch{toast('Ad unavailable. Your property is unchanged.');}finally{adBusy=false;$('survey').disabled=false;document.body.inert=false;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){propertyClock.suspend();save();ambience.update(s,false);}else propertyClock.resume();});
window.addEventListener('pagehide',save);
function checkStage(){const r=Stages.reachStage(s);if(r){toast(r.stage.name+' reached · '+P.cash(r.reward));map.life.celebrate(s,r.stage.name+' · '+P.cash(r.reward));if(panel)renderPanel();}}
const propertyClock=propertyTime(s,P.tick,report=>{
 $('awayText').textContent=(report.capped?'Away progress capped at two game days. ':'')+report.appliedSeconds+' game seconds passed · '+report.built+' projects finished · '+report.sold+' head sold · '+P.cash(report.money)+' net funds.';
 $('awayEvents').replaceChildren(...report.events.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
 $('away').showModal();
},()=>{checkStage();save();hud();if(panel)renderPanel();});
$('closeAway').onclick=()=>$('away').close();
$('objective').onclick=()=>openPanel('progress');
$('objective').tabIndex=0;$('objective').setAttribute('role','button');$('objective').setAttribute('aria-label','Open property stages and daily jobs');
$('objective').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel('progress');}};
propertyClock.sync();
let last=performance.now(),lastUI=0,lastSave=0,lastEvent=s.events[0]?.id;
function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;
 const active=document.body.dataset.view==='play'&&!document.hidden&&!document.querySelector('dialog[open]')&&!adBusy&&!propertyClock.busy;
 ambience.update(s,active&&speed>0);
 if(active){
 const before=s.jobs.map(j=>({id:j.id,type:j.type,building:j.building,heads:j.animalIds?.length||0})),guests=s.campGuests;
 if(speed>0)propertyClock.markPlayed();P.tick(s,dt*speed);checkStage();
 for(const job of before)if(!s.jobs.some(j=>j.id===job.id)){
 if(job.type!=='walk')track(job.type==='build'?'build_completed':job.type==='sell'?'sale':job.type,{heads:job.heads,building:job.building});
 if(job.type==='sell'){map.life.celebrate(s,s.events.find(e=>e.text.includes(' head sold'))?.text||'Livestock sold');ambience.payoff('sale');}
 if(job.type==='muster'||job.type==='rotate'){map.life.celebrate(s,job.heads+' head safely '+(job.type==='muster'?'in the yards':'on fresh pasture'),'muster');ambience.payoff('muster');}
 if(job.type==='harvest'||job.type==='harvestField'){map.life.celebrate(s,job.type==='harvestField'?'Field harvested':'Fresh produce ready for the shop','harvest');ambience.payoff('harvest');}
 }
 if(s.campGuests>guests)track('camp_checkin',{guests:s.campGuests,income:s.campIncome});
 }
 if(document.body.dataset.view==='play'){
 map.draw(prefs.motion?now:0,prefs.motion);
 if(surveyUntil>s.time){for(const p of [[2,6,'ROAD FRONTAGE'],[9,12,'LOW CATCHMENT']])map.label(...p,true);}
 if(now-lastUI>500){hud();if(['fields','progress'].includes(panel))renderPanel();lastUI=now;}
 if(now-lastSave>3000){save();lastSave=now;}
 if(s.events[0]?.id!==lastEvent){lastEvent=s.events[0]?.id;toast(s.events[0].text);sound();if(panel)renderPanel();save();track('property_progress',{built:s.stats.built,sold:s.stats.sold});}
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
bannerOnScreens('view',['home','play']);initAds().catch(()=>{});
Object.defineProperty(window,'__homesteadPropertyQA',{get:()=>({state:JSON.parse(JSON.stringify(s)),selected,speed,point:(x,y)=>map.point(x,y)})});
// The original clock-protected crop game remains available at legacy.html.
