// Local presentation preferences and optional synthesised effects. No economy state.
const KEY='leaplegends.presentation.v1';
export const presentation={paused:false,sound:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');if(typeof s.sound==='boolean')presentation.sound=s.sound;if(typeof s.reduced==='boolean')presentation.reduced=s.reduced;}catch{}
let context;
export function unlockSound(){if(!presentation.sound)return;try{context ||= new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});}catch{}}
export function sound(type){
 if(!presentation.sound||!context||context.state!=='running')return;
 const notes={bounce:[280,450,.06],spring:[330,880,.14],coin:[1000,1500,.1],rocket:[220,900,.25],shield:[630,220,.15],dead:[180,65,.25],best:[660,1320,.28]};const note=notes[type];if(!note)return;
 const [a,b,d]=note,o=context.createOscillator(),v=context.createGain(),now=context.currentTime;o.type='sine';o.frequency.setValueAtTime(a,now);o.frequency.exponentialRampToValueAtTime(b,now+d);v.gain.setValueAtTime(.035,now);v.gain.exponentialRampToValueAtTime(.001,now+d);o.connect(v);v.connect(context.destination);o.start(now);o.stop(now+d);
}
export function fullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});}
export function setupSettings({isRunning,clearInput,endRun}){
 const $=id=>document.getElementById(id),dialog=$('settings');
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({sound:presentation.sound,reduced:presentation.reduced}));}catch{}};
 const sync=()=>{document.documentElement.classList.toggle('reduced-motion',presentation.reduced);$('soundSetting').checked=presentation.sound;$('motionSetting').checked=presentation.reduced;};sync();
 function open(){if(dialog.open)return;presentation.paused=true;clearInput();$('pauseLabel').textContent=isRunning()?'Your climb is paused.':'Make yourself at home.';$('endRun').classList.toggle('hidden',!isRunning());dialog.showModal();}
 function close(){dialog.close();presentation.paused=false;clearInput();}
 $('openSettings').onclick=open;$('closeSettings').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('soundSetting').onchange=e=>{presentation.sound=e.target.checked;save();unlockSound();};
 $('motionSetting').onchange=e=>{presentation.reduced=e.target.checked;save();sync();};
 $('fullscreenSetting').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else fullscreen();};
 $('endRun').onclick=()=>{close();endRun();};
 addEventListener('keydown',e=>{if(e.code==='Escape'&&!dialog.open){e.preventDefault();open();}});
 addEventListener('blur',()=>{clearInput();if(isRunning())open();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&isRunning())open();});
 document.addEventListener('pointerdown',unlockSound,{passive:true});
}
