// Property geography and visitors. Simulation time only; all visitor state is saved.
export const MIN=-13, MAX=29;
export const PARCELS=[
 {id:'home',name:'Home block',x:1,y:1,cost:0},
 {id:'north',name:'Northern pasture',x:1,y:-13,cost:4500},
 {id:'east',name:'Eastern flats',x:15,y:1,cost:5000},
 {id:'south',name:'Creek country',x:1,y:15,cost:4000},
 {id:'west',name:'Western ridge',x:-13,y:1,cost:5500},
 {id:'nw',name:'Ironbark rise',x:-13,y:-13,cost:6500},
 {id:'ne',name:'Sunrise station',x:15,y:-13,cost:7000},
 {id:'sw',name:'River bend',x:-13,y:15,cost:6000},
 {id:'se',name:'Long paddock',x:15,y:15,cost:7500}
];
export function migrateWorld(s){
 s.land??=s.extent===23?['home','east','south','se']:['home'];
 s.visitors??=[];s.campIncome??=0;s.campGuests??=0;s.visitorSeed??=Math.floor(Math.random()*2147483646)+1;
 s.nextVisitor??=s.time+20;s.acres=s.land.length*8;
}
export const parcelAt=(x,y)=>PARCELS.find(p=>x>=p.x&&y>=p.y&&x<p.x+14&&y<p.y+14);
export const owns=(s,x,y)=>s.land?s.land.includes(parcelAt(x,y)?.id):x>=1&&y>=1&&x<s.extent&&y<s.extent;
export const adjacent=(s,p)=>PARCELS.some(o=>(s.land||['home']).includes(o.id)&&Math.abs(o.x-p.x)+Math.abs(o.y-p.y)===14);
export function random(s){s.visitorSeed=(s.visitorSeed*16807)%2147483647;return (s.visitorSeed-1)/2147483646;}
function travel(v,dt,s,route){
 if(!v.path)v.path=route(s,v,v.target);
 if(!v.path)return false;
 if(!v.path.length)return true;
 const p=v.path[0],dx=p.x-v.x,dy=p.y-v.y,d=Math.hypot(dx,dy),step=dt*2;
 if(d<=step){v.x=p.x;v.y=p.y;v.path.shift();}else{v.x+=dx/d*step;v.y+=dy/d*step;}
 return !v.path.length;
}
export function tickVisitors(s,dt,route,entry,hasHome,emit){
 migrateWorld(s);
 if(s.time>=s.nextVisitor){
 s.nextVisitor=s.time+25+random(s)*45;
 const camps=s.buildings.filter(b=>b.kind==='camp'&&b.built&&b.open!==false&&!s.visitors.some(v=>v.camp===b.id)&&s.water>=2&&hasHome);
 if(camps.length){
 const camp=camps[Math.floor(random(s)*camps.length)],at=entry(camp),path=route(s,{x:1,y:16},at);
 if(path)s.visitors.push({id:s.nextId++,camp:camp.id,x:1,y:16,target:at,path,status:'arriving',stay:40+random(s)*80,fee:camp.fee||90,paid:false});
 }
 }
 for(const v of s.visitors){
 if(v.status==='arriving'&&travel(v,dt,s,route)){
 v.status='staying';v.departAt=s.time+v.stay;
 if(!v.paid){v.paid=true;s.money+=v.fee;s.campIncome+=v.fee;s.campGuests++;s.water=Math.max(0,s.water-2);emit(s,'Campers checked in: $'+v.fee+' paid.');}
 }else if(v.status==='staying'&&s.time>=v.departAt){v.status='leaving';v.target={x:1,y:16};v.path=null;emit(s,'Campers packed up and are heading home.');}
 else if(v.status==='leaving'&&travel(v,dt,s,route))v.status='gone';
 }
 s.visitors=s.visitors.filter(v=>v.status!=='gone');
}
