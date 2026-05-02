/*
 * streak.js
 *
 * Daily login streak. The first play of each calendar day bumps a counter
 * and awards a coin bonus that scales with the streak length; skipping a
 * day resets it to 1. A "Day N streak!" toast — using the achievements
 * toast UI — celebrates the bonus without forcing the player to look at a
 * separate screen.
 *
 * Bonus formula: 5 + min(streak * 2, 30) coins. So day 1 = 7💰, day 2 = 9💰,
 * day 13+ = 35💰 (capped). Generous enough to feel rewarding but not so
 * much that a player can buy everything just by logging in.
 *
 * Date handling: dates are stored as YYYY-MM-DD strings in *local* time,
 * built manually to avoid toISOString's UTC shift around midnight. Comparing
 * "yesterday" goes through Date arithmetic rather than string subtraction,
 * which keeps month/year boundaries and DST shifts honest.
 */

import { save } from './state.js';
import { showToast, onTrigger } from './achievements.js';
import { persist } from './save.js';
import { setIfHigher } from './stats.js';

// YYYY-MM-DD in the player's local time. Used as the dedupe key for "is
// this the first play of today?" — the actual time of day doesn't matter.
function localIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso()     { return localIsoDate(new Date()); }
function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localIsoDate(d);
}

// Called once per session, right after the player clicks Play. Idempotent
// within a single calendar day — calling it again returns silently.
export function checkDailyStreak() {
  // Backfill the new fields for older saves that predate this layer.
  if (!save.lastVisit) save.lastVisit = '';
  if (typeof save.streak !== 'number') save.streak = 0;

  const today = todayIso();
  if (save.lastVisit === today) return; // already counted today

  if (save.lastVisit === yesterdayIso()) {
    save.streak += 1;
  } else {
    // First-ever play, or a day was skipped — start a fresh streak.
    save.streak = 1;
  }
  save.lastVisit = today;

  const bonus = 5 + Math.min(save.streak * 2, 30);
  save.coins += bonus;
  persist();

  // Defer the toast a beat so it lands *after* the play screen has had a
  // moment to render and any first-run welcome is on screen — otherwise
  // it would be the first thing the player sees, which is weird if it's
  // a multi-day-late return.
  setTimeout(() => {
    showToast('🌟', `Day ${save.streak} streak!`, `Welcome back · +${bonus}💰`);
  }, 800);

  if (save.streak >= 3) onTrigger('streak3');
  if (save.streak >= 7) onTrigger('streak7');
  setIfHigher('longestStreak', save.streak);
}
