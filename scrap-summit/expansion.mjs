// Ten expedition mountains. Existing route IDs/geometry remain in rocky-mountain.mjs.
const names=[
 ['greenhorn-hill','Greenhorn Hill','meadow','Grassy shelves and generous footholds.',['The meadow','Moss steps','Old roots','Shepherd ledge','Green traverse','High pasture','The green crown']],
 ['quarry-crown','Quarry Crown','quarry','Broad quarry cuts give way to exposed sandstone shelves.',['Cut stone','The haul road','Quarry teeth','The cut face','Dust traverse','Crane ledge','Quarry crown']],
 ['junkyard-jag','Junkyard Jag','junkyard','Crushed cars, steel teeth and slippery metal seams.',['Tyre pile','Scrap cars','Crushed chassis','The crusher','Bent girders','Crane graveyard','Scrap king']],
 ['timber-top','Timber Top','timber','Sawtooth timber ledges above an abandoned mine.',['Log landing','Old sleepers','Broken braces','Timber teeth','The trestle','High scaffold','The watchtower']],
 ['mosswater-wall','Mosswater Wall','moss','Wet slate, rounded holds and short slick crossings.',['Wet roots','Slate shelves','Waterfall lip','Moss wall','Rain traverse','Cloud ledge','The falls crown']],
 ['red-mesa','Red Mesa','canyon','Tall red shelves, long reaches and receding ledges.',['Red sand','Sandstone ribs','The dry wash','Vulture wall','Sun traverse','The red needle','Mesa crown']],
 ['cinder-spire','Cinder Spire','volcanic','Sharp basalt, narrow grips and polished glass seams.',['Ash field','Black clinker','Basalt teeth','The caldera','Glass traverse','Cinder needle','Ember crown']],
 ['glacier-gate','Glacier Gate','glacier','Longer ice bands demand deliberate hammer placement.',['Frozen moraine','Blue shelves','Glacier teeth','Frozen wall','Ice traverse','Cold needle','Glacier gate']],
 ['tempest-tower','Tempest Tower','storm','Steep broken granite with exposed low-grip crossings.',['Storm foot','Broken ribs','Thunder ledge','The dark wall','Storm traverse','Lightning needle','Tempest crown']],
 ['obsidian-zenith','Obsidian Zenith','obsidian','The longest climb: sharp black stone and extensive ice.',['Black moraine','Frozen shards','Obsidian teeth','The final wall','White traverse','Last foothold','Zenith']]
];
export const EXPEDITIONS=names.map(([slug,name,theme,description,sectionNames],i)=>({
 id:slug+'-v1',name,theme,description,sectionNames,difficulty:i+1,height:86+i*16,
 phase:.7+i*.83,slope:1.5-i*.055,roughness:.14+i*.055,grip:1.1-i*.05,
 iceFraction:Math.max(0,(i-3)*.09),baseKind:i===2?'metal':i===3?'plank':'rock',tint:null,
 challenge:['First footholds','Longer reaches','Metal grip','Timber teeth','Wet crossings','Narrow ledges','Glass seams','Extended ice','Exposed holds','Endurance & ice'][i]
}));
