// Starts the game. Older Android WebViews (before Chrome 89) refuse to run any module
// that holds a top-level await, so main.mjs never ran there ("Unexpected reserved word",
// seen in the live game numbers 25 Oct 2026). The artwork loads here instead, then
// main.mjs starts with the renderer ready on window.__crownDraw.
import { renderer } from './draw.mjs';

renderer(document.getElementById('world')).then((draw) => {
  window.__crownDraw = draw;
  return import('./main.mjs');
});
