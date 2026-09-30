// Opt-in private two-player rooms. Signalling registers the code before display.
// No account/leaderboard claims: poses are untrusted cosmetic data only.
import { ROUTE_ID, LEVELS } from './rocky-mountain.mjs';
import {safeAppearance} from './cosmetics.mjs';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanName=s=>String(s||'Climber').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,20)||'Climber';
const makeCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>alphabet[v%alphabet.length]).join('');
export function createFriends({onChange,onPose,onStart,onRequest,getRoute=()=>ROUTE_ID}){
 let peer=null,connection=null,timer=null,lastSeen=0,pending=false,epoch=0;
 const state={status:'offline',code:'',name:'Climber',friend:'',host:false,connected:false,error:''};
 const emit=()=>onChange({...state});
 const send=data=>{if(connection?.open)try{connection.send(data);}catch{}};
 const shutdown=()=>{epoch++;clearTimeout(timer);connection?.close();peer?.destroy();connection=null;peer=null;pending=false;state.connected=false;state.code='';state.friend='';onPose(null);};
 function fail(message){shutdown();state.status='error';state.error=message;emit();}
 function bind(c,host){
  connection=c;lastSeen=Date.now();
  c.on('open',()=>{if(connection!==c)return;clearTimeout(timer);state.status=host?'request':'waiting';emit();if(!host)send({type:'hello',route:getRoute(),name:state.name});timer=setTimeout(()=>{if(!state.connected)fail('The invitation timed out. Create or join again.');},45000);});
  c.on('data',msg=>{
   if(connection!==c||!msg||typeof msg!=='object')return;lastSeen=Date.now();
   if(msg.type==='hello'&&host&&!state.connected&&!pending){if(msg.route!==getRoute()){send({type:'reject',reason:'Choose the same mountain as your mate, then join again.'});return;}state.error='';state.friend=cleanName(msg.name);pending=true;state.status='request';emit();onRequest(state.friend);}
   else if(msg.type==='accept'&&!host&&!state.connected){if(msg.route!==getRoute())return fail('Choose the same mountain as your mate, then join again.');clearTimeout(timer);state.friend=cleanName(msg.name);state.connected=true;state.status='connected';emit();}
   else if(msg.type==='reject'&&!host)fail(msg.reason==='Choose the same mountain as your mate, then join again.'?msg.reason:'The invitation was declined or the room is unavailable.');
   else if(msg.type==='pose'&&state.connected){const p=msg.pose;if(!p||!['x','y','ox','oy','t'].every(k=>Number.isFinite(p[k])))return;if(!poseFitsRoute(p,getRoute()))return;onPose({...p,appearance:safeAppearance(p.appearance),name:state.friend,received:performance.now(),paused:!!p.paused});}
   else if(msg.type==='start'&&state.connected&&!host){onStart();}
   else if(msg.type==='leave')c.close();
   else if(msg.type==='ping')send({type:'pong'});
  });
  c.on('close',()=>{if(connection!==c)return;clearTimeout(timer);connection=null;state.connected=false;state.friend='';pending=false;onPose(null);state.status=state.host&&peer?.open?'hosting':'offline';state.error='Your mate disconnected. Solo climbing still works.';emit();});
  c.on('error',()=>{if(connection===c)fail('Could not connect these devices. Try again on another network.');});
 }
 async function open(host,code,name){
  shutdown();const current=epoch;state.host=host;state.name=cleanName(name);state.status='connecting';state.error='';emit();
  if(!window.Peer)return fail('Friends could not load. Reload and try again.');
  const own=makeCode();
  peer=new window.Peer('scrap-r1-'+own,{debug:0,secure:true});
  timer=setTimeout(()=>fail('Connection unavailable. Check your internet and try again.'),15000);
  peer.on('open',()=>{if(current!==epoch)return;clearTimeout(timer);if(host){state.code=own;state.status='hosting';emit();}else{const c=peer.connect('scrap-r1-'+code,{reliable:true,serialization:'json'});bind(c,false);timer=setTimeout(()=>{if(!state.connected)fail('Room not reachable. Check the code and keep both games open.');},18000);}});
  peer.on('connection',c=>{if(current!==epoch||!host||connection){c.on('open',()=>{c.send({type:'reject'});setTimeout(()=>c.close(),150);});return;}bind(c,true);});
  peer.on('error',e=>{if(current!==epoch)return;fail(e.type==='peer-unavailable'?'That room is not online. Check the code with your mate.':'Friends connection failed. Try again; solo climbing is available.');});
 }
 const heartbeat=setInterval(()=>{if(state.connected){send({type:'ping'});if(Date.now()-lastSeen>20000)fail('Your mate stopped responding. Rejoin when you are both online.');}},5000);
 addEventListener('pagehide',()=>{send({type:'leave'});clearInterval(heartbeat);shutdown();});
 return {
  state,
  host:name=>open(true,'',name),
  join:(code,name)=>{code=String(code||'').toUpperCase().replace(/[\s-]/g,'');if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){state.error='Enter the eight-character room code.';emit();return;}open(false,code,name);},
  accept(){if(!pending||!connection?.open)return;clearTimeout(timer);pending=false;state.connected=true;state.status='connected';send({type:'accept',route:getRoute(),name:state.name});emit();},
  decline(){send({type:'reject'});pending=false;setTimeout(()=>connection?.close(),150);},
  leave(){send({type:'leave'});shutdown();state.status='offline';state.error='';emit();},
  start(){if(!state.connected||!state.host)return;send({type:'start'});onStart();},
  pose(pose){if(state.connected)send({type:'pose',pose});},
 };
}

export function poseFitsRoute(p,id){const level=LEVELS.find(l=>l.id===id);return !!level&&p.x>=-45&&p.x<=Math.max(110,level.height)&&p.y>=-10&&p.y<=level.height+12&&Math.abs(p.ox)<=3.2&&Math.abs(p.oy)<=3.2;}
