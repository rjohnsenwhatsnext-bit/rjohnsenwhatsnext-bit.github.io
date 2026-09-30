# Direct worker control and walking correction — 29 September 2026

Ryan rejected the split-image leg animation and requested tapping a worker, then dragging them onto a resource to start work.

Implemented tap selection, gold selection ring, draggable worker preview, green/red destination highlight and release-to-assign. Idle workers stand in a clearing near the keep; farm and resource workers are selectable too. Trees, stone, gold and farms accept workers subject to the existing capacity/recovery/depletion rules. Reassignment validates source and destination before updating either count. Empty/invalid drops retain the old assignment. A second touch cancels worker dragging and transfers control to pinch zoom. Assignment persists through the existing saved worker counts; no duplicate workforce or new save schema.

Worker slots are derived from the current assignment counts, not named persistent individual villagers. A successful drag shows a 1.3-second walk to the destination, followed by the existing chopping/mining frames. Counts and resource production update at assignment, as with the existing panel controls. Idle and farm workers no longer roam across keep roofs.

Removed the split/rotated lower-sprite leg rendering. Workers, swordsmen, archers and commanders use four full painted walking frames per faction with aligned canvases and height matching. Horse/siege art remains intact rather than bending parts of the original image.

## Artwork

- Three accepted transparent masters: `store/walking/{verdant,ironfjord,sunspire}-walk-final.png`.
- Exact built-in ImageGen prompts: `store/walking/FINAL-PROMPTS.json`.
- Export rectangles/normalization: `store/walking/crops.json`; repeat with `export-walking.cjs`.
- 48 runtime WebP files: `web/assets/[faction-]walk-{0,1,2,5}-{0..3}.webp`. Verdant has no prefix.
- Earlier `*-walk.png` and `*-walk-alpha.png` sheets are rejected checkerboard-background attempts. They are NOT consumed or included in the delivery pack.
- Actual browser screenshots: `store/screenshots/worker-drag-target.png`, `worker-chopping.png`.
- Existing game icon and feature artwork retained. Native packaging must include the new runtime walk assets.

## Verification

20 unit tests pass, including valid reassignment, source conservation, full/depleted/recovering targets, bad IDs and saved assignments. `qa-workers.cjs` passes native Chromium touch selection, drag onto tree, increased wood, moving the busy worker to stone, invalid-drop retention, pinch cancellation and reload persistence; WebKit touch selection and pointer dragging pass. No page/asset errors. Existing pinch and animated river browser checks pass. Phone-sized screenshots inspected. Physical-phone feel and Ryan's acceptance remain open.

Frontend/local simulation only; no backend, real billing or native release changes.
