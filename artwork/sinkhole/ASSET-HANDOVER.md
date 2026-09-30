# Sinkhole asset handover

All paths relative to `games/sinkhole/`. Built-in ImageGen generated the three masters; exact prompts in `store/art-v1/PROMPTS.json`.

| Asset | Path | Use |
| --- | --- | --- |
| App icon master | store/art-v1/icon-master.png | Full original artwork |
| Launcher/store icons | store/art-v1/icon-1024.png, icon-512.png, icon-192.png, icon-180.png | Native/store/catalogue exports |
| Feature artwork | store/art-v1/feature-master.png | Promotional key art, not gameplay |
| Store feature | store/art-v1/feature-1024x500.png | Store listing |
| Town atlas | store/art-v1/atlas-master.png | Original 25-object transparent master |
| Runtime sprites | web/assets/*.webp |21 objects,2 holes, fence and barrels; exported with export-assets.py |
| Menu artwork | web/assets/hero.webp | Responsive title screen |
| Runtime icon | web/assets/icon.png | Browser icon |
| Real gameplay screenshots | store/screenshots/ | Actual browser captures |

Use menu-review.png, play-review.png, webkit-gameplay.png, friends-request.png, friends-guest.png, friends-results.png and 3-over.png for review. earned-15s/45s/90s are actual progress earned with automated steering through ordinary browser input, not injected state or generated screenshots. QA used read-only scene inspection to choose edible targets. Sizes do not imply physical-phone testing.

Atlas export removes small disconnected neighbouring-cell fragments and preserves transparency. Exact repeatable exporter: export-assets.py. Do not substitute generic icons or promotional art for gameplay screenshots. Codex visual review is separate from Ryan's approval. Friend codes in captured screenshots are expired session examples.
