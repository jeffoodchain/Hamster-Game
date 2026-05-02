/*
 * music.js
 *
 * Procedural ambient background music. Two synthesized pads play in
 * parallel — one warmer "day" pad in a major key, one cooler "night" pad
 * in a minor key — and their gain envelopes are crossfaded based on
 * view.dayTime. The same chord changes every ~12 seconds, so the texture
 * doesn't feel static even though no individual oscillator ever stops.
 *
 * Architecture per pad:
 *
 *   osc1..oscN ──► oscGain ──► filter (lowpass, Q≈1.2) ──► padGain ─┐
 *      (slight detune)         ▲                                    │
 *                              │ (LFO depth)                        ▼
 *                              └── LFO osc                       masterGain ──► destination
 *
 *   - osc1 is a triangle wave (root) for body; the rest are sines.
 *   - The LFO modulates the filter cutoff so the pad slowly "breathes".
 *   - padGain is the crossfade lever (set by updateMusic).
 *   - masterGain sets the overall music level and ramps up gently on init
 *     so the player isn't startled by a hard start.
 *
 * Initialization is deferred until the AudioContext is unlocked (after the
 * first user gesture — browsers reject earlier creation). Once initialized
 * the oscillators run for the lifetime of the page; only gain values change.
 *
 * Mute: respects save.muted. When muted we ramp both pads' gain to 0 over
 * 0.6s and keep them there until unmuted.
 *
 * Bonus environmental sound: an occasional water-bottle drip to remind the
 * player the world is alive. Uses the same AudioContext, fires at a low
 * random rate (~once per minute on average).
 */

import { view, save } from './state.js';
import { getAudioContext, isAudioReady } from './audio.js';

// Chord cycles. Each entry is the four notes (Hz) the four oscillators of a
// pad will hold. Day cycles through warm major chords; night cycles through
// minor / suspended ones.
const DAY_CHORDS = [
  [261.63, 329.63, 392.00, 523.25], // C  E  G  C   (Cmaj)
  [349.23, 440.00, 523.25, 698.46], // F  A  C  F   (Fmaj)
  [293.66, 369.99, 440.00, 587.33], // D  F# A  D   (Dmaj — bright lift)
];
const NIGHT_CHORDS = [
  [220.00, 261.63, 329.63, 440.00], // A  C  E  A   (Am)
  [196.00, 246.94, 293.66, 392.00], // G  B  D  G   (Gmaj — dreamy resolution)
  [174.61, 220.00, 261.63, 349.23], // F  A  C  F   (Fmaj — warm lower register)
];

let masterGain = null;
let dayPad = null, nightPad = null;
let initialized = false;
let lastChordFrame = 0;
let dayIdx = 0, nightIdx = 0;

// Build one pad. Returns the handles updateMusic / setChord need to talk
// to it later. Filter cutoff and LFO rate distinguish day (bright, faster
// breathing) from night (dull, slower).
function makePad(ctx, freqs, filterCutoff, lfoRate) {
  const padOut = ctx.createGain();
  padOut.gain.value = 0; // silent until the crossfade ramps it up

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterCutoff;
  filter.Q.value = 1.2;
  filter.connect(padOut);

  const oscs = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    // Root gets a triangle wave (more harmonic content → "thicker"); upper
    // voices stay as sines so the chord doesn't get muddy.
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.value = f;
    // Tiny per-voice detune so the chord chorusses gently instead of
    // sounding mathematically perfect.
    osc.detune.value = (Math.random() - 0.5) * 12;
    const oscG = ctx.createGain();
    oscG.gain.value = (i === 0 ? 0.42 : 0.22) / freqs.length;
    osc.connect(oscG);
    oscG.connect(filter);
    osc.start();
    return { osc, gain: oscG };
  });

  // Slow LFO on the filter cutoff. Depth is a fraction of the base cutoff
  // so the pad shimmers without ever turning fully closed/open.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = lfoRate;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = filterCutoff * 0.35;
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.frequency);
  lfo.start();

  return { padOut, oscs };
}

function setChord(pad, chord) {
  if (!pad) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  pad.oscs.forEach((entry, i) => {
    const target = chord[i] !== undefined ? chord[i] : chord[chord.length - 1];
    entry.osc.frequency.cancelScheduledValues(t);
    // 2-second slide between chords so transitions feel like one breath
    // morphing into another rather than a hard cut.
    entry.osc.frequency.linearRampToValueAtTime(target, t + 2.0);
  });
}

function tryInit() {
  if (initialized) return true;
  if (!isAudioReady()) return false;
  const ctx = getAudioContext();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.0;
  masterGain.connect(ctx.destination);

  dayPad   = makePad(ctx, DAY_CHORDS[0],   1500, 0.06);
  nightPad = makePad(ctx, NIGHT_CHORDS[0],  700, 0.035);
  dayPad.padOut.connect(masterGain);
  nightPad.padOut.connect(masterGain);

  // Fade master in over 3s so the music sneaks up on the player rather
  // than slamming on at full volume.
  masterGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 3.0);

  initialized = true;
  return true;
}

// Called from main.js's loop. Decides the pad-crossfade weights from
// view.dayTime (matching the visual day/night phases set in hud.js) and
// rotates the chord every ~12 seconds.
export function updateMusic() {
  // Music only matters in the play screen — the picker is silent.
  if (view.gameScreen !== 'game') return;
  if (!tryInit()) return;

  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const dt = view.dayTime;

  // Same dayTime regions used for the visual overlay in hud.js, mapped
  // to a 0..1 weight per pad.
  let dayWeight, nightWeight;
  if (dt < 0.20) {
    const k = dt / 0.20;
    dayWeight = k; nightWeight = 1 - k;
  } else if (dt < 0.55) {
    dayWeight = 1; nightWeight = 0;
  } else if (dt < 0.78) {
    const k = (dt - 0.55) / 0.23;
    dayWeight = 1 - k; nightWeight = k;
  } else {
    dayWeight = 0; nightWeight = 1;
  }

  // Mute kills both pads. The 0.6s ramp keeps the (un)mute from clicking.
  const muteFactor = save.muted ? 0 : 1;
  dayPad.padOut.gain.cancelScheduledValues(t);
  nightPad.padOut.gain.cancelScheduledValues(t);
  dayPad.padOut.gain.linearRampToValueAtTime(dayWeight   * muteFactor, t + 0.6);
  nightPad.padOut.gain.linearRampToValueAtTime(nightWeight * muteFactor, t + 0.6);

  // Chord rotation. ~12 seconds at 60fps = 720 frames. Using absolute
  // frame numbers (not a counter) means rate-limiting updateMusic() to
  // every Nth frame doesn't drift the schedule.
  if (view.frame - lastChordFrame >= 720) {
    lastChordFrame = view.frame;
    dayIdx   = (dayIdx   + 1) % DAY_CHORDS.length;
    nightIdx = (nightIdx + 1) % NIGHT_CHORDS.length;
    setChord(dayPad,   DAY_CHORDS[dayIdx]);
    setChord(nightPad, NIGHT_CHORDS[nightIdx]);
  }

  maybeDrip();
}

// Ramp both pads down to silent. Called when the player leaves the play
// screen so the music doesn't keep humming under the picker.
export function fadeOutMusic() {
  if (!initialized) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  dayPad.padOut.gain.cancelScheduledValues(t);
  nightPad.padOut.gain.cancelScheduledValues(t);
  dayPad.padOut.gain.linearRampToValueAtTime(0, t + 0.8);
  nightPad.padOut.gain.linearRampToValueAtTime(0, t + 0.8);
}

// ---------- Environmental drip ----------

let nextDripFrame = 600 + Math.floor(Math.random() * 1800);
function maybeDrip() {
  if (save.muted) return;
  if (view.frame < nextDripFrame) return;
  // Schedule the next one randomly between ~10s and ~40s away so the drip
  // doesn't fall into a predictable rhythm.
  nextDripFrame = view.frame + 600 + Math.floor(Math.random() * 1800);

  const ctx = getAudioContext();
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  const t = ctx.currentTime;
  // Pitch drops from ~900Hz to ~400Hz over a tenth of a second — that's the
  // signature shape of a water drop. Quiet so it sits below the music.
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
