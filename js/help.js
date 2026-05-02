/*
 * help.js
 *
 * In-game Help / How-to-Play modal. Surfaces the full inventory of features
 * the game has accumulated into one scrollable list — useful for players
 * coming back after a break, or who never noticed a feature in the first
 * place. Also lists the keyboard shortcuts that aren't visible anywhere
 * else.
 *
 * Reached via the 📖 button at the bottom of the stats panel — the modal
 * stack rather than the HUD, since it's reference material rather than
 * an in-the-moment action.
 *
 * Hosts the **Reset save** escape hatch as well. Reset is deliberately
 * high-friction: native confirm() (intentionally jarring), an explicit
 * warning about everything that's lost, then a hard reload so every
 * module re-initialises from a clean DEFAULT_SAVE.
 */

import { snd } from './audio.js';
import { SAVE_KEY } from './config.js';

function resetSaveData() {
  const ok = confirm(
    'Reset all hamster game progress?\n\n' +
    'This erases coins, achievements, themes, costumes, treats tried, ' +
    'stats, and the daily streak. The current play session ends.\n\n' +
    'This cannot be undone.'
  );
  if (!ok) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (_e) { /* private mode etc. */ }
  // Hard reload — cleanest way to reset every cached module state.
  location.reload();
}

function openHelp() {
  const m = document.getElementById('helpModal');
  if (m) m.classList.add('show');
  snd('click');
}

function closeHelp() {
  const m = document.getElementById('helpModal');
  if (m) m.classList.remove('show');
}

export function initHelp() {
  const helpBtn  = document.getElementById('helpBtn');
  const closeBtn = document.getElementById('closeHelp');
  const modal    = document.getElementById('helpModal');
  const resetBtn = document.getElementById('resetSaveBtn');

  if (helpBtn)  helpBtn.addEventListener('click', openHelp);
  if (closeBtn) closeBtn.addEventListener('click', () => { closeHelp(); snd('click'); });
  if (modal) {
    // Click on the backdrop closes; clicks inside the box don't bubble out.
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHelp();
    });
  }
  if (resetBtn) resetBtn.addEventListener('click', resetSaveData);
}
