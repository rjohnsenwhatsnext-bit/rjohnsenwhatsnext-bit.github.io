export const TRACKS=[{name:'Rustwater Run',subtitle:'The proving ground',length:2300,difficulty:1,seed:137},{name:'Crusher Alley',subtitle:'Heavy metal. Narrow escapes.',length:2850,difficulty:1.4,seed:421},{name:'Furnace Mile',subtitle:'Nothing left to lose',length:3300,difficulty:1.8,seed:829}];
export const CARS=[{name:'Rustbucket',tag:'Welded. Worn. Willing.',cost:0,color:'#ec954b'},{name:'Sidewinder',tag:'Low slung. Loud mouthed.',cost:220,color:'#56beb6'},{name:'Delivery of Doom',tag:'Your scrap has arrived.',cost:420,color:'#e8d8a8'}];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function course(index=0){const track=TRACKS[index]||TRACKS[0],random=rng(track.seed),items=[];let id=0;for(let z=120;z<track.length-100;z+=55/track.difficulty){const x=[-.68,0,.68][Math.floor(random()*3)],r=random();items.push({id:id++,z,x,type:r<.17?'ramp':r<.40?'scrap':r<.63?'crate':r<.85?'barrel':'crusher',phase:random()*6.28});if(random()<.3)items.push({id:id++,z:z+16,x:-x||.68,type:'scrap',phase:0});}return {...track,items};}
export function makeRace(index=0,profiles=[{}],id='local'){const map=course(index);return{id,index,t:0,countdown:3,finished:false,actors:Array.from({length:4},(_,i)=>{const p=profiles[i]||{};return{id:i,name:p.name||['YOU','RIVET','BOLT','SPANNER'][i],human:i<profiles.length,car:p.car??i%3,wrap:p.wrap||'stock',engine:clamp(p.engine??(i>=profiles.length?index:0),0,3),armour:clamp(p.armour||0,0,3),x:(i%2?1:-1)*.38,z:-Math.floor(i/2)*8,speed:0,hp:100+15*clamp(p.armour||0,0,3),boost:100,jump:0,vy:0,hit:0,scrap:0,finish:0,wrecks:0,seen:{},input:{steer:0,boost:false}};}),events:[],length:map.length};}
export function control(a,v){a.input={steer:clamp(Number(v?.steer)||0,-1,1),boost:!!v?.boost};}
export function step(r,map,dt){dt=clamp(dt,0,.04);r.t+=dt;r.events=[];if(r.countdown>0){r.countdown=Math.max(0,r.countdown-dt);return;}if(r.finished)return;
 for(const a of r.actors){if(a.finish)continue;
  if(!a.human){let target=Math.sin(a.z*.012+a.id*2)*.65;const danger=map.items.find(o=>o.z>a.z&&o.z<a.z+50&&Math.abs(o.x-a.x)<.32&&['barrel','crusher'].includes(o.type));if(danger)target=danger.x>.0?-.65:.65;control(a,{steer:clamp((target-a.x)*4,-1,1),boost:Math.sin(r.t*.55+a.id)> .8});}
  a.hit=Math.max(0,a.hit-dt);const boosting=a.input.boost&&a.boost>1;const maximum=52+a.engine*2+(boosting?22:0)-(a.human?0:2+a.id*.6);
  a.boost=clamp(a.boost+(boosting?-30:11)*dt,0,100);a.speed+=clamp(maximum-a.speed,-30*dt,(boosting?32:20)*dt);
  a.x+=a.input.steer*dt*(1.35+a.speed*.011)*(a.jump>0?.65:1);a.x-=Math.sin(a.z*.003+map.seed)*a.speed*.0015*dt;
  if(Math.abs(a.x)>1.02){a.speed=Math.max(18,a.speed-45*dt);a.hp-=7*dt;}
  a.x=clamp(a.x,-1.3,1.3);a.z+=a.speed*dt;
  if(a.jump>0||a.vy>0){a.jump=Math.max(0,a.jump+a.vy*dt);a.vy-=9.8*dt;if(a.jump===0)a.vy=0;}
  for(const o of map.items){if(a.seen[o.id]||Math.abs(o.z-a.z)>3.4||Math.abs(o.x-a.x)>.29)continue;
   if(o.type==='ramp'){a.seen[o.id]=1;a.vy=5.5+a.speed*.025;a.jump=.03;r.events.push({type:'jump',actor:a.id});}
   else if(o.type==='scrap'){a.seen[o.id]=1;a.scrap+=10;a.boost=clamp(a.boost+13,0,100);r.events.push({type:'scrap',actor:a.id});}
   else if(a.jump<.7){if(o.type==='crusher'&&!crusherDown(r.t,o.phase))continue;a.seen[o.id]=1;
    const damage=o.type==='crate'?(boosting?0:8):o.type==='crusher'?32:22;a.hp-=damage;a.speed*=o.type==='crate'?(boosting?1:.82):.5;a.hit=.4;if(o.type==='crate'){a.scrap+=5;r.events.push({type:'smash',actor:a.id});}else r.events.push({type:'hit',actor:a.id});}
  }
  if(a.hp<=0){a.hp=100+a.armour*15;a.speed=8;a.boost=40;a.x=0;a.wrecks++;a.hit=1.5;r.events.push({type:'wreck',actor:a.id});}
  if(a.z>=map.length){a.z=map.length;a.finish=r.t-3;r.events.push({type:'finish',actor:a.id});}
 }
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=r.actors[i],b=r.actors[j];if(a.finish||b.finish||a.jump>.6||b.jump>.6||a.hit>0||b.hit>0)continue;if(Math.abs(a.z-b.z)<5&&Math.abs(a.x-b.x)<.27){const dir=a.x>=b.x?1:-1;a.x=clamp(a.x+dir*.12,-1.3,1.3);b.x=clamp(b.x-dir*.12,-1.3,1.3);const faster=a.speed>b.speed?a:b,slower=faster===a?b:a;slower.speed*=.78;slower.hp-=faster.input.boost?12:5;a.hit=b.hit=.3;r.events.push({type:'ram',actor:faster.id});}}
 r.finished=r.actors.filter(a=>a.human).every(a=>a.finish>0);
}
export const crusherDown=(t,p)=>Math.sin(t*2+p)>.15;
export function placing(r,id){const order=[...r.actors].sort((a,b)=>a.finish&&b.finish?a.finish-b.finish:a.finish?-1:b.finish?1:b.z-a.z);return order.findIndex(a=>a.id===id)+1;}
export const freshSave=()=>({scrap:0,car:0,owned:[0],engine:0,armour:0,best:{},races:0,claimed:[],sound:true,motion:true});
export function readSave(raw){try{const v=JSON.parse(raw),s=freshSave();if(!v||typeof v!=='object')return s;s.scrap=clamp(Math.floor(Number(v.scrap)||0),0,1000000);s.owned=[0,...[1,2].filter(n=>Array.isArray(v.owned)&&v.owned.includes(n))];s.car=s.owned.includes(v.car)?v.car:0;for(const k of ['engine','armour'])s[k]=clamp(Math.floor(Number(v[k])||0),0,3);s.races=clamp(Math.floor(Number(v.races)||0),0,100000);s.claimed=Array.isArray(v.claimed)?v.claimed.filter(x=>typeof x==='string').slice(-100):[];s.best=Object.fromEntries(Object.entries(v.best||{}).filter(([k,n])=>['0','1','2'].includes(k)&&Number.isFinite(n)&&n>0));s.sound=v.sound!==false;s.motion=v.motion!==false;return s;}catch{return freshSave();}}
export function reward(save,r,id){const a=r.actors[id];if(!a.finish||save.claimed.includes(r.id))return 0;const amount=60+(5-placing(r,id))*20+a.scrap;save.scrap+=amount;save.races++;save.claimed.push(r.id);save.claimed=save.claimed.slice(-100);save.best[r.index]=Math.min(save.best[r.index]||Infinity,a.finish);return amount;}
export function purchase(save,type){if(type==='engine'||type==='armour'){const level=save[type],cost=(level+1)*120;if(level>=3||save.scrap<cost)return false;save.scrap-=cost;save[type]++;return true;}const id=Number(type);if(!Number.isInteger(id)||!CARS[id])return false;if(save.owned.includes(id)){save.car=id;return true;}if(save.scrap<CARS[id].cost)return false;save.scrap-=CARS[id].cost;save.owned.push(id);save.car=id;return true;}
