import {PropertyTerrain,creekY} from './property-terrain.mjs';
import {drawDetail,detailLights} from './property-detail-art.mjs';
import {PaintedActors} from './property-painted.mjs';
import {drawField} from './property-field-art.mjs';
import {MotionTracks,drawVehicle} from './property-motion.mjs';
import {PropertyLife} from './property-life.mjs';
import {BUILDINGS,SIZE,canPlace,ready,dims,owns,PARCELS,parcelAt,animalHome} from './property.mjs';
export class PropertyMap{
 constructor(canvas,getState,onPick){
 this.canvas=canvas;this.ctx=canvas.getContext('2d');this.getState=getState;this.onPick=onPick;this.zoom=1;this.cx=8;this.cy=9;this.selected=1;this.placement=null;this.hover=null;this.images=[];this.life=new PropertyLife();this.tracks=new MotionTracks();this.painted=new PaintedActors();
 for(let i=0;i<32;i++){const a=new Image();a.src='assets/farm-'+i+'.webp';this.images.push(a);}
 this.terrain=new PropertyTerrain();this.buildingSize=dims;
 this.resize=()=>{const r=canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio,2);canvas.width=r.width*d;canvas.height=r.height*d;this.dpr=d;};
 new ResizeObserver(this.resize).observe(canvas);
 let drag=null;const pointers=new Map();let pinch=0;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.placement==='fence'){const r=canvas.getBoundingClientRect();this.fenceStart=this.tile(e.clientX-r.left,e.clientY-r.top);this.fenceEnd=this.fenceStart;}drag={x:e.clientX,y:e.clientY,cx:this.cx,cy:this.cy,moved:false};if(pointers.size===2){this.fenceStart=null;const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);drag.moved=true;}});
 canvas.addEventListener('pointermove',e=>{
 const rect=canvas.getBoundingClientRect();this.hover=this.tile(e.clientX-rect.left,e.clientY-rect.top);
 if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){this.fenceStart=null;const p=[...pointers.values()],n=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);this.zoom=Math.max(this.landMode ? .14 : .3,Math.min(2.5,this.zoom*n/(pinch||n)));pinch=n;drag.moved=true;return;}
 if(this.placement==='fence'&&this.fenceStart){this.fenceEnd=this.hover;drag.moved=true;return;}
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>6){drag.moved=true;this.cx=drag.cx-(dx/28+dy/14)/2/this.zoom;this.cy=drag.cy-(dy/14-dx/28)/2/this.zoom;}
 });
 const end=e=>{if(this.placement==='fence'&&this.fenceStart&&pointers.size===1){const a=this.fenceStart,b=this.fenceEnd||a;this.onPick({fence:{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x)+1,h:Math.abs(a.y-b.y)+1}});this.fenceStart=null;this.fenceEnd=null;pointers.clear();drag=null;return;}if(drag&&!drag.moved&&pointers.size===1){const r=canvas.getBoundingClientRect();this.pick(e.clientX-r.left,e.clientY-r.top);}pointers.delete(e.pointerId);if(!pointers.size)drag=null;else if(drag)drag.moved=true;};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',()=>{pointers.clear();drag=null;this.fenceStart=null;this.fenceEnd=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(this.landMode ? .14 : .3,Math.min(2.5,this.zoom*(e.deltaY>0?.9:1.1)));},{passive:false});
 }
 fit(){const s=this.getState(),ps=PARCELS.filter(p=>this.landMode||s.land.includes(p.id)),x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y)),w=Math.max(...ps.map(p=>p.x+14))-x,h=Math.max(...ps.map(p=>p.y+14))-y;this.cx=x+w/2;this.cy=y+h/2;this.zoom=Math.max(.14,Math.min(1.25,this.w/((w+h)*28),this.h/((w+h)*16)));}
 focus(w){this.cx=w.x;this.cy=w.y;this.zoom=Math.max(this.zoom,.9);}
 point(x,y){return {x:this.w/2+(x-y-this.cx+this.cy)*28*this.zoom,y:this.h*.51+(x+y-this.cx-this.cy)*14*this.zoom};}
 tile(x,y){const a=(x-this.w/2)/(28*this.zoom),b=(y-this.h*.51)/(14*this.zoom);return {x:Math.floor((a+b)/2+this.cx),y:Math.floor((b-a)/2+this.cy)};}
 pick(x,y){
 const s=this.getState();
 const tile=this.tile(x,y),project=s.buildings.find(b=>tile.x>=b.x&&tile.y>=b.y&&tile.x<b.x+dims(b).w&&tile.y<b.y+dims(b).h);
 if(!this.placement&&!this.landMode&&project)return this.onPick({building:project.id});
 if(!this.placement){const near=s.workers.find(w=>{const p=this.point(w.x+.5,w.y+.5);return Math.hypot(x-p.x,y-(p.y-12*this.zoom))<23;});if(near)return this.onPick({worker:near.id});}
 const t=this.tile(x,y);
 if(this.landMode)return this.onPick({land:parcelAt(t.x,t.y)?.id});
 if(this.placement)return this.onPick({place:this.placement,...t});
 const building=s.buildings.find(b=>t.x>=b.x&&t.y>=b.y&&t.x<b.x+dims(b).w&&t.y<b.y+dims(b).h);
 this.onPick(building?{building:building.id}:{ground:t});
 }
 polygon(points,fill,stroke,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 rectShape(x,y,w,h,fill,stroke){this.polygon([this.point(x,y),this.point(x+w,y),this.point(x+w,y+h),this.point(x,y+h)],fill,stroke);}
 tileShape(x,y,size,fill,stroke){this.polygon([this.point(x,y),this.point(x+size,y),this.point(x+size,y+size),this.point(x,y+size)],fill,stroke);}
 sprite(art,x,y,width,alpha=1,bob=0,flip=false){
 const a=this.images[art];if(!a?.complete||!a.naturalWidth)return;
 const p=this.point(x,y),w=width*this.zoom,h=w*a.naturalHeight/a.naturalWidth;
 this.ctx.save();this.ctx.globalAlpha=alpha;if(flip){this.ctx.translate(p.x*2,0);this.ctx.scale(-1,1);}this.ctx.drawImage(a,p.x-w/2,p.y-h+bob,w,h);this.ctx.restore();
 }
 vehicle(kind,id,x,y,heading=null,rider=true){const pose=this.tracks.sample(id,x,y,this.getState().time);if(heading!==null)pose.heading=heading;drawVehicle(this,kind,x,y,pose,rider);}
 grounded(art,x,y,width,flip=false){const p=this.point(x,y),c=this.ctx;c.save();c.fillStyle='#20312535';c.beginPath();c.ellipse(p.x,p.y,width*this.zoom*.3,width*this.zoom*.09,0,0,Math.PI*2);c.fill();c.restore();this.sprite(art,x,y,width,1,0,flip);}
 fence(x,y,w,colour='#b7a77a',h=w,segments=Infinity,gate=false){
 const c=this.ctx,pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];let built=0;
 for(let side=0;side<4;side++){
 const a=pts[side],b=pts[side+1],len=side%2?h:w;
 for(let n=0;n<len;n++){
 const p=this.point(a[0]+(b[0]-a[0])*n/len,a[1]+(b[1]-a[1])*n/len),q=this.point(a[0]+(b[0]-a[0])*(n+1)/len,a[1]+(b[1]-a[1])*(n+1)/len);
 const complete=built++<segments;c.strokeStyle=complete?colour:'#e9c77466';c.lineWidth=(complete?2:1)*this.zoom;
 c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-(complete?9:3)*this.zoom);c.stroke();
 if(complete&&!(gate&&side===2&&n===w-1)){c.lineWidth=this.zoom;c.beginPath();for(const off of [4,8]){c.moveTo(p.x,p.y-off*this.zoom);c.lineTo(q.x,q.y-off*this.zoom);}c.stroke();}
 }
 }
 }
 label(x,y,text,accent=false){const p=this.point(x,y),c=this.ctx;c.font='600 10px system-ui';const width=c.measureText(text).width+16;c.fillStyle=accent?'#e8c679':'#203d32df';c.beginPath();c.roundRect(p.x-width/2,p.y-18,width,21,7);c.fill();c.fillStyle=accent?'#213a2e':'#fff4da';c.textAlign='center';c.fillText(text,p.x,p.y-4);}
 draw(time=0,motion=true){
 if(!this.w)return;const c=this.ctx,s=this.getState();this.life.update(s,motion);time=motion?s.time*1000:0;c.setTransform(this.dpr,0,0,this.dpr,0,0);
 this.terrain.draw(this,s);
 // Survey boundaries stay subtle during play; full grid appears only while placing.
 for(const p of PARCELS){
  if(s.land.includes(p.id)){c.save();c.setLineDash([5*this.zoom,7*this.zoom]);this.rectShape(p.x,p.y,14,14,null,this.landMode?'#fff0b7':'#ede7bd66');c.restore();}
  else if(this.landMode)this.rectShape(p.x,p.y,14,14,'#263e3855','#ead7a8');
 }
 if(this.placement){c.save();c.lineWidth=.7;for(const p of PARCELS.filter(p=>s.land.includes(p.id)))for(let n=1;n<14;n++){for(const points of [[this.point(p.x+n,p.y),this.point(p.x+n,p.y+14)],[this.point(p.x,p.y+n),this.point(p.x+14,p.y+n)]]){c.strokeStyle='#f7edc529';c.beginPath();c.moveTo(points[0].x,points[0].y);c.lineTo(points[1].x,points[1].y);c.stroke();}}c.restore();}
 const draws=[];
 for(let i=0;i<110;i++){
 const seed=n=>{const a=Math.sin(n*127.1)*43758.5453;return a-Math.floor(a);};const x=-15+seed(i+1)*47,y=-15+seed(i+301)*47;
 if(!owns(s,Math.floor(x),Math.floor(y))&&Math.abs(x-1.5)>1.05&&Math.abs(y-16.5)>1.05&&Math.abs(y-creekY(x))>1.5){
 const p=this.point(x,y);if(p.x< -90||p.x>this.w+90||p.y< -80||p.y>this.h+130)continue;
 draws.push({depth:x+y,run:()=>{c.save();c.translate(p.x+9*this.zoom,p.y);c.scale(1,.4);const r=24*this.zoom,g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'#233c3045');g.addColorStop(1,'#233c3000');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);c.restore();this.sprite(15,x,y,54+(i%5)*9,1,0,i%2===0);}});
 }
 }
 for(const b of s.buildings){
 const d=BUILDINGS[b.kind],{w,h}=dims(b),size=Math.max(w,h);
 draws.push({depth:b.x+b.y+size,run:()=>{
 if(!b.built||b.id===this.activeBuilding)this.rectShape(b.x,b.y,w,h,b.built?'#f5df9320':'#e0c79455',b.id===this.activeBuilding?'#fff1ae':'#c6b386');
 if(!b.built){
 this.fence(b.x,b.y,w,'#d6bd87',h,b.fenceSegments??0,true);
 if(d.decoration)drawDetail(this,b,.28);else{c.save();c.globalAlpha=.22;this.sprite(d.art,b.x+size/2,b.y+size/2+.5,size*56);c.restore();}
 this.label(b.x+size/2,b.y+size/2,Math.round(b.progress*100)+'% · '+d.name,true);
 }else if(d.decoration){drawDetail(this,b);}
 else if(b.kind==='field'){drawField(this,s,b,time,motion);}
 else if(b.kind==='paddock'){this.rectShape(b.x,b.y,w,h,(b.pasture??100)<30?'#bd945e55':'#72955328');this.fence(b.x,b.y,w,'#dec69a',h,Infinity,true);this.rectShape(b.x+w-.85,b.y+h-.7,.55,.3,s.water?'#709aa4':'#938774','#d6d3bd');}
 else if(b.kind==='garden'&&!b.planted){
 this.rectShape(b.x+.07,b.y+.07,w-.14,h-.14,'#947550','#af966b');
 for(let n=0;n<5;n++){const a=this.point(b.x+.15+n*.32,b.y+.1),z=this.point(b.x+.15+n*.32,b.y+1.8);c.strokeStyle='#604c35';c.lineWidth=3*this.zoom;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(z.x,z.y);c.stroke();}
 }else if(b.kind==='dam'&&!b.water){const p=this.point(b.x+1.5,b.y+1.5);c.fillStyle='#9a734d';c.beginPath();c.ellipse(p.x,p.y,66*this.zoom,35*this.zoom,0,0,Math.PI*2);c.fill();c.fillStyle='#755638';c.beginPath();c.ellipse(p.x,p.y-3*this.zoom,51*this.zoom,24*this.zoom,0,0,Math.PI*2);c.fill();this.label(b.x+1.5,b.y+1.8,'Waiting for rain');}
 else{this.sprite(d.art,b.x+size/2,b.y+size/2+.5,(b.kind==='dam'?1.1:1)*size*57);if(b.kind==='dam'&&!b.water)this.label(b.x+1.5,b.y+1.8,'Waiting for rain');}
 if(b.kind==='garden'&&b.planted)this.label(b.x+1,b.y+1,s.time>=b.ready?'Ready to harvest':Math.ceil(b.ready-s.time)+'s',s.time>=b.ready);
 }});
 }
 for(const job of s.jobs.filter(j=>j.type==='relocateDecor')){const b=s.buildings.find(b=>b.id===job.building);if(b)draws.push({depth:job.x+job.y+1,run:()=>{drawDetail(this,{...b,x:job.x,y:job.y},.3);this.label(job.x+.5,job.y+.5,'Moving here');}});}
 for(const a of s.animals){
 const b=a.yarded?ready(s,'yards'):s.buildings.find(b=>b.id===a.paddock);if(!b)continue;
 const sale=s.jobs.find(j=>j.type==='sell'&&j.status==='active'&&j.stage>=2&&j.animalIds.includes(a.id));if(sale)continue;
 const home=animalHome(s,a),view=this.life.animal(s,a,b,dims(b).w,dims(b).h);let x=view.x??home.x,y=view.y??home.y;
 const pose=this.tracks.sample('animal-'+a.id,x,y,s.time);
 draws.push({depth:x+y+.8,run:()=>this.grounded(view.rest?(a.kind==='sheep'?31:30):(a.kind==='sheep'?13:12),x,y,32,Math.cos(pose.heading)-Math.sin(pose.heading)<0)});
 }
 for(const v of s.visitors||[]){draws.push({depth:v.x+v.y+1,run:()=>{this.vehicle('camper','visitor-'+v.id,v.x+.5,v.y+.5);if(v.status==='staying'){this.sprite(14,v.x+1,v.y+.4,20);this.label(v.x+.5,v.y-1,'Camping - paid $'+v.fee);}}});}
 for(const [i,v]of s.vehicles.entries()){
 if(s.jobs.some(j=>j.vehicle===v&&j.status==='active'&&j.stage>0))continue;
 const x=3.8+(i%3)*3.2,y=14.8-Math.floor(i/3)*2.4;
 draws.push({depth:x+y,run:()=>{if(v==='horse')this.grounded(11,x,y,40);else this.vehicle(v,'parked-'+v,x,y,null,false);}});
 }
 for(const [i,v] of (s.machines||[]).filter(v=>/Tractor|Harvester|header/.test(v)).entries()){
 if(s.jobs.some(j=>j.machine===v&&j.status==='active'&&j.stage>0))continue;
 const x=4+(i%3)*3.2,y=11.8-Math.floor(i/3)*2.4;draws.push({depth:x+y,run:()=>this.vehicle(v,'machine-'+v,x,y,0,false)});
 }
 for(const j of s.jobs.filter(j=>j.hire&&j.building&&j.status==='active'&&j.elapsed>0)){
 const b=s.buildings.find(b=>b.id===j.building&&b.kind==='field');if(!b)continue;
 const fraction=Math.min(.999,j.elapsed/(j.stops[j.stage]?.work||1)),row=Math.min(b.h-1,Math.floor(fraction*b.h)),along=(fraction*b.h-row),x=b.x+.25+(row%2?1-along:along)*(b.w-.5),y=b.y+row+.5;
 const kind=j.type==='harvestField'?(b.path==='cane'?'caneHarvester':'header'):'smallTractor';
 draws.push({depth:x+y+1,run:()=>{this.vehicle(kind,'contractor-'+j.id,x,y,row%2?Math.PI:0);}});
 }
 for(const w of s.workers){
 const j=s.jobs.find(j=>j.worker===w.id&&j.status==='active'),p=this.point(w.x+.5,w.y+.5);
 draws.push({depth:w.x+w.y+1,run:()=>{
 if(w.id===this.selected){c.strokeStyle='#ffdf79';c.lineWidth=2;c.fillStyle='#f9e5a433';c.beginPath();c.ellipse(p.x,p.y,20*this.zoom,10*this.zoom,0,0,Math.PI*2);c.fill();c.stroke();}
 const pose=this.tracks.sample('worker-'+w.id,w.x+.5,w.y+.5,s.time);
 if(j?.machine&&j.stage>0){drawVehicle(this,j.machine,w.x+.5,w.y+.5,{...pose,implement:j.implement});}
 else if(j?.type==='deliver'){drawVehicle(this,'truck',w.x+.5,w.y+.5,pose);}
 else if(j?.vehicle&&j.stage>0){if(j.vehicle==='horse'){if(!this.painted.vehicle(this,'horse',w.x+.5,w.y+.5,pose))this.grounded(22,w.x+.5,w.y+.5,58,Math.cos(pose.heading)-Math.sin(pose.heading)<0);}else drawVehicle(this,j.vehicle,w.x+.5,w.y+.5,pose);}
 else if(!this.painted.worker(this,w.x+.5,w.y+.5,pose))this.grounded(14,w.x+.5,w.y+.5,26,Math.cos(pose.heading)-Math.sin(pose.heading)<0);
 if(w.id===this.selected&&!j?.herding)this.label(w.x+.5,w.y-1.1,j?j.stops[j.stage]?.label||'Finishing':w.name+' · ready');
 }});
 }
 this.life.entities(this,s,draws);
 draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.run());
 this.tracks.prune(new Set([...s.workers.map(w=>'worker-'+w.id),...s.animals.map(a=>'animal-'+a.id),...(s.visitors||[]).map(v=>'visitor-'+v.id),...s.jobs.map(j=>'contractor-'+j.id),...s.vehicles.map(v=>'parked-'+v),...(s.machines||[]).map(v=>'machine-'+v),'traffic-'+Math.floor(s.time/125)]));
 this.life.world(this,s,time);detailLights(this,s);
 if(this.placement==='fence'&&this.fenceStart&&this.fenceEnd){const a=this.fenceStart,b=this.fenceEnd,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x)+1,h=Math.abs(a.y-b.y)+1;this.rectShape(x,y,w,h,canPlace(s,this.fieldLayout?'field':'paddock',x,y,w,h)?'#cc493855':'#ecda8b66','#fff0aa');this.label(x+w/2,y+h/2,w+' x '+h+' - $'+(this.fieldLayout?w*h*150:(w+h)*180+160),true);}
 else if(this.placement&&this.placement!=='fence'&&this.hover){const {x,y}=this.hover,d=BUILDINGS[this.placement];this.tileShape(x,y,d.size,canPlace(s,this.placement,x,y)?'#cc493855':'#ecda8b66','#fff0aa');}
 if(this.landMode)for(const p of PARCELS)this.label(p.x+7,p.y+7,s.land.includes(p.id)?p.id.toUpperCase()+' - owned':p.id.toUpperCase()+' $'+p.cost,!s.land.includes(p.id));
 if(s.weather==='Rain'){c.strokeStyle='#d2e7de55';c.lineWidth=1;for(let i=0;i<70;i++){const x=(i*79+time*.02)%this.w,y=(i*127+time*.1)%this.h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+12);c.stroke();}}
 const vignette=c.createRadialGradient(this.w/2,this.h/2,this.h*.25,this.w/2,this.h/2,this.w*.8);vignette.addColorStop(0,'#1b312200');vignette.addColorStop(1,'#1b312240');c.fillStyle=vignette;c.fillRect(0,0,this.w,this.h);
 }
}
