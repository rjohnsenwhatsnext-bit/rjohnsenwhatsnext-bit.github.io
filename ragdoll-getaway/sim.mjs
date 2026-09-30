import {LEVELS,starsFor} from './levels.mjs';
// Fixed 60 Hz physical bodies, shared unchanged by browser and headless tests.
export function createGame(M,index=0){
 const {Engine,Bodies,Body,Composite,Constraint,Query}=M;
 const level=LEVELS[index];if(!level)throw new Error('Unknown level');
 const engine=Engine.create({gravity:{x:0,y:1},positionIterations:8,velocityIterations:8,constraintIterations:6});
 const s={engine,level,index,tick:0,phase:'playing',health:3,collected:0,shots:0,knockouts:0,reason:'',events:[],bullets:[],particles:[],props:[],guards:[],loot:level.loot.map(x=>({x,y:490,taken:false})),platforms:[],ropes:[],grab:null,invincible:0,dive:0,face:1,jumpWas:false,diveWas:false};
 function add(b){Composite.add(engine.world,b);return b;}
 let edge=-500;
 for(const [a,b] of [...level.gaps,[level.length+650,level.length+650]]){s.platforms.push(add(Bodies.rectangle((edge+a)/2,640,a-edge,160,{isStatic:true,friction:.8,label:'floor'})));edge=b;}
 function doll(x,y,robot=false){
  const group=Body.nextGroup(true);const opts={collisionFilter:{group,category:1,mask:0xffffffff},friction:.35,frictionAir:.016,restitution:.05};
  const torso=Bodies.rectangle(x,y,26,39,{...opts,mass:3,label:'torso'});
  const head=Bodies.circle(x,y-33,14,{...opts,mass:.7,label:'head'});
  const arms=[-1,1].map(dir=>Bodies.rectangle(x+dir*24,y+3,12,33,{...opts,mass:.45,label:'arm'}));
  const legs=[-1,1].map(dir=>Bodies.rectangle(x+dir*10,y+38,13,36,{...opts,mass:.8,label:'leg'}));
  const parts=[torso,head,...arms,...legs];
  const links=[Constraint.create({bodyA:torso,pointA:{x:0,y:-20},bodyB:head,pointB:{x:0,y:13},length:1,stiffness:.85,damping:.15})];
  arms.forEach((b,i)=>links.push(Constraint.create({bodyA:torso,pointA:{x:(i?1:-1)*13,y:-12},bodyB:b,pointB:{x:0,y:-15},length:3,stiffness:.7,damping:.1})));
  legs.forEach((b,i)=>links.push(Constraint.create({bodyA:torso,pointA:{x:(i?1:-1)*9,y:18},bodyB:b,pointB:{x:0,y:-17},length:2,stiffness:.8,damping:.1})));
  add([...parts,...links]);return {torso,head,arms,legs,parts,links,robot,health:robot?2:3,dead:false,flash:0,lastShot:-90};
 }
 s.player=doll(160,475);
 for(const x of level.guards)s.guards.push(doll(x,475,true));
 for(const [x,type] of level.props){const w=type==='glass'?18:42,h=type==='glass'?115:48;const body=add(Bodies.rectangle(x,560-h/2,w,h,{isStatic:true,label:type,friction:.7}));s.props.push({body,type,w,h,hp:type==='crate'?2:1,broken:false});}
 for(const e of level.extras)if(e.type==='rope'){
  const segments=[];let previous=null;
  for(let i=0;i<7;i++){const b=add(Bodies.circle(e.x,215+i*35,5,{mass:.18,collisionFilter:{group:0,category:1,mask:0},frictionAir:.01}));add(Constraint.create({bodyA:previous,pointA:previous?{x:0,y:0}:{x:e.x,y:180},bodyB:b,length:35,stiffness:.95,damping:.03}));segments.push(b);previous=b;}
  s.ropes.push(segments);
 }
 function emit(type,x,y){s.events.push({type,x,y});}
 function burst(x,y,color,n=12){for(let i=0;i<n;i++)s.particles.push({x,y,vx:Math.sin(i*2.4)*((i%4)+2),vy:-2-(i%5),life:35+(i%10),color});}
 function ground(x){return s.platforms.find(b=>x>=b.bounds.min.x+3&&x<=b.bounds.max.x-3)?.bounds.min.y??Infinity;}
 function pushDoll(d,vx,vy){d.parts.forEach(b=>Body.setVelocity(b,{x:vx,y:vy}));}
 function balance(d,move=0){
  const b=d.torso,g=ground(b.position.x),target=g-62;
  if(b.position.y>target-18&&b.position.y<target+46&&Math.abs(b.velocity.y)<7){Body.applyForce(b,b.position,{x:0,y:Math.max(-.11,Math.min(.015,(target-b.position.y)*.005-b.velocity.y*.016))});}
  Body.setAngularVelocity(b,-b.angle*.2+move*.008);
  // Head and limbs hang from single pins, which are free pivots: nothing held their angle, so the head
  // spun and sat upside down 90-96% of upright play (measured 27 Sep 2026). While upright the head follows
  // the torso and limbs keep to a range; knockouts and dives skip balance(), so they stay fully floppy.
  const rel=(p)=>Math.atan2(Math.sin(p.angle-b.angle),Math.cos(p.angle-b.angle));
  Body.setAngularVelocity(d.head,b.angularVelocity-rel(d.head)*.3);
  const limit=(p,max)=>{const r=rel(p),over=r-Math.max(-max,Math.min(max,r));if(over)Body.setAngularVelocity(p,p.angularVelocity*.5-over*.35);};
  d.legs.forEach(p=>limit(p,.75));d.arms.forEach(p=>limit(p,1.3));
  if(move){Body.setVelocity(b,{x:b.velocity.x+(move*3.8-b.velocity.x)*.13,y:b.velocity.y});d.legs.forEach((leg,i)=>Body.applyForce(leg,leg.position,{x:move*.0002,y:-Math.max(0,Math.sin(s.tick*.23+i*Math.PI))*.0006}));}
 }
 function die(d,dir){d.dead=true;s.knockouts++;pushDoll(d,dir*8,-7);Body.setAngularVelocity(d.torso,dir*.24);burst(d.torso.position.x,d.torso.position.y,'#71ecf5');emit('bonk',d.torso.position.x,d.torso.position.y);}
 function damage(){if(s.invincible||s.phase!=='playing')return;s.health--;s.invincible=120;s.dive=35;if(s.grab){Composite.remove(engine.world,s.grab);s.grab=null;}pushDoll(s.player,-s.face*4,-5);emit('hit',s.player.torso.position.x,s.player.torso.position.y);if(s.health<=0){s.phase='lost';s.reason='The robots caught you. Dive under their shots or clear them from a distance.';}}
 function breakProp(p){if(p.broken)return;p.broken=true;Composite.remove(engine.world,p.body);const{x,y}=p.body.position;burst(x,y,p.type==='glass'?'#86f7ff':'#ffb748',18);emit(p.type==='barrel'?'boom':'smash',x,y);
  if(p.type==='barrel'){
   for(const d of s.guards)if(!d.dead&&Math.hypot(d.torso.position.x-x,d.torso.position.y-y)<200)die(d,Math.sign(d.torso.position.x-x)||1);
   if(Math.hypot(s.player.torso.position.x-x,s.player.torso.position.y-y)<110)damage();
   for(const q of s.props)if(!q.broken&&q!==p&&Math.abs(q.body.position.x-x)<140)breakProp(q);
  }
 }
 function fire(x,y,target,enemy=false){const dx=target.x-x,dy=target.y-y,len=Math.hypot(dx,dy)||1;s.bullets.push({x,y,vx:dx/len*(enemy?6:16),vy:dy/len*(enemy?6:16),life:70,enemy});if(!enemy)s.shots++;emit(enemy?'zap':'shot',x,y);}
 function step(input={}){
  if(s.phase!=='playing')return s;
  s.tick++;s.events=[];s.invincible=Math.max(0,s.invincible-1);s.dive=Math.max(0,s.dive-1);
  const p=s.player.torso,move=Math.max(-1,Math.min(1,input.move||0));if(move)s.face=Math.sign(move);
  const grounded=Math.abs(p.position.y-(ground(p.position.x)-62))<30&&p.velocity.y>-4;
  if(grounded&&!s.dive&&!s.grab)s.safeX=p.position.x;
  if(input.jump&&((!s.jumpWas&&grounded)||s.grab)){if(s.grab){Composite.remove(engine.world,s.grab);s.grab=null;s.ropeCooldown=60;}pushDoll(s.player,move*4.7,-10.5);s.dive=0;emit('jump',p.position.x,p.position.y);}
  if(input.dive&&!s.diveWas&&!s.dive&&grounded){s.dive=43;pushDoll(s.player,s.face*8,-4);Body.setAngularVelocity(p,s.face*.25);emit('dive',p.position.x,p.position.y);}
  s.jumpWas=!!input.jump;s.diveWas=!!input.dive;
  if(!s.dive)balance(s.player,move);else if(move)Body.applyForce(p,p.position,{x:move*.004,y:0});
  if(!move&&!s.dive)Body.setVelocity(p,{x:p.velocity.x*.93,y:p.velocity.y});
  s.ropeCooldown=Math.max(0,(s.ropeCooldown||0)-1);
  for(const rope of s.ropes){const end=rope.at(-1);if(!s.grab&&!s.ropeCooldown&&Math.hypot(end.position.x-p.position.x,end.position.y-p.position.y)<65){s.grab=add(Constraint.create({bodyA:p,pointA:{x:0,y:-18},bodyB:end,length:15,stiffness:.7}));s.dive=0;emit('grab',p.position.x,p.position.y);}}
  for(const e of level.extras)if(e.type==='spring'&&Math.abs(p.position.x-e.x)<40&&grounded&&p.velocity.y>-2){pushDoll(s.player,move*5.2,-13);emit('spring',e.x,550);}
  if(!s.dive&&s.tick-s.player.lastShot>=17){
   const target=s.guards.filter(d=>!d.dead&&Math.abs(d.torso.position.x-p.position.x)<300&&Math.abs(d.torso.position.y-p.position.y)<160).sort((a,b)=>Math.abs(a.torso.position.x-p.position.x)-Math.abs(b.torso.position.x-p.position.x))[0];
   const obstacle=s.props.filter(q=>!q.broken&&Math.abs(q.body.position.x-p.position.x)<270&&(q.body.position.x-p.position.x)*s.face>0).sort((a,b)=>Math.abs(a.body.position.x-p.position.x)-Math.abs(b.body.position.x-p.position.x))[0];
   const aim=target?.torso.position||obstacle?.body.position;
   if(aim){s.face=Math.sign(aim.x-p.position.x)||s.face;fire(p.position.x+s.face*23,p.position.y-10,{x:aim.x,y:aim.y-8});s.player.lastShot=s.tick;}
  }
  for(const d of s.guards){d.flash=Math.max(0,d.flash-1);if(d.dead)continue;balance(d);const b=d.torso;if(Math.abs(p.position.x-b.position.x)<300&&Math.abs(p.position.y-b.position.y)<150){if(!d.alertAt)d.alertAt=s.tick;if(s.tick-d.alertAt>=65&&s.tick-d.lastShot>150){d.lastShot=s.tick;fire(b.position.x,b.position.y-10,{x:p.position.x,y:p.position.y-10},true);}}else d.alertAt=0;if(b.position.y>760)die(d,1);}
  for(const b of s.bullets){const a={x:b.x,y:b.y};b.x+=b.vx;b.y+=b.vy;b.life--;const end={x:b.x,y:b.y};
   const prop=s.props.find(q=>!q.broken&&Query.ray([q.body],a,end,4).length);
   if(prop){b.life=0;prop.hp--;if(prop.hp<=0)breakProp(prop);continue;}
   if(b.enemy){if(!s.dive&&Query.ray(s.player.parts,a,end,3).length){b.life=0;damage();}}
   else for(const d of s.guards)if(!d.dead&&Query.ray(d.parts,a,end,5).length){b.life=0;d.health--;d.flash=8;if(d.health<=0)die(d,Math.sign(b.vx));else Body.applyForce(d.torso,d.torso.position,{x:Math.sign(b.vx)*.06,y:-.01});break;}
  }
  s.bullets=s.bullets.filter(b=>b.life>0);
  for(const l of s.loot)if(!l.taken&&Math.hypot(l.x-p.position.x,l.y-p.position.y)<65){l.taken=true;s.collected++;burst(l.x,l.y,'#ffdf6c');emit('loot',l.x,l.y);}
  for(const q of s.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.18;q.life--;};s.particles=s.particles.filter(q=>q.life>0);
  Engine.update(engine,1000/60);
  if(p.position.x<75)pushDoll(s.player,2,p.velocity.y);
  if(p.position.y>820){s.phase='lost';s.reason='Missed the landing. Jump just before the striped edge and keep holding right.';}
  if(p.position.x>level.length-135&&p.position.y<590&&s.phase==='playing'){s.phase='won';s.stars=starsFor(s);emit('win',p.position.x,p.position.y);}
  return s;
 }
 // Second chance, paid for by a rewarded ad in the app: once per attempt, back on the last solid ground
 // with one shield, so a revived run can never earn the health star. Returns false when not allowed.
 function revive(){
  if(s.phase!=='lost'||s.revived)return false;
  s.revived=true;s.phase='playing';s.reason='';s.health=1;s.invincible=180;s.dive=0;
  if(s.grab){Composite.remove(engine.world,s.grab);s.grab=null;}
  const d=s.player,x=Math.max(160,(s.safeX??160)-40),y=475;
  // Same standing pose doll() builds, so the joints start relaxed.
  const pose=[[d.torso,0,0],[d.head,0,-33],[d.arms[0],-24,3],[d.arms[1],24,3],[d.legs[0],-10,38],[d.legs[1],10,38]];
  for(const [b,ox,oy] of pose){Body.setAngle(b,0);Body.setPosition(b,{x:x+ox,y:y+oy});Body.setVelocity(b,{x:0,y:0});Body.setAngularVelocity(b,0);}
  s.bullets=s.bullets.filter(b=>!b.enemy);emit('revive',x,475);
  return true;
 }
 return Object.assign(s,{step,ground,revive,dispose:()=>{Composite.clear(engine.world,false);Engine.clear(engine);}});
}
