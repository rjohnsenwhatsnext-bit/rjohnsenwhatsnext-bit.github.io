# Three factions — 29 September 2026

Ryan requested factions with completely different buildings and outfits. Added Verdant Crown (existing medieval sets), Ironfjord Clans (carved timber/granite, crimson fur and iron outfits), and Sunspire Dominion (adobe/sandstone domes, saffron/turquoise bronze outfits).

Each new faction has 36 building sprites across three ages, six worker/troop/siege sprites, and six gathering poses: 96 new runtime sprites from eight built-in ImageGen masters. These are distinct illustrated designs, not colour filters. Existing icon and promotional feature retained for the same game.

First entry offers faction choice; existing saves retain Verdant until a choice is made. Settings → Change faction preserves progress. All factions are free with equal costs/stats. Army and age cards, buildings, workers, gathering/walking, banners, keeps and combat units use faction art. Campaign opponents have specified factions.

Friend protocol 4 includes a whitelisted faction ID; both players must refresh. Faction changes are blocked during battles and active rooms so connected profiles remain consistent. Missing/invalid IDs normalize to verdant. Future authoritative profiles should persist faction and factionChosen, preserve progress on changes, and keep paid entitlements separate.

Validation: 18 unit tests pass including legacy migration, preservation of progress, profile validation and complete art coverage. Chromium/WebKit mobile choice/change/save/reload and army/building/campaign rendering pass with zero page/HTTP errors. Real two-browser PeerJS mixed-faction host/guest battle passes, including new-player invite retention and guest commands. Native two-touch camera checks still pass.

Actual phone-sized screenshots reviewed. Age screenshots use explicit 35/220/1500 XP fixtures, not earned progression evidence. Physical-phone performance and Ryan's visual/fun approval remain open. No backend/native/billing changes or store publication.

## Exact artwork paths

- `store/factions/PROMPTS.json`: eight exact built-in ImageGen prompts.
- `store/factions/{ironfjord,sunspire}-{frontier,building,imperial}.png`: 12 buildings each, in existing catalogue order.
- `store/factions/{ironfjord,sunspire}-people.png`: worker, swordsman, archer, mounted knight, catapult, commander, three axe poses, three pickaxe poses.
- `store/factions/crops.json`: whole-object export rectangles. Re-export with `export-factions.cjs`. Alpha preserved; gathering poses share canvas size and foot anchoring.
- `web/assets/{faction}-{age}-{0..11}.webp`, `{faction}-unit-{0..5}.webp`, `{faction}-gather-{0..5}.webp`: runtime exports.
- `store/screenshots/factions-{choice,ironfjord,sunspire,battle,friends}.png`: real gameplay captures.
- `store/screenshots/faction-{ironfjord,sunspire}-{frontier,stone,imperial}.png`: real browser renders with explicit XP fixtures.

Claude: retain supplied art in native packaging. Use existing icon-master and feature-master. Native release is a separate gate.
