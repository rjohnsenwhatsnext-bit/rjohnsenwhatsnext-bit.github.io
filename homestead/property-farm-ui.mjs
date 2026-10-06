import * as F from './fields.mjs';
import * as S from './stages.mjs';
import {dailyJobs} from './daily.mjs';
import {cash} from './property.mjs';
const btn=(label,attrs,disabled=false)=>`<button class="wide" ${attrs}${disabled?' disabled':''}>${label}</button>`;
const note=text=>`<p class="panel-note">${text}</p>`;
const card=(title,text,buttons='')=>`<article class="farm-card"><h3>${title}</h3>${note(text)}${buttons}</article>`;
export function farmPanel(s,panel,dayKey){
 if(panel==='fields'){
  let html=note(`${F.seasonOf(s)} · Lay out a field, work the soil, sow, then harvest. Your own tractor needs the matching implement; otherwise a contractor is hired. Vegetables can be picked by hand.`);
  for(const [id,p] of Object.entries(F.PATHS))html+=btn(`Lay out ${p.name.toLowerCase()} · $150 / square`,`data-field-path="${id}"`,!S.unlocked(s,p.unlock));
  if(!S.unlocked(s,'grain'))html+=note('Reach Small farm to unlock grain and vegetables. A home, four completed projects and a garden harvest will get you started.');
  for(const b of F.fields(s)){
   const crop=F.CROPS[b.crop],busy=s.jobs.some(j=>j.building===b.id),area=b.w*b.h;
   let actions='';const action=(label,type,extra='',disabled=false)=>btn(label,`data-field-task="${type}" data-field="${b.id}" ${extra}`,busy||disabled);
   const cost=(type,seed=0)=>{const worker=s.workers[0];const r=F.fieldJob(s,worker,type,{field:b.id,crop:seed||undefined});return r?.reason?r.reason:r?.job?`${cash(r.cost)} · ${r.job.hire?'contractor':r.job.machine?'your machinery':'by hand'}`:'';};
   if(b.stage==='bare')actions+=action('Work ground · '+cost('workGround'),'workGround');
   if(b.stage==='worked')for(const [id,c] of Object.entries(F.CROPS).filter(([,c])=>c.path===b.path)){
    const inSeason=c.sow.includes(F.seasonOf(s));actions+=action(`Sow ${c.name} · ${inSeason?cost('sow',id):'plant in '+c.sow.join(' / ')}`,'sow',`data-crop="${id}"`,!inSeason);
   }
   if(b.stage==='growing'&&!b.sprayed)actions+=action('Spray · '+cost('spray'),'spray');
   if(b.stage==='ready')actions+=action('Harvest · '+cost('harvestField'),'harvestField','',Boolean(crop?.harvestIn&&!crop.harvestIn.includes(F.seasonOf(s))));
   actions+=btn('Show field on map',`data-field-focus="${b.id}"`);
   const progress=b.stage==='ready'?100:b.stage==='growing'?Math.min(100,Math.max(0,100*(s.time-b.sownAt)/(b.ready-b.sownAt))):0;
   html+=card(`${crop?.name||F.PATHS[b.path]?.name||'Crop'} field · ${b.w} × ${b.h}`,`${area} squares · ${b.stage}${b.stage==='growing'?' · '+Math.max(0,Math.ceil(b.ready-s.time))+' game seconds remaining':''}${busy?' · worker assigned':''}${b.sprayed?' · sprayed':''}`,`<progress max="100" value="${progress}" aria-label="Crop growth"></progress>`+actions);
  }
  for(const what of ['grain','cane'])html+=btn(`Deliver ${what} · ${Number((s.store?.[what]||0).toFixed(1))} loads`,`data-deliver="${what}"`,!(s.store?.[what]>0)||s.jobs.some(j=>j.type==='deliver'&&j.what===what));
  html+=note('Grain and cane are paid on delivery. Vegetable crates go to your farm shop. Delivery costs $40 plus $2 per load; a carrier is hired if you have no truck.');
  return {title:'Fields & crops',html};
 }
 if(panel==='machinery'){
  let html=note('Equipment is collected for compatible field jobs. Buy a tractor and plough to work soil, then the right planting implement. Machines are shared between workers.');
  for(const [id,m] of Object.entries(F.MACHINES)){
   const owned=s.machines?.includes(id),available=S.unlocked(s,m.unlock);
   const role=m.kind==='tractor'?'Pulls field implements':m.kind==='harvester'?'Harvests '+m.paths.join(' / '):m.for==='work'?'Prepares bare soil':m.for==='spray'?'Improves a growing crop':'Plants '+m.paths.join(' / ');
   html+=card(m.name,role,btn(owned?'Owned':available?'Buy · '+cash(m.cost):'Unlocks at '+S.STAGES.find(st=>st.unlocks.includes(m.unlock))?.name,`data-machine="${id}"`,owned||!available));
  }
  return {title:'Farm machinery',html};
 }
 if(panel==='progress'){
  const next=S.nextStage(s);let html=card(S.stageOf(s).name,`${s.acres} acres · Grow the property through gardens, livestock or field crops.`);
  if(next)html+=card('Next: '+next.name,`Reward ${cash(next.reward)} · ${next.done} of ${next.of} requirements met`,`<ul class="milestones">${next.needs.map(n=>`<li class="${n.done?'done':''}">${n.done?'✓':'○'} ${n.text}</li>`).join('')}</ul>`);
  else html+=card('Your big station','All property stages reached. Keep shaping the property your way.');
  html+=btn('Fields & crops','data-panel="fields"')+btn('Farm machinery','data-panel="machinery"');
  if(!dayKey)html+=card('Daily jobs need an internet connection','Your property remains playable. Connect to check today’s board and time away.',btn('Check connection','data-clock-retry="true"'));
  else{
   const board=dailyJobs(s,dayKey);
   html+=card('Today around the property',`${board.day} · Brisbane time · ${board.streak} day reward streak`,board.jobs.map(j=>`<div class="daily-job"><b>${j.done?'✓ ':''}${j.text}</b><span>${j.progress} / ${j.target}</span><progress value="${j.progress}" max="${j.target}" aria-label="${j.text}"></progress></div>`).join('')+btn(board.claimed?'Today’s reward collected':'Collect '+cash(board.reward),'data-daily-claim="true"',board.claimed||!board.allDone));
  }
  return {title:'Your next chapter',html};
 }
 return null;
}
