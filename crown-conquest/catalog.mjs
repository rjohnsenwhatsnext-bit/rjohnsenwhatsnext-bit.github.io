import {AGES,ageOf} from './ages.mjs';
export const LEVELS=[0,80,220,480,900,1500,2400,3600];
export const levelOf=xp=>LEVELS.reduce((n,t,i)=>xp>=t?i+1:n,1);
export const FEATURES=[
{id:'archery',name:'Longbow companies',level:2,desc:'Train ranged archers and build archery ranges.',product:'crown.unlock.archery'},
{id:'masonry',name:'Fortified frontier',level:3,desc:'Build defensive towers and stone walls. +15% keep health.',product:'crown.unlock.masonry'},
{id:'cavalry',name:'Royal cavalry',level:4,desc:'Build stables and train fast armoured knights.',product:'crown.unlock.cavalry'},
{id:'logistics',name:'Imperial logistics',level:4,desc:'Two construction crews instead of one. +25% resource production.',product:'crown.unlock.logistics'},
{id:'steel',name:'Tempered steel',level:5,desc:'+15% army attack. Applies in AI and casual friend battles.',product:'crown.unlock.steel'},
{id:'siege',name:'Siege engineering',level:6,desc:'Build workshops and train long-range catapults.',product:'crown.unlock.siege'},
{id:'commander',name:'The Crimson Marshal',level:7,desc:'Recruit a powerful commander who strengthens nearby allies.',product:'crown.unlock.commander'},
{id:'empire',name:'Imperial armour',level:8,desc:'+20% army health. Applies in AI and casual friend battles.',product:'crown.unlock.empire'}];
export const BUILDINGS={
keep:{name:'Town Keep',art:0,cost:{wood:200,stone:180,gold:100},hp:1600},
farm:{name:'Farm',art:1,cost:{wood:65},resource:'food',rate:1.7},
lumber:{name:'Lumber Mill',art:2,cost:{wood:55,food:20},resource:'wood',rate:1.5},
quarry:{name:'Quarry',art:3,cost:{wood:75,food:25},resource:'stone',rate:.9},
mine:{name:'Gold Mine',art:4,cost:{wood:90,stone:35},resource:'gold',rate:.7},
house:{name:'Cottages',art:5,cost:{wood:55,stone:15},population:6},
barracks:{name:'Barracks',art:6,cost:{wood:100,stone:50}},
range:{name:'Archery Range',art:7,cost:{wood:150,gold:50},feature:'archery'},
stable:{name:'Stables',art:8,cost:{wood:180,stone:70,gold:75},feature:'cavalry'},
workshop:{name:'Siege Workshop',art:9,cost:{wood:220,stone:140,gold:120},feature:'siege'},
tower:{name:'Watchtower',art:10,cost:{wood:80,stone:120,gold:50},feature:'masonry'},
wall:{name:'Stone Wall',art:11,cost:{stone:55,wood:15},feature:'masonry'}};
export const UNITS={
sword:{name:'Swordsman',art:1,cost:{food:30,gold:10},building:'barracks',hp:105,attack:15,range:2.3,speed:5,period:1.0},
archer:{name:'Longbow Archer',art:2,cost:{food:25,wood:25,gold:15},building:'range',feature:'archery',hp:65,attack:13,range:15,speed:4.5,period:1.2},
knight:{name:'Royal Knight',art:3,cost:{food:65,gold:40},building:'stable',feature:'cavalry',hp:205,attack:24,range:2.7,speed:7,period:1.05},
siege:{name:'Catapult',art:4,cost:{wood:90,stone:35,gold:65},building:'workshop',feature:'siege',hp:125,attack:48,range:23,speed:2.7,period:2.8},
commander:{name:'Crimson Marshal',art:5,cost:{food:150,gold:160},building:'barracks',feature:'commander',hp:330,attack:30,range:3.0,speed:5.5,period:.95}};
export const FLAGS=[{id:'stag',name:'Verdant Stag',color:'#58aa8a',symbol:'♜',free:true},{id:'lion',name:'Golden Lion',color:'#d7ac55',symbol:'♛',product:'crown.flag.lion'},{id:'raven',name:'Night Raven',color:'#ab87c9',symbol:'♞',product:'crown.flag.raven'},{id:'sun',name:'Sun Empire',color:'#e39353',symbol:'✦',product:'crown.flag.sun'}];
export const SKINS=[{id:'classic',name:'Verdant stone',free:true},{id:'ivory',name:'Ivory citadel',product:'crown.skin.ivory'},{id:'obsidian',name:'Obsidian court',product:'crown.skin.obsidian'}];
export const MISSIONS=[
{name:'Ashwood Outpost',subtitle:'A frontier lord tests your banner.',power:1,reward:{xp:100,food:180,wood:180,stone:80,gold:100},army:{sword:4,archer:1}},
{name:'The Copper Road',subtitle:'Break the raiders controlling the gold route.',power:1.25,reward:{xp:150,food:240,wood:220,stone:120,gold:180},army:{sword:6,archer:3}},
{name:'Greywatch Bastion',subtitle:'Storm the fortress on the northern ridge.',power:1.55,reward:{xp:220,food:350,wood:280,stone:180,gold:260},army:{sword:7,archer:4,knight:2}},
{name:'The Broken Crown',subtitle:'A rival monarch fields their royal cavalry.',power:1.9,reward:{xp:320,food:450,wood:350,stone:250,gold:350},army:{sword:8,archer:5,knight:4}},
{name:'Throne of Embers',subtitle:'Siege engines defend an ancient capital.',power:2.25,reward:{xp:450,food:600,wood:500,stone:350,gold:500},army:{sword:8,archer:6,knight:5,siege:2}}];
export const LOOT=[
{id:'supplies',name:'Frontier supplies',rarity:'Common',weight:60,description:'180 food, 180 wood, 100 stone and 100 gold.'},
{id:'standard',name:'A heraldic standard',rarity:'Rare',weight:28,description:'Golden Lion or Night Raven flag. Owned duplicate converts to 250 gold.'},
{id:'court',name:'A citadel skin',rarity:'Epic',weight:10,description:'Ivory or Obsidian skin. Owned duplicate converts to 500 gold.'},
{id:'royal',name:'Royal cavalry charter',rarity:'Legendary',weight:2,description:'Permanent cavalry unlock, also earnable at level 4. Owned duplicate converts to 800 gold.'}];
export const PRODUCTS=[...AGES.filter(a=>a.product).map(a=>({id:a.product,name:a.name+' advancement',type:'age',description:a.description,earn:'Reach '+a.xp+' XP'})),...FEATURES.map(f=>({id:f.product,name:f.name,type:'unlock',description:f.desc,earn:`Reach level ${f.level} (${LEVELS[f.level-1]} XP)`})),
{id:'crown.pack.provisions',name:'Royal supply caravan',type:'consumable',description:'1,000 each of food, wood, stone and gold.'},
{id:'crown.pack.experience',name:'Scholar’s chronicle',type:'consumable',description:'500 XP towards feature unlocks.'},
{id:'crown.pack.builders',name:'Master builders',type:'consumable',description:'Finish every currently active construction order once.'},
{id:'crown.pack.reinforcements',name:'Frontier reinforcements',type:'consumable',description:'8 swordsmen and 4 archers. Requires 12 free army places.'},
...FLAGS.filter(f=>f.product).map(f=>({id:f.product,name:f.name+' flag',type:'cosmetic',description:'Permanent banner design. No combat bonus.'})),
...SKINS.filter(f=>f.product).map(f=>({id:f.product,name:f.name,type:'cosmetic',description:'Permanent settlement skin. No combat bonus.'})),
{id:'crown.chest.war',name:'War chest',type:'loot',description:'One reward: common 60%, rare 28%, epic 10%, legendary 2%. No cash value or trading.'},
{id:'crown.chest.war5',name:'Five war chests',type:'loot',description:'Five independent rewards with the same published odds. No guaranteed rarity.'}];
export const hasFeature=(s,id,paid=[])=>!id||ageOf(s,paid).features.includes(id)||levelOf(s.xp)>=(FEATURES.find(f=>f.id===id)?.level??99)||s.unlocks.includes(id)||paid.includes(FEATURES.find(f=>f.id===id)?.product);
