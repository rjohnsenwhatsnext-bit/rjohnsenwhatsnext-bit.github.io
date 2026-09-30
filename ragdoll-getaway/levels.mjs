// Authored short routes. Coordinates are world pixels; floor is y=560.
const make=(name,theme,length,gaps,guards,props,loot,tip,extras=[])=>({name,theme,length,gaps,guards,props,loot,tip,extras});
export const LEVELS=[
make('The first getaway','bank',1650,[],[750,1190],[[480,'crate'],[1050,'glass']],[360,950,1380],'Move right. Your blaster fires at nearby robots. Reach the yellow van.'),
make('Window shopping','bank',1850,[],[720,1380],[[480,'glass'],[980,'crate'],[1220,'glass']],[350,1070,1590],'Glass shatters when you shoot it. Keep moving through.'),
make('Mind the gap','bank',1750,[[810,910]],[550,1210],[[420,'crate'],[1390,'glass']],[360,1060,1510],'Tap JUMP before the striped edge. Hold right while airborne.'),
make('Special delivery','street',2000,[],[650,1160,1600],[[470,'barrel'],[980,'crate'],[1380,'crate']],[340,900,1780],'Orange barrels knock nearby robots and crates flying. Give them room.'),
make('Spring fling','street',2000,[[880,1010]],[620,1450],[[420,'crate'],[1230,'glass']],[350,1100,1730],'The pink spring pad launches you. Keep moving right.',[{x:790,type:'spring'}]),
make('Rush hour','street',2200,[[1050,1150]],[660,1450,1800],[[440,'barrel'],[820,'glass'],[1620,'crate']],[350,1280,1990],'Dive through a tight spot. You get back up automatically.'),
make('Art of escape','museum',2100,[],[700,1200,1680],[[480,'glass'],[990,'crate'],[1440,'glass']],[350,1350,1850],'A quick dive dodges robot shots. Your blaster pauses while you tumble.'),
make('Exhibit A: chaos','museum',2400,[[960,1060],[1660,1760]],[670,1370,1970],[[450,'barrel'],[1180,'glass'],[1900,'crate']],[350,1490,2180],'Two gaps, two clean jumps. The striped edges show the drop.'),
make('Ropey business','museum',2250,[[1090,1200]],[680,1430,1850],[[450,'crate'],[970,'glass'],[1660,'barrel']],[350,1280,2040],'Leap onto the hanging rope to catch it. JUMP lets go.',[{x:1060,type:'rope'}]),
make('Platform panic','train',2350,[[900,990],[1560,1650]],[630,1240,1890],[[430,'glass'],[1120,'crate'],[1740,'barrel']],[350,1370,2120],'Train-car gaps need a running jump. The scenery moves, the controls stay the same.'),
make('Express checkout','train',2600,[[1030,1150],[1880,2000]],[690,1490,2170],[[440,'barrel'],[880,'glass'],[1330,'crate'],[1720,'glass']],[350,1600,2380],'Keep your momentum. Spring pads can carry you over gaps.',[{x:940,type:'spring'}]),
make('The big getaway','train',2850,[[980,1090],[1740,1850]],[650,1330,2100,2450],[[430,'glass'],[830,'barrel'],[1540,'glass'],[2320,'crate']],[350,1450,2600],'Everything you learned. Escape, then return for every loot bag.',[{x:1680,type:'spring'}])
];
export function starsFor(s){return s.phase==='won'?1+Number(s.collected===s.level.loot.length)+Number(s.health>=2):0;}
export function loadProgress(raw){try{const v=JSON.parse(raw);if(!Array.isArray(v))return LEVELS.map(()=>0);return LEVELS.map((_,i)=>Number.isInteger(v[i])?Math.max(0,Math.min(3,v[i])):0);}catch{return LEVELS.map(()=>0);}}
export function unlocked(progress,i){return i===0||progress[i-1]>0;}
export function recordWin(progress,i,stars){return progress.map((v,j)=>j===i?Math.max(v,stars):v);}
