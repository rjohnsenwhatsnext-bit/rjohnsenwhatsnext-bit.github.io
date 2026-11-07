import {safeProfile} from './battle.mjs';
// version 6: friend battles are city against city, so both games must carry the city
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',version=6;
// the city's buildings are checked again where the duel is built (createDuel)
const withCity=p=>({...safeProfile(p),city:Array.isArray(p?.city)?p.city.slice(0,81).map(b=>({type:String(b?.type||'').slice(0,12),x:Number(b?.x),y:Number(b?.y),level:Number(b?.level)})):[]});
const clean=s=>String(s||'Driver').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,18)||'Driver';
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%32]).join('');
export function room(callback){let peer,conn,timer,last=0,epoch=0;const state={host:false,connected:false,code:'',status:'offline',error:'',friend:null};const emit=()=>callback('status',{...state});const parts={};let sent=0;
 // A message over about 16 KB never arrived and dropped the room, which a city
 // battle hits at once, so long messages go in pieces and are put back together.
 // A failed send ends the room with the reason instead of being swallowed.
 const send=(type,data)=>{if(!conn?.open)return;try{const text=JSON.stringify({type,data});if(text.length<=4000){conn.send({type,data});return;}const id=++sent,n=Math.ceil(text.length/4000);for(let i=0;i<n;i++)conn.send({type:'part',data:{id,i,n,text:text.slice(i*4000,(i+1)*4000)}});}catch(e){fail('The battle could not reach your mate: '+(e?.message||e));}};
 const joined=m=>{const d=m.data;if(!d||!Number.isInteger(d.n)||d.n>400||!Number.isInteger(d.i)||typeof d.text!=='string')return null;const list=parts[d.id]??=[];list[d.i]=d.text;if(list.filter(v=>v!==undefined).length<d.n)return null;delete parts[d.id];for(const k of Object.keys(parts))if(Number(k)<d.id)delete parts[k];return JSON.parse(list.join(''));};
 const stop=()=>{epoch++;clearTimeout(timer);conn?.close();peer?.destroy();conn=null;peer=null;state.connected=false;state.code='';state.friend=null;};
 const fail=message=>{stop();state.status='offline';state.error=message;emit();callback('disconnect');};
 function bind(c,host,profile){conn=c;last=Date.now();c.on('open',()=>{if(c!==conn)return;clearTimeout(timer);if(!host)send('hello',{version,profile});timer=setTimeout(()=>fail('Room timed out. Please create or join again.'),30000);});c.on('data',m=>{if(c!==conn||!m||typeof m!=='object')return;last=Date.now();if(m.type==='part'){m=joined(m);if(!m||typeof m!=='object')return;}
 if(m.type==='hello'&&host&&!state.connected){if(m.data?.version!==version)return fail('Both reload the game before joining.');state.friend=withCity(m.data.profile);state.status='request';emit();}
 else if(m.type==='accept'&&!host){clearTimeout(timer);state.friend=withCity(m.data);state.connected=true;state.status='connected';emit();}
 else if(state.connected&&['input','snapshot','start','exit'].includes(m.type))callback(m.type,m.data);
 else if(m.type==='ping')send('pong');});
 c.on('close',()=>{if(c===conn)fail('Your mate disconnected. Create a new room to battle again.');});c.on('error',()=>{if(c===conn)fail('These devices could not connect. Try another network.');});}
 function open(host,join,profile){stop();const e=epoch;Object.assign(state,{host,connected:false,status:'connecting',error:'',friend:null});emit();if(!window.Peer)return fail('Friends did not load. Reload the page.');peer=new window.Peer('crown-v1-'+code(),{secure:true,debug:0});timer=setTimeout(()=>fail('Connection unavailable. Check your internet.'),18000);peer.on('open',id=>{if(e!==epoch)return;clearTimeout(timer);if(host){state.code=id.replace('crown-v1-','');state.status='hosting';emit();}else{bind(peer.connect('crown-v1-'+join,{reliable:true,serialization:'json'}),false,profile);timer=setTimeout(()=>fail('Room not found. Keep both games open and check the code.'),18000);}});peer.on('connection',c=>{if(!host||conn){c.close();return;}bind(c,true,profile);});peer.on('error',()=>{if(e===epoch)fail('Room connection failed. Check the code or create another room.');});}
 const pulse=setInterval(()=>{if(state.connected){send('ping');if(Date.now()-last>20000)fail('Your mate stopped responding. Reconnect to play together.');}},5000);
 addEventListener('pagehide',()=>{clearInterval(pulse);stop();});
 return {state,send,host:p=>open(true,'',withCity(p)),join:(s,p)=>{s=String(s).toUpperCase().replace(/[\s-]/g,'');if(!/^[A-HJ-NP-Z2-9]{8}$/.test(s)){state.error='Enter the eight-character room code.';emit();return;}open(false,s,withCity(p));},accept:p=>{if(state.status!=='request')return;clearTimeout(timer);state.connected=true;state.status='connected';send('accept',withCity(p));emit();},leave:()=>{stop();state.status='offline';state.error='';emit();}};
}

