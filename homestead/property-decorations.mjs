// Standard earnable property details; no paid entitlement required.
export const DECORATIONS={
 gravelDrive:{name:'Gravel driveway',cost:120,size:1,seconds:4,decor:0,walkable:true,description:'A laid gravel square. People and vehicles can cross it.'},
 entranceSign:{name:'Timber entrance sign',cost:450,size:1,seconds:6,decor:1,description:'A rustic timber welcome at your entrance.'},
 letterbox:{name:'Country letterbox',cost:180,size:1,seconds:4,decor:2,description:'A red rural letterbox for the front of your place.'},
 railFence:{name:'Decorative rail fence',cost:260,size:1,seconds:5,decor:3,description:'A timber feature fence. Decoration only; it does not hold livestock.'},
 nativeBed:{name:'Native garden bed',cost:380,size:1,seconds:6,decor:4,description:'Grevilleas, native grasses and stone edging.'},
 flowerBed:{name:'Cottage flower bed',cost:320,size:1,seconds:5,decor:5,description:'Colour around your home or campground.'},
 shadeTree:{name:'Shade gum tree',cost:650,size:1,seconds:8,decor:6,description:'An established gum tree with a broad leafy canopy.'},
 picnicTable:{name:'Picnic table',cost:420,size:1,seconds:5,decor:7,description:'A timber table and benches for your outdoor space.'},
 firePit:{name:'Stone fire pit',cost:550,size:1,seconds:7,decor:8,description:'An unlit stone fire pit for your outdoor seating area.'},
 outdoorChairs:{name:'Verandah furniture',cost:480,size:1,seconds:5,decor:9,description:'Two timber chairs and a table. Place beside your home.'},
 gardenLamp:{name:'Garden lantern',cost:340,size:1,seconds:6,decor:10,description:'A warm lantern that lights up at sunset.'},
 dogKennel:{name:'Dog kennel',cost:390,size:1,seconds:6,decor:11,description:'A timber kennel ready for a future companion. No dog included.'}
};
for(const d of Object.values(DECORATIONS)){d.decoration=true;d.art=-1;}
