// The Homestead property prototype. Active simulation seconds only; no wall-clock rewards.
// Separate save/contract from Claude's original crop engine in logic.mjs.
export const SIZE=24;
export const BUILDINGS={
 caravan:{name:'Caravan',cost:1200,size:1,seconds:6,art:1,description:'A simple place to call home.'},
 tank:{name:'Water tank',cost:1600,size:1,seconds:8,art:2,description:'Delivered water. Supplies your first animals and garden.'},
 shed:{name:'Hay & machinery shed',cost:2400,size:2,seconds:12,art:0,description:'Stores hay and supplies. Needed for ute feeding.'},
 paddock:{name:'Fenced paddock',cost:1400,size:3,seconds:12,art:-1,description:'Gated fencing for up to eight cattle or sheep.'},
 yards:{name:'Stockyards & loading ramp',cost:2200,size:2,seconds:12,art:6,description:'Muster here before sending stock to market.'},
 garden:{name:'Market garden',cost:650,size:2,seconds:8,art:3,description:'Plant, harvest, then sell produce through your shop.'},
 shop:{name:'Farm shop',cost:1800,size:1,seconds:10,art:4,description:'Road frontage only. Sell your harvested produce.'},
 camp:{name:'Bush campsite',cost:900,size:1,seconds:8,art:5,description:'Needs water and a caravan. Earn $220 each occupied day.'},
 dam:{name:'Earth dam',cost:4800,size:3,seconds:20,art:7,description:'Low ground only. Includes $1,200 excavator hire unless you own one.'}
};
export const VEHICLES={
 ute:{name:'Work ute',cost:3200,speed:3.3,art:8,description:'Carries hay from the shed to your herd.'},
 truck:{name:'Livestock truck',cost:12500,speed:2.4,art:9,description:'Moves four head per trip. Saves carrier hire.'},
 excavator:{name:'Excavator',cost:28000,speed:1.2,art:10,description:'Build dams without the $1,200 hire fee.'},
 horse:{name:'Stock horse',cost:1800,speed:2.0,art:11,description:'Muster quietly. Lower running cost.'},
 bike:{name:'Station bike',cost:2400,speed:3.0,art:-1,description:'Faster mustering; costs $35 in fuel per job.'}
};
export const level=s=>1+Math.min(4,Math.floor(s.xp/80));
export const cash=n=>'$'+Math.round(n).toLocaleString('en-AU');
export function fresh(){return {v:1,time:0,day:1,money:22000,xp:0,acres:8,extent:15,debt:0,wageArrears:0,repayments:0,water:80,hay:12,produce:0,buildings:[],vehicles:[],animals:[],workers:[{id:1,name:'You',x:5,y:10}],jobs:[],events:[],nextId:1,stats:{built:0,fed:0,sold:0,harvests:0},claimed:[],weather:'Fine',lastDay:1};}
export function validate(raw){
 const s=typeof raw==='string'?JSON.parse(raw):raw;
 if(!s||s.v!==1||!Number.isFinite(s.money)||!Number.isFinite(s.time)||s.money<0||!Array.isArray(s.buildings)||!Array.isArray(s.workers)||!s.workers.length||!Array.isArray(s.jobs)||!Array.isArray(s.animals)||!Array.isArray(s.vehicles))throw Error('Unrecognised property save');
 s.wageArrears ??= 0;
 for(const b of s.buildings)if(b.kind==="paddock")b.pasture ??= 100;
 for(const j of s.jobs)if(j.paid===undefined){const b=s.buildings.find(b=>b.id===j.building);j.paid=j.type==='build'&&b?BUILDINGS[b.kind].cost-(b.kind==='dam'&&!j.hire?1200:0):j.type==='feed'?20:j.type==='plant'?40:j.type==='muster'?(j.vehicle==='bike'?35:5):j.type==='sell'?(j.hire?180:60):0;} return s;
}
const emit=(s,text)=>{s.events.unshift({id:s.nextId++,text,time:s.time});s.events=s.events.slice(0,12);};
export const ready=(s,kind)=>s.buildings.find(b=>b.kind===kind&&b.built);
export function canPlace(s,kind,x,y){
 const b=BUILDINGS[kind];if(!b)return 'Unknown project';
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<2||y<2||x+b.size>s.extent||y+b.size>s.extent)return 'Choose ground inside your boundary.';
 if(kind==='dam'&&y<10)return 'Dams need the low catchment ground near the creek.';
 if(kind!=='dam'&&y+b.size>13)return 'This is low catchment ground. Keep buildings above the creek.';
 if(kind==='shop'&&x>4)return 'Place your farm shop beside the road, on the western edge.';
 if(s.buildings.some(o=>x<o.x+BUILDINGS[o.kind].size&&x+b.size>o.x&&y<o.y+BUILDINGS[o.kind].size&&y+b.size>o.y))return 'That space is already reserved.';
 const inside=p=>p.x>=x&&p.y>=y&&p.x<x+b.size&&p.y<y+b.size;
 if(s.workers.some(inside)||s.jobs.some(j=>j.stops.some(inside)))return 'Leave the worker and queued routes clear.';
 if(s.buildings.some(o=>inside({x:o.x,y:o.y+BUILDINGS[o.kind].size})))return 'Leave access below existing projects clear.';
 if(blocked(s,x,y+b.size))return 'Leave a clear approach below this project.';
 return '';
}
function affordable(s,cost){return s.money>=cost?'':'You need '+cash(cost-s.money)+' more.';}
function enqueue(s,worker,job,cost=0){
 if(!s.workers.some(w=>w.id===worker))return {ok:false,reason:'Select a worker first.'};
 if(s.jobs.filter(j=>j.worker===worker).length>=5)return {ok:false,reason:'This worker already has five jobs queued.'};
 const why=affordable(s,cost);if(why)return {ok:false,reason:why};
 s.money-=cost;const j={id:s.nextId++,worker,status:'queued',stage:0,elapsed:0,paid:cost,...job};s.jobs.push(j);return {ok:true,job:j.id};
}
const stop=(x,y,label,work=0)=>({x,y,label,work});
const entry=b=>({x:b.x,y:b.y+BUILDINGS[b.kind].size});
export function place(s,worker,kind,x,y){
 const reason=canPlace(s,kind,x,y);if(reason)return {ok:false,reason};
 const def=BUILDINGS[kind];let cost=def.cost;
 const owns=kind==='dam'&&s.vehicles.includes('excavator');if(owns)cost-=1200;
 const b={id:s.nextId++,kind,x,y,built:false,progress:0,pasture:100};const at=entry(b);
 const r=enqueue(s,worker,{type:'build',building:b.id,vehicle:kind==='dam'?'excavator':null,hire:kind==='dam'&&!owns,title:'Build '+def.name,stops:[stop(3,15,kind==='dam'?'Collect excavator':'Collect building supplies',2),stop(at.x,at.y,kind==='dam'?'Excavating dam':'Building '+def.name,def.seconds)]},cost);
 if(r.ok){s.buildings.push(b);emit(s,def.name+' marked out · '+cash(cost));}return r;
}
export function buyVehicle(s,kind){
 const v=VEHICLES[kind];if(!v)return {ok:false,reason:'Unknown vehicle'};
 if(s.vehicles.includes(kind))return {ok:false,reason:'You already own this vehicle.'};
 const reason=affordable(s,v.cost);if(reason)return {ok:false,reason};
 s.money-=v.cost;s.vehicles.push(kind);emit(s,v.name+' delivered to the entrance.');return {ok:true};
}
export function loan(s){
 if(s.repayments||s.debt)return {ok:false,reason:'One starter loan per property.'};
 s.money+=12000;s.debt=13200;s.repayments=30;emit(s,'Starter loan received: $12,000. Repay $440 per game day for 30 days.');return {ok:true};
}
export function repay(s){
 const why=affordable(s,s.debt);if(why)return {ok:false,reason:why};if(!s.debt)return {ok:false,reason:'No outstanding loan.'};
 s.money-=s.debt;s.debt=0;s.repayments=-1;emit(s,'Property loan paid off.');return {ok:true};
}
export function hire(s){
 if(s.workers.length>=4)return {ok:false,reason:'Four workers is the limit in this slice.'};
 const reason=affordable(s,1800);if(reason)return {ok:false,reason};
 s.money-=1800;const id=s.workers.length+1;s.workers.push({id,name:['You','Jess','Mick','Charlie'][id-1],x:4,y:14});emit(s,'New farmhand hired. Wages: $120 per game day.');return {ok:true};
}
export function expand(s){
 if(s.extent===23)return {ok:false,reason:'You own all 32 acres in this first slice.'};
 const reason=affordable(s,9000);if(reason)return {ok:false,reason};
 s.money-=9000;s.extent=23;s.acres=32;s.xp+=40;emit(s,'Neighbouring acreage secured. Your property is now 32 acres.');return {ok:true};
}
export function buyStock(s,kind){
 const p=s.buildings.filter(b=>b.kind==='paddock'&&b.built).sort((a,b)=>occupancy(s,a.id)-occupancy(s,b.id)).find(b=>occupancy(s,b.id)<8);if(!p||!ready(s,'tank')&&!ready(s,'dam'))return {ok:false,reason:'Build a fenced paddock and water supply first.'};
 const capacity=s.buildings.filter(b=>b.kind==='paddock'&&b.built).length*8;
 if(s.animals.length>=capacity)return {ok:false,reason:'Your paddocks are full. Build another first.'};
 const cost=kind==='sheep'?240:900;const why=affordable(s,cost);if(why)return {ok:false,reason:why};
 s.money-=cost;s.animals.push({id:s.nextId++,kind,weight:kind==='sheep'?45:320,condition:65,paddock:p.id,yarded:false});emit(s,(kind==='sheep'?'Sheep':'Beef animal')+' delivered.');return {ok:true};
}
export const occupancy=(s,id)=>s.animals.filter(a=>a.paddock===id).length+s.jobs.filter(j=>j.type==='rotate'&&j.destinationPaddock===id).reduce((n,j)=>n+j.animalIds.length,0);
export function cancelJob(s,id){
 const j=s.jobs.find(j=>j.id===id);
 if(!j||j.status!=='queued')return {ok:false,reason:'Only waiting jobs can be cancelled.'};
 s.money+=j.paid||0;if(j.type==='feed')s.hay+=2;if(j.type==='plant')s.water+=5;
 if(j.type==='build')s.buildings=s.buildings.filter(b=>b.id!==j.building);
 s.jobs=s.jobs.filter(o=>o.id!==id);emit(s,'Waiting job cancelled. Reserved funds and supplies returned.');return {ok:true};
}
export function supplies(s){
 const why=affordable(s,400);if(why)return {ok:false,reason:why};
 s.money-=400;s.hay+=8;s.water=Math.min(200,s.water+60);emit(s,'8 hay bales and 60 water units delivered.');return {ok:true};
}
export function assign(s,worker,type,target){
 const w=s.workers.find(w=>w.id===worker);if(!w)return {ok:false,reason:'Select a worker.'};
 const b=s.buildings.find(b=>b.id===target);let job,cost=0;
 if(type==='walk'){if(!target||target.x<1||target.y<1||target.x>=s.extent||target.y>=s.extent)return {ok:false,reason:'Stay inside your boundary.'};job={type,title:'Walk here',stops:[stop(target.x,target.y,'Walking')]};}
 if(type==='feed'){
 const shed=ready(s,'shed'),p=s.buildings.find(b=>b.id===target?.paddock&&b.built)||ready(s,'paddock');
 if(!shed||!p||!s.animals.length)return {ok:false,reason:'You need a shed, paddock and livestock.'};
 if(!s.vehicles.includes('ute'))return {ok:false,reason:'Buy a work ute to carry the hay.'};
 if(s.hay<2)return {ok:false,reason:'Buy hay supplies first.'};
 if(s.jobs.some(j=>j.type==='feed'))return {ok:false,reason:'A feed run is already queued.'};
 const herd=s.animals.filter(a=>!a.yarded&&a.paddock===p.id&&!s.jobs.some(j=>j.animalIds?.includes(a.id)));if(!herd.length)return {ok:false,reason:'No available stock in this paddock.'};
 const a=entry(shed),z=entry(p);job={type,animalIds:herd.map(a=>a.id),vehicle:'ute',title:'Feed herd by ute',stops:[stop(4,15,'Collect work ute',1),stop(a.x,a.y,'Load 2 hay bales',4),stop(z.x,z.y,'Feed out hay',6)]};cost=20;
 }
 if(type==='muster'||type==='rotate'){
 const yards=type==='rotate'?s.buildings.find(b=>b.id===target?.destination&&b.kind==='paddock'&&b.built):ready(s,'yards'),p=s.buildings.find(b=>b.id===target?.paddock&&b.kind==='paddock'&&b.built)||ready(s,'paddock');if(!yards||!p||!s.animals.length)return {ok:false,reason:'Build yards and buy livestock first.'};
 const herd=s.animals.filter(a=>!a.yarded&&a.paddock===p.id&&!s.jobs.some(j=>j.animalIds?.includes(a.id)));
 if(!herd.length)return {ok:false,reason:'No available stock in this paddock.'};
 if(type==='rotate'&&(yards.id===p.id||occupancy(s,yards.id)+herd.length>8))return {ok:false,reason:'Choose another paddock with room for this mob.'};
 const vehicle=(target?.vehicle||target)==='bike'?'bike':'horse';if(!s.vehicles.includes(vehicle))return {ok:false,reason:'Buy a '+VEHICLES[vehicle].name.toLowerCase()+' first.'};
 const a=entry(p),z=entry(yards);job={type,vehicle,animalIds:herd.map(a=>a.id),destinationPaddock:type==='rotate'?yards.id:null,title:(type==='rotate'?'Rotate mob by ':'Muster by ')+vehicle,stops:[stop(4,15,'Collect '+vehicle,1),stop(a.x,a.y,'Gather the mob',vehicle==='horse'?7:4),stop(z.x,z.y,type==='rotate'?'Move mob into fresh paddock':'Move mob into yards',5)]};cost=vehicle==='bike'?35:5;
 }
 if(type==='sell'){
 const yards=ready(s,'yards');const herd=s.animals.filter(a=>a.yarded&&!s.jobs.some(j=>j.animalIds?.includes(a.id))).slice(0,4);
 if(!yards||!herd.length)return {ok:false,reason:'Muster stock into the yards first.'};
 const owns=s.vehicles.includes('truck'),a=entry(yards);
 job={type,vehicle:'truck',hire:!owns,animalIds:herd.map(a=>a.id),destination:target||'meatworks',title:'Livestock to '+(target||'meatworks'),stops:[stop(3,15,owns?'Collect livestock truck':'Carrier arrives',2),stop(a.x,a.y,'Load '+herd.length+' head',6),stop(1,16,'Deliver to '+(target||'meatworks'),5)]};cost=owns?60:180;
 }
 if(type==='plant'||type==='harvest'){
 if(!b?.built||b.kind!=='garden')return {ok:false,reason:'Choose a completed market garden.'};
 if(s.jobs.some(j=>j.building===b.id))return {ok:false,reason:'A job is already queued for this garden.'};
 if(type==='plant'&&b.planted)return {ok:false,reason:'This garden is already growing.'};
 if(type==='harvest'&&(!b.planted||s.time<b.ready))return {ok:false,reason:'The vegetables are not ready yet.'};
 if(type==='plant'&&s.water<5)return {ok:false,reason:'Buy water supplies first.'};
 const a=entry(b);job={type,building:b.id,title:type==='plant'?'Plant vegetables':'Harvest vegetables',stops:[stop(a.x,a.y,type==='plant'?'Planting rows':'Harvesting produce',5)]};cost=type==='plant'?40:0;
 }
 if(type==='shop'){
 const shop=ready(s,'shop');if(!shop||!s.produce)return {ok:false,reason:'Build a shop and harvest produce first.'};
 if(s.jobs.some(j=>j.type==='shop'))return {ok:false,reason:'A shop delivery is already queued.'};
 const a=entry(shop);job={type,title:'Stock farm shop',stops:[stop(a.x,a.y,'Stocking produce crates',5)]};
 }
 if(!job)return {ok:false,reason:'Choose a task.'};
 const result=enqueue(s,worker,job,cost);if(result.ok&&type==='feed')s.hay-=2;if(result.ok&&type==='plant')s.water-=5;return result;
}
function finish(s,j){
 const b=s.buildings.find(b=>b.id===j.building);
 if(j.type==='build'){b.built=true;b.progress=1;s.stats.built++;s.xp+=20;if(b.kind==='tank')s.water+=80;if(b.kind==='dam')b.water=0;emit(s,BUILDINGS[b.kind].name+' completed.');}
 if(j.type==='plant'){b.planted=true;b.ready=s.time+55;emit(s,'Vegetables planted. Ready in 55 game seconds.');}
 if(j.type==='harvest'){b.planted=false;b.ready=0;s.produce+=4;s.stats.harvests++;s.xp+=15;emit(s,'Harvested 4 produce crates. Take them to the farm shop.');}
 if(j.type==='feed'){for(const a of s.animals.filter(a=>!j.animalIds||j.animalIds.includes(a.id))){a.condition=Math.min(100,a.condition+25);a.lastFedDay=s.day;}s.stats.fed++;s.xp+=15;emit(s,'Hay fed out. The herd is in better condition.');}
 if(j.type==='muster'){for(const a of s.animals.filter(a=>!j.animalIds||j.animalIds.includes(a.id)))a.yarded=true;s.xp+=10;emit(s,'Mob secured in the stockyards. Ready to load.');}
 if(j.type==='rotate'){for(const a of s.animals.filter(a=>j.animalIds.includes(a.id))){a.paddock=j.destinationPaddock;a.yarded=false;}s.xp+=10;emit(s,'Mob moved to fresh pasture. Rest the old paddock to regrow grass.');}
 if(j.type==='sell'){
 const sold=s.animals.filter(a=>j.animalIds.includes(a.id));const gross=Math.round(sold.reduce((n,a)=>n+a.weight*(a.kind==='sheep'?6:3.4)*(j.destination==='saleyards'?.96:1),0));const fees=Math.round(gross*.04);
 s.money+=gross-fees;s.animals=s.animals.filter(a=>!j.animalIds.includes(a.id));s.stats.sold+=sold.length;s.xp+=30;emit(s,sold.length+' head sold · '+cash(gross-fees)+' after '+cash(fees)+' selling fees.');
 }
 if(j.type==='shop'){const n=s.produce;s.produce=0;s.money+=n*145;s.xp+=15;emit(s,n+' produce crates sold · '+cash(n*145));}
 if(j.type!=='walk')s.xp+=3;
 const milestones=[['firstbuild',s.stats.built>=3,1000,'First foundations'],['firstfeed',s.stats.fed>=1,800,'A working property'],['firstsale',s.stats.sold>=1,1500,'First livestock sale']];
 for(const [id,done,reward,name] of milestones)if(done&&!s.claimed.includes(id)){s.claimed.push(id);s.money+=reward;emit(s,name+' · earned '+cash(reward));}
}
export function blocked(s,x,y){return s.buildings.some(b=>x>=b.x&&y>=b.y&&x<b.x+BUILDINGS[b.kind].size&&y<b.y+BUILDINGS[b.kind].size);}
export function route(s,from,to){
 const start=[Math.round(from.x),Math.round(from.y)],end=[Math.round(to.x),Math.round(to.y)],key=p=>p.join(',');
 const queue=[start],seen=new Map([[key(start),null]]);let found=false;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){found=true;break;}
 for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[p[0]+d[0],p[1]+d[1]];if(n[0]<0||n[1]<0||n[0]>=SIZE||n[1]>=SIZE||seen.has(key(n))||blocked(s,...n))continue;seen.set(key(n),p);queue.push(n);}}
 if(!found)return null;const path=[];let p=end;while(p&&key(p)!==key(start)){path.unshift({x:p[0],y:p[1]});p=seen.get(key(p));}return path;
}
export function tick(s,dt){
 dt=Math.min(1,Math.max(0,dt));s.time+=dt;s.day=1+Math.floor(s.time/180);
 if(s.day>s.lastDay){
 s.lastDay=s.day;s.weather=s.day%3===0?'Rain':s.day%5===0?'Hot':'Fine';
 let income=0;for(const b of s.buildings){if(b.built&&b.kind==='dam'&&s.weather==='Rain'){b.water=Math.min(200,(b.water||0)+70);s.water=Math.min(300,s.water+70);}if(b.built&&b.kind==='camp'&&ready(s,'caravan')&&s.water>0)income+=220;}
 const wages=(s.workers.length-1)*120+(s.wageArrears||0);
 s.money+=income;const paidWages=Math.min(s.money,wages);s.money-=paidWages;s.wageArrears=wages-paidWages;
 const repayment=s.debt?Math.min(440,s.debt,s.money):0;
 s.money-=repayment;s.debt-=repayment;if(s.debt===0&&s.repayments>0)s.repayments=-1;
 const watered=s.water>=s.animals.length*2;s.water=Math.max(0,s.water-s.animals.length*2);
 for(const p of s.buildings.filter(b=>b.kind==='paddock'&&b.built)){
 const grazing=s.animals.filter(a=>a.paddock===p.id&&!a.yarded).reduce((n,a)=>n+(a.kind==='sheep'?3:8),0);
 p.pasture=Math.max(0,Math.min(100,(p.pasture??100)+(s.weather==='Rain'?22:s.weather==='Hot'?3:10)-grazing));
 }
 for(const a of s.animals){
 const p=s.buildings.find(b=>b.id===a.paddock),fed=a.lastFedDay>=s.day-1||(!a.yarded&&(p?.pasture??100)>=30);
 a.condition=Math.max(15,Math.min(100,a.condition+(watered?(fed?2:-8):-20)));
 if(watered&&fed&&a.condition>60)a.weight+=a.kind==='sheep'?1:5;
 }
 emit(s,'Day '+s.day+' � '+s.weather+'. Camps '+cash(income)+' � wages paid '+cash(paidWages)+(s.wageArrears?' � wages owing '+cash(s.wageArrears):'')+(repayment?' � loan '+cash(repayment):''));

 }
 for(const w of s.workers){
 let j=s.jobs.find(j=>j.worker===w.id);
 if(!j)continue;
 if(j.status==='queued'){
 if(j.vehicle&&s.jobs.some(o=>o.id!==j.id&&o.status==='active'&&o.vehicle===j.vehicle))continue;
 j.status='active';
 }
 const step=j.stops[j.stage];
 if(!step){finish(s,j);s.jobs=s.jobs.filter(o=>o.id!==j.id);continue;}
 if(!j.path){j.path=route(s,w,step);if(!j.path){j.status='blocked';continue;}j.status='active';}
 if(j.path.length){
 const next=j.path[0],dx=next.x-w.x,dy=next.y-w.y,dist=Math.hypot(dx,dy);
 const speed=j.vehicle&&j.stage>0?VEHICLES[j.vehicle].speed:2.2;
 const amount=speed*dt;if(dist<=amount){w.x=next.x;w.y=next.y;j.path.shift();}else{w.x+=dx/dist*amount;w.y+=dy/dist*amount;}
 }else{
 j.elapsed+=dt;if(j.type==='build'){const b=s.buildings.find(b=>b.id===j.building);b.progress=j.stage===1?Math.min(.99,j.elapsed/step.work):.03;}
 if(j.elapsed>=step.work){j.stage++;j.elapsed=0;j.path=null;}
 }
 }
}
