export const COMMANDERS=[
 {id:'warden',name:'The Warden',xp:0,role:'Infantry guardian',unit:'sword',stat:'health',bonus:.08},
 {id:'ranger',name:'The Pathfinder',xp:300,role:'Marksmen captain',unit:'archer',stat:'attack',bonus:.08},
 {id:'marshal',name:'The Marshal',xp:900,role:'Cavalry commander',unit:'knight',stat:'speed',bonus:.1},
 {id:'engineer',name:'The Artificer',xp:1800,role:'Siege engineer',unit:'siege',stat:'attack',bonus:.1},
 {id:'vanguard',name:'The Vanguard',xp:4000,role:'Expedition general',unit:'all',stat:'health',bonus:.05},
 {id:'strategist',name:'The Strategist',xp:9000,role:'Industrial field marshal',unit:'all',stat:'attack',bonus:.05}
];
export function ensureCommanders(s){const old=s.commanders;s.commanders={equipped:COMMANDERS.some(c=>c.id===old?.equipped&&s.xp>=c.xp)?old.equipped:'warden',fragments:Object.fromEntries(COMMANDERS.map(c=>[c.id,Math.min(10000,Math.max(0,Math.floor(Number(old?.fragments?.[c.id]))||0))]))};return s.commanders;}
export function commanderLevel(s,id){return Math.min(10,1+Math.floor(Math.sqrt((s.commanders?.fragments?.[id]||0)/5)));}
export function equipCommander(s,id){const c=COMMANDERS.find(c=>c.id===id);if(!c||s.xp<c.xp)return false;ensureCommanders(s).equipped=id;return true;}
export function awardFragments(s,pick=0,amount=5){const cs=ensureCommanders(s),c=COMMANDERS[Math.min(COMMANDERS.length-1,Math.max(0,Math.floor(pick*COMMANDERS.length)))];cs.fragments[c.id]=Math.min(10000,cs.fragments[c.id]+amount);return c.name+' +'+amount+' command fragments';}
export function commandProfile(s){const cs=ensureCommanders(s);return {id:cs.equipped,level:commanderLevel(s,cs.equipped)};}
export function commandBonus(profile,type,stat){const c=COMMANDERS.find(c=>c.id===profile?.id);return c&&c.stat===stat&&(c.unit==='all'||c.unit===type)?1+c.bonus*(1+(Math.min(10,Math.max(1,profile.level||1))-1)*.12):1;}
export function eraStats(unit,age){const i=['frontier','stone','imperial','renaissance','industrial'].indexOf(age);return {...unit,hp:unit.hp*(1+Math.max(0,i)*.1),attack:unit.attack*(1+Math.max(0,i)*.12),range:i>=3?(unit.art===1?10+(i-3)*3:unit.range>10?unit.range+4*(i-2):unit.range):unit.range};}
