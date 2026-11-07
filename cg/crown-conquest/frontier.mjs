// Persistent frontier simulation. Time advances only during active, unpaused play.
import {AGES,ageOf} from './ages.mjs';
export const SITES=[
 ['ashford','Ashford Crossing','ironfjord',22,30],['saffron','Saffron Oasis','sunspire',72,24],
 ['pinewatch','Pinewatch Hold','verdant',42,15],['ironport','Ironport Foundry','ironfjord',86,52],
 ['glassmere','Glassmere Court','sunspire',65,78],['thornwall','Thornwall','verdant',20,75],
 ['frostgate','Frostgate','ironfjord',10,53],['sunreach','Sunreach Arsenal','sunspire',88,85]
].map(([id,name,faction,x,y])=>({id,name,faction,x,y}));
const bound=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
export function ensureFrontier(s){
 const old=s.frontier;
 if(old?.version===1&&Array.isArray(old.sites)&&old.sites.length===SITES.length&&old.sites.every((v,i)=>v?.id===SITES[i].id))return old;
 return s.frontier={version:1,time:0,wave:1,peaceUntil:600,sites:SITES.map((v,i)=>({...v,level:1,stores:0,troops:4+i,owned:false,captured:0,raidAt:600+i*100})),raids:[],reports:['Scouts have charted eight rival settlements.'],pending:null};
}
export function restoreFrontier(s){
 const f=ensureFrontier(s);f.time=bound(f.time,1e9);f.wave=Math.max(1,Math.floor(bound(f.wave,10000)));f.peaceUntil=bound(f.peaceUntil,1e9);
 f.sites=f.sites.map((v,i)=>({...SITES[i],level:Math.max(1,Math.floor(bound(v.level,20))),stores:bound(v.stores,10000),troops:Math.floor(bound(v.troops,60)),owned:v.owned===true,captured:Math.floor(bound(v.captured,10000)),raidAt:bound(v.raidAt,1e9),scouted:v.scouted===true,scoutAt:bound(v.scoutAt,1e9),probed:v.probed===true,damage:Object.fromEntries(Object.entries(v.damage||{}).filter(([k,val])=>['keep','house-west','house-east','barracks','store','bell','farm'].includes(k)&&Number.isFinite(val)).map(([k,val])=>[k,Math.min(1,Math.max(0,val))]))}));
 f.raids=Array.isArray(f.raids)?f.raids.filter(r=>SITES.some(v=>v.id===r.site)&&Number.isFinite(r.arrives)&&Number.isFinite(r.departed)&&r.arrives>r.departed).slice(0,2).map(r=>({...r,troops:Math.max(1,Math.floor(bound(r.troops,30)))})):[];
 f.reports=Array.isArray(f.reports)?f.reports.filter(x=>typeof x==='string').slice(0,8):[];
 f.alerts=[];f.pending=null;return f;
}
function report(f,text){f.reports.unshift(text);f.reports=f.reports.slice(0,8);}
// rivals gather, level up and recruit; owned outposts pay gold
function grow(s,f,dt){
 for(const v of f.sites){
  if(v.owned){s.resources.gold=Math.min(50000,s.resources.gold+dt*.12*v.level);continue;}
  v.stores+=dt*(.7+v.level*.12)*(v.damage?.store===0?.4:1);
  if(v.stores>=80&&v.level<Math.min(20,2+Math.floor(f.time/600))){v.stores-=80;v.level++;}
  else if(v.stores>=100&&v.damage?.barracks!==0&&v.troops<(60-(v.damage?.['house-west']===0?12:0)-(v.damage?.['house-east']===0?12:0))){v.stores-=100;v.troops++;}
 }
}
const yourArmy=s=>Object.values(s.army||{}).reduce((n,v)=>n+(Number.isFinite(v)?v:0),0);
// Rivals probe before they attack (Ryan, 25 Oct 2026): scouts are seen two minutes before a raid sets
// out, a rival's first raid is a small war party testing your walls, and later raids come in bigger
// when your army looks thin and smaller when it looks strong.
function raidSize(s,v){
 const base=Math.min(24,Math.floor(v.troops*.55));
 if(!v.probed)return {troops:Math.min(base,3+Math.floor(v.level/2)),probe:true};
 const yours=yourArmy(s),scale=yours<base?1.25:yours>base*2?.75:1;
 return {troops:Math.max(1,Math.min(24,v.troops,Math.round(base*scale))),probe:false};
}
function alert(f,text){report(f,text);(f.alerts||(f.alerts=[])).push(text);}
export function tickFrontier(s,seconds){
 const f=ensureFrontier(s);if(f.pending)return;const dt=bound(seconds,5);f.time+=dt;
 grow(s,f,dt);
 for(const v of f.sites){
  if(v.owned)continue;
  if(!v.scouted&&f.time>=f.peaceUntil&&f.time>=v.raidAt-120&&v.troops>=8&&f.raids.length<2){v.scouted=true;v.scoutAt=f.time;alert(f,v.name+' scouts were seen near your walls. A raid may follow.');}
  // the raid sets out two minutes after its scouts were seen, never in the same moment
  if(v.scouted&&f.time>=f.peaceUntil&&f.time>=Math.max(v.raidAt,v.scoutAt+120)&&v.troops>=8&&f.raids.length<2){
   const {troops,probe}=raidSize(s,v);v.troops-=troops;v.raidAt=f.time+600;v.scouted=false;v.probed=true;
   f.raids.push({site:v.id,troops,departed:f.time,arrives:f.time+120});report(f,probe?v.name+' sends a small war party to test your walls.':v.name+' is marching on your capital. Intercept or prepare your defence.');
  }
 }
 const arrived=f.time>=f.peaceUntil&&f.raids.find(r=>r.arrives<=f.time);if(arrived){f.pending={site:arrived.site,defence:true,troops:arrived.troops};}
}
// Time away from the game no longer freezes the frontier (Ryan, 25 Oct 2026). Rivals keep growing at a
// quarter of live speed for up to 8 hours away, and at most two raids are settled against your army and
// walls. Nothing here touches a building: a lost defence costs at most 5% of each resource, capped at
// 100, the same as losing one live. New kingdoms are shielded until their first victory. Returns the
// lines to show the player; an empty list means nothing worth telling.
export function awayFrontier(s,seconds){
 const f=ensureFrontier(s),out=[],away=Math.min(bound(seconds,1e9),8*3600);
 if(away<300||f.pending)return out;
 const levels=f.sites.map(v=>v.level),world=away/4;
 for(let t=0;t<world;t+=5){const dt=Math.min(5,world-t);f.time+=dt;grow(s,f,dt);}
 const grew=f.sites.filter((v,i)=>!v.owned&&v.level>levels[i]);
 if(grew.length)out.push(grew.length===1?grew[0].name+' grew stronger while you were away.':grew[0].name+' and '+(grew.length-1)+' other rival'+(grew.length>2?'s':'')+' grew stronger while you were away.');
 if(!(s.wins>0)){if(grew.length)out.push('Win your first battle and they will start testing your walls.');return out;}
 const marching=f.raids.map(r=>({v:f.sites.find(v=>v.id===r.site),troops:r.troops}));f.raids=[];
 const due=f.sites.filter(v=>!v.owned&&v.troops>=8&&f.time>=f.peaceUntil&&f.time>=v.raidAt).sort((a,b)=>a.raidAt-b.raidAt);
 for(const v of due){if(marching.length>=2)break;const {troops,probe}=raidSize(s,v);v.troops-=troops;v.probed=true;marching.push({v,troops,probe});}
 for(const {v,troops,probe} of marching.slice(0,2)){
  if(!v)continue;out.push(v.name+' scouts were seen at your walls.');
  const held=yourArmy(s)+4>=troops;
  if(held){const gold=50+v.level*20;s.resources.gold=Math.min(50000,s.resources.gold+gold);s.xp+=10+v.level*5;out.push((probe?'A small war party from ':'A raid from ')+v.name+' broke on your walls. You took '+gold+' gold from the field.');}
  else{const lost={};for(const k of ['food','wood','stone','gold']){const n=Math.min(100,Math.floor(s.resources[k]*.05));s.resources[k]=Math.max(0,s.resources[k]-n);lost[k]=n;}const taken=Object.entries(lost).filter(([,n])=>n>0).map(([k,n])=>n+' '+k).join(', ');out.push(v.name+(taken?' raided your stores and carried off '+taken:' raided your stores and found nothing worth taking')+'. Your buildings stood. Train more troops before they return.');v.troops+=Math.floor(troops/2);}
  v.raidAt=f.time+600;v.scouted=false;report(f,out[out.length-1]);
 }
 f.peaceUntil=Math.max(f.peaceUntil,f.time+300);return out;
}
export function rivalProfile(s,id,troops){
 const f=ensureFrontier(s),v=f.sites.find(v=>v.id===id);if(!v)return null;
 const era=Math.min(4,Math.floor((v.level-1)/3));const n=Math.max(0,Math.floor(troops??v.troops));// each faction leans on what its trait is good at (counters.mjs), so the player has something to counter
 const lean={verdant:{knight:.25,archer:.2},ironfjord:{knight:.1,archer:.2},sunspire:{knight:.1,archer:.45}}[v.faction]||{knight:.15,archer:.3};
 const commander=era>=3&&n>=10?1:0,knight=era>=2?Math.floor(n*lean.knight):0,siege=era>=2?Math.floor(n*.1):0,archer=Math.floor(n*lean.archer);const army={sword:n-archer-knight-siege-commander,archer,knight,siege,commander};
 return {name:v.name,faction:v.faction,age:AGES[era].id,army,fortress:AGES[era].fortress,defence:Math.min(8,v.level/2)};
}
export function beginFrontierBattle(s,id,defence=false){
 const f=ensureFrontier(s),v=f.sites.find(v=>v.id===id);if(!v||v.owned&&!defence||f.pending&&!defence)return null;
 const raid=f.raids.find(r=>r.site===id);if(defence&&!raid)return null;f.pending={site:id,defence,troops:defence?raid?.troops:v.troops};
 return rivalProfile(s,id,f.pending.troops);
}
export function resolveFrontier(s,won){
 const f=ensureFrontier(s),p=f.pending;if(!p)return false;const v=f.sites.find(v=>v.id===p.site);f.pending=null;
 if(p.defence)f.raids=f.raids.filter(r=>r.site!==p.site);
 if(won){s.xp+=60+v.level*25;s.chests=Math.min(1000,s.chests+1);s.resources.gold=Math.min(50000,s.resources.gold+100+v.level*60);if(!p.defence){v.owned=true;v.captured++;v.troops=0;}report(f,(p.defence?'Raid repelled at ':'Captured ')+v.name+'. A war chest and spoils await.');}
 else{if(p.defence)for(const k of ['food','wood','stone','gold'])s.resources[k]=Math.max(0,s.resources[k]-Math.min(100,s.resources[k]*.05));report(f,'Regroup after '+v.name+'. Your buildings and age are safe.');}
 f.peaceUntil=f.time+300;v.raidAt=f.time+600;return true;
}
export function newFrontier(s){const f=ensureFrontier(s);if(!f.sites.every(v=>v.owned))return false;f.wave++;for(const v of f.sites){v.owned=false;v.damage={};v.level=Math.min(20,v.level+2);v.troops=Math.min(45,8+f.wave*3);v.raidAt=f.time+600;}f.peaceUntil=f.time+600;report(f,'Expedition '+f.wave+': new rival forces have entered the frontier.');return true;}
