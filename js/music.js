/*
 * music.js
 *
 * Cheerful procedural background music. A bouncy 16th-note arpeggio plays
 * the current chord on top of a light bass pulse and a quiet pad bed —
 * the result is closer to a music box / kawaii chiptune than the original
 * ambient drone.
 *
 * Architecture:
 *   - Beat scheduler runs in updateMusic() (called ~4×/sec from main.js).
 *     We schedule notes ahead of audioCtx.currentTime by `lookahead` so
 *     small JavaScript timing jitter doesn't show up as audible swing.
 *   - Each note is a short pluck (attack 5ms, decay 250ms) on a square
 *     oscillator, lowpass-filtered. Cheap, bright, distinctive.
 *   - The chord rotates every 4 bars (~6 seconds) and the day/night swap
 *     simply switches between two chord progressions.
 *
 * Mute and "leave the play screen" both ramp `masterGain` to zero — the
 * scheduler keeps running but is silent, so unmuting / re-entering the
 * game picks up exactly where we left off without restarting the loop.
 *
 * Bonus environmental sound: an occasional water-bottle drip to remind
 * the player the world is alive (~once per minute random).
 */

import { view, save } from './state.js';
import { getAudioContext, isAudioReady } from './audio.js';

// ---------- Songs ----------

// Day mode: I → IV → V → I in C major (bright, classic kid-music feel).
// Each chord is [bass, then a 6-note arpeggio pattern in mid-range].
// Bass note uses a softer triangle wave; arpeggio notes are bright squares.
const DAY_PROGRESSION = [
  { bass: 130.81, arp: [261.63, 329.63, 392.00, 329.63, 392.00, 523.25] }, // C
  { bass: 174.61, arp: [349.23, 440.00, 523.25, 440.00, 523.25, 698.46] }, // F
  { bass: 196.00, arp: [392.00, 493.88, 587.33, 493.88, 587.33, 783.99] }, // G
  { bass: 130.81, arp: [261.63, 329.63, 392.00, 329.63, 523.25, 392.00] }, // C (with twist)
];

// Night mode: minor-key but still pluckily lively — a little cooler but
// not gloomy. vi → IV → I → V relative to C (so Am → F → C → G).
const NIGHT_PROGRESSION = [
  { bass: 110.00, arp: [220.00, 261.63, 329.63, 261.63, 329.63, 440.00] }, // Am
  { bass: 174.61, arp: [349.23, 440.00, 523.25, 440.00, 523.25, 698.46] }, // F
  { bass: 130.81, arp: [261.63, 329.63, 392.00, 329.63, 392.00, 523.25] }, // C
  { bass: 196.00, arp: [392.00, 493.88, 587.33, 493.88, 587.33, 783.99] }, // G
];

// Tempo: 16th notes at ~108 BPM = a 16th every 0.139s. Tuned to feel
// brisk-cute rather than rushed.
const SIXTEENTH_SEC = 60 / 108 / 4;

// Each chord holds for one bar = 16 sixteenths. Six arpeggio notes get
// stretched across the bar's first 12 sixteenths; the rest is rest.
const STEPS_PER_BAR = 16;

// ---------- State ----------

let masterGain = null;
let bedGain    = null; // a soft sustained pad under everything
let initialized = false;
let nextNoteAt = 0;       // audioCtx time of the next 16th
let stepIdx = 0;          // 0..15 within the current bar
let chordIdx = 0;         // index into the active progression
let bedFilter = null;
let bedOsc1 = null, bedOsc2 = null;

// ---------- Building blocks ----------

// One short pluck: square osc → lowpass → gain envelope → masterGain.
// `when` is the AudioContext time to play the note at.
function pluck(ctx, freq, when, level = 0.18, duration = 0.28) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, when);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, when);
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  // Quick attack, exponential decay → that pluck/music-box sound.
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

// Soft bass note — triangle wave, longer envelope, lower level. Plays
// once per bar on beat 1.
function bassNote(ctx, freq, when, duration = 0.45) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, when);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.18, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

// Quiet sustained pad bed — two detuned sines through a lowpass — adds
// just enough harmonic glue under the plucks so silence between notes
// doesn't feel empty. Volume is intentionally tiny.
function buildBed(ctx) {
  bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = 1100;
  bedFilter.Q.value = 0.6;
  bedGain = ctx.createGain();
  bedGain.gain.value = 0.04;
  bedFilter.connect(bedGain);
  bedGain.connect(masterGain);
  bedOsc1 = ctx.createOscillator();
  bedOsc2 = ctx.createOscillator();
  bedOsc1.type = 'sine';
  bedOsc2.type = 'sine';
  bedOsc1.frequency.value = 261.63; // C4 — overwritten on each chord change
  bedOsc2.frequency.value = 392.00; // G4
  bedOsc1.detune.value = -6;
  bedOsc2.detune.value =  6;
  bedOsc1.connect(bedFilter);
  bedOsc2.connect(bedFilter);
  bedOsc1.start();
  bedOsc2.start();
}

function setBedChord(ctx, chord) {
  if (!bedOsc1 || !bedOsc2) return;
  const t = ctx.currentTime;
  // Glide for 0.4s so the bed slides between chords smoothly rather
  // than chunking through them.
  bedOsc1.frequency.cancelScheduledValues(t);
  bedOsc2.frequency.cancelScheduledValues(t);
  bedOsc1.frequency.linearRampToValueAtTime(chord.arp[0], t + 0.4);
  bedOsc2.frequency.linearRampToValueAtTime(chord.arp[2], t + 0.4);
}

// ---------- Init ----------

function tryInit() {
  if (initialized) return true;
  if (!isAudioReady()) return false;
  const ctx = getAudioContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.0;
  masterGain.connect(ctx.destination);
  buildBed(ctx);
  // Fade master in over 2s — the music sneaks up rather than slamming on.
  masterGain.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 2.0);
  // Schedule the first note slightly into the future so we don't miss it
  // while the AudioContext is still spinning up.
  nextNoteAt = ctx.currentTime + 0.1;
  initialized = true;
  return true;
}

// ---------- Per-frame scheduling ----------

// Pick the right progression based on time of day. The split lines up
// with the visual day/night transitions so the music shifts when the
// lighting does.
function activeProgression() {
  const t = view.dayTime;
  return (t < 0.20 || t >= 0.78) ? NIGHT_PROGRESSION : DAY_PROGRESSION;
}

export function updateMusic() {
  if (!tryInit()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Out-of-game (or muted): silence the master, pause scheduling. The
  // gradient + audioCtx state stays so unmuting / coming back is instant.
  const inGame = view.gameScreen === 'game' && !save.muted;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.linearRampToValueAtTime(inGame ? 0.55 : 0, now + 0.3);
  if (!inGame) return;

  // Schedule any 16th notes that are due in the next ~0.5s. We loop
  // because updateMusic might fire less often than the 16th rate during
  // tab-throttled background frames.
  const lookahead = 0.45;
  const prog = activeProgression();
  while (nextNoteAt < now + lookahead) {
    const chord = prog[chordIdx % prog.length];
    // Beat 0 of each bar — fire the bass note + glide the bed.
    if (stepIdx === 0) {
      bassNote(ctx, chord.bass, nextNoteAt);
      setBedChord(ctx, chord);
    }
    // Arpeggio occupies the first 12 sixteenths of the bar (steps 0-11).
    if (stepIdx < chord.arp.length * 2) {
      // Each arpeggio note plays for two 16ths so it has a tiny breath.
      // Indexing every other 16th means we still hit 6 distinct notes
      // across 12 steps, then the last 4 steps rest = a "lift" before
      // the next bar.
      if (stepIdx % 2 === 0) {
        const noteIdx = stepIdx / 2;
        pluck(ctx, chord.arp[noteIdx], nextNoteAt);
      }
    }
    nextNoteAt += SIXTEENTH_SEC;
    stepIdx++;
    if (stepIdx >= STEPS_PER_BAR) {
      stepIdx = 0;
      chordIdx++;
    }
  }

  maybeDrip();
}

// ---------- Stop on screen change ----------

// Called from input.js when the player hits "Change Hamster" so the music
// doesn't keep playing under the picker. The scheduler is gated by
// inGame above; this is the explicit fade-down trigger.
export function fadeOutMusic() {
  if (!initialized) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.linearRampToValueAtTime(0, t + 0.6);
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
  // the signature shape of a water drop. Quiet so it sits below the music.
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
