import {DECORATIONS} from './property-decorations.mjs';
import {daylight} from './property-life.mjs';
let image,rects;
export const detailsReady=(async()=>{image=new Image();image.src=new URL('./assets/property-details-v1.png',import.meta.url).href;const r=await fetch(new URL('./assets/property-details-v1.json',import.meta.url));rects=await r.json();await image.decode();})().catch(()=>{rects=null;});
export function detailThumbnail(kind){return '<canvas class="detail-thumb" width="116" height="116" data-detail-art="'+kind+'" aria-hidden="true"></canvas>';}
export async function paintDetailThumbnails(root){await detailsReady;if(!rects)return;for(const c of root.querySelectorAll('[data-detail-art]')){const def=DECORATIONS[c.dataset.detailArt];if(!def)continue;const [x,y,w,h]=rects[def.decor],scale=Math.min(108/w,108/h);c.getContext('2d').drawImage(image,x,y,w,h,(116-w*scale)/2,(116-h*scale)/2,w*scale,h*scale);}}
export function drawDetail(map,b,alpha=1){
 const def=DECORATIONS[b.kind];if(!def||!rects)return false;
 const [sx,sy,sw,sh]=rects[def.decor],p=map.point(b.x+.5,b.y+.65),width=(b.kind==='shadeTree'?69:b.kind==='gravelDrive'?52:b.kind==='gardenLamp'?22:b.kind==='letterbox'?20:43)*map.zoom,height=width*sh/sw,c=map.ctx;
 c.save();c.globalAlpha=alpha;if(b.flipped){c.translate(p.x*2,0);c.scale(-1,1);}c.drawImage(image,sx,sy,sw,sh,p.x-width/2,p.y-height*.94,width,height);c.restore();return true;
}
export function detailLights(map,s){
 const light=daylight(s);if(!light.night&&light.name!=='Sunset')return;
 for(const b of s.buildings.filter(b=>b.built&&b.kind==='gardenLamp')){const p=map.point(b.x+.5,b.y+.65),r=25*map.zoom,c=map.ctx,y=p.y-31*map.zoom,g=c.createRadialGradient(p.x,y,0,p.x,y,r);g.addColorStop(0,'#ffd786aa');g.addColorStop(1,'#ffc55b00');c.fillStyle=g;c.fillRect(p.x-r,y-r,r*2,r*2);}
}
