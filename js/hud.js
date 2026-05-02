/*
 * hud.js
 *
 * Updates the DOM-based HUD overlay each frame:
 *   - five stat bars (hunger / thirst / energy / happy / clean), with the
 *     fill colors shifting toward red/orange when a stat gets low
 *   - the coin counter
 *   - the day/night tint overlay (the multiply-blended <div> behind the canvas)
 *   - the day/night and mute icon buttons
 *
 * Coin gain animation: behavior.js's addCoins() does the actual save bump
 * and audio. The visual "pop" effect (briefly scaling up the number) is
 * triggered here by toggling a CSS class on/off — `void offsetWidth` forces
 * the browser to flush style and restart the keyframes.
 */

import { save, view } from './state.js';
import { coinNum, sleepOverlay, dayBtn, muteBtn } from './canvas.js';
import { snd } from './audio.js';
import { persist } from './save.js';
import { isMinigameRunning, isMinigameOnCooldown, minigameCooldownSec } from './minigame.js';

let lastCoins = save.coins;

function clamp(v) { return Math.max(0, Math.min(100, v)); }

// As stats get low, shift the bar toward orange then red so the player sees
// at a glance which need is approaching critical. Returning null means "use
// the default color the caller passed in" (i.e. the healthy color).
function colorFor(v) {
  if (v < 25) return '#d04030';
  if (v < 50) return '#e8a040';
  return null;
}

function setBar(id, v, defaultColor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = clamp(v) + '%';
  el.style.background = colorFor(v) || defaultColor;
}

export function updateHud() {
  setBar('bar-hunger', save.stats.hunger, '#e0a040');
  setBar('bar-thirst', save.stats.thirst, '#5ab8d8');
  setBar('bar-energy', save.stats.energy, '#d8c040');
  setBar('bar-happy',  save.stats.happy,  '#7ac058');
  setBar('bar-clean',  save.stats.clean,  '#a888d8');

  // Rain button: show 🌧️ when ready, ⏳<sec> while on cooldown, disabled
  // both during a running round and during cooldown.
  const rainBtn = document.getElementById('rainBtn');
  if (rainBtn) {
    if (isMinigameRunning()) {
      rainBtn.textContent = '🌧️';
      rainBtn.disabled = true;
    } else if (isMinigameOnCooldown()) {
      rainBtn.textContent = '⏳' + minigameCooldownSec();
      rainBtn.disabled = true;
    } else {
      rainBtn.textContent = '🌧️';
      rainBtn.disabled = false;
    }
  }

  // Trigger the pop animation any time the coin count goes up.
  if (save.coins !== lastCoins) {
    coinNum.textContent = save.coins;
    if (save.coins > lastCoins) {
      coinNum.classList.remove('pop');
      // Force a reflow so the animation restarts even when re-adding the same class
      void coinNum.offsetWidth;
      coinNum.classList.add('pop');
    }
    lastCoins = save.coins;
  }
}

// ---------- Day/night tint ----------

// `dayTime` runs 0..1; we map four phases:
//   0.00–0.25  dawn  (warm pink fading to clear)
//   0.25–0.55  day   (no tint)
//   0.55–0.75  dusk  (warm orange deepening)
//   0.75–1.00  night (cool blue, getting darker)
//
// Multiply blend is applied via CSS on #sleepOverlay; this function picks
// the rgba color for that fill.
export function applyDayNight() {
  const t = view.dayTime;
  let r, g, b, a;

  if (t < 0.25) {
    const k = t / 0.25;
    r = 255 - k * 40; g = 200; b = 180 + k * 40; a = 0.32 - k * 0.32;
  } else if (t < 0.55) {
    r = 255; g = 255; b = 255; a = 0;
  } else if (t < 0.75) {
    const k = (t - 0.55) / 0.20;
    r = 255 - k * 40; g = 200 - k * 60; b = 160 - k * 40; a = k * 0.20;
  } else {
    const k = (t - 0.75) / 0.25;
    r = 80; g = 80; b = 140; a = 0.20 + k * 0.30;
  }

  sleepOverlay.style.background = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`;

  // Update the day/night button icon to roughly match where we are in the cycle.
  if (t > 0.55 && t < 0.92) {
    dayBtn.textContent = t < 0.78 ? '🌅' : '🌙';
  } else {
    dayBtn.textContent = t < 0.22 ? '🌄' : '☀️';
  }
}

// Wire up the HUD buttons. `init()` is called from main.js after the DOM is ready.
export function initHudButtons() {
  // Day/night button — advances the cycle by 25% so a curious player can
  // skip ahead to see what night looks like without waiting.
  dayBtn.addEventListener('click', () => {
    view.dayTime = (view.dayTime + 0.25) % 1;
    snd('click');
  });

  muteBtn.textContent = save.muted ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => {
    save.muted = !save.muted;
    muteBtn.textContent = save.muted ? '🔇' : '🔊';
    persist();
    snd('click'); // a quick blip if we just unmuted; nothing if we just muted (snd checks save.muted)
  });
}
