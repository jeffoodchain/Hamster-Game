/*
 * firstrun.js
 *
 * A short onboarding panel for fresh players. The first time someone enters
 * the play screen *and* the save shows no prior interactions, we slide a
 * panel of three or four short tips into view: how to feed, how to pet,
 * what the wheel does. Returning players never see it again.
 *
 * "Fresh" is detected from the same data the achievements layer is keeping
 * for us — if no achievements have unlocked and no counters have ticked,
 * this is somebody's first time. That's a more reliable signal than a
 * dedicated "have I shown the tutorial" flag (which would need its own
 * migration).
 *
 * Dismissal: explicit click on the button, click anywhere on the dimmed
 * backdrop, or after first real action (poll-based — see maybeDismiss).
 */

import { save } from './state.js';

let dismissed = false;

function isFreshSave() {
  if (dismissed) return false;
  // No achievements unlocked yet…
  const achKeys = save.achievements ? Object.keys(save.achievements) : [];
  if (achKeys.length > 0) return false;
  // …and no counter has been bumped.
  const c = save.counters || {};
  const sum = (c.wheelRuns || 0) + (c.cleaned || 0) + (c.pets || 0);
  return sum === 0;
}

function dismiss() {
  const overlay = document.getElementById('firstRunOverlay');
  if (overlay) overlay.classList.remove('show');
  dismissed = true;
}

// Called from input.js right after a fresh player clicks Play.
export function maybeShowFirstRun() {
  if (!isFreshSave()) return;
  const overlay = document.getElementById('firstRunOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  // Backdrop click closes the overlay; clicks on the inner box don't bubble
  // because of stopPropagation in initFirstRun.
  overlay.addEventListener('click', dismiss, { once: true });
}

// Called once per second from the main loop (cheap), so as soon as the
// player makes their first interaction (which bumps a counter or unlocks
// an achievement) the overlay closes itself.
export function autoDismissIfStale() {
  if (dismissed) return;
  if (!isFreshSave()) dismiss();
}

export function initFirstRun() {
  const overlay = document.getElementById('firstRunOverlay');
  const okBtn = document.getElementById('firstRunOk');
  if (okBtn) okBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });
  if (overlay) {
    // Stop clicks inside the inner box from bubbling to the backdrop handler.
    const box = overlay.querySelector('.firstRunBox');
    if (box) box.addEventListener('click', (e) => e.stopPropagation());
  }
}
