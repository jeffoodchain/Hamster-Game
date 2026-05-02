/*
 * music.js
 *
 * Plays two looping background tracks (day + night) and crossfades
 * between them based on view.dayTime. Both tracks are CC-BY 4.0 by
 * Kevin MacLeod (https://incompetech.com) — see ATTRIBUTION.md and the
 * in-game Help modal for full credit.
 *
 * Tracks:
 *   music/day.mp3   — "Fluffing a Duck" (lively / cute)
 *   music/night.mp3 — "Carefree"        (calmer / dreamy)
 *
 * Implementation notes:
 *   - Uses plain HTMLAudioElement (no Web Audio routing) so the browser
 *     handles decoding and looping. This keeps the code simple at the
 *     cost of giving us slightly less control than Web Audio nodes.
 *   - Volume crossfade is a per-call lerp toward the target weight.
 *     updateMusic() runs ~4×/sec, lerp 0.1 → settles smoothly in ~1s.
 *   - tryInit() defers Audio() construction until isAudioReady() is true
 *     (i.e. after the user's first click) so the first .play() call
 *     succeeds without a "user gesture required" error.
 *   - Mute and "leave the play screen" both lerp volumes to 0; the
 *     <audio> elements keep playing silently so re-entry is seamless.
 *
 * Bonus environmental sound: an occasional water-bottle drip
 * (~once per minute random), generated via Web Audio so it doesn't
 * compete with the looping MP3s for AudioElement bandwidth.
 */

import { view, save } from './state.js';
import { getAudioContext, isAudioReady } from './audio.js';

// Master music volume — under 1 because MP3s are mastered loud and we
// want them to sit under sound effects.
const MUSIC_MAX_VOLUME = 0.32;

let dayAudio = null;
let nightAudio = null;
let initialized = false;

function tryInit() {
  if (initialized) return true;
  // Defer until the AudioContext has been unlocked by a user gesture —
  // browsers also block <audio>.play() before that. isAudioReady() is
  // our signal that the gesture has happened.
  if (!isAudioReady()) return false;

  dayAudio = new Audio('music/day.mp3');
  dayAudio.loop = true;
  dayAudio.volume = 0;
  dayAudio.preload = 'auto';

  nightAudio = new Audio('music/night.mp3');
  nightAudio.loop = true;
  nightAudio.volume = 0;
  nightAudio.preload = 'auto';

  // Begin playback silent. If the browser still rejects (rare after a
  // click), we just swallow the error — the next updateMusic call will
  // re-attempt via the same path.
  dayAudio.play().catch(() => {});
  nightAudio.play().catch(() => {});

  initialized = true;
  return true;
}

// Per-frame crossfade weight in [0, 1] based on view.dayTime, matching
// the visual day/night phase boundaries used by hud.js.
function dayNightWeights() {
  const t = view.dayTime;
  if (t < 0.20)      { const k = t / 0.20;          return [k,        1 - k]; }
  if (t < 0.55)      {                              return [1,        0    ]; }
  if (t < 0.78)      { const k = (t - 0.55) / 0.23; return [1 - k,    k    ]; }
                       return [0, 1];
}

export function updateMusic() {
  if (!tryInit()) return;

  const inGame = view.gameScreen === 'game' && !save.muted;
  const [dayW, nightW] = dayNightWeights();

  // Lerp the volumes toward their targets each call. With ~4 calls/sec
  // and lerp 0.1, the volume settles in roughly one second — enough to
  // avoid audible level pops without feeling sluggish.
  const lerp = 0.10;
  const dayTarget   = inGame ? dayW   * MUSIC_MAX_VOLUME : 0;
  const nightTarget = inGame ? nightW * MUSIC_MAX_VOLUME : 0;
  if (dayAudio)   dayAudio.volume   += (dayTarget   - dayAudio.volume)   * lerp;
  if (nightAudio) nightAudio.volume += (nightTarget - nightAudio.volume) * lerp;

  if (inGame) maybeDrip();
}

// Called from input.js when the player hits "Change Hamster" — explicit
// fade so the music doesn't keep playing under the picker. The audio
// element keeps looping silently so coming back is seamless.
export function fadeOutMusic() {
  if (dayAudio)   dayAudio.volume   = 0;
  if (nightAudio) nightAudio.volume = 0;
}

// ---------- Environmental drip ----------

let nextDripFrame = 600 + Math.floor(Math.random() * 1800);
function maybeDrip() {
  if (save.muted) return;
  if (view.frame < nextDripFrame) return;
  nextDripFrame = view.frame + 600 + Math.floor(Math.random() * 1800);

  const ctx = getAudioContext();
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  const t = ctx.currentTime;
  // Pitch drops from ~900Hz to ~400Hz over a tenth of a second — that's
  // the signature shape of a water drop. Quiet so it sits under the music.
  o.type = 'sine';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  g.gain.setValueAtTime(0.035, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.22);
}
