# Fiver artwork — 29 September 2026

Original ImageGen artwork: `icon-master.png` (ivory F ceramic tile with gold/teal/slate stack) and `feature-master.png` (matching FIVER literary still life). Exact prompts: `PROMPTS.json`.

Exports: `icon-1024.png` for native icon generation, `icon-512.png` for store listing, `feature-1024x500.png` for Google Play. game.json references the 1024 icon and feature. Runtime assets: web/assets/title.webp and icon-512.png. Reproduce with `node games/fiver/export-art.cjs` from the repository root (Sharp path is local runtime specific).

`play-screenshots/phone-1.png` is the main menu; phone-2 through phone-4 are actual Easy/Medium/Hard boards (1170x2340). `store-shots.mjs` enters legitimate demonstration guesses through the UI, selected using the deterministic puzzle answer to show varied clues; it does not inject game state or claim a human solution. `screenshots/` contains separate automated QA captures, including a solved-result test.

Keep the existing rules, local save key, native banner wiring and no-paid-advantage model. Browser preview does not validate native ad delivery. Ryan's visual and physical-device review remains open.
