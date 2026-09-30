// Ground is drawn in world space: materials and roadside details stay fixed while the camera follows.
const textures={};const names=['dirt','asphalt','grass','paving'];
export const terrainReady=Promise.all(names.map(n=>{const im=new Image();im.src=new URL('./assets/v2/'+n+'.webp',import.meta.url);textures[n]=im;return im.decode().catch(()=>{});}));
const patterns=new WeakMap();
function material(ctx,n,size){let p=patterns.get(ctx);if(!p){p={};patterns.set(ctx,p);}if(!p[n]&&textures[n].naturalWidth){p[n]=ctx.createPattern(textures[n],'repeat');p[n].setTransform(new DOMMatrix().scale(size/textures[n].width));}return p[n]||'#aa9570';}
export const PERSPECTIVE=.82;
export function terrain(ctx,W,H,cam,zoom){
 const halfX=W/zoom/2,halfY=H/(zoom*PERSPECTIVE)/2;
 const x0=cam.x-halfX,y0=cam.y-halfY,x1=cam.x+halfX,y1=cam.y+halfY;
 ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom*PERSPECTIVE);ctx.translate(-cam.x,-cam.y);
 ctx.fillStyle=material(ctx,'dirt',13);ctx.fillRect(x0,y0,x1-x0,y1-y0);
 const bx0=Math.max(0,Math.floor(x0/30)),bx1=Math.min(8,Math.floor(x1/30)),by0=Math.max(0,Math.floor(y0/30)),by1=Math.min(8,Math.floor(y1/30));
 // Vegetation, paved commercial plots and worn footpaths make distinct neighbourhoods.
 for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
  const x=bx*30+6,y=by*30+6,district=(bx+by*3)%5;
  ctx.fillStyle=material(ctx,district===0?'paving':'grass',district===0?7:15);
  ctx.beginPath();ctx.moveTo(x+.7,y+.6);ctx.lineTo(x+23.4,y+.9);ctx.lineTo(x+23.2,y+23.4);ctx.lineTo(x+.6,y+23.2);ctx.closePath();ctx.fill();
  if(district!==0){ctx.fillStyle='#b4905659';ctx.fillRect(x+.6,y+.6,23,23);}
  // Realistic pedestrian pavement around the block and driveways to its four plots.
  ctx.strokeStyle=material(ctx,'paving',7);ctx.lineWidth=.9;ctx.strokeRect(x+.7,y+.7,22.6,22.6);
  ctx.strokeStyle='#e7d3a594';ctx.lineWidth=.08;ctx.strokeRect(x+.15,y+.15,23.7,23.7);
  ctx.fillStyle=material(ctx,'dirt',13);
  for(const xx of [6.72,17.28])for(const yy of [6.72,17.28]){ctx.fillRect(x+xx-.6,y+(yy<12?0:yy),1.2,yy<12?yy:24-yy);}
  // Narrow footpaths divide yards; no fake collision objects remain after a swallow.
  ctx.strokeStyle='#514d2b40';ctx.lineWidth=.13;ctx.setLineDash([.65,.2]);ctx.beginPath();ctx.moveTo(x+12,y+1);ctx.lineTo(x+12,y+23);ctx.moveTo(x+1,y+12);ctx.lineTo(x+23,y+12);ctx.stroke();ctx.setLineDash([]);
 }
 // Asphalt intersections, raised sandstone kerbs, faded markings and drain grates.
 for(let bx=bx0;bx<=Math.min(9,bx1+1);bx++){const x=bx*30;ctx.fillStyle=material(ctx,'asphalt',10);ctx.fillRect(x,y0,6,y1-y0);ctx.fillStyle='#39434455';ctx.fillRect(x,y0,6,y1-y0);}
 for(let by=by0;by<=Math.min(9,by1+1);by++){const y=by*30;ctx.fillStyle=material(ctx,'asphalt',10);ctx.fillRect(x0,y,x1-x0,6);ctx.fillStyle='#39434455';ctx.fillRect(x0,y,x1-x0,6);}
 for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
  const x=bx*30,y=by*30;
  ctx.strokeStyle='#131f2370';ctx.lineWidth=.16;ctx.beginPath();ctx.moveTo(x+6,y+6);ctx.lineTo(x+30,y+6);ctx.moveTo(x+6,y+6);ctx.lineTo(x+6,y+30);ctx.stroke();
  ctx.strokeStyle='#c8c3a380';ctx.lineWidth=.075;ctx.setLineDash([1.4,2.5]);ctx.beginPath();ctx.moveTo(x+3,y+7);ctx.lineTo(x+3,y+29);ctx.moveTo(x+7,y+3);ctx.lineTo(x+29,y+3);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#eee0ba5c';ctx.lineWidth=.065;ctx.beginPath();ctx.moveTo(x+5.6,y+7);ctx.lineTo(x+5.6,y+29);ctx.moveTo(x+7,y+5.6);ctx.lineTo(x+29,y+5.6);ctx.stroke();
  ctx.fillStyle='#253334b0';for(let j=0;j<5;j++){ctx.fillRect(x+5.45,y+8+j*.12,.3,.06);ctx.fillRect(x+8+j*.12,y+5.45,.06,.3);}
  // Short corner crosswalks and faded stop lines add town scale.
  if((bx+by)%3===0){ctx.fillStyle='#e4dfbe6e';for(let j=0;j<5;j++)ctx.fillRect(x+.8+j*.9,y+6.8,.42,1.5);ctx.fillRect(x+6.8,y+.7,1.3,.1);}
  // Barely visible wheel tracks run along the asphalt.
  ctx.strokeStyle='#222b2624';ctx.lineWidth=.11;for(const q of [1.8,4.4]){ctx.beginPath();ctx.moveTo(x+q,y+7);ctx.lineTo(x+q,y+29);ctx.stroke();}
 }
 // A natural dusty edge, rather than a thick rectangular outline.
 ctx.strokeStyle='#776b4555';ctx.lineWidth=.15;ctx.strokeRect(0,0,270,270);
 ctx.restore();
 const grade=ctx.createLinearGradient(0,0,W,H);grade.addColorStop(0,'#fff0bf12');grade.addColorStop(1,'#122e3112');ctx.fillStyle=grade;ctx.fillRect(0,0,W,H);
}
