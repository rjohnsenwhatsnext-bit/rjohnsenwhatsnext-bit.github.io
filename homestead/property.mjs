import {MIN,MAX,PARCELS,parcelAt,owns,adjacent,migrateWorld,tickVisitors} from './property-world.mjs';
export {PARCELS,parcelAt,owns,adjacent};
// The Homestead property prototype. Active simulation seconds only; no wall-clock rewards.
// Separate save/contract from Claude's original crop engine in logic.mjs.
export const SIZE=30;
export const BUILDINGS={
 caravan:{name:'Caravan',home:true,cost:1200,size:1,seconds:6,art:1,description:'A simple place to call home.'},
 tank:{name:'Water tank',cost:1600,size:1,seconds:8,art:2,description:'Delivered water. Supplies your first animals and garden.'},
 shed:{name:'Hay & machinery shed',cost:2400,size:2,seconds:12,art:0,description:'Stores hay and supplies. Needed for ute feeding.'},
 cottage:{name:'Weatherboard cottage',cost:3600,size:2,seconds:18,art:16,home:true,description:'A green-roof cottage with a shaded front verandah.'},
 queenslander:{name:'Queenslander',cost:6800,size:3,seconds:26,art:17,home:true,description:'An elevated timber home with wide verandahs.'},
 modern:{name:'Modern country home',cost:8500,size:3,seconds:30,art:18,home:true,description:'A contemporary home with a charcoal roof and glass frontage.'},
 stationhouse:{name:'Station homestead',cost:12500,size:3,seconds:36,art:19,home:true,description:'Sandstone walls and a wraparound verandah for your dream property.'},
 cabin:{name:'Bush cabin',cost:2400,size:2,seconds:14,art:20,home:true,description:'A modest timber cabin tucked into the country.'},
 paddock:{name:'Fenced paddock',cost:1400,size:3,seconds:12,art:-1,description:'Gated fencing for up to eight cattle or sheep.'},
 yards:{name:'Stockyards & loading ramp',cost:2200,size:2,seconds:12,art:6,description:'Muster here before sending stock to market.'},
 garden:{name:'Market garden',cost:650,size:2,seconds:8,art:3,description:'Plant, harvest, then sell produce through your shop.'},
 shop:{name:'Farm shop',cost:1800,size:1,seconds:10,art:4,description:'Road frontage only. Sell your harvested produce.'},
 camp:{name:'Bush campsite',cost:900,size:1,seconds:8,art:5,description:'Open a paid campsite. Visitors drive in, stay, then leave. Requires a home and water.'},
 dam:{name:'Earth dam',cost:4800,size:3,seconds:20,art:7,description:'Low ground only. Includes $1,200 excavator hire unless you own one.'}
};
export const VEHICLES={
 ute:{name:'Work ute',cost:3200,speed:3.3,art:8,description:'Carries hay from the shed to livestock held in the yards.'},
 truck:{name:'Livestock truck',cost:12500,speed:2.4,art:9,description:'Moves four head per trip. Saves carrier hire.'},
 excavator:{name:'Excavator',cost:28000,speed:1.2,art:10,description:'Build dams without the $1,200 hire fee.'},
 horse:{name:'Stock horse',cost:1800,speed:2.0,art:11,description:'Muster quietly. Lower running cost.'},
 bike:{name:'Station bike',cost:2400,speed:3.0,art:-1,description:'Faster mustering; costs $35 in fuel per job.'}
};
export const level=s=>1+Math.min(4,Math.floor(s.xp/80));
export const cash=n=>'$'+Math.round(n).toLocaleString('en-AU');
export function fresh(){const s={v:1,time:0,day:1,money:22000,xp:0,acres:8,extent:15,debt:0,wageArrears:0,repayments:0,water:80,hay:12,produce:0,buildings:[],vehicles:[],animals:[],workers:[{id:1,name:'You',x:5,y:10}],jobs:[],events:[],nextId:1,stats:{built:0,fed:0,sold:0,harvests:0},claimed:[],weather:'Fine',lastDay:1};migrateWorld(s);return s;}
export function validate(raw){
 const s=typeof raw==='string'?JSON.parse(raw):raw;
 if(!s||s.v!==1||!Number.isFinite(s.money)||!Number.isFinite(s.time)||s.money<0||!Array.isArray(s.buildings)||!Array.isArray(s.workers)||!s.workers.length||!Array.isArray(s.jobs)||!Array.isArray(s.animals)||!Array.isArray(s.vehicles))throw Error('Unrecognised property save');
 migrateWorld(s);s.wageArrears ??= 0;
 for(const b of s.buildings)if(b.kind==="paddock")b.pasture ??= 100;
 for(const j of s.jobs)if(j.paid===undefined){const b=s.buildings.find(b=>b.id===j.building);j.paid=j.type==='build'&&b?BUILDINGS[b.kind].cost-(b.kind==='dam'&&!j.hire?1200:0):j.type==='feed'?20:j.type==='plant'?40:j.type==='muster'?(j.vehicle==='bike'?35:5):j.type==='sell'?(j.hire?180:60):0;}
 // Retire old paddock hay runs; livestock now graze and only yards receive hay.
 for(const j of [...s.jobs])if(j.type==='feed'&&(!j.animalIds||s.animals.some(a=>j.animalIds.includes(a.id)&&!a.yarded))){s.money+=j.paid||20;s.hay+=2;s.jobs=s.jobs.filter(o=>o.id!==j.id);}
 return s;
}
const emit=(s,text)=>{s.events.unshift({id:s.nextId++,text,time:s.time});s.events=s.events.slice(0,12);};
function invalidateRoutes(s){for(const j of s.jobs)j.path=null;for(const v of s.visitors||[])v.path=null;for(const a of s.animals)a.drivePath=null;}
export const ready=(s,kind)=>s.buildings.find(b=>b.kind===kind&&b.built);
export const dims=b=>({w:b.w||BUILDINGS[b.kind].size,h:b.h||BUILDINGS[b.kind].size});
export const capacity=b=>Math.max(2,Math.floor(dims(b).w*dims(b).h*8/9));
export const hasHome=s=>s.buildings.some(b=>b.built&&BUILDINGS[b.kind].home);
export function canPlace(s,kind,x,y,w=BUILDINGS[kind]?.size,h=w){
 const b=BUILDINGS[kind];if(!b)return 'Unknown project';
 if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(w)||!Number.isInteger(h))return 'Choose whole map squares.';
 for(let xx=x;xx<x+w;xx++)for(let yy=y;yy<y+h;yy++)if(!owns(s,xx,yy)||xx===1||yy===16||xx<=MIN||yy<=MIN||xx>=MAX-1||yy>=MAX-1)return 'Buy this land first and leave the road clear.';
 if(kind==='dam'&&y<10)return 'Dams need the low catchment ground near the creek.';
 if(y<20&&y+h>18)return 'Keep the creek clear. Build on either bank.';
 if(kind==='shop'&&x>4)return 'Place your farm shop beside the road, on the western edge.';
 if(s.buildings.some(o=>x<o.x+dims(o).w&&x+w>o.x&&y<o.y+dims(o).h&&y+h>o.y))return 'That space is already reserved.';
 const inside=p=>p.x>=x&&p.y>=y&&p.x<x+w&&p.y<y+h;
 if(s.workers.some(inside)||s.jobs.some(j=>j.stops.some(inside))||(s.visitors||[]).some(v=>inside(v)||inside(v.target)))return 'Leave the worker and queued routes clear.';
 if(s.buildings.some(o=>inside({x:o.x,y:o.y+dims(o).h})))return 'Leave access below existing projects clear.';
 if(blocked(s,x,y+h))return 'Leave a clear approach below this project.';
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
export const entry=b=>({x:b.x,y:b.y+dims(b).h});
export function place(s,worker,kind,x,y){
 const reason=canPlace(s,kind,x,y);if(reason)return {ok:false,reason};
 const def=BUILDINGS[kind];let cost=def.cost;
 const owns=kind==='dam'&&s.vehicles.includes('excavator');if(owns)cost-=1200;
 const b={id:s.nextId++,kind,x,y,built:false,progress:0,pasture:100};const at=entry(b);
 const r=enqueue(s,worker,{type:'build',building:b.id,vehicle:kind==='dam'?'excavator':null,hire:kind==='dam'&&!owns,title:'Build '+def.name,stops:[stop(3,15,kind==='dam'?'Collect excavator':'Collect building supplies',2),stop(at.x,at.y,kind==='dam'?'Excavating dam':'Building '+def.name,def.seconds)]},cost);
 if(r.ok){s.buildings.push(b);invalidateRoutes(s);emit(s,def.name+' marked out · '+cash(cost));}return r;
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
export function buyLand(s,id){
 migrateWorld(s);const p=PARCELS.find(p=>p.id===id);
 if(!p||s.land.includes(id))return {ok:false,reason:'You already own this block.'};
 if(!adjacent(s,p))return {ok:false,reason:'Buy an adjoining block first.'};
 const reason=affordable(s,p.cost);if(reason)return {ok:false,reason};
 s.money-=p.cost;s.land.push(id);s.acres=s.land.length*8;s.extent=Math.max(s.extent,p.x+14,p.y+14);s.xp+=20;
 emit(s,p.name+' purchased. Your property is now '+s.acres+' acres.');return {ok:true};
}
export function expand(s){return buyLand(s,PARCELS.find(p=>!s.land.includes(p.id)&&adjacent(s,p))?.id);}
export function fencePlan(s,worker,x,y,w,h){
 if(w<2||h<2||w>10||h>10)return {ok:false,reason:'Drag a paddock between 2 and 10 squares on each side.'};
 const reason=canPlace(s,'paddock',x,y,w,h);if(reason)return {ok:false,reason};
 const cost=(w+h)*2*90+160,b={id:s.nextId++,kind:'paddock',x,y,w,h,built:false,progress:0,pasture:100,fenceSegments:0};
 const stops=[stop(3,15,'Collect posts, wire and gate',2)];
 // Work around the boundary: no usable paddock until every section is built.
 for(let i=0;i<w;i++)stops.push(stop(x+i,y-1,'Set posts and strain wire',2));
 for(let i=0;i<h;i++)stops.push(stop(x+w,y+i,'Build eastern fence',2));
 for(let i=w-1;i>=0;i--)stops.push(stop(x+i,y+h,i===0?'Hang the paddock gate':'Build southern fence',2));
 for(let i=h-1;i>=0;i--)stops.push(stop(x-1,y+i,'Finish western fence',2));
 if(stops.some(p=>blocked(s,p.x,p.y)||p.x<MIN||p.y<MIN||p.x>=MAX||p.y>=MAX))return {ok:false,reason:'Leave a clear strip around the fence for the worker.'};
 const r=enqueue(s,worker,{type:'build',building:b.id,fencing:true,title:'Build planned paddock fence',stops},cost);
 if(r.ok){s.buildings.push(b);invalidateRoutes(s);emit(s,'Fence pegged out: '+(w*h)+' squares, '+cash(cost)+'. Construction queued.');}return r;
}
export function setCamp(s,id,open){
 const b=s.buildings.find(b=>b.id===id&&b.kind==='camp'&&b.built);if(!b)return {ok:false,reason:'Complete the campsite first.'};
 b.open=open;emit(s,open?'Campsite open for bookings.':'Campsite closed to new arrivals. Existing guests finish their stay.');return {ok:true};
}
export function buyStock(s,kind){
 const p=s.buildings.filter(b=>b.kind==='paddock'&&b.built).sort((a,b)=>occupancy(s,a.id)-occupancy(s,b.id)).find(b=>occupancy(s,b.id)<capacity(b));if(!p||!ready(s,'tank')&&!ready(s,'dam'))return {ok:false,reason:'Build a fenced paddock and water supply first.'};
 const totalCapacity=s.buildings.filter(b=>b.kind==='paddock'&&b.built).reduce((n,b)=>n+capacity(b),0);
 if(s.animals.length>=totalCapacity)return {ok:false,reason:'Your paddocks are full. Build another first.'};
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
 if(type==='walk'){if(!target||!owns(s,target.x,target.y))return {ok:false,reason:'Stay inside your boundary.'};job={type,title:'Walk here',stops:[stop(target.x,target.y,'Walking')]};}
 if(type==='feed'){
 const shed=ready(s,'shed'),p=ready(s,'yards');
 if(target?.paddock)return {ok:false,reason:'Paddock livestock graze for themselves. Feed hay only in the yards.'};
 if(!shed||!p||!s.animals.length)return {ok:false,reason:'You need a hay shed and livestock held in the yards.'};
 if(!s.vehicles.includes('ute'))return {ok:false,reason:'Buy a work ute to carry the hay.'};
 if(s.hay<2)return {ok:false,reason:'Buy hay supplies first.'};
 if(s.jobs.some(j=>j.type==='feed'))return {ok:false,reason:'A feed run is already queued.'};
 const herd=s.animals.filter(a=>a.yarded&&!s.jobs.some(j=>j.animalIds?.includes(a.id)));if(!herd.length)return {ok:false,reason:'No available livestock in the yards.'};
 const a=entry(shed),z=entry(p);job={type,animalIds:herd.map(a=>a.id),vehicle:'ute',title:'Feed yarded livestock by ute',stops:[stop(4,15,'Collect work ute',1),stop(a.x,a.y,'Load 2 hay bales',4),stop(z.x,z.y,'Feed out hay',6)]};cost=20;
 }
 if(type==='muster'||type==='rotate'){
 const yards=type==='rotate'?s.buildings.find(b=>b.id===target?.destination&&b.kind==='paddock'&&b.built):ready(s,'yards'),p=s.buildings.find(b=>b.id===target?.paddock&&b.kind==='paddock'&&b.built)||ready(s,'paddock');if(!yards||!p||!s.animals.length)return {ok:false,reason:'Build yards and buy livestock first.'};
 const herd=s.animals.filter(a=>!a.yarded&&a.paddock===p.id&&!s.jobs.some(j=>j.animalIds?.includes(a.id)));
 if(!herd.length)return {ok:false,reason:'No available stock in this paddock.'};
 if(type==='rotate'&&(yards.id===p.id||occupancy(s,yards.id)+herd.length>capacity(yards)))return {ok:false,reason:'Choose another paddock with room for this mob.'};
 const vehicle=(target?.vehicle||target)==='bike'?'bike':'horse';if(!s.vehicles.includes(vehicle))return {ok:false,reason:'Buy a '+VEHICLES[vehicle].name.toLowerCase()+' first.'};
 const a=entry(p),z=entry(yards);job={type,vehicle,herding:true,sourcePaddock:p.id,animalIds:herd.map(a=>a.id),destinationPaddock:type==='rotate'?yards.id:null,title:(type==='rotate'?'Rotate mob by ':'Muster by ')+vehicle,stops:[stop(4,15,'Collect '+vehicle,1),stop(a.x,a.y,'Ride through the paddock gate',0),stop(p.x+dims(p).w-1,p.y,'Sweep the back of the paddock',2),stop(p.x,p.y,'Turn the mob towards the gate',2),stop(a.x,a.y,'Gather stock through the gate',1),stop(z.x,z.y,type==='rotate'?'Drive mob to fresh pasture':'Drive mob to the stockyards',3)]};cost=vehicle==='bike'?35:5;
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
 if(j.type==='build'){b.built=true;b.progress=1;invalidateRoutes(s);s.stats.built++;s.xp+=20;if(b.kind==='tank')s.water+=80;if(b.kind==='dam')b.water=0;emit(s,BUILDINGS[b.kind].name+' completed.');}
 if(j.type==='plant'){b.planted=true;b.ready=s.time+55;emit(s,'Vegetables planted. Ready in 55 game seconds.');}
 if(j.type==='harvest'){b.planted=false;b.ready=0;s.produce+=4;s.stats.harvests++;s.xp+=15;emit(s,'Harvested 4 produce crates. Take them to the farm shop.');}
 if(j.type==='feed'){for(const a of s.animals.filter(a=>!j.animalIds||j.animalIds.includes(a.id))){a.condition=Math.min(100,a.condition+25);a.lastFedDay=s.day;}s.stats.fed++;s.xp+=15;emit(s,'Hay fed out. The herd is in better condition.');}
 if(j.type==='muster'){for(const a of s.animals.filter(a=>!j.animalIds||j.animalIds.includes(a.id))){a.yarded=true;delete a.drive;}s.xp+=10;emit(s,'Mob secured in the stockyards. Ready to load.');}
 if(j.type==='rotate'){for(const a of s.animals.filter(a=>j.animalIds.includes(a.id))){a.paddock=j.destinationPaddock;a.yarded=false;delete a.drive;}s.xp+=10;emit(s,'Mob moved to fresh pasture. Rest the old paddock to regrow grass.');}
 if(j.type==='sell'){
 const sold=s.animals.filter(a=>j.animalIds.includes(a.id));const gross=Math.round(sold.reduce((n,a)=>n+a.weight*(a.kind==='sheep'?6:3.4)*(j.destination==='saleyards'?.96:1),0));const fees=Math.round(gross*.04);
 s.money+=gross-fees;s.animals=s.animals.filter(a=>!j.animalIds.includes(a.id));s.stats.sold+=sold.length;s.xp+=30;emit(s,sold.length+' head sold · '+cash(gross-fees)+' after '+cash(fees)+' selling fees.');
 }
 if(j.type==='shop'){const n=s.produce;s.produce=0;s.money+=n*145;s.xp+=15;emit(s,n+' produce crates sold · '+cash(n*145));}
 if(j.type!=='walk')s.xp+=3;
 const milestones=[['firstbuild',s.stats.built>=3,1000,'First foundations'],['firstfeed',s.stats.fed>=1,800,'A working property'],['firstsale',s.stats.sold>=1,1500,'First livestock sale']];
 for(const [id,done,reward,name] of milestones)if(done&&!s.claimed.includes(id)){s.claimed.push(id);s.money+=reward;emit(s,name+' · earned '+cash(reward));}
}
export function blocked(s,x,y){return (y>=18&&y<=19&&x!==1)||s.buildings.some(b=>b.kind!=='paddock'&&x>=b.x&&y>=b.y&&x<b.x+dims(b).w&&y<b.y+dims(b).h);}
export function route(s,from,to){
 const start=[Math.round(from.x),Math.round(from.y)],end=[Math.round(to.x),Math.round(to.y)],key=p=>p.join(',');
 const queue=[start],seen=new Map([[key(start),null]]);let found=false;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){found=true;break;}
 for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[p[0]+d[0],p[1]+d[1]];if(n[0]<MIN||n[1]<MIN||n[0]>=MAX||n[1]>=MAX||seen.has(key(n))||blocked(s,...n)||fenceCrossing(s,p,n))continue;seen.set(key(n),p);queue.push(n);}}
 if(!found)return null;const path=[];let p=end;while(p&&key(p)!==key(start)){path.unshift({x:p[0],y:p[1]});p=seen.get(key(p));}return path;
}
export function tick(s,dt){
 dt=Math.min(1,Math.max(0,dt));s.time+=dt;s.day=1+Math.floor(s.time/180);
 if(s.day>s.lastDay){
 s.lastDay=s.day;s.weather=s.day%3===0?'Rain':s.day%5===0?'Hot':'Fine';
 let income=0;for(const b of s.buildings){if(b.built&&b.kind==='dam'&&s.weather==='Rain'){b.water=Math.min(200,(b.water||0)+70);s.water=Math.min(300,s.water+70);}}
 const wages=(s.workers.length-1)*120+(s.wageArrears||0);
 s.money+=income;const paidWages=Math.min(s.money,wages);s.money-=paidWages;s.wageArrears=wages-paidWages;
 const repayment=s.debt?Math.min(440,s.debt,s.money):0;
 s.money-=repayment;s.debt-=repayment;if(s.debt===0&&s.repayments>0)s.repayments=-1;
 const watered=s.water>=s.animals.length*2;s.water=Math.max(0,s.water-s.animals.length*2);
 for(const p of s.buildings.filter(b=>b.kind==='paddock'&&b.built)){
 const grazing=s.animals.filter(a=>a.paddock===p.id&&!a.yarded).reduce((n,a)=>n+(a.kind==='sheep'?3:8),0);
 p.pasture=Math.max(0,Math.min(100,(p.pasture??100)+(s.weather==='Rain'?22:s.weather==='Hot'?3:10)-grazing*9/(dims(p).w*dims(p).h)));
 }
 for(const a of s.animals){
 const p=s.buildings.find(b=>b.id===a.paddock),fed=a.lastFedDay>=s.day-1||(!a.yarded&&(p?.pasture??100)>=30);
 a.condition=Math.max(15,Math.min(100,a.condition+(watered?(fed?2:-8):-20)));
 if(watered&&fed&&a.condition>60)a.weight+=a.kind==='sheep'?1:5;
 }
 emit(s,'Day '+s.day+' · '+s.weather+'. Wages paid '+cash(paidWages)+(s.wageArrears?' · wages owing '+cash(s.wageArrears):'')+(repayment?' · loan '+cash(repayment):''));

 }
 tickVisitors(s,dt,route,entry,hasHome(s),emit);
 tickHerds(s,dt);
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
 const speed=j.herding&&j.stage===5?1.1:j.vehicle&&j.stage>0?VEHICLES[j.vehicle].speed:2.2;
 const amount=speed*dt;if(dist<=amount){w.x=next.x;w.y=next.y;j.path.shift();}else{w.x+=dx/dist*amount;w.y+=dy/dist*amount;}
 }else{
 if(j.herding&&(j.stage===4||j.stage===5)&&s.animals.some(a=>j.animalIds.includes(a.id)&&Math.hypot((a.x??0)-step.x,(a.y??0)-step.y)>.8))continue;
 j.elapsed+=dt;if(j.type==='build'){const b=s.buildings.find(b=>b.id===j.building);b.progress=j.fencing?Math.min(.99,(j.stage-1+j.elapsed/step.work)/(j.stops.length-1)):j.stage===1?Math.min(.99,j.elapsed/step.work):.03;if(j.fencing)b.fenceSegments=Math.max(0,j.stage-1);}
 if(j.elapsed>=step.work){j.stage++;j.elapsed=0;j.path=null;}
 }
 }
}

// A completed fence is crossed through its southern gate, never through wire.
export function fenceCrossing(s,from,to){
 for(const b of s.buildings.filter(b=>b.kind==='paddock'&&b.built)){
 const d=dims(b),inside=p=>p[0]>=b.x&&p[0]<b.x+d.w&&p[1]>=b.y&&p[1]<b.y+d.h;
 if(inside(from)===inside(to))continue;
 const gate=from[0]===b.x&&to[0]===b.x&&Math.min(from[1],to[1])===b.y+d.h-1&&Math.max(from[1],to[1])===b.y+d.h;
 if(!gate)return true;
 }
 return false;
}
export function animalHome(s,a){
 const b=a.yarded?ready(s,'yards'):s.buildings.find(b=>b.id===a.paddock);
 if(!b)return {x:3,y:14};
 const d=dims(b);return {x:b.x+.25+(a.id*.41)%(d.w-.5),y:b.y+.25+(a.id*.71)%(d.h-.5)};
}
function advanceAnimal(a,target,s,dt,speed){
 const key=target.x+','+target.y;
 if(a.driveTarget!==key){a.driveTarget=key;a.drivePath=null;}
 if(!a.drivePath)a.drivePath=route(s,a,target);
 if(!a.drivePath)return;
 const p=a.drivePath[0]||target,dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),step=dt*speed;
 if(d<=step){a.x=p.x;a.y=p.y;if(a.drivePath.length)a.drivePath.shift();}
 else{a.x+=dx/d*step;a.y+=dy/d*step;}
}
function tickHerds(s,dt){
 for(const a of s.animals){
 const j=s.jobs.find(j=>j.herding&&j.status==='active'&&j.animalIds.includes(a.id));
 const home=animalHome(s,a);
 if(a.x===undefined){a.x=home.x;a.y=home.y;}
 if(j&&j.stage>=2){
 const w=s.workers.find(w=>w.id===j.worker),source=s.buildings.find(b=>b.id===j.sourcePaddock);
 // Stock start moving as the rider reaches them, with a final sweep gathering stragglers.
 if(Math.hypot(w.x-a.x,w.y-a.y)<3.2||j.stage>=4)a.drive=j.id;
 if(a.drive===j.id){const t=j.stage>=5?j.stops[5]:entry(source),target={x:t.x+(a.id%3-1)*.25,y:t.y+(a.id%2)*.2};advanceAnimal(a,target,s,dt,(j.vehicle==='bike'?1.8:1.45)*(.84+(a.id%5)*.04));}
 }else if(!j){
 delete a.drive;delete a.drivePath;delete a.driveTarget;
 // Walk in through the gate after arrival, then settle into grazing positions.
 const dx=home.x-a.x,dy=home.y-a.y,d=Math.hypot(dx,dy),step=dt*.7;
 if(d>step){a.x+=dx/d*step;a.y+=dy/d*step;}else{a.x=home.x;a.y=home.y;}
 }
 }
}
