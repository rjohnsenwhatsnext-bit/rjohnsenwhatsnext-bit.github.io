// Presentation-only landscape. World-anchored and cached: no tile seams, save or path changes.
const MIN=-25,SPAN=70,PPU=32;
function hash(x,y=0){const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);}
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (hash(a,b)*(1-s)+hash(a+1,b)*s)*(1-t)+(hash(a,b+1)*(1-s)+hash(a+1,b+1)*s)*t;}
export const creekY=x=>19.15+Math.sin(x*.24)*.68+Math.sin(x*.61)*.17;
export class PropertyTerrain{
 constructor(){this.surface=null;this.texture=null;const image=new Image();image.onload=()=>{this.surface=image;};image.onerror=()=>{this.texture=new Image();this.texture.onload=()=>this.bake();this.texture.onerror=()=>this.bake();this.texture.src='assets/pasture.webp';};image.src='assets/terrain-v1.webp';}
 bake(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SPAN*PPU;const c=canvas.getContext('2d',{alpha:false}),im=c.createImageData(canvas.width,canvas.height),data=im.data;
  // Large soft pasture patches, with fine low-contrast grain rather than repeated photos.
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
   const wx=x/PPU+MIN,wy=y/PPU+MIN,broad=noise(wx*.18,wy*.18),detail=noise(wx*.9+31,wy*.9+31),fine=hash(x,y)-.5;
   const dry=Math.max(0,(broad-.32)*1.25),shade=(detail-.5)*12+fine*6;
   const i=(y*canvas.width+x)*4;data[i]=112+dry*48+shade;data[i+1]=134+dry*21+shade;data[i+2]=78+dry*16+shade*.65;data[i+3]=255;
  }c.putImageData(im,0,0);
  if(this.texture?.complete&&this.texture.naturalWidth){c.save();c.globalAlpha=.22;c.fillStyle=c.createPattern(this.texture,'repeat');c.fillRect(0,0,canvas.width,canvas.height);c.restore();}
  c.save();c.scale(PPU,PPU);c.translate(-MIN,-MIN);
  // Thousands of small low-contrast brush marks stay attached to the world when panning.
  for(let i=0;i<43000;i++){
   const x=MIN+hash(i,3)*SPAN,y=MIN+hash(i,7)*SPAN,a=hash(i,9),len=.025+a*.09;
   c.strokeStyle=i%3?'rgba(64,94,48,.11)':'rgba(224,215,153,.20)';c.lineWidth=.015+a*.01;c.beginPath();c.moveTo(x,y);c.lineTo(x+len,y-len*.45);c.stroke();
  }
  const stream=(width,color,offset=0)=>{const bank=[];for(let x=MIN;x<=MIN+SPAN;x+=.16){const w=width*(1+Math.sin(x*.43)*.16+Math.sin(x*1.3)*.05)/2;bank.push([x,creekY(x)+offset-w,x,creekY(x)+offset+w]);}c.beginPath();bank.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));for(let i=bank.length-1;i>=0;i--)c.lineTo(bank[i][2],bank[i][3]);c.closePath();c.fillStyle=color;c.fill();};
  stream(2.85,'rgba(87,113,67,.17)');stream(2.4,'rgba(126,134,91,.4)');stream(2.05,'#acaa7b');stream(1.82,'#9eae8c');stream(1.66,'#6f9990');stream(1.46,'#648e87');stream(.85,'rgba(63,106,113,.16)');
  // Broken reflections and uneven shallows avoid the look of a straight drainage canal.
  for(let i=0;i<700;i++){const x=MIN+hash(i,67)*SPAN,y=creekY(x)+(hash(i,71)-.5)*1.25;c.strokeStyle=i%3?'rgba(190,217,192,.15)':'rgba(40,86,96,.10)';c.lineWidth=.015+hash(i,77)*.015;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+.06,y-.025,x+.12+hash(i,79)*.18,y-.02);c.stroke();}

  // Stones and rushes along the creek margins, deliberately kept away from the road crossing.
  for(let i=0;i<640;i++){
   const x=MIN+hash(i,17)*SPAN;if(Math.abs(x-1.5)<1)continue;const side=i%2?1:-1,y=creekY(x)+side*(.92+Math.sin(x*.43)*.15+hash(i,19)*.32);
   if(i%3===0){c.fillStyle=['#c3b78c','#a3a17f','#848d70'][i%3];c.beginPath();c.ellipse(x,y,.04+hash(i)*.07,.025+hash(i,2)*.03,hash(i,8)*3,0,7);c.fill();}
   else{c.strokeStyle=i%2?'#617d55':'#809267';c.lineWidth=.022;c.beginPath();c.moveTo(x,y);c.lineTo(x-.04,y-.13);c.moveTo(x,y);c.lineTo(x+.04,y-.1);c.stroke();}
  }
  // Roads keep their gameplay coordinates, with blended shoulders and twin wheel ruts.
  const road=(horizontal,width,color,offset=0,wobble=0)=>{c.beginPath();for(let t=MIN;t<=MIN+SPAN;t+=.3){const edge=offset+Math.sin(t*2.2)*wobble+Math.sin(t*5.1)*wobble*.3,x=horizontal?t:1.5+edge,y=horizontal?16.5+edge:t;t===MIN?c.moveTo(x,y):c.lineTo(x,y);}c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.stroke();};
  for(const h of [false,true]){road(h,1.66,'rgba(126,116,77,.12)');road(h,1.43,'rgba(150,128,83,.24)');road(h,1.16,'#b3a17a',0,.035);road(h,.96,'#c6b086',0,.025);road(h,.74,'#cdb890',0,.018);for(const off of [-.24,.24]){road(h,.10,'rgba(154,128,89,.28)',off,.012);road(h,.028,'rgba(221,199,154,.6)',off-.025,.012);}road(h,.1,'rgba(152,148,97,.17)');}
  for(let i=0;i<3300;i++){
   const h=i%2,x=h?MIN+hash(i,26)*SPAN:1.5+(hash(i,29)-.5)*1.05,y=h?16.5+(hash(i,29)-.5)*1.05:MIN+hash(i,26)*SPAN;c.fillStyle=i%3?'#9b8d6a35':'#ede0b142';c.beginPath();c.ellipse(x,y,.01+hash(i,32)*.025,.015,0,0,7);c.fill();
  }
  // Low timber crossing over the existing creek, no new routing or obstacle.
  const cy=creekY(1.5);c.fillStyle='#4b514347';c.fillRect(.88,cy-1.42,1.35,2.88);c.fillStyle='#958467';c.fillRect(.91,cy-1.41,1.18,2.82);
  for(let i=0;i<22;i++){c.fillStyle=i%3?'#b3a080':'#a49173';c.fillRect(.92,cy-1.39+i*.128,1.16,.113);c.fillStyle='#796d5840';c.fillRect(1.0,cy-1.36+i*.128,.03,.022);c.fillRect(1.97,cy-1.36+i*.128,.03,.022);}
  c.fillStyle='#786c54';c.fillRect(.85,cy-1.46,.07,2.92);c.fillRect(2.09,cy-1.46,.07,2.92);
  // Blend distant scenery into the backdrop, including the all-parcels survey zoom.
  for(const [x0,y0,x1,y1] of [[MIN,MIN,MIN+8,MIN],[MIN+SPAN,MIN,MIN+SPAN-8,MIN],[MIN,MIN,MIN,MIN+8],[MIN,MIN+SPAN,MIN,MIN+SPAN-8]]){const fade=c.createLinearGradient(x0,y0,x1,y1);fade.addColorStop(0,'#81915c');fade.addColorStop(1,'#81915c00');c.fillStyle=fade;if(y0===y1)c.fillRect(Math.min(x0,x1),MIN,8,SPAN);else c.fillRect(MIN,Math.min(y0,y1),SPAN,8);}
  c.restore();this.surface=canvas;
 }
 draw(map,s){
  const c=map.ctx,z=map.zoom,p=map.point(MIN,MIN);c.fillStyle='#81915c';c.fillRect(0,0,map.w,map.h);if(!this.surface)return;c.save();c.transform(28*z/PPU,14*z/PPU,-28*z/PPU,14*z/PPU,p.x,p.y);c.drawImage(this.surface,0,0);c.restore();
  // Soft compacted yards root structures in the landscape; paddocks and crops keep grass/soil.
  for(const b of s.buildings){if(['paddock','field','garden','dam'].includes(b.kind))continue;const size=map.buildingSize(b);if(size.w<2)continue;const a=map.point(b.x+size.w/2,b.y+size.h/2),r=Math.max(size.w,size.h)*25*z;c.save();c.translate(a.x,a.y);c.scale(1,.5);const g=c.createRadialGradient(0,0,r*.25,0,0,r);g.addColorStop(0,'#baa37985');g.addColorStop(.65,'#b4a07640');g.addColorStop(1,'#b4a07600');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);c.restore();}
 }
}
