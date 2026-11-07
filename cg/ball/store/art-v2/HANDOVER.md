# Ball artwork

Use icon-1024.png for app icon source; icon-512.png for the store. Use feature-1024x500.png for the wide store feature. Masters are preserved alongside the exports. Do not substitute a title card or stretch the icon into a banner.

The game.json icon path is wired where a game exists in Arcade. The existing android-art.mjs still draws its own feature image: AFTER it runs, copy feature-1024x500.png to build/ball/store/feature.png (and icon-512.png to icon.png). artwork/copy-to-build.mjs does this explicitly. Claude owns permanent CI integration; do not let later packaging overwrite the supplied feature. No store upload performed.

Illustrated key art is not a gameplay screenshot. Keep real screenshot captures for screenshot slots. Codex inspected the generated images; Ryan approval and native masked-icon checks remain separate.
