// Lightweight synthesised country ambience; opt-in and silent outside active play.
import {daylight} from './property-life.mjs';
export class PropertyAudio{
 constructor(){this.enabled=false;this.next=0;this.ctx=null;this.playing=false;}
 enable(on){
 this.enabled=on;
 if(on&&!this.ctx){try{this.ctx=new (globalThis.AudioContext||globalThis.webkitAudioContext)();}catch{}}
 if(!on)this.ctx?.suspend().catch(()=>{});
 else this.ctx?.resume().catch(()=>{});
 }
 tone(freq,duration=.2,volume=.018,type='sine',slide=0,delay=0){
 if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
 const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;
 o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(25,freq+slide),t+duration);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
 o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
 }
 payoff(kind){
 if(kind==='sale'){[392,494,587,784].forEach((n,i)=>this.tone(n,.3,.025,'sine',0,i*.1));}
 else if(kind==='muster'){this.tone(190,.11,.015,'triangle',-100);this.tone(350,.08,.012,'triangle',-200,.12);}
 else this.tone(650,.13,.014,'sine',-100);
 }
 update(s,active){
 const play=this.enabled&&active;
 if(play!==this.playing){this.playing=play;if(play)this.ctx?.resume().catch(()=>{});else this.ctx?.suspend().catch(()=>{});}
 if(!play||!this.ctx||s.time<this.next)return;this.next=s.time+3.5;
 const light=daylight(s),engine=s.jobs.some(j=>j.status==='active'&&['ute','truck','bike','excavator'].includes(j.vehicle)&&j.stage>0);
 if(engine)this.tone(75,.7,.012,'triangle',-15);
 else if(s.weather==='Rain'||light.night){this.tone(260,.18,.01,'sine',-60);this.tone(240,.15,.008,'sine',-40,.26);}
 else if(light.name==='Dawn'){[740,990,820].forEach((f,i)=>this.tone(f,.2,.012,'sine',120,i*.23));}
 else if(Math.floor(s.time/7)%3===0&&s.animals.length)this.tone(130,.6,.012,'triangle',-30);
 else this.tone(2700,.35,.004,'sawtooth',-250);
 }
}
