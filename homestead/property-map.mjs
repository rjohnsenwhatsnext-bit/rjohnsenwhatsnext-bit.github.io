import {BUILDINGS,VEHICLES,SIZE,canPlace,ready,dims,owns,PARCELS,parcelAt,animalHome} from './property.mjs';
export class PropertyMap{
 constructor(canvas,getState,onPick){
 this.canvas=canvas;this.ctx=canvas.getContext('2d');this.getState=getState;this.onPick=onPick;this.zoom=1;this.cx=8;this.cy=9;this.selected=1;this.placement=null;this.hover=null;this.images=[];
 for(let i=0;i<24;i++){const a=new Image();a.src='assets/farm-'+i+'.webp';this.images.push(a);}
 this.ground=new Image();this.ground.src='assets/pasture.webp';this.ground.onload=()=>{this.grassPattern=this.ctx.createPattern(this.ground,'repeat');};
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
 draw(time=0){
 if(!this.w)return;const c=this.ctx,s=this.getState();c.setTransform(this.dpr,0,0,this.dpr,0,0);
 const bg=c.createLinearGradient(0,0,0,this.h);bg.addColorStop(0,'#7f8f61');bg.addColorStop(1,'#a8a473');c.fillStyle=bg;c.fillRect(0,0,this.w,this.h);
 for(let y=-15;y<SIZE+2;y++)for(let x=-15;x<SIZE+2;x++){
 const hash=Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1;
 const owned=owns(s,x,y);
 const screen=this.point(x,y);if(screen.x < -100||screen.x>this.w+100||screen.y< -100||screen.y>this.h+150)continue;
 let fill=owned?['#a3a770','#a1a56e','#9ea36c','#a5a872'][Math.floor(hash*4)]:['#74845a','#7b875a','#818c5e'][Math.floor(hash*3)];
 if(x===1||y===16)fill=['#c3a378','#bca077','#caaa7c'][Math.floor(hash*3)];
 if(x!==1&&y>=18&&y<=19)fill=y===18?'#627b64':'#69877a';
 this.tileShape(x,y,1,fill);
 if(this.grassPattern&&x!==1&&y!==16&&!(y>=18&&y<=19)){c.save();c.globalAlpha=.43;this.tileShape(x,y,1,this.grassPattern);c.restore();}
 const p=this.point(x+hash,y+.5);if(hash>.3&&x!==1&&y!==16){c.strokeStyle=owned?'#596d3b38':'#ced4a222';c.lineWidth=.7;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-2*this.zoom,p.y-3*this.zoom);c.moveTo(p.x,p.y);c.lineTo(p.x+2*this.zoom,p.y-2*this.zoom);c.stroke();}
 }
 // Property line and road guide.
 for(const p of PARCELS){if(s.land.includes(p.id))this.rectShape(p.x,p.y,14,14,null,'#ead7a888');else if(this.landMode)this.rectShape(p.x,p.y,14,14,'#263e3855','#ead7a8');}
 const draws=[];
 for(let i=0;i<28;i++){const x=(i*7.31)%25,y=(i*11.19)%25;if(x<2||y<2||x>s.extent||y>s.extent)draws.push({depth:x+y,run:()=>this.sprite(15,x,y,70+(i%3)*10,.9)});}
 for(const b of s.buildings){
 const d=BUILDINGS[b.kind],{w,h}=dims(b),size=Math.max(w,h);
 draws.push({depth:b.x+b.y+size,run:()=>{
 this.rectShape(b.x,b.y,w,h,b.built?'#b3a17a60':'#e0c79470',b.id===this.activeBuilding?'#fff1ae':'#c6b386');
 if(!b.built){
 this.fence(b.x,b.y,w,'#d6bd87',h,b.fenceSegments??0,true);
 c.save();c.globalAlpha=.22;this.sprite(d.art,b.x+size/2,b.y+size/2+.5,size*56);c.restore();
 this.label(b.x+size/2,b.y+size/2,Math.round(b.progress*100)+'% · '+d.name,true);
 }else if(b.kind==='paddock'){this.rectShape(b.x,b.y,w,h,(b.pasture??100)<30?'#bd945e99':'#82ae6399');this.fence(b.x,b.y,w,'#dec69a',h,Infinity,true);}
 else if(b.kind==='garden'&&!b.planted){
 for(let n=0;n<5;n++){const a=this.point(b.x+.15+n*.32,b.y+.1),z=this.point(b.x+.15+n*.32,b.y+1.8);c.strokeStyle='#775c39';c.lineWidth=5*this.zoom;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(z.x,z.y);c.stroke();}
 }else if(b.kind==='dam'&&!b.water){const p=this.point(b.x+1.5,b.y+1.5);c.fillStyle='#9a734d';c.beginPath();c.ellipse(p.x,p.y,66*this.zoom,35*this.zoom,0,0,Math.PI*2);c.fill();c.fillStyle='#755638';c.beginPath();c.ellipse(p.x,p.y-3*this.zoom,51*this.zoom,24*this.zoom,0,0,Math.PI*2);c.fill();this.label(b.x+1.5,b.y+1.8,'Waiting for rain');}
 else{this.sprite(d.art,b.x+size/2,b.y+size/2+.5,(b.kind==='dam'?1.1:1)*size*57);if(b.kind==='dam'&&!b.water)this.label(b.x+1.5,b.y+1.8,'Waiting for rain');}
 if(b.kind==='garden'&&b.planted)this.label(b.x+1,b.y+1,s.time>=b.ready?'Ready to harvest':Math.ceil(b.ready-s.time)+'s',s.time>=b.ready);
 }});
 }
 for(const a of s.animals){
 const b=a.yarded?ready(s,'yards'):s.buildings.find(b=>b.id===a.paddock);if(!b)continue;
 const sale=s.jobs.find(j=>j.type==='sell'&&j.status==='active'&&j.stage>=2&&j.animalIds.includes(a.id));if(sale)continue;
 const home=animalHome(s,a);let x=a.x??home.x,y=a.y??home.y;
 const moving=!!a.drive;const graze=moving?0:Math.sin(time*.0003+a.id)*.06;
 x+=graze;

 draws.push({depth:x+y+.8,run:()=>this.sprite(a.kind==='sheep'?13:12,x,y,32,1,Math.sin(time*(moving?.014:.001)+a.id)*(moving?1.4:.4),a.drivePath?.[0]&&(a.drivePath[0].x-a.drivePath[0].y<x-y))});
 }
 for(const v of s.visitors||[]){draws.push({depth:v.x+v.y+1,run:()=>{this.sprite(21,v.x+.5,v.y+.5,63,1,v.status==='staying'?0:Math.sin(time*.01)*.5);if(v.status==='staying'){this.sprite(14,v.x+1,v.y+.4,20);this.label(v.x+.5,v.y-1,'Camping - paid $'+v.fee);}}});}
 for(const [i,v]of s.vehicles.entries()){
 if(s.jobs.some(j=>j.vehicle===v&&j.status==='active'&&j.stage>0))continue;
 const x=4+i*1.5,y=15;
 draws.push({depth:x+y,run:()=>{if(v==='bike')this.bike(x,y);else this.sprite(VEHICLES[v].art,x,y,v==='truck'?88:v==='horse'?40:65);}});
 }
 for(const w of s.workers){
 const j=s.jobs.find(j=>j.worker===w.id&&j.status==='active'),p=this.point(w.x+.5,w.y+.5);
 draws.push({depth:w.x+w.y+1,run:()=>{
 if(w.id===this.selected){c.strokeStyle='#ffdf79';c.lineWidth=2;c.fillStyle='#f9e5a433';c.beginPath();c.ellipse(p.x,p.y,20*this.zoom,10*this.zoom,0,0,Math.PI*2);c.fill();c.stroke();}
 if(j?.vehicle&&j.stage>0){if(j.vehicle==='horse'||j.vehicle==='bike')this.sprite(j.vehicle==='horse'?22:23,w.x+.5,w.y+.5,j.vehicle==='horse'?58:46,1,j.path?.length?Math.sin(time*.012)*1.1:0,j.path?.[0]&&(j.path[0].x-j.path[0].y<w.x-w.y));else this.sprite(VEHICLES[j.vehicle].art,w.x+.5,w.y+.5,j.vehicle==='truck'?86:70,1,j.path?.length?Math.sin(time*.012)*.4:0);}
 else this.sprite(14,w.x+.5,w.y+.5,26,1,j?.path?.length?Math.sin(time*.016)*1.2:0);
 if(w.id===this.selected&&!j?.herding)this.label(w.x+.5,w.y-1.1,j?j.stops[j.stage]?.label||'Finishing':w.name+' · ready');
 }});
 }
 draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.run());
 if(this.placement==='fence'&&this.fenceStart&&this.fenceEnd){const a=this.fenceStart,b=this.fenceEnd,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x)+1,h=Math.abs(a.y-b.y)+1;this.rectShape(x,y,w,h,canPlace(s,'paddock',x,y,w,h)?'#cc493855':'#ecda8b66','#fff0aa');this.label(x+w/2,y+h/2,w+' x '+h+' - $'+((w+h)*180+160),true);}
 else if(this.placement&&this.placement!=='fence'&&this.hover){const {x,y}=this.hover,d=BUILDINGS[this.placement];this.tileShape(x,y,d.size,canPlace(s,this.placement,x,y)?'#cc493855':'#ecda8b66','#fff0aa');}
 if(this.landMode)for(const p of PARCELS)this.label(p.x+7,p.y+7,s.land.includes(p.id)?p.id.toUpperCase()+' - owned':p.id.toUpperCase()+' $'+p.cost,!s.land.includes(p.id));
 if(s.weather==='Rain'){c.strokeStyle='#d2e7de55';c.lineWidth=1;for(let i=0;i<70;i++){const x=(i*79+time*.02)%this.w,y=(i*127+time*.1)%this.h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+12);c.stroke();}}
 const vignette=c.createRadialGradient(this.w/2,this.h/2,this.h*.25,this.w/2,this.h/2,this.w*.8);vignette.addColorStop(0,'#1b312200');vignette.addColorStop(1,'#1b312240');c.fillStyle=vignette;c.fillRect(0,0,this.w,this.h);
 }
 bike(x,y){const c=this.ctx,p=this.point(x,y);c.fillStyle='#26392f';for(const dx of [-10,10]){c.beginPath();c.ellipse(p.x+dx*this.zoom,p.y,4*this.zoom,7*this.zoom,-.6,0,7);c.fill();}c.strokeStyle='#c2693e';c.lineWidth=5*this.zoom;c.beginPath();c.moveTo(p.x-10*this.zoom,p.y-4*this.zoom);c.lineTo(p.x+8*this.zoom,p.y-9*this.zoom);c.stroke();this.sprite(14,x,y-.1,18);}
}
