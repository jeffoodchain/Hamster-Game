/*
 * saveio.js
 *
 * Export / import the player's save slot as a JSON file. Buttons live in
 * the stats panel; this module owns the actual file plumbing.
 *
 * Export: serialize state.save → Blob → download as
 *   hamster-save-YYYY-MM-DD.json
 *
 * Import: read a JSON file, validate it has the shape we expect, copy
 * known keys into state.save, persist, and reload the page so every
 * cached value (HUD, achievements, themes, music, …) re-initializes from
 * the new save without us having to plumb a "save changed" event through
 * every module.
 *
 * Validation is deliberately permissive: we only require a `coins` number
 * and a `stats` object. Anything else missing falls back to defaults via
 * save.js's loadSave() shape-checks. This keeps imports lenient enough to
 * accept partial backups but strict enough to reject random JSON files.
 */

import { save } from './state.js';
import { DEFAULT_SAVE } from './config.js';
import { persist } from './save.js';
import { snd } from './audio.js';

export function exportSave() {
  const json = JSON.stringify(save, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hamster-save-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  snd('click');
}

function isLooselyValidSave(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (typeof parsed.coins !== 'number') return false;
  if (!parsed.stats || typeof parsed.stats !== 'object') return false;
  return true;
}

export function importSaveFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!isLooselyValidSave(parsed)) {
        alert('That doesn\'t look like a hamster-game save.');
        return;
      }
      // Copy only keys we know about — guards against arbitrary fields
      // ending up on the save object from a tampered file.
      for (const key of Object.keys(DEFAULT_SAVE)) {
        if (parsed[key] !== undefined) save[key] = parsed[key];
      }
      persist();
      // Hard reload — every module re-runs its boot path with the imported
      // save. Cleaner than trying to surgically refresh ham state, music,
      // achievements, etc. from this layer.
      location.reload();
    } catch (e) {
      alert('Could not parse the file: ' + e.message);
    }
  };
  reader.readAsText(file);
}

export function initSaveIO() {
  const exportBtn = document.getElementById('exportSaveBtn');
  const importBtn = document.getElementById('importSaveBtn');
  const fileInput = document.getElementById('importSaveInput');
  if (exportBtn) exportBtn.addEventListener('click', exportSave);
  // The hidden file input is the actual native picker. The visible Import
  // button just forwards the click to it; the input's change event then
  // hands the chosen file to importSaveFromFile.
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      importSaveFromFile(file);
      fileInput.value = ''; // reset so picking the same file twice still fires
    });
  }
}
