export const FACTIONS=[
 {id:'verdant',name:'Verdant Crown',color:'#5aaa84',symbol:'♜',description:'Oak halls become soaring stone castles. Teal tabards, steel plate and royal cavalry.',architecture:['Timber halls and thatched roofs','Stone castles and slate towers','Grand fortified royal courts','Brick guildhalls and star forts','Factories, iron and steam'],troops:['Royal Swordsman','Longbow Archer','Royal Knight','Catapult','Crimson Marshal']},
 {id:'ironfjord',name:'Ironfjord Clans',color:'#cb6653',symbol:'ᛟ',description:'Carved longhouses grow into granite strongholds. Crimson wool, fur mantles and rugged iron armour.',architecture:['Sod-roofed timber longhouses','Granite halls and dragon gables','Great northern citadels','Slate-roofed harbour halls and bastions','Foundries, shipyards and steam cranes'],troops:['Clan Swordsman','Fjord Hunter','Iron Rider','Clan Stonecaster','High Thane']},
 {id:'sunspire',name:'Sunspire Dominion',color:'#e6b955',symbol:'☀',description:'Adobe courtyards rise into domed sandstone palaces. Saffron wraps, turquoise cloth and bronze armour.',architecture:['Adobe courts and woven awnings','Sandstone halls and tiled domes','Ornate palaces and bronze gates','Tiled academies and walled bazaars','Glass arcades, mills and railways'],troops:['Sun Guard','Dune Archer','Bronze Rider','Sunstone Catapult','Dawn Marshal']}
];
export const factionOf=s=>FACTIONS.find(f=>f.id===s?.faction)||FACTIONS[0];
const buildingNames={
 verdant:{granary:'Crown Granary',market:'Guild Hall',sanctuary:'Grove Sanctuary'},
 ironfjord:{granary:'Winter Stores',market:'Clan Trading Hall',sanctuary:'Healing Lodge'},
 sunspire:{granary:'Sun Granary',market:'Caravan Bazaar',sanctuary:'Dawn Sanctuary'}
};
export const buildingName=(s,type,fallback)=>buildingNames[factionOf(s).id]?.[type]||fallback;
export const factionArt=(s,key)=>factionOf(s).id==='verdant'?key:factionOf(s).id+'-'+key;
const troopEra=s=>s.age||((s.xp>=9000||s.ageUnlocks?.includes('industrial'))?'industrial':(s.xp>=4000||s.ageUnlocks?.includes('renaissance'))?'renaissance':'');
export const unitArt=(s,art)=>factionArt(s,(['renaissance','industrial'].includes(troopEra(s))?troopEra(s)+'-':'')+'unit-'+art);
export const troopName=(s,type)=>{const i=['sword','archer','knight','siege','commander'].indexOf(type),era=troopEra(s),prefix=({verdant:'Crown',ironfjord:'Fjord',sunspire:'Sunspire'})[factionOf(s).id];return ['renaissance','industrial'].includes(era)?prefix+' '+(era==='industrial'?['Riflemen','Sharpshooters','Mounted Rifles','Field Artillery','Field General']:['Musketeers','Skirmishers','Dragoons','Cannon Battery','Marshal'])[i]:factionOf(s).troops[i]||'Worker';};
export const missionFaction=i=>['ironfjord','sunspire','ironfjord','sunspire','verdant'][i]||'verdant';
