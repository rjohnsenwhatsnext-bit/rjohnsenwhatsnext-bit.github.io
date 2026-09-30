// Presentation only. All state changes and rewards stay in logic.mjs.
export const itemArt=it=>`assets/item-${it.g?({face:29,shed:30,mill:31,store:32}[it.g]):({ore:0,tool:8,timber:15,lamp:21,chest:26}[it.c]+it.l-1)}.webp`;
let prefs={sound:true,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
try{prefs={...prefs,...JSON.parse(localStorage.getItem('mergemine.presentation')||'{}')}}catch{}
document.documentElement.dataset.motion=String(prefs.motion);
let ctx;
export function sound(kind='merge'){
 if(!prefs.sound)return;
 try{ctx ||= new (window.AudioContext||window.webkitAudioContext)();ctx.resume();const now=ctx.currentTime;const notes=kind==='lucky'?[523,659,784,1047]:kind==='crate'?[330,440,660]:kind==='build'?[392,494,587]:[440,660];notes.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,now+i*.07);g.gain.linearRampToValueAtTime(.055,now+i*.07+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.07+.24);o.connect(g).connect(ctx.destination);o.start(now+i*.07);o.stop(now+i*.07+.25)})}catch{}
}
export function burst(index,kind='merge'){
 sound(kind);if(!prefs.motion)return;
 const cell=document.querySelector(`[data-i="${index}"]`),r=cell?.getBoundingClientRect();if(!r)return;
 const el=document.createElement('div');el.className='mergeBurst '+kind;el.style.left=r.x+r.width/2+'px';el.style.top=r.y+r.height/2+'px';
 for(let i=0;i<(kind==='lucky'?20:9);i++){const p=document.createElement('i'),a=i*2.399;p.style.setProperty('--x',Math.cos(a)*(kind==='lucky'?100:48)+'px');p.style.setProperty('--y',Math.sin(a)*(kind==='lucky'?100:48)+'px');el.append(p)}
 document.body.append(el);setTimeout(()=>el.remove(),1000);
}
export function reveal(contents){
 sound('crate');const el=document.getElementById('crateReveal');el.innerHTML=`<img src="assets/item-28.webp" alt=""><strong>Crate opened</strong><span>${contents}</span>`;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400);
}
export function initSettings(home){
 const dlg=document.getElementById('settingsDlg');
 for(const id of ['settings','homeSettings'])document.getElementById(id).onclick=()=>{document.getElementById('soundOn').checked=prefs.sound;document.getElementById('motionOn').checked=prefs.motion;dlg.showModal()};
 for(const [id,key]of [['soundOn','sound'],['motionOn','motion']])document.getElementById(id).onchange=e=>{prefs[key]=e.target.checked;document.documentElement.dataset.motion=String(prefs.motion);try{localStorage.setItem('mergemine.presentation',JSON.stringify(prefs))}catch{}};
 document.getElementById('closeSettings').onclick=()=>dlg.close();document.getElementById('backHome').onclick=()=>{dlg.close();home()};
}
