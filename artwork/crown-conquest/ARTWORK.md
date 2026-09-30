# Crown & Conquest — artwork manifest
Generated with built-in ImageGen; prompts/briefs are in PROMPTS.json. Masters retained; exports resized/cropped with Sharp while preserving generated alpha.

- icon-master.png -> icon-512.png (512×512, native/store icon), web/assets/icon.png.
- feature-master.png -> feature-1024x500.png (1024×500 store promotional graphic).
- backdrop-master.png -> web/assets/backdrop.webp, title menu landscape.
- buildings-master.png -> web/assets/building-0.webp through building-11.webp, 12 isolated alpha sprites. In order: keep, farm, lumber, quarry, mine, cottages, barracks, archery range, stable, workshop, tower, wall.
- units-master.png -> web/assets/unit-0.webp through unit-5.webp, six alpha sprites. Villager, swordsman, archer, knight, catapult, Crimson Marshal.
- town-terrain-master.png -> web/assets/town-terrain.webp.
- battle-terrain-master.png -> web/assets/battle-terrain.webp.
- screenshots/01-menu.png, 02-kingdom.png, 03-battle.png, 04-chests.png, 05-friends.png, 06-victory.png: actual rendered 430×932 phone captures, not generated marketing mockups.

Skin variants currently use rendering treatments on the original building sprites (Ivory: lighter/desaturated; Obsidian: darker/hue shift). Heraldry is rendered from four colour/emblem designs. These are not separately generated geometry packs. Troops are sprite-based, not skeletal animation.

CLAUDE: Use these exact assets for the native wrapper/store. Do not regenerate generic placeholders or substitute previous game art. Native storefront publishing is separate from this browser preview. The feature image is promotional, not a gameplay screenshot. The gameplay screenshots are suitable development evidence; final store submission still needs platform-specific checks and screenshots of the final native build.

## Land and ages artwork update
- frontier-master.png:12 new wooden/thatch building sprites -> runtime frontier-0.webp…frontier-11.webp.
- imperial-master.png:12 new grand stone building sprites -> runtime imperial-0.webp…imperial-11.webp.
- land-master.png: oak, pine, granite, gold, stump, exhausted pit -> runtime land-0.webp…land-5.webp.
- AGES-PROMPTS.json contains exact three built-in ImageGen prompts. atlas-crops.json records actual sprite bounds (whole generated objects are not perfectly centred on equal grid cells). Use export-age-sprites.cjs for the current complete-object exports.
- Screenshots08-frontier-age,09-chopping,10-mining,11-age-progression,12-castle-age,13-imperial-age show the new gameplay and progression. Castle uses a documented210XP test fixture then real resource gathering to cross220XP; Imperial is a1500XP visual fixture. These are actual browser renders, not generated game mockups or evidence of purchases.
- Existing building-0…11 are now the Castle Age middle tier. Building levels and cosmetics do not substitute for the three actual age sprite sets.
- gather-workers-master.png -> runtime gather-0.webp…gather-5.webp: three axe-chopping poses and three pickaxe-mining poses, animated at the working site. GATHER-PROMPT.json records the exact built-in ImageGen prompt. These frames retain equal cell bounds for consistent animation scale; use art-workers.cjs on this workstation to repeat the initial export.

## Factions update
96 new runtime sprites and eight ImageGen masters are described in ../FACTIONS-HANDOVER.md. Exact prompts: factions/PROMPTS.json. Crops: factions/crops.json. Existing icon and feature remain current.

## Walking correction
48 full painted walk frames replace split-image legs. Use walking/*-walk-final.png, walking/FINAL-PROMPTS.json and walking/crops.json only. Earlier walking sheets are rejected checkerboard drafts, not runtime assets. See ../WORKERS-HANDOVER.md.
