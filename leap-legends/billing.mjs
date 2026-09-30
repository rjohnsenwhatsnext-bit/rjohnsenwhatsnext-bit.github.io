// Leap Legends purchases. Three cases, and the game never has to know which:
//   web preview  purchases are free and say so (nothing is charged)
//   phone app, before Play billing is wired in: purchases refuse, so a store
//                build can never hand out free gems
//   phone app with Play billing: the real thing (to come, with the products
//                set up in Play Console; prices come from Play, never from here)
import { PRODUCTS } from './economy.mjs';

const native = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());

export const billing = {
  mode: () => (native() ? 'unavailable' : 'preview'),
  // the price label to show for a product
  label(id) {
    if (this.mode() === 'preview') return 'Free in preview';
    return 'Coming soon';
  },
  async buy(id) {
    if (!PRODUCTS[id]) throw new Error('Unknown product');
    if (this.mode() === 'preview') return { token: `preview-${id}-${Date.now()}`, preview: true };
    throw new Error('Purchases are not open yet');
  },
};
