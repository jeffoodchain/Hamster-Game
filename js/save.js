/*
 * save.js
 *
 * Persistence layer for the `save` slice in state.js. Two functions:
 *   loadSave()  — reads from localStorage on boot and merges into state.save,
 *                 keeping default values for any keys the stored save lacks.
 *   persist()   — writes the current state.save back. Called sparingly
 *                 (after coin gains, purchases, etc.) and as a periodic
 *                 autosave from the main tick loop.
 *
 * Both functions swallow exceptions: if localStorage is disabled or the data
 * is corrupt, the game should still play (just without persistence) rather
 * than crash on boot.
 */

import { SAVE_KEY, DEFAULT_SAVE } from './config.js';
import { save } from './state.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Only copy keys that DEFAULT_SAVE knows about — this guards against
    // accidentally introducing arbitrary fields from a tampered save and
    // keeps the shape predictable for the rest of the codebase.
    for (const key of Object.keys(DEFAULT_SAVE)) {
      if (parsed[key] !== undefined) save[key] = parsed[key];
    }
    // Ensure nested objects are present even if an older save predates them.
    if (!save.owned) save.owned = { ...DEFAULT_SAVE.owned };
    if (!save.stats) save.stats = { ...DEFAULT_SAVE.stats };
  } catch (_e) { /* ignore — fall back to defaults */ }
}

export function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (_e) { /* ignore — quota / disabled storage / private mode */ }
}
