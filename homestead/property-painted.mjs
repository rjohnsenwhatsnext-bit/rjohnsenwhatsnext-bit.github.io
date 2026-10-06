// Painted directional assets with a distance-driven, pre-rendered walking rig.
// The source PNGs remain intact; meshes and animation frames exist only in memory.
export const headingColumn=heading=>((Math.round(heading/(Math.PI/2))%4)+4)%4;
export const gaitPhase=distance=>(distance/.92*Math.PI*2)%(Math.PI*2);
const smooth=t=>Math.max(0,Math.min(1,t));
export function rigPoint(x,y,phase,direction){
 const side=x<.5?-1:1,step=Math.sin(phase+(side<0?0:Math.PI));
 const forwardX=[1,-1,-1,1][direction],forwardY=[.45,.45,-.45,-.45][direction];
 let dx=0,dy=0;
 if(y>.53){
  const influence=smooth((y-.53)/.40),stride=step*.125*influence;
  dx=forwardX*stride;dy=forwardY*stride-Math.max(0,Math.cos(phase+(side<0?0:Math.PI)))*.055*influence;
 }else if(y>.24&&(x<.25||x>.76)){
  const weight=smooth((y-.24)/.29);dx=-forwardX*step*.05*weight;dy=-forwardY*step*.035*weight;
 }
 return {x:x*.40+dx,y:y+dy-Math.abs(Math.sin(phase))*.012};
}
function triangle(ctx,img,src,dst){
 const [s0,s1,s2]=src,[d0,d1,d2]=dst,sx1=s1.x-s0.x,sy1=s1.y-s0.y,sx2=s2.x-s0.x,sy2=s2.y-s0.y,det=sx1*sy2-sx2*sy1;
 const dx1=d1.x-d0.x,dy1=d1.y-d0.y,dx2=d2.x-d0.x,dy2=d2.y-d0.y;
 const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det,d=(dy2*sx1-dy1*sx2)/det;
 ctx.save();ctx.beginPath();const center={x:(d0.x+d1.x+d2.x)/3,y:(d0.y+d1.y+d2.y)/3};
 dst.forEach((p,i)=>{const vx=p.x-center.x,vy=p.y-center.y,len=Math.hypot(vx,vy)||1,px=p.x+vx/len*.35,py=p.y+vy/len*.35;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();
 ctx.transform(a,b,c,d,d0.x-a*s0.x-c*s0.y,d0.y-b*s0.x-d*s0.y);ctx.drawImage(img,0,0);ctx.restore();
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export class PaintedActors{
 constructor(){
  this.ready=false;this.frames=[];
  const image=async name=>{const img=new Image();img.src=new URL('./assets/'+name,import.meta.url).href;await img.decode();return img;};
  this.loaded=Promise.all([image('vehicles-painted-v2.png'),image('farmer-rig-v2.png'),fetch(new URL('./assets/painted-v2-atlas.json',import.meta.url)).then(r=>r.json())]).then(([vehicles,farmer,atlas])=>{
   this.vehicles=vehicles;this.atlas=atlas;this.makeWalk(farmer,atlas['farmer-rig-v2.png'][0]);this.ready=true;
  }).catch(error=>{this.error=error.message;});
 }
 makeWalk(image,rects){
  for(let direction=0;direction<4;direction++){
   const [x,y,w,h]=rects[direction],cut=canvas(96,240);cut.getContext('2d').drawImage(image,x,y,w,h,0,0,96,240);
   const idle=canvas(192,276);idle.getContext('2d').drawImage(cut,48,12);const frames=[];
   const xs=[0,.18,.25,.38,.5,.62,.76,.83,1],ys=[0,.20,.24,.38,.53,.62,.75,.88,1];
   for(let frame=0;frame<16;frame++){
    const target=canvas(192,276),ctx=target.getContext('2d'),phase=frame/16*Math.PI*2;
    const point=(x,y)=>{const p=rigPoint(x,y,phase,direction);return {x:48+p.x*240,y:12+p.y*240};};
    for(let r=0;r<ys.length-1;r++)for(let col=0;col<xs.length-1;col++){
     const pairs=[[xs[col],ys[r]],[xs[col+1],ys[r]],[xs[col+1],ys[r+1]],[xs[col],ys[r+1]]],src=pairs.map(([x,y])=>({x:x*96,y:y*240})),dst=pairs.map(([x,y])=>point(x,y));
     for(const ids of [[0,1,2],[0,2,3]])triangle(ctx,cut,ids.map(i=>src[i]),ids.map(i=>dst[i]));
    }frames.push(target);
   }
   this.frames.push({idle,frames});
  }
 }
 worker(map,x,y,pose){
  if(!this.ready)return false;
  const c=map.ctx,p=map.point(x,y),direction=headingColumn(pose.heading),moving=pose.moving&&map.life?.motion!==false;
  const frame=moving?this.frames[direction].frames[Math.floor(gaitPhase(pose.distance)/Math.PI/2*16)%16]:this.frames[direction].idle;
  const height=39*map.zoom,scale=height/240;
  c.save();c.fillStyle='#17291d30';c.beginPath();c.ellipse(p.x,p.y,7*map.zoom,3*map.zoom,0,0,Math.PI*2);c.fill();
  c.drawImage(frame,p.x-96*scale,p.y-234*scale,192*scale,276*scale);c.restore();return true;
 }
 vehicle(map,kind,x,y,pose){
  if(!this.ready)return false;
  const row=kind==='truck'?0:kind==='ute'?1:/Tractor/.test(kind)?2:/Harvester|header/.test(kind)?3:-1;if(row<0)return false;
  const column=headingColumn(pose.heading),[sx,sy,sw,sh]=this.atlas['vehicles-painted-v2.png'][row][column],c=map.ctx,p=map.point(x,y);
  const width=[94,70,65,94][row]*map.zoom,height=width*sh/sw;
  c.save();
  if(pose.moving&&map.life?.motion!==false&&map.getState?.().weather!=='Rain'){
   const dx=Math.cos(pose.heading),dy=Math.sin(pose.heading);
   for(let i=0;i<4;i++){const age=(pose.distance*.75+i/4)%1,q=map.point(x-dx*(.65+age),y-dy*(.65+age));c.fillStyle=`rgba(182,150,102,${.12*(1-age)})`;c.beginPath();c.ellipse(q.x,q.y,(3+age*8)*map.zoom,(1+age*3)*map.zoom,0,0,Math.PI*2);c.fill();}
  }
  if(pose.implement)this.implement(map,x,y,pose);
  c.drawImage(this.vehicles,sx,sy,sw,sh,p.x-width/2,p.y-height*.80,width,height);
  c.restore();return true;
 }
 implement(map,x,y,pose){
  const c=map.ctx,cs=Math.cos(pose.heading),sn=Math.sin(pose.heading),pt=(u,v)=>map.point(x+u*cs-v*sn,y+u*sn+v*cs);
  const a=pt(-.55,0),b=pt(-1.05,0);c.strokeStyle='#77755e';c.lineWidth=2*map.zoom;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
  const width=pose.implement==='sprayer'?1.45:.72;
  const corners=[pt(-1.0,-width),pt(-1.4,-width),pt(-1.4,width),pt(-1,width)];map.polygon(corners,'#86734d','#b8a67c',map.zoom);
  for(let v=-width;v<width;v+=.2){const a=pt(-1.15,v),b=pt(-1.52,v);c.strokeStyle='#4b5246';c.lineWidth=2*map.zoom;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
 }
}
