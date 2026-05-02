/*
 * canvas.js
 *
 * Owns the DOM references that everyone else needs: the main canvas and its
 * 2D context, the offscreen background canvas, and every overlay element.
 * Also handles two cross-cutting concerns:
 *
 *   1. DPR-aware sizing. The canvas's pixel buffer is sized to
 *      W * devicePixelRatio so drawings are crisp on retina displays.
 *      A matching ctx.setTransform(dpr,0,0,dpr,0,0) means the rest of the
 *      codebase can keep working in CSS-pixel ("logical") coordinates.
 *
 *   2. Fullscreen toggling. On desktop we use the standard Fullscreen API;
 *      on mobile we instead force the container to viewport-fill and try to
 *      lock to landscape, since iOS doesn't honour requestFullscreen on
 *      arbitrary elements.
 *
 * `onResize` is the hook other modules (e.g. background) register to rebuild
 * cached rasters when the canvas changes size.
 */

import { view } from './state.js';

export const cv         = document.getElementById('hc');
export const ct         = cv.getContext('2d');
export const st         = document.getElementById('hst');
export const backBtn    = document.getElementById('backBtn');
export const fullscreenBtn = document.getElementById('fullscreenBtn');
export const container  = document.getElementById('gameContainer');
export const hud        = document.getElementById('hud');
export const shopBtn    = document.getElementById('shopBtn');
export const shopModal  = document.getElementById('shopModal');
export const closeShop  = document.getElementById('closeShop');
export const shopGrid   = document.getElementById('shopGrid');
export const dayBtn     = document.getElementById('dayBtn');
export const muteBtn    = document.getElementById('muteBtn');
export const coinNum    = document.getElementById('coinNum');
export const sleepOverlay = document.getElementById('sleepOverlay');

// Offscreen canvas that holds the static habitat background. Re-rasterized
// only on resize/screen-change, then blitted each frame in main.js's draw().
export const bgCv = document.createElement('canvas');

// Modules that need to react to resize (e.g. rebuild the background) push a
// callback into here. We use a list rather than CustomEvent so the callbacks
// can run synchronously inside resize() before the next frame paints.
const resizeListeners = [];
export function onResize(fn) { resizeListeners.push(fn); }

export function resize() {
  const r = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  view.W = Math.round(r.width)  || 680;
  view.H = Math.round(r.height) || 600;
  // Buffer is in *device* pixels; the CSS-level size stays at W×H thanks to
  // the canvas's `width:100%; height:100%` styling. We then scale the context
  // so all drawing code keeps using logical pixels.
  cv.width  = view.W * dpr;
  cv.height = view.H * dpr;
  ct.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const fn of resizeListeners) fn();
}

window.addEventListener('resize', resize);

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768;
}

// Mobile path: blow up the container to fill the viewport and ask the OS for
// landscape. This bypasses the (unreliable on iOS) Fullscreen API entirely.
function enterLandscapeFullscreen() {
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.zIndex = '9999';
  container.style.borderRadius = '0';
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => { /* not granted — keep going anyway */ });
  }
  view.isFullscreen = true;
  fullscreenBtn.textContent = '✕';
  // Defer resize until after the layout settles, otherwise getBoundingClientRect
  // can return stale dimensions.
  setTimeout(resize, 200);
}

function exitLandscapeFullscreen() {
  container.style.position = 'relative';
  container.style.top = '';
  container.style.left = '';
  container.style.width = '100%';
  container.style.height = '600px';
  container.style.zIndex = '';
  container.style.borderRadius = '16px';
  if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  view.isFullscreen = false;
  fullscreenBtn.textContent = '⛶';
  setTimeout(resize, 200);
}

fullscreenBtn.addEventListener('click', () => {
  if (view.isFullscreen) { exitLandscapeFullscreen(); return; }
  if (isMobileDevice()) {
    enterLandscapeFullscreen();
  } else if (container.requestFullscreen) {
    // Fall back to the manual approach if the browser refuses.
    container.requestFullscreen().catch(enterLandscapeFullscreen);
  } else {
    enterLandscapeFullscreen();
  }
});
