// Saved local campaign. Free play and private rooms use the original rules.
export const MISSIONS = [
 {id:'street-sweep',name:'Street sweep',chapter:'Goldfields / First appetite',seed:7311,brief:'Swallow 20 pieces of street clutter.',hint:'Sweep across the small objects before chasing bigger prey.',goals:[{label:'Street clutter',kinds:['rock','tyre','crate','cone','bin','bricks','rope','toolbox','barrel'],need:20}],gold:40,silver:70},
 {id:'collectors-trail',name:'Collector’s trail',chapter:'Goldfields / Explore the town',seed:8213,brief:'Swallow eight different object types.',hint:'Explore gardens, roads and yards. Repeats do not count.',goals:[{label:'Different types',unique:true,need:8}],gold:45,silver:80},
 {id:'yard-clearance',name:'Yard clearance',chapter:'Goldfields / Grow and conquer',seed:9319,brief:'Swallow four vehicles and two sheds or stalls.',hint:'Grow on clutter, move to parked vehicles, then clear the yards.',goals:[{label:'Vehicles',kinds:['car','ute','van','caravan','minecart','truck'],need:4},{label:'Sheds / stalls',kinds:['shed','stall'],need:2}],gold:75,silver:100}
];
export function cleanSave(raw){
 const out={version:1,medals:{}};
 for(const m of MISSIONS){const v=raw?.medals?.[m.id];if(Number.isInteger(v)&&v>=1&&v<=3)out.medals[m.id]=v;}
 return out;
}
export function unlocked(save,index){return index===0||!!save.medals[MISSIONS[index-1]?.id];}
export function newAttempt(mission){return {id:mission.id,counts:mission.goals.map(()=>0),seen:[],completedAt:null};}
export function collect(mission,attempt,kind,time){
 if(attempt.completedAt!==null)return;
 const fresh=!attempt.seen.includes(kind);if(fresh)attempt.seen.push(kind);
 mission.goals.forEach((goal,i)=>{if(goal.unique?fresh:goal.kinds.includes(kind))attempt.counts[i]=Math.min(goal.need,attempt.counts[i]+1);});
 if(attempt.counts.every((n,i)=>n>=mission.goals[i].need))attempt.completedAt=time;
}
export function medal(mission,attempt){return attempt.completedAt===null?0:attempt.completedAt<=mission.gold?3:attempt.completedAt<=mission.silver?2:1;}
export function award(save,mission,attempt){const next=cleanSave(save);const earned=medal(mission,attempt);if(earned)next.medals[mission.id]=Math.max(next.medals[mission.id]||0,earned);return next;}
export function progress(mission,attempt){return mission.goals.map((goal,i)=>goal.label+' '+attempt.counts[i]+'/'+goal.need).join(' · ');}
