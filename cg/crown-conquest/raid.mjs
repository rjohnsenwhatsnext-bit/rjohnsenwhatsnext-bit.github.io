import {hitMultiplier} from './counters.mjs';
import {commandBonus} from './commanders.mjs';
import {createBattle,safeProfile} from './battle.mjs';
import {ensureFrontier,rivalProfile} from './frontier.mjs';
import {battleProfile} from './town.mjs';
import {AGES} from './ages.mjs';
import {BUILDINGS} from './catalog.mjs';
export const RAID_WORLD={width:360,height:300,home:{x:165,y:160},bridges:[62,148,218]};
export const riverX=y=>200+Math.sin(y*.035)*12;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const layout=[['keep',0,0,0,1900],['house-west',5,-15,9,430],['house-east',5,14,9,430],['barracks',6,-15,-12,850],['store',4,14,-12,600],['bell',10,0,-21,1050],['farm',1,-3,20,450]];
const radius=b=>b.kind==='keep'?8:b.kind==='bell'?4:5;
export function createRaid(town,targetSite){
 const f=ensureFrontier(town),player=battleProfile(town),s=createBattle(player,rivalProfile(town,targetSite)||player);
 Object.assign(s,{raid:true,world:RAID_WORLD,structures:[],projectiles:[],captures:[],settled:false,reserves:{},reinforceAt:{},targetSite,selectedTarget:null,orders:[{x:155,y:177},{...RAID_WORLD.home}]});
 s.units=s.units.filter(u=>u.side===0);for(let i=0;i<s.units.length;i++){const u=s.units[i];u.x=145+(i%8)*2.3;u.y=177+Math.floor(i/8)*2.5;u.profile=s.profiles[0];u.phase=i;}
 let nextId=1000;
 for(const v of f.sites){
  const profile=safeProfile(rivalProfile(town,v.id)),age=AGES.find(a=>a.id===profile.age),cx=v.x*3.6,cy=v.y*3;
  for(const [kind,art,dx,dy,hp]of layout){const id=v.id+':'+kind,max=hp*(1+v.level*.04),ratio=clamp(Number(v.damage?.[kind]??1),0,1);s.structures.push({id,site:v.id,name:v.name,kind,art,x:cx+dx,y:cy+dy,max,hp:max*ratio,side:v.owned?0:1,profile,age:age.art,cool:0,downAt:ratio===0?-100:null,lootClaimed:ratio===0,fall:(nextId++%2?1:-1)});}
  if(!v.owned){const garrison=createBattle(profile,profile).units.filter(u=>u.side===0);for(let i=0;i<Math.min(14,garrison.length);i++){const u=garrison[i];Object.assign(u,{id:nextId++,side:1,x:cx-12+(i%7)*4,y:cy+12+Math.floor(i/7)*3,site:v.id,home:{x:cx,y:cy+9},profile,phase:i});s.units.push(u);}s.reserves[v.id]=Math.max(0,v.troops-14);}
 }
 s.nextId=nextId;
 s.keeps=[{id:'camp',x:165,y:160,hp:1800,max:1800,side:0}];
 return s;
}
// Every fight happens on the one open map (Ryan, 22 Oct 2026: the two-bridge arena
// "fuck that shit right off, make the missions all a part of the one map").
// Campaign and practice fights put a single enemy camp at a fixed place on the
// map; a frontier defence sends the raiders from their settlement at your camp.
export const MISSION_CAMPS=[{x:110,y:110},{x:255,y:120},{x:240,y:25},{x:150,y:268},{x:300,y:205}];
export function createSiege(town,enemy,{kind='campaign',mission=0,site=null}={}){
 const s=createBattle(battleProfile(town),enemy,{mission}),profile=s.profiles[1],age=AGES.find(a=>a.id===profile.age)||AGES[0];
 Object.assign(s,{raid:true,siege:kind,world:RAID_WORLD,structures:[],projectiles:[],captures:[],settled:false,reserves:{},reinforceAt:{},targetSite:null,selectedTarget:null,orders:[{x:155,y:177},{...RAID_WORLD.home}],nextId:2000});
 const home=s.units.filter(u=>u.side===0),foes=s.units.filter(u=>u.side===1);
 home.forEach((u,i)=>Object.assign(u,{x:145+(i%8)*2.3,y:177+Math.floor(i/8)*2.5,profile:s.profiles[0],phase:i}));
 if(kind==='defence'){
  const v=ensureFrontier(town).sites.find(v=>v.id===site),from=v?{x:v.x*3.6,y:v.y*3}:{x:300,y:60};
  // the raiders march on your camp; the first troops they meet stop them
  foes.forEach((u,i)=>Object.assign(u,{x:from.x-8+(i%6)*3,y:from.y+Math.floor(i/6)*3,home:{...RAID_WORLD.home},profile,phase:i}));
 }else{
  const camp=MISSION_CAMPS[mission%MISSION_CAMPS.length],id=kind==='ally'?'ally':'mission'+mission;
  // the old arena keep had 650 x fortress and shot for 13; a camp matches it so
  // the campaign is no harder than before
  for(const [k,art,dx,dy,hp]of layout){const max=hp*650/1900*profile.fortress;s.structures.push({id:id+':'+k,site:id,name:enemy?.name||'Enemy camp',kind:k,art,x:camp.x+dx,y:camp.y+dy,max,hp:max,side:1,profile,age:age.art,cool:0,power:.35,downAt:null,lootClaimed:false,fall:s.nextId++%2?1:-1});}
  foes.forEach((u,i)=>Object.assign(u,{x:camp.x-12+(i%7)*4,y:camp.y+12+Math.floor(i/7)*3,site:id,home:{x:camp.x,y:camp.y+9},profile,phase:i}));
  s.targetSite=id;
 }
 s.keeps=[{id:'camp',x:165,y:160,hp:1800,max:1800,side:0}];
 return s;
}
// Friend battles (Ryan, 22 Oct 2026: "friends should be able to battle their entire
// cities against each other"): each player's real city, every building where they
// built it, either side of the river. Taking the other keep, or wiping out the
// other army, wins.
const CITY={keep:['keep',1600],farm:['farm',450],lumber:['lumber',450],quarry:['quarry',500],mine:['mine',550],house:['house',430],barracks:['barracks',850],range:['range',700],stable:['stable',750],workshop:['workshop',800],tower:['bell',1050],wall:['wall',1200],granary:['granary',550],market:['market',600],sanctuary:['sanctuary',750]};
export const DUEL_CITIES=[{x:95,y:150},{x:290,y:150}];
export function cityOf(town){return (town.buildings||[]).map(b=>({type:b.type,x:b.x,y:b.y,level:b.level}));}
export function createDuel(a,b){
 const s=createBattle(a,b,{ai:false}),cities=[a?.city,b?.city];
 Object.assign(s,{raid:true,siege:'duel',world:RAID_WORLD,structures:[],projectiles:[],captures:[],settled:false,reserves:{},reinforceAt:{},targetSite:null,selectedTarget:null,orders:[{...DUEL_CITIES[0]},{...DUEL_CITIES[1]}],nextId:3000,keeps:[]});
 for(const side of [0,1]){
  const profile=s.profiles[side],age=(AGES.find(v=>v.id===profile.age)||AGES[0]).art,c=DUEL_CITIES[side];
  // a city as sent by the friend's game: known buildings on the 9 by 9 plot only, and always one keep
  let plan=(Array.isArray(cities[side])?cities[side]:[]).filter(v=>CITY[v?.type]&&Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>=1&&v.x<=9&&v.y>=1&&v.y<=9).slice(0,81);
  plan=plan.filter((v,i)=>plan.findIndex(w=>w.x===v.x&&w.y===v.y)===i);
  if(!plan.some(v=>v.type==='keep'))plan=[{type:'keep',x:5,y:5,level:1},...plan.filter(v=>!(v.x===5&&v.y===5))];
  for(const v of plan){const [kind,hp]=CITY[v.type],level=clamp(Math.floor(Number(v.level))||1,1,10),max=hp*(1+.15*(level-1))*650/1900*profile.fortress,art=BUILDINGS[v.type].art;
   // the east city is the west one turned round, so both keeps face the river
   const gx=side?10-v.x:v.x;
   s.structures.push({id:side+':'+v.type+':'+v.x+':'+v.y,site:'city'+side,name:profile.name,kind,art,x:c.x+(gx-5)*9,y:c.y+(v.y-5)*9,max,hp:max,side,profile,age,cool:0,power:.35,size:kind==='keep'?26:15,downAt:null,lootClaimed:false,fall:s.nextId++%2?1:-1});}
  s.units.filter(u=>u.side===side).forEach((u,i)=>Object.assign(u,{x:c.x+(side?-40:40)+(i%6)*2.5,y:c.y-8+Math.floor(i/6)*2.5,home:{x:c.x+(side?-40:40),y:c.y},profile,phase:i}));
 }
 return s;
}
// The host sends the whole fight to the guest ten times a second. Each soldier and
// building carried its own copy of its player's profile, which made a starter city
// 15 KB a message and dropped the connection, so they travel without it and the
// guest puts it back from the two profiles.
const trim=v=>typeof v==='number'?Math.round(v*100)/100:v;
// a light snapshot sends each soldier as only what the guest draws
const SEEN=['id','type','side','x','y','hp','max','phase','moving','direction','lastShot'];
export function packDuel(s,light=false){return{...s,light,units:s.units.map(({profile,stats,...u})=>light?SEEN.map(k=>u[k]===undefined?null:trim(u[k])):Object.fromEntries(Object.entries(u).map(([k,v])=>[k,trim(v)]))),structures:light?s.structures.map(b=>({id:b.id,hp:trim(b.hp),downAt:b.downAt,hitAt:b.hitAt})):s.structures.map(({profile,...b})=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,trim(v)]))),stats:Object.fromEntries([0,1].map(side=>[side,Object.fromEntries(s.units.filter(u=>u.side===side).map(u=>[u.type,u.stats]))]))};}
// a light snapshot carries only building health, laid over the buildings the guest already has
export function unpackDuel(s,previous){if(!s?.stats)return s;s.units=s.units.map(u=>Array.isArray(u)?Object.fromEntries(SEEN.map((k,i)=>[k,u[i]]).filter(([,v])=>v!==null)):u);if(s.light){const had=new Map((previous?.structures||[]).map(b=>[b.id,b]));s.structures=s.structures.map(b=>had.has(b.id)?Object.assign(had.get(b.id),b):b).filter(b=>b.kind);}delete s.light;for(const u of s.units){u.profile=s.profiles[u.side];u.stats=s.stats[u.side]?.[u.type];}for(const b of s.structures)b.profile=s.profiles[b.side];delete s.stats;return s;}
export function orderRaid(s,side,a){
 const duel=s.siege==='duel';
 if(s.winner!==null||!(side===0||(duel&&side===1))||!a||!['all','sword','archer','knight','siege','commander'].includes(a.group)||!Number.isFinite(a.x)||!Number.isFinite(a.y))return false;
 const x=clamp(a.x,5,s.world.width-5),y=clamp(a.y,5,s.world.height-5);
 const target=s.structures.filter(b=>b.side!==side&&b.hp>0&&Math.hypot(b.x-x,b.y-y)<11).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
 if(duel){s.selected??=[null,null];s.selected[side]=target?.id||null;}else s.selectedTarget=target?.id||null;
 for(const u of s.units)if(u.side===side&&(a.group==='all'||u.type===a.group))u.order={x,y,target:target?.id};
 s.orders[side]={x,y};return true;
}
export function nextRaidTarget(s,side=0){
 if(s.siege==='duel')return s.structures.find(b=>b.side!==side&&b.kind==='keep'&&b.hp>0)||DUEL_CITIES[1-side];
 const selected=s.structures.find(b=>b.site===s.targetSite&&b.kind==='keep'&&b.hp>0&&b.side===1);if(selected)return selected;
 const army=s.units.filter(u=>u.side===0&&u.hp>0),x=army.reduce((n,u)=>n+u.x,0)/(army.length||1),y=army.reduce((n,u)=>n+u.y,0)/(army.length||1);
 // a defence has no camp to take: advance on the nearest raider
 if(s.siege==='defence')return s.units.filter(u=>u.side===1&&u.hp>0).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||s.world.home;
 return s.structures.filter(b=>b.kind==='keep'&&b.side===1&&b.hp>0).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||s.world.home;
}
function move(s,u,destination,dt){
 let x=destination.x,y=destination.y;
 const left=u.x<riverX(u.y),targetLeft=x<riverX(y);
 if(left!==targetLeft||Math.abs(u.x-riverX(u.y))<8){
  const bridge=s.world.bridges.reduce((a,b)=>Math.abs(u.y-a)+Math.abs(y-a)<Math.abs(u.y-b)+Math.abs(y-b)?a:b),bx=riverX(bridge);
  if(Math.abs(u.y-bridge)>2&&Math.abs(u.x-riverX(u.y))>8){x=bx+(left?-12:12);y=bridge;}
  else {x=bx+(targetLeft?-12:12);y=bridge;}
 }
 let dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<.2)return;
 const step=Math.min(d,u.stats.speed*dt);let nx=u.x+dx/d*step,ny=u.y+dy/d*step;
 // Solid footprints: troops move around intact buildings; rubble opens the route.
 for(const b of s.structures)if(b.hp>0){const r=radius(b)+.8,dist=Math.hypot(nx-b.x,ny-b.y);if(dist<r){const angle=Math.atan2(ny-b.y,nx-b.x);nx=b.x+Math.cos(angle)*r;ny=b.y+Math.sin(angle)*r;}}
 u.phase=(u.phase||0)+Math.hypot(nx-u.x,ny-u.y)*1.6;u.direction=nx<u.x?-1:1;u.moving=true;u.x=clamp(nx,3,357);u.y=clamp(ny,3,297);
}
export function damageStructure(s,b,amount){
 if(b.hp<=0)return false;b.hp=Math.max(0,b.hp-amount);b.hitAt=s.time;
 if(b.hp===0){b.downAt=s.time;if(b.kind==='keep'&&s.siege!=='duel'&&!s.captures.includes(b.site)){s.captures.push(b.site);for(const other of s.structures)if(other.site===b.site&&other.hp>0)other.side=0;}}
 return true;
}
function impact(s,p){
 const targets=[...s.units,...s.structures];
 for(const v of targets){if(v.hp<=0||v.side===p.side)continue;const d=Math.hypot(v.x-p.tx,v.y-p.ty);if(v.id!==p.target&&d>(p.siege?4:0))continue;
  const damage=p.damage*(v.kind?(p.siege?3:0.65):1)*(v.id===p.target?1:.45);
  if(v.kind)damageStructure(s,v,damage);else v.hp=Math.max(0,v.hp-damage);
 }
 s.effects.push({x:p.tx,y:p.ty,start:s.time,life:p.siege?1.1:.25,siege:p.siege});
}
export function stepRaid(s,dt){
 if(s.paused||s.winner!==null)return;dt=clamp(dt,0,.1);s.time+=dt;s.effects=s.effects.filter(e=>(e.life-=dt)>0);
 for(const p of s.projectiles)p.elapsed+=dt;
 for(const p of s.projectiles.filter(p=>p.elapsed>=p.duration))impact(s,p);
 s.projectiles=s.projectiles.filter(p=>p.elapsed<p.duration);
 for(const [site,reserve]of Object.entries(s.reserves)){if(!reserve||s.time<(s.reinforceAt[site]||0))continue;const barracks=s.structures.find(b=>b.site===site&&b.kind==='barracks'&&b.hp>0&&b.side===1),bell=s.structures.find(b=>b.site===site&&b.kind==='bell'&&b.hp>0&&b.side===1);if(!barracks||!bell||!s.units.some(u=>u.side===0&&u.hp>0&&Math.hypot(u.x-bell.x,u.y-bell.y)<50))continue;const template=s.units.find(u=>u.site===site);if(template&&s.units.filter(u=>u.site===site&&u.hp>0).length<14){const u=structuredClone(template);Object.assign(u,{id:s.nextId++,hp:u.max,x:barracks.x-8,y:barracks.y+6,home:{x:barracks.x,y:barracks.y+8},order:null});s.units.push(u);s.reserves[site]--;s.reinforceAt[site]=s.time+5;}}
 const alive=s.units.filter(u=>u.hp>0);
 for(const u of alive){u.moving=false;u.cool-=dt;const explicit=u.order?.target&&s.structures.find(b=>b.id===u.order.target&&b.hp>0&&b.side!==u.side);let target=explicit||null,best=target?Math.max(0,Math.hypot(u.x-target.x,u.y-target.y)-radius(target)):Infinity;
  // in a map battle, troops sent at the keep still fight off defenders who reach them
  if(explicit&&s.siege){let near=null,nd=Math.max(20,u.stats.range+3);for(const v of alive)if(v.side!==u.side){const d=Math.hypot(v.x-u.x,v.y-u.y);if(d<=nd){near=v;nd=d;}}if(near){target=near;best=nd;}}
  if(!explicit)for(const v of alive)if(v.side!==u.side){const d=Math.hypot(v.x-u.x,v.y-u.y);if(d<best&&d<(u.side===1&&s.siege!=='duel'?42:Math.max(16,u.stats.range+3))){target=v;best=d;}}
  if((u.side===0||s.siege==='duel')&&!target)for(const b of s.structures)if(b.side!==u.side&&b.hp>0){const d=Math.max(0,Math.hypot(u.x-b.x,u.y-b.y)-radius(b));if(d<best&&d<=u.stats.range+3){target=b;best=d;}}
  if(target&&best<=u.stats.range+.5){if(u.cool<=0){u.cool=u.stats.period;u.lastShot=s.time;const siege=u.type==='siege',distance=Math.hypot(target.x-u.x,target.y-u.y);s.projectiles.push({x:u.x,y:u.y,tx:target.x,ty:target.y,target:target.id,side:u.side,siege,damage:u.stats.attack*(u.profile?.attack||1)*commandBonus(u.profile?.commander,u.type,'attack')*hitMultiplier(u.type,(u.profile||s.profiles[u.side])?.faction,target.type,(target.profile||s.profiles[target.side])?.faction),elapsed:0,duration:siege?Math.max(.35,distance/40):.16});}}
  else if(target)move(s,u,target,dt);else if(u.side===0||s.siege==='duel')move(s,u,u.order||s.orders[u.side],dt);else if(Math.hypot(u.x-u.home.x,u.y-u.home.y)>4)move(s,u,u.home,dt);
 }
 // Siege alerts wake a camp; surviving bell towers call its defenders toward attackers.
 for(const b of s.structures)if((b.side===1||s.siege==='duel')&&b.hp>0&&(b.kind==='bell'||b.kind==='keep')){b.cool-=dt;const enemy=alive.find(u=>u.side!==b.side&&Math.hypot(u.x-b.x,u.y-b.y)<(b.kind==='bell'?26:18));if(enemy&&b.cool<=0){b.cool=b.kind==='bell'?2:1.4;s.projectiles.push({x:b.x,y:b.y,tx:enemy.x,ty:enemy.y,target:enemy.id,side:b.side,siege:false,damage:(b.kind==='bell'?18:24)*(b.power??1),elapsed:0,duration:.3});}}
 for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){const a=alive[i],b=alive[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>0&&d<1.6){const p=(1.6-d)*.15,dx=(a.x-b.x)/d*p,dy=(a.y-b.y)/d*p;a.x+=dx;a.y+=dy;b.x-=dx;b.y-=dy;}}
 // a duel ends when either keep falls or either army is gone
 if(s.siege==='duel'){for(const side of [0,1])if(!s.units.some(u=>u.side===side&&u.hp>0)||!s.structures.some(b=>b.side===side&&b.kind==='keep'&&b.hp>0)){s.winner=1-side;break;}}
 else if(!s.units.some(u=>u.side===0&&u.hp>0))s.winner=1;
 else if(s.siege==='defence'?!s.units.some(u=>u.side===1&&u.hp>0):!s.structures.some(b=>b.kind==='keep'&&b.side===1&&b.hp>0)){s.victoryAt??=s.time;if(s.time-s.victoryAt>2.2)s.winner=0;}
}
export function settleRaid(town,s){
 // a map fight that is not a frontier raid has no settlements to update
 if(!s.raid||s.settled||s.siege)return false;s.settled=true;const f=ensureFrontier(town);
 for(const v of f.sites){if(v.owned)continue;v.damage??={};for(const b of s.structures.filter(b=>b.site===v.id)){if(b.hp<=0&&(v.damage[b.kind]??1)>0&&b.kind!=='keep'){town.resources.gold=Math.min(50000,town.resources.gold+35);town.resources.wood=Math.min(50000,town.resources.wood+20);town.xp+=8;}v.damage[b.kind]=clamp(b.hp/b.max,0,1);}
  const survivors=s.units.filter(u=>u.site===v.id&&u.hp>0).length;v.troops=survivors+(s.reserves[v.id]||0);
  if(s.captures.includes(v.id)){v.owned=true;v.captured++;v.troops=0;town.xp+=60+v.level*25;town.chests=Math.min(1000,town.chests+1);town.resources.gold=Math.min(50000,town.resources.gold+100+v.level*60);f.reports.unshift('Captured '+v.name+' in an open-world raid.');}
 }
 f.pending=null;f.peaceUntil=f.time+300;f.reports=f.reports.slice(0,8);return true;
}

// Save a settled copy each normal autosave; closing the app cannot undo casualties
// or replay building loot. The live expedition continues without being mutated.
export function raidCheckpoint(town,s){if(s.siege)return town;const copy=structuredClone(town),raid=structuredClone(s);for(const k of Object.keys(copy.army)){const alive=s.units.filter(u=>u.side===0&&u.type===k&&u.hp>0).length;copy.army[k]=Math.max(0,copy.army[k]-(s.profiles[0].army[k]-alive));}settleRaid(copy,raid);return copy;}
