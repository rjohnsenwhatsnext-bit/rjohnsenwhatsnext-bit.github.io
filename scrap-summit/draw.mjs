import {EXPEDITIONS} from './expansion.mjs';
import {BODY_R,HEAD_R} from './sim.mjs';
import {CHARACTERS,TOOLS,safeAppearance} from './cosmetics.mjs';
const images={};const sources=[...EXPEDITIONS.flatMap(l=>[['terrain-'+l.theme,'assets/expeditions/terrain-'+l.theme+'.webp'],['sky-'+l.theme,'assets/expeditions/sky-'+l.theme+'.webp']]),...['sky','rock','ice','wood','metal','climber'].map(n=>[n,'assets/'+n+'.webp']),...CHARACTERS.filter(v=>!v.free).map(v=>['character-'+v.id,v.asset]),...TOOLS.filter(v=>!v.free).map(v=>['tool-'+v.id,v.asset])];for(const [name,src] of sources){const i=new Image();i.src=new URL('./'+src,import.meta.url);images[name]=i;}
export const artReady=Promise.all(Object.values(images).map(i=>i.decode().then(()=>{i.ready=true;}).catch(()=>{})));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function poly(g,pts,S){g.beginPath();pts.forEach((p,i)=>{const[x,y]=S(...p);i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();}
const patternCache=new WeakMap();
function material(g,name,scale,cam,w,h,density=1){let cache=patternCache.get(g);if(!cache){cache={};patternCache.set(g,cache);}if(!cache[name]&&images[name]?.ready)cache[name]=g.createPattern(images[name],'repeat');const p=cache[name];if(p)p.setTransform(new DOMMatrix().translate(w/2-cam.x*scale,h*.55+cam.y*scale).scale(scale/90*density));return p||'#54626b';}
function line(g,x1,y1,x2,y2,color,width){g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
function shade(hex,f){const n=parseInt(hex.slice(1),16);return 'rgb('+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.round(v*f))).join(',')+')';}
function sleeve(g,x1,y1,x2,y2,color,width){const dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d,mx=(x1+x2)/2,my=(y1+y2)/2;const fill=g.createLinearGradient(mx-nx*width/2,my-ny*width/2,mx+nx*width/2,my+ny*width/2);fill.addColorStop(0,shade(color,.45));fill.addColorStop(.35,shade(color,1.12));fill.addColorStop(.6,color);fill.addColorStop(1,shade(color,.6));line(g,x1,y1,x2,y2,'#17232b',width+1);line(g,x1,y1,x2,y2,fill,width);for(const q of [.68,.8]){const x=x1+dx*q,y=y1+dy*q;line(g,x-nx*width*.28,y-ny*width*.28,x+nx*width*.22,y+ny*width*.22,shade(color,.7),Math.max(.6,width*.055));}}
export function drawClimber(g,c,S,scale,{alpha=1,tint=null,name='',reduced=false,appearance={}}={}){
 const look=safeAppearance(appearance),character=CHARACTERS.find(v=>v.id===look.character),tool=TOOLS.find(v=>v.id===look.tool),avatar=images[character.free?'climber':'character-'+character.id];
 const b=c.body,[x,y]=S(b.x,b.y),[hx,hy]=S(b.x+c.head.ox,b.y+c.head.oy),r=BODY_R*scale;
 g.save();g.globalAlpha=alpha;
 if(tint){g.shadowColor=tint;g.shadowBlur=12;}
 if(avatar?.ready){g.save();g.translate(x,y);if(c.head.ox<0)g.scale(-1,1);g.drawImage(avatar,-scale*.48,-scale*1.4,scale*.96,scale*1.87);g.restore();}
 else{g.fillStyle='#939d9d';g.beginPath();g.roundRect(x-r,y-r*.5,r*2,r*1.5,5);g.fill();g.fillStyle='#c89670';g.beginPath();g.arc(x,y-r*1.1,r*.42,0,7);g.fill();}
 // Shoulders, articulated sleeves and gloves follow the actual hammer head.
 const sx=x,sy=y-scale*.7,dx=hx-sx,dy=hy-sy,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
 const handX=sx+dx*.43,handY=sy+dy*.43;
 for(const sign of [-1,1]){const shoulderX=sx+sign*scale*.18,elbowX=(shoulderX+handX)*.5-uy*scale*.14*sign,elbowY=(sy+handY)*.5+ux*scale*.14*sign;g.lineCap='round';sleeve(g,shoulderX,sy,elbowX,elbowY,tint||character.color,scale*.12);sleeve(g,elbowX,elbowY,handX+sign*scale*.04,handY,tint||character.color,scale*.09);}
 g.lineCap='round';line(g,handX-ux*scale*.3,handY-uy*scale*.3,hx,hy,'#262a2b',scale*.095);line(g,handX-ux*scale*.3,handY-uy*scale*.3,hx,hy,tint||tool.handle,scale*.057);line(g,handX,handY,handX+ux*scale*.17,handY+uy*scale*.17,tint||'#dbb480',scale*.12);
 const headSprite=images['tool-'+tool.id];
 if(headSprite?.ready){g.save();g.translate(hx,hy);g.rotate(Math.atan2(dy,dx)+Math.PI/2);const width=scale*.46,height=width*headSprite.height/headSprite.width;g.drawImage(headSprite,-width/2,-height/2,width,height);g.restore();}
 else{g.save();g.translate(hx,hy);g.rotate(Math.atan2(dy,dx));const metal=g.createLinearGradient(-9,-10,9,10);metal.addColorStop(0,'#d1dadd');metal.addColorStop(.38,'#78858a');metal.addColorStop(.5,'#c4d0d2');metal.addColorStop(1,'#303b41');g.fillStyle=tint||metal;g.strokeStyle='#1d2d34';g.lineWidth=1.5;g.beginPath();g.roundRect(-HEAD_R*scale*.75,-HEAD_R*scale*1.25,HEAD_R*scale*1.5,HEAD_R*scale*2.5,2);g.fill();g.stroke();g.restore();}

 if(c.planted&&!reduced){g.globalAlpha=alpha*.7;g.strokeStyle='#f9ce7d';g.lineWidth=1.2;for(let i=0;i<3;i++){const a=i*2.2+(c.t||0)*2;line(g,hx+Math.cos(a)*8,hy+Math.sin(a)*8,hx+Math.cos(a)*12,hy+Math.sin(a)*12,'#f9ce7d',1);}}
 if(name){g.shadowBlur=0;g.globalAlpha=1;g.font='700 11px system-ui';g.textAlign='center';g.fillStyle=tint||'#d3f4fa';g.strokeStyle='#14232e';g.lineWidth=4;g.strokeText(name,x,y-scale*1.65);g.fillText(name,x,y-scale*1.65);}
 g.restore();
}
export function drawScene(g,w,h,{world,cam,scale,climb,ghost,friend,appearance={},reduced=false,t=0,menu=false}){
 const S=(x,y)=>[(x-cam.x)*scale+w/2,h*.55-(y-cam.y)*scale];
 const elevation=clamp(cam.y/world.summit);
 const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#203648');bg.addColorStop(1,'#d0c2a8');g.fillStyle=bg;g.fillRect(0,0,w,h);
 const sky=images['sky-'+world.level?.theme]||images.sky;
 if(sky.ready){g.save();if(world.level?.theme)g.filter='blur(1.2px)';const q=Math.max(w/sky.width,h/sky.height)*1.08;g.drawImage(sky,(w-sky.width*q)/2+Math.sin(cam.x*.004)*w*.015,(h-sky.height*q)/2+Math.sin(cam.y*.014)*h*.03,sky.width*q,sky.height*q);g.restore();}
 if(world.level?.tint){g.fillStyle=world.level.tint;g.fillRect(0,0,w,h);}
 g.fillStyle=`rgba(12,28,53,${elevation*.45})`;g.fillRect(0,0,w,h);
 if(!reduced){g.fillStyle=world.level?.theme==='volcanic'?'#ffb34c':['meadow','timber'].includes(world.level?.theme)?'#c9d397':['junkyard','quarry','canyon'].includes(world.level?.theme)?'#deb98a':'#e9f1ed';g.save();g.globalAlpha=.2+elevation*.35;for(let i=0;i<28;i++){const x=((i*137.2+t*(6+elevation*20))%(w+30))-15,y=((i*97.6+t*(12+elevation*22)+cam.y*2)%(h+30))-15;g.fillRect(x,y,1+elevation,1+elevation);}g.restore();}
 // One continuous rock mass: collision tessellation is never drawn as tiles.
 const side=world.direction||-1;
 const outline=[[world.contour[0][0],-100],...world.contour,[world.massEdge,world.contour.at(-1)[1]],[world.massEdge,-100]];
 g.save();poly(g,outline,S);g.clip();
 g.fillStyle=material(g,world.level?.theme?'terrain-'+world.level.theme:'rock',scale,cam,w,h,world.level?.theme?1.3:1.05);g.fillRect(0,0,w,h);
 if(world.level?.tint){g.fillStyle=world.level.tint;g.fillRect(0,0,w,h);}
 const shade=g.createLinearGradient(0,0,w,h);shade.addColorStop(0,'#172a3a44');shade.addColorStop(.5,'#3b3b3722');shade.addColorStop(1,'#0b192f99');g.fillStyle=shade;g.fillRect(0,0,w,h);
 // Deep erosion channels are continuous in world space, not horizontal bands.
 if(!['junkyard','timber'].includes(world.level?.theme))for(let k=Math.floor((cam.y-h/scale)/4);k<Math.ceil((cam.y+h/scale)/4);k++){
  const y=k*4,edge=world.contour.find(p=>p[1]>=y)?.[0]??3.2;
  for(let j=0;j<3;j++){
   const x=edge+side*(1+j*2.7)+Math.sin(k*8+j),[a,b]=S(x,y+3.1),[c,d]=S(x-.45,y+1.6),[e,f]=S(x+.15,y+.4),[u,v]=S(x-.75,y-1.1);
   g.beginPath();g.moveTo(a,b);g.bezierCurveTo(a-scale*.2,b+scale*.4,c+scale*.15,d-scale*.3,c,d);g.lineTo(e,f);g.lineTo(u,v);g.strokeStyle='#101b2a55';g.lineWidth=scale*.026;g.stroke();
  }
 }
 const icePatches=[];let patch=[];
 for(let i=1;i<world.contour.length;i++){const p=world.contour[i];if(p.kind==='ice'){if(!patch.length)patch.push(world.contour[i-1]);patch.push(p);}else if(patch.length){icePatches.push(patch);patch=[];}}if(patch.length)icePatches.push(patch);
 for(const frozen of icePatches){if(Math.abs(frozen[0][1]-cam.y)>h/scale+4)continue;const inner=frozen.slice().reverse().map(([x,y],i)=>[x+side*(.15+Math.sin(Math.PI*i/(frozen.length-1))*(1.6+.4*Math.sin(y*3))),y]);g.save();poly(g,[...frozen,...inner],S);g.clip();const slickTheme=['moss','canyon','volcanic','storm'].includes(world.level?.theme);g.fillStyle=material(g,slickTheme?'terrain-'+world.level.theme:'ice',scale,cam,w,h,1.3);g.fillRect(0,0,w,h);g.fillStyle=slickTheme?'#0a2532aa':'#173d5655';g.fillRect(0,0,w,h);g.restore();}
 g.restore();
 // Light catches actual angled surfaces; no white horizontal platform caps.
 for(let i=1;i<world.contour.length;i++){
  const a=world.contour[i-1],b=world.contour[i];if(Math.abs(a[1]-cam.y)>h/scale+3)continue;
  const dx=b[0]-a[0],dy=b[1]-a[1],up=side*dx/Math.hypot(dx,dy),[ax,ay]=S(...a),[bx,by]=S(...b);
  line(g,ax,ay,bx,by,up>.4?'#cfbea075':'#10263899',up>.4?1.3:1.8);
  if((!world.level?.theme||['glacier','obsidian'].includes(world.level.theme))&&a[1]>65&&up>.65)line(g,ax,ay-.7,bx,by-.7,'#d5e2e3a0',2);
 }
 // Mark section starts on the rock face, with a worn expedition plaque.
 for(const s of world.sections){const q=world.route.find(r=>r.y>=s.from);if(!q||Math.abs(q.y-cam.y)>h/scale)continue;const[x,y]=S(q.x+side*2,q.y-.7);g.save();g.fillStyle='#1e2d35b8';g.fillRect(x-28,y-12,56,24);g.strokeStyle='#c6a26b88';g.strokeRect(x-28,y-12,56,24);g.fillStyle='#e4d5b3';g.font='700 11px monospace';g.textAlign='center';g.fillText(s.grade,x,y+4);g.restore();}
 const[fx,fy]=S(world.summitX,world.summit);line(g,fx,fy,fx,fy-scale*1.9,'#bfc6c5',3);g.fillStyle='#dd753e';g.beginPath();g.moveTo(fx,fy-scale*1.9);g.lineTo(fx+scale*.8,fy-scale*(1.84+(reduced?0:Math.sin(t*3)*.07)));g.lineTo(fx+scale*.8,fy-scale*1.35);g.lineTo(fx,fy-scale*1.4);g.fill();
 if(ghost)drawClimber(g,ghost.c,S,scale,{alpha:.3,tint:'#99c8d5',name:'Personal best',appearance,reduced});
 if(friend&&performance.now()-friend.received<6000){drawClimber(g,{body:{x:friend.x,y:friend.y},head:{ox:friend.ox,oy:friend.oy},t:friend.t},S,scale,{alpha:.75,tint:'#78d6de',name:friend.name+(friend.paused?' · paused':''),appearance:friend.appearance,reduced});}
 if(climb)drawClimber(g,climb,S,scale,{appearance,reduced});
 if(menu){const veil=g.createLinearGradient(0,0,0,h);veil.addColorStop(0,'#11212f22');veil.addColorStop(.5,'#101c2844');veil.addColorStop(1,'#0d1926ee');g.fillStyle=veil;g.fillRect(0,0,w,h);}
}
