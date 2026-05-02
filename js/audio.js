/*
 * audio.js
 *
 * Tiny Web Audio sound engine. All sounds are synthesized on the fly from
 * short oscillator+gain envelopes — no audio files to load. This keeps the
 * project a single deployable artifact and gives us per-sound parameter
 * control without an asset pipeline.
 *
 * The AudioContext is created lazily (browsers block creation until a user
 * gesture). `ensureAudio()` is called from input handlers so the first click
 * unlocks audio.
 *
 * `snd(name)` is the public API the rest of the game uses. Add a new sound
 * by extending the switch in snd().
 */

import { save } from './state.js';

let audioCtx = null;

// Lazy-create the AudioContext on first user gesture (browsers refuse
// earlier). Also resume if a previously-created context was suspended —
// some browsers auto-suspend on tab visibility changes.
export function ensureAudio() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Shared accessors for other audio-producing modules (music.js).
export function getAudioContext() { return audioCtx; }
export function isAudioReady() { return !!audioCtx && audioCtx.state === 'running'; }

// Short tone with an exponential gain decay. Defaults are tuned for "blip":
// loud at the start, fast tail, low overall volume so layered sounds don't clip.
function tone(freq, dur, type, vol) {
  if (save.muted) return;
  ensureAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const t = audioCtx.currentTime;
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol || 0.05, t);
  // exponentialRampToValueAtTime can't ramp to 0, so we ramp to a near-zero floor.
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export function snd(name) {
  switch (name) {
    case 'click':   tone(640, 0.04, 'square', 0.04); break;
    // Two-note rising chime for affection.
    case 'heart':   tone(900, 0.10, 'sine', 0.05); setTimeout(() => tone(1300, 0.10, 'sine', 0.04), 80); break;
    case 'coin':    tone(1100, 0.06, 'square', 0.05); setTimeout(() => tone(1500, 0.10, 'square', 0.04), 60); break;
    // Random pitch jitter prevents repeated nibbles from sounding mechanical.
    case 'eat':     tone(280 + Math.random() * 60, 0.05, 'sawtooth', 0.04); break;
    case 'drink':   tone(420, 0.08, 'triangle', 0.04); break;
    case 'squeak':  tone(1700, 0.04, 'sine', 0.025); break;
    case 'splash':  tone(540, 0.10, 'sine', 0.05); setTimeout(() => tone(720, 0.08, 'sine', 0.04), 60); break;
    // Three-note fanfare for completed purchases / unlocks.
    case 'buy':     tone(700, 0.06, 'square', 0.04);
                    setTimeout(() => tone(900, 0.06, 'square', 0.04), 70);
                    setTimeout(() => tone(1300, 0.12, 'square', 0.04), 140);
                    break;
    // Low buzz for "you can't afford that".
    case 'reject':  tone(160, 0.18, 'sawtooth', 0.04); break;
    case 'roll':    tone(220 + Math.random() * 80, 0.04, 'sine', 0.025); break;
  }
}
