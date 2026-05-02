/*
 * layout.js
 *
 * Pure functions that return the screen-space position of each habitat
 * element as a function of the current canvas size (state.view.W/H). They
 * are functions rather than constants because the canvas is responsive —
 * positions need to recompute after every resize.
 *
 * Naming convention (matches the original prototype):
 *   FLY        floor line Y — the cage floor's top edge
 *   FBOT       floor bottom — the bottom of the bedding area
 *   GY_TOP/BOT the Y range the wandering hamster is allowed to roam in
 *   *X / *Y    centerpoint of an item (wheel, bottle, hut, basket, bin, …)
 *   *_X / *_Y  centerpoint of an interactive feature (chew log, sand bath, jar)
 *
 * Also exports `mkRng` — a small deterministic PRNG used to scatter bedding
 * and plant decorations in the same spots every time the background is
 * rebuilt. Passing the same seed gives the same layout, which keeps the
 * habitat looking stable across resizes.
 */

import { view } from './state.js';

export const FLY    = () => view.H * 0.60;
export const FBOT   = () => view.H - 18;

// Wheel
export const WCX    = () => view.W * 0.18;
export const WR     = () => Math.min(82, view.W * 0.12);
export const WCY    = () => FLY() - WR() - 2;

// Water bottle
export const BCX    = () => view.W * 0.88;
export const BCY    = () => FLY() - 72;

// Recycle / poop bin
export const BINX   = () => view.W - 54;
export const BINY   = () => view.H - 44;

// Seed basket
export const BASKX  = () => view.W * 0.30;
export const BASKY  = () => FLY() + 30;

// Sleep hut
export const HUT_X  = () => view.W * 0.72;
export const HUT_Y  = () => FLY() - 2;

// Chew log (wood block)
export const CHEW_X = () => view.W * 0.55;
export const CHEW_Y = () => FLY() - 12;

// Sand bath
export const SAND_X = () => view.W * 0.40;
export const SAND_Y = () => FLY() - 20;

// Treat jar
export const JAR_X  = () => view.W * 0.10;
export const JAR_Y  = () => FLY() - 22;

// Climbing ladder. Stands against the back wall just inside the left edge.
// LADDER_TOP is well above the floor so climbing reads as a real ascent.
export const LADDER_X      = () => view.W * 0.05;
export const LADDER_BOTTOM = () => FLY();
export const LADDER_TOP    = () => FLY() - 110;

export const feetY  = (cy) => cy + 28;     // where the hamster's feet land relative to its center
export const GY_TOP = () => FLY() + 22;
export const GY_BOT = () => FBOT() - 40;

// Tiny xorshift32 PRNG. We need *deterministic* randomness for the
// background so the same scattering of bedding strands appears each time
// buildBg() runs, even after a resize. Math.random() can't do that.
export function mkRng(seed) {
  let s = seed >>> 0;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
