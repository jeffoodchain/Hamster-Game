/*
 * state.js
 *
 * Single source of truth for all *mutable* runtime state. Each export is a
 * plain object that other modules import by reference and mutate directly —
 * since ES module bindings share the same object identity, a write here is
 * visible everywhere.
 *
 * State is grouped by concern:
 *   view     — rendering surface dimensions and screen mode
 *   ham      — the hamster's motion, animation, and current "mode" (state machine)
 *   ball     — bouncy ball physics and drag state
 *   drag     — pointer-driven seed-drag interaction
 *   entities — collections of small things (poops, particles, basket seeds…)
 *   save     — the slice that gets persisted to localStorage (see save.js)
 *
 * `save` lives here, not in save.js, because it is the thing being saved —
 * save.js is just I/O against this object.
 */

import { DEFAULT_SAVE } from './config.js';

export const view = {
  W: 680,                // logical canvas width  (CSS pixels)
  H: 600,                // logical canvas height (CSS pixels)
  gameScreen: 'select',  // 'select' (picker) | 'game' (playing)
  isFullscreen: false,
  frame: 0,              // ticks since the play screen started
  dayTime: 0.3,          // 0..1 fraction of the day cycle (0 = sunrise)
  selHover: -1,          // hovered card index on the select screen, -1 = none
};

// All hamster-related runtime state. The `mode` field is the central state
// machine — see behavior.js for the transitions and what each mode means.
export const ham = {
  mode: 'wander',
  x: 0, y: 0,         // logical position
  vx: 0.8, vy: 0.3,   // wander velocity
  dir: 1,             // facing: 1 = right, -1 = left
  tgt: 0,             // wander heading angle in radians (re-randomized periodically)
  timer: 120,         // frames until next wander re-target / mode timeout
  speed: 1.1,
  bob: 0, leg: 0,     // animation phases
  blink: false, blinkT: 90,
  cheek: 0, cheekD: 1,

  // Wheel run
  runSpd: 0, runTgt: 0, wTimer: 0,
  wAngle: 0,           // wheel rotation, persists between runs

  // Generic source-position lerp (climbing, ball, chew, bath, treat all reuse these)
  csx: 0, csy: 0,
  climbT: 0,           // climbing/descending the wheel
  toBallT: 0,          // shared "walking toward target" interpolator

  // Drink
  dsx: 0, dsy: 0, drnkT: 0, dframes: 0,

  // Eat
  eatTimer: 0,

  // Hut / nap
  toHutT: 0, fromHutT: 0, hutSX: 0, hutSY: 0,
  napTimer: 0, napDuration: 0, nextNap: 0,

  // Toy/activity timers (used by the matching modes — ballPlayT for 'playball', etc.)
  ballPlayT: 0, chewT: 0, sandT: 0, treatT: 0,

  // Ladder modes (climbingLadder / onLadder / slidingDown):
  //   ladderT      — 0..1 fraction up the ladder (used by climb and slide)
  //   ladderY      — current world Y on the ladder, derived from ladderT each frame
  //   ladderTimer  — how long the perch at the top lasts before sliding down
  ladderT: 0, ladderY: 0, ladderTimer: 0,

  // Idle micro-animations (mode='idle' — see behavior.js's startIdle).
  // idleType selects the animation: 'yawn' / 'stretch' / 'lookAround'.
  // idleScale is a runtime multiplier applied to the body scale during
  // 'stretch' (1.0 the rest of the time).
  idleType: null, idleTimer: 0, nextIdle: 600, idleScale: 1,

  // Reactive-feedback timers (decremented per frame; >0 = effect active):
  //   excitedT  — short "!" bubble overlay shown when a seed is dropped on
  //               the hamster, just before the eating animation starts
  //   happyHopT — brief vertical-hop bob applied during wander when the
  //               happiness stat is high — a "good mood" tell
  excitedT: 0, happyHopT: 0,

  // Set true by achievements.js's unlock() and consumed at the next tick.
  // Decoupling via a flag keeps achievements.js out of the behavior.js
  // import cycle (it can't call hamPos directly without circular issues).
  celebrationPending: false,

  // Autonomy
  nextBehavior: 300,
};

// Bouncy ball — purchased via the shop. `active` mirrors save.owned.ball at
// reset; it's duplicated here so the toggle is cheap to read in the draw loop.
export const ball = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  spin: 0,
  active: false,
  dragging: false,
  dragOffX: 0, dragOffY: 0,  // pointer offset when the drag started
  lastX: 0, lastY: 0,        // previous pointer pos, used to derive a fling velocity on release
};

// Active seed drag. `treatType` is set when a treat is dragged (jarTreat=true)
// rather than a basket seed.
export const drag = {
  active: false,
  seedIdx: -1,
  jarTreat: false,
  treatType: '',
  x: 0, y: 0,
  type: '',
  angle: 0,
};

export const entities = {
  poops: [],         // [{x, y, pellets, age}]
  flyingPoops: [],   // mid-arc into the bin after a click
  flyingItems: [],   // sunflower shells flying into the bin
  shells: [],        // dropped sunflower shells on the ground
  hearts: [],        // pet/treat hearts
  sparkles: [],      // crunch / bath sparkles
  coinFlies: [],     // "+N💰" floating-text rewards
  basketSeeds: [],   // current seeds visible in the basket
  poopTick: 0,       // counter that triggers automatic poop spawns
  binCount: 0,       // total cleaned this play session (display only)
};

// `save` starts as a deep copy of DEFAULT_SAVE so missing keys in an older
// stored save get filled in automatically when save.js merges on load.
export const save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
