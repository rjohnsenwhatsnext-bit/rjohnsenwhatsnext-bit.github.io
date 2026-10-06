import {clock} from './clock.mjs';
import {catchUp,stampSeen} from './away.mjs';
import {dayKeyFor,dailyJobs} from './daily.mjs';
// Only a successful server check enables catch-up. Local play always works.
export function propertyTime(s,tick,onReport,onReady){
 let ready=false,busy=false,started=false,pendingAway=true,lastBoardMinute=null;
 const api={
  get busy(){return busy;},
  get dayKey(){return ready?dayKeyFor(clock.now()):null;},
  stamp(){if(ready&&!busy&&!pendingAway)stampSeen(s,clock.now());},
  suspend(){api.stamp();if(ready)started=false;pendingAway=true;},
  markPlayed(){started=true;if(!ready)delete s.seenAt;else {const minute=Math.floor(clock.now()/60000);if(minute!==lastBoardMinute){dailyJobs(s,api.dayKey);lastBoardMinute=minute;}}},
  async sync(){
   if(busy)return;busy=true;
   const checked=await clock.sync();
   ready=checked&&!clock.problem;
   if(ready){
    dailyJobs(s,api.dayKey);
    // An offline session already played cannot later receive the same time twice.
    if(pendingAway&&!started){const report=catchUp(s,clock.now(),tick);if(report)onReport(report);}
    else stampSeen(s,clock.now());
    pendingAway=false;started=false;
   }
   busy=false;onReady();
  },
  resume(){return api.sync();}
 };
 return api;
}
