export const FACTIONS=[
 {id:'verdant',name:'Verdant Crown',color:'#5aaa84',symbol:'♜',description:'Oak halls become soaring stone castles. Teal tabards, steel plate and royal cavalry.',architecture:['Timber halls and thatched roofs','Stone castles and slate towers','Grand fortified royal courts'],troops:['Royal Swordsman','Longbow Archer','Royal Knight','Catapult','Crimson Marshal']},
 {id:'ironfjord',name:'Ironfjord Clans',color:'#cb6653',symbol:'ᛟ',description:'Carved longhouses grow into granite strongholds. Crimson wool, fur mantles and rugged iron armour.',architecture:['Sod-roofed timber longhouses','Granite halls and dragon gables','Great northern citadels'],troops:['Clan Swordsman','Fjord Hunter','Iron Rider','Clan Stonecaster','High Thane']},
 {id:'sunspire',name:'Sunspire Dominion',color:'#e6b955',symbol:'☀',description:'Adobe courtyards rise into domed sandstone palaces. Saffron wraps, turquoise cloth and bronze armour.',architecture:['Adobe courts and woven awnings','Sandstone halls and tiled domes','Ornate palaces and bronze gates'],troops:['Sun Guard','Dune Archer','Bronze Rider','Sunstone Catapult','Dawn Marshal']}
];
export const factionOf=s=>FACTIONS.find(f=>f.id===s?.faction)||FACTIONS[0];
export const factionArt=(s,key)=>factionOf(s).id==='verdant'?key:factionOf(s).id+'-'+key;
export const unitArt=(s,art)=>factionArt(s,'unit-'+art);
export const troopName=(s,type)=>factionOf(s).troops[['sword','archer','knight','siege','commander'].indexOf(type)]||'Worker';
export const missionFaction=i=>['ironfjord','sunspire','ironfjord','sunspire','verdant'][i]||'verdant';
