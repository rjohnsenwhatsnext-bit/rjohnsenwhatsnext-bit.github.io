// Presentation only: no earnings, progression, offline time or animal ownership changes.
export function daylight(s){
 const hour=((s.time/180*24+7)%24+24)%24;
 const night=hour<5||hour>=20;
 return {hour,name:night?'Night':hour<8?'Dawn':hour>=17?'Sunset':'Day',night,
 darkness:night?.36:hour<8?(.16*(8-hour)/3):hour>=17?.16*(hour-17)/3:0,
 warm:!night&&(hour<8||hour>=17)};
}
export function idleTarget(s,a,b,w,h){
 const hour=daylight(s).hour,rest=!a.yarded&&hour>=11&&hour<14;
 const drinking=(s.time+a.id*3)%70<12;
 const group=Math.floor(a.id/4),phase=s.time/22+group;
 const x=b.x+.4+(w-.8)*(.5+.35*Math.sin(phase))+(a.id%3-1)*.1;
 const y=b.y+.4+(h-.8)*(.5+.35*Math.cos(phase*.7))+(a.id%2)*.1;
 return {x:drinking?b.x+w-.45:Math.max(b.x+.3,Math.min(b.x+w-.3,x)),
 y:drinking?b.y+h-.45:Math.max(b.y+.3,Math.min(b.y+h-.3,y)),rest,drinking};
}
export class PropertyLife{
 constructor(){this.positions=new Map();this.effects=[];this.time=0;this.dt=0;}
 update(s,motion){
 this.dt=Math.min(.5,Math.max(0,s.time-this.time));this.time=s.time;this.motion=motion;
 for(const id of this.positions.keys())if(!s.animals.some(a=>a.id===id))this.positions.delete(id);
 this.effects=this.effects.filter(e=>s.time-e.at<5);
 }
 animal(s,a,b,w,h){
 const busy=s.jobs.some(j=>j.animalIds?.includes(a.id)),target=busy?{x:a.x??b.x+w/2,y:a.y??b.y+h/2,rest:false}:idleTarget(s,a,b,w,h);
 let p=this.positions.get(a.id);
 if(!p){p={x:a.x??target.x,y:a.y??target.y};this.positions.set(a.id,p);}
 if(!this.motion){p.x=a.x??target.x;p.y=a.y??target.y;}
 else{const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),step=this.dt*(busy?3.5:.38);if(d<=step){p.x=target.x;p.y=target.y;}else if(d){p.x+=dx/d*step;p.y+=dy/d*step;}}
 return {...p,rest:target.rest&&!busy,drinking:target.drinking};
 }
 celebrate(s,text,kind='sale'){
 this.effects.push({at:s.time,text,kind});
 }
 world(map,s,time){
 const c=map.ctx,light=daylight(s),t=this.motion?s.time:0;
 // A working dog keeps close during a muster and curls up beside the home at night.
 const active=s.workers.find(w=>s.jobs.some(j=>j.worker===w.id&&j.herding&&j.status==='active'))||s.workers[0];
 const home=s.buildings.find(b=>b.built&&['caravan','cabin','cottage','queenslander','modern','stationhouse'].includes(b.kind));
 const asleep=light.night&&!s.jobs.some(j=>j.worker===active.id);
 let dog=asleep&&home?{x:home.x-.3,y:home.y+1.5}:{x:active.x-.7+Math.sin(t*1.5)*.18,y:active.y+.9};
 map.sprite(asleep?25:24,dog.x,dog.y,asleep?24:27,1,!asleep&&this.motion?Math.sin(t*9)*.7:0);
 // Wildlife stays decorative and never blocks a route or changes the economy.
 if(light.name==='Dawn'||light.name==='Sunset'){
 for(let i=0;i<5;i++){const x=3+(t*.22+i*.65)%18,y=5+i*.25;map.sprite(27,x,y,16,1,this.motion?Math.sin(t*7+i)*2:0);}
 if(light.name==='Sunset')for(let i=0;i<2;i++)map.sprite(26,14+i,2+Math.sin(t*.12+i)*.3,32);
 }else if(!light.night){
 map.sprite(28,9+Math.sin(t*.045)*6,6+Math.cos(t*.045)*5,44,.8);
 if(Math.floor(s.time/60)%3===1)map.sprite(29,2+(t*.025)%4,15.5,25);
 }
 // Passing traffic uses the public road; it is distinct from paid campsite visitors.
 const roadTime=s.time%125;
 if(this.motion&&roadTime<24){map.sprite(Math.floor(s.time/125)%2?8:9,1,-10+roadTime*1.5,Math.floor(s.time/125)%2?55:78);}
 // Small clouds of dust behind moving mounts and vehicles.
 if(this.motion)for(const w of s.workers){
 const j=s.jobs.find(j=>j.worker===w.id&&j.status==='active'&&j.vehicle&&j.stage>0&&j.path?.length);if(!j)continue;
 const p=map.point(w.x+.5,w.y+.7);
 for(let i=0;i<4;i++){const phase=(t*2+i*.25)%1;c.fillStyle='rgba(204,174,119,'+(.17*(1-phase))+')';c.beginPath();c.ellipse(p.x-i*4*map.zoom,p.y+phase*7*map.zoom,(3+phase*7)*map.zoom,(2+phase*3)*map.zoom,0,0,7);c.fill();}
 }
 // Existing rain and hot weather drive the ambience; no invented gameplay seasons.
 if(s.weather==='Rain'){c.fillStyle='#40576d22';c.fillRect(0,0,map.w,map.h);}
 if(light.warm){c.fillStyle='rgba(225,150,64,.10)';c.fillRect(0,0,map.w,map.h);}
 if(light.darkness){c.fillStyle='rgba(14,27,64,'+light.darkness+')';c.fillRect(0,0,map.w,map.h);}
 if(light.night||light.name==='Sunset'){
 for(const b of s.buildings.filter(b=>b.built&&(homeKinds.includes(b.kind)||b.kind==='camp'))){
 const p=map.point(b.x+.5,b.y+1),r=(b.kind==='camp'?28:46)*map.zoom;
 const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);glow.addColorStop(0,'#ffd48788');glow.addColorStop(1,'#ffc46b00');c.fillStyle=glow;c.fillRect(p.x-r,p.y-r,r*2,r*2);
 if(b.kind==='camp'&&s.visitors.some(v=>v.camp===b.id&&v.status==='staying')){c.fillStyle='#ffc75b';c.beginPath();c.ellipse(p.x,p.y,3*map.zoom,(5+(this.motion?Math.sin(t*8):0))*map.zoom,0,0,7);c.fill();}
 }
 }
 for(const e of this.effects){
 const age=s.time-e.at,alpha=Math.min(1,(5-age)/1.5);
 c.save();c.globalAlpha=alpha;
 const x=map.w/2,y=map.h*.28-(this.motion?Math.min(18,age*5):0);
 c.font='600 '+(map.w<650?19:26)+'px Georgia';c.textAlign='center';
 const width=Math.min(map.w-24,c.measureText(e.text).width+36);c.fillStyle='#203b30ee';c.beginPath();c.roundRect(x-width/2,y-31,width,49,12);c.fill();c.fillStyle='#ffdf8d';c.fillText(e.text,x,y, width-20);c.restore();
 }
 }
}
const homeKinds=['caravan','cabin','cottage','queenslander','modern','stationhouse'];
