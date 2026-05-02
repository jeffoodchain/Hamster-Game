/*
 * photo.js
 *
 * Photo mode — capture the current canvas as a PNG and trigger a download.
 * Wired to the 📸 HUD button. The PNG comes out at the canvas's native
 * (DPR-scaled) resolution, so a screenshot from a 2× retina display lands
 * as a 1360×1200 image, not 680×600.
 *
 * Implementation: cv.toBlob() → Blob URL → invisible <a download>. We use
 * a Blob URL rather than a data URL so we don't pay the ~33% base64
 * overhead and so very large images don't stall the main thread on encode.
 * The URL is revoked right after click() so the browser can reclaim it.
 */

import { cv, st } from './canvas.js';
import { snd } from './audio.js';
import { bumpCounter } from './achievements.js';

export function capturePhoto() {
  // Older Safari / very obscure browsers might not have toBlob — bail out
  // silently rather than crashing.
  if (typeof cv.toBlob !== 'function') return;
  cv.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamster-game-${date}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
  snd('click');
  if (st) st.textContent = '📸 Snapshot saved!';
  // Bump counter (also auto-checks Photographer at 10).
  bumpCounter('photos');
}

export function initPhoto() {
  const btn = document.getElementById('photoBtn');
  if (btn) btn.addEventListener('click', capturePhoto);
}
