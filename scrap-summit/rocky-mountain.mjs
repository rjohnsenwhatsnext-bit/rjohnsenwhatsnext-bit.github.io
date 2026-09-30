import {EXPEDITIONS} from './expansion.mjs';
// Authored alpine route. Claude's hammer physics and legacy route are untouched.
export const ROUTE_ID = 'rocky-ridge-v3';
export const SECTIONS = [
 {name:'The foothills',from:0,step:1.05,ledge:1.6,kind:'rock',grade:'I'},
 {name:'Broken granite',from:12,step:1.25,ledge:1.3,kind:'rock',grade:'II'},
 {name:'The hanging wall',from:28,step:1.45,ledge:1.05,kind:'rock',grade:'III'},
 {name:'Eagle overhang',from:45,step:1.6,ledge:.9,kind:'rock',grade:'IV'},
 {name:'Blue ice traverse',from:62,step:1.7,ledge:.8,kind:'ice',grade:'V'},
 {name:'The knife edge',from:80,step:1.8,ledge:.68,kind:'rock',grade:'VI'},
 {name:'The last needle',from:98,step:1.95,ledge:.55,kind:'rock',grade:'VII'},
];
const materials={rock:{grip:.95,bounce:.08},ice:{grip:.12,bounce:.05},metal:{grip:.6,bounce:.15},plank:{grip:.9,bounce:.1}};
export const LEVELS = [
 {id:ROUTE_ID,name:'Rocky Ridge',height:111.5,description:'The original granite climb.',phase:0,slope:1,iceFrom:62,iceTo:80,tint:null},
 {id:'sunburnt-bluff-v1',name:'Sunburnt Bluff',height:123,description:'Warm sandstone, long traverses and exposed holds.',phase:1.4,slope:1.13,iceFrom:200,iceTo:201,tint:'#b976383d'},
 {id:'frostbite-ridge-v1',name:'Frostbite Ridge',height:127,description:'Cold granite and two slippery ice crossings.',phase:3.1,slope:.96,iceFrom:38,iceTo:57,tint:'#6397bb38'},
...EXPEDITIONS,
];
export function buildMountain(id=ROUTE_ID){
 const level=LEVELS.find(l=>l.id===id)||LEVELS[0];
 const sections=SECTIONS.map((s,i)=>({...s,from:s.from*level.height/111.5,name:level.sectionNames?level.sectionNames[i]:level.id===ROUTE_ID?s.name:(level.id==='sunburnt-bluff-v1'?['Red earth','Sandstone shelves','The sun wall','Vulture ledge','Copper traverse','Burnt spire','The fire crown']:['Cold approach','Frosted granite','Frozen crossing','The blue wall','Shelter ledge','Black ice','The white crown'])[i]}));
 const isIce=y=>level.theme?(level.iceFraction>0&&(y/13%1)>1-level.iceFraction):(y>=level.iceFrom&&y<level.iceTo)||(level.id==='frostbite-ridge-v1'&&y>=91&&y<108);
 const mass=level.theme?200:100;
 const solids=[],route=[];
 const add=(kind,poly,name)=>{let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];}if(area<0)poly.reverse();const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);const s={kind,poly,name,...materials[kind],box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};solids.push(s);return s;};
 // Continuous eroded skyline. Convex collision strips tessellate the same
 // contour the renderer uses, with no visible strip seams or staircase caps.
 const contour=[[40,-1.1],[18,-.6],[10,-.22],[6,0],[4,0],[3.2,0]];
 let base=3.2,previous=contour.at(-1),i=0;
 while(previous[1]<level.height){
  const y=Math.min(level.height,(i+1)*.22),section=sections.filter(s=>s.from<=y).at(-1);
  base-=.22*(isIce(y)?.55:(section.ledge/section.step)*.78*level.slope);
  const strength=level.theme?level.roughness*(1+y/level.height):.28+y/111*.22;
  const tooth=level.theme==='junkyard'||level.theme==='timber';
  const erosion=tooth?strength*(2/Math.PI)*Math.asin(Math.sin(y*(level.theme==='junkyard'?2.7:1.9)))+.06*Math.sin(y*9):strength*Math.sin(y*2.3+level.phase)+.19*Math.sin(y*5.1+level.phase)+.065*Math.sin(y*13.7);
  const x=base+erosion,point=[x,y];
  const kind=isIce(y)&&(level.theme||Math.sin(y*1.7)>0)?'ice':level.baseKind||'rock';
  const surface=add(kind,[[-mass,previous[1]],previous,point,[-mass,y]],level.theme||'eroded cliff');
  if(level.theme&&kind!=='ice')surface.grip=level.grip;
  point.kind=kind;contour.push(point);
  if(i%5===0)route.push({x,y,kind,section:section.name,width:section.ledge,rise:section.step,overhang:x>previous[0]});
  previous=point;i++;
 }
 // Uneven approach ground joins the rock face rather than a rectangular slab.
 for(let n=0;n<5;n++){const a=contour[n],b=contour[n+1];add('rock',[[b[0],-100],[a[0],-100],a,b],'valley floor');}
 add('rock',[[-mass,-100],[3.2,-100],[3.2,0],[-mass,0]],'cliff foundation');
 const edge=previous[0],y=level.height;
 // Reflect both the visible contour and convex collision pieces. Reversing
 // each polygon restores counter-clockwise winding for the collision solver.
 for(const s of solids){s.poly=s.poly.map(([x,y])=>[-x,y]).reverse();const b=s.box;s.box=[-b[2],b[1],-b[0],b[3]];}
 for(const p of contour)p[0]=-p[0];
 for(const p of route)p.x=-p.x;
 const start=[-4.3,.46],summit=y-.05,CELL=4,grid=new Map();
 for(const s of solids)for(let x=Math.floor(s.box[0]/CELL);x<=Math.floor(s.box[2]/CELL);x++)for(let yy=Math.floor(s.box[1]/CELL);yy<=Math.floor(s.box[3]/CELL);yy++){const k=x+','+yy;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s);}
 return {id:level.id,level,start,summit,summitX:-edge+.6,direction:1,massEdge:mass,armMax:2.55,solids,route,contour,sections,
  near(x,y,r){const found=new Set();for(let xx=Math.floor((x-r)/CELL);xx<=Math.floor((x+r)/CELL);xx++)for(let yy=Math.floor((y-r)/CELL);yy<=Math.floor((y+r)/CELL);yy++)for(const s of grid.get(xx+','+yy)||[])found.add(s);return found;},
  sectionAt(y){return sections.filter(s=>s.from<=y).at(-1)||sections[0];},
 };
}
