/*
 * achievements.js
 *
 * Goal & progression layer. Tracks long-term player accomplishments,
 * rewards coins, and surfaces toast notifications when something unlocks.
 *
 * The achievement *catalog* (ACHIEVEMENT_DEFS) lives in config.js so it sits
 * with the other game data. This module owns the *logic*:
 *
 *   onTrigger(name)        — one-shot event helper. Unlocks any achievement
 *                            whose `trigger` matches `name` and isn't yet
 *                            unlocked.
 *   bumpCounter(c, n=1)    — increments save.counters[c] and unlocks any
 *                            counter-based achievement that just hit its
 *                            threshold.
 *   noteTreat(id)          — records a treat as tried (also fires the
 *                            'treat' one-shot, and re-checks foodCritic).
 *   noteDayPhase(p)        — flips save.sawDay or save.sawNight, then
 *                            re-checks the dayNight achievement.
 *   checkAll()             — re-evaluates every state-based ('custom')
 *                            achievement. Cheap; safe to call from the tick.
 *   showToast(icon,n,sub?) — slide a card down for ~4s. Used for unlocks
 *                            and exposed publicly so other modules could
 *                            piggyback on the same UI later.
 *
 * The achievements modal (📜 button on the HUD) is rendered on demand —
 * the catalog is small enough that re-rendering on every open is fine.
 *
 * Persistence: this module mutates `save` directly (counters, achievements
 * map, treatsTried list, sawDay/sawNight flags) and calls persist() after
 * each meaningful change. Re-loads pick up where they left off.
 */

import { ACHIEVEMENT_DEFS, SHOP_ITEMS } from './config.js';
import { save, ham } from './state.js';
import { snd } from './audio.js';
import { persist } from './save.js';

// ---------- Save migration / initialization ----------

// Ensure all achievement-related save fields exist on the current `save`
// object. Older saves predate this layer, so anything missing is created.
function ensureSaveShape() {
  if (!save.counters)     save.counters = { wheelRuns: 0, cleaned: 0, pets: 0 };
  // Backfill any newly-added counter keys without overwriting existing values.
  for (const k of ['wheelRuns', 'cleaned', 'pets']) {
    if (typeof save.counters[k] !== 'number') save.counters[k] = 0;
  }
  if (!save.achievements) save.achievements = {};
  if (!Array.isArray(save.treatsTried)) save.treatsTried = [];
  if (typeof save.sawDay   !== 'boolean') save.sawDay = false;
  if (typeof save.sawNight !== 'boolean') save.sawNight = false;
}

// ---------- Toast UI ----------

// Slides a card down from the top, hangs around, then fades out. Multiple
// toasts stack — they're all appended to #toastStack and removed when their
// CSS animation finishes.
export function showToast(icon, name, subtitle) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toastIcon">${icon}</div>
    <div class="toastInfo">
      <div class="toastName">${name}</div>
      ${subtitle ? `<div class="toastSub">${subtitle}</div>` : ''}
    </div>`;
  stack.appendChild(el);
  // The CSS animation (toastIn -> hold -> toastOut) totals ~4s; remove the
  // node a hair after that so we don't accumulate orphaned elements.
  setTimeout(() => el.remove(), 4200);
}

// ---------- Internal helpers ----------

function isUnlocked(id) {
  return !!(save.achievements && save.achievements[id] && save.achievements[id].unlocked);
}

function unlock(def) {
  if (isUnlocked(def.id)) return;
  save.achievements[def.id] = { unlocked: true, at: Date.now() };
  save.coins += def.reward;
  showToast(def.icon, def.name, `Unlocked  •  +${def.reward}💰`);
  snd('buy');
  // Ping the achievements button so the player sees something to look at.
  flagButtonNew();
  persist();
  // Queue an in-cage celebration. behavior.js consumes the flag on its
  // next tick — that path has access to the live render position via
  // hamPos(), so the sparkles land on the hamster wherever they actually
  // are (wheel, hut, etc.), not just at ham.x/ham.y.
  ham.celebrationPending = true;
}

// State-based ("custom") achievements are checked here. Each case reads from
// `save` directly so the predicate stays close to the data it depends on.
function passesCustom(def) {
  switch (def.custom) {
    case 'rich':         return save.coins >= 200;
    case 'maxStats': {
      const s = save.stats;
      return s.hunger >= 99 && s.thirst >= 99 && s.energy >= 99 && s.happy >= 99 && s.clean >= 99;
    }
    case 'foodCritic': {
      const allTreats = SHOP_ITEMS.treats.map(t => t.id);
      return allTreats.every(id => save.treatsTried.includes(id));
    }
    case 'ownBall':       return !!save.owned.ball;
    case 'ownTunnel':     return !!save.owned.tunnel;
    case 'ownRoomba':     return !!save.owned.roomba;
    case 'ownCrown':      return !!save.owned.crown;
    case 'allCosmetics':  return !!(save.owned.bow && save.owned.hat && save.owned.crown);
    case 'dayNight':      return save.sawDay && save.sawNight;
    case 'sweetTooth':    return Array.isArray(save.treatsTried) && save.treatsTried.includes('cake');
    case 'bigSpender':    return !!save.counters && (save.counters.coinsSpent || 0) >= 500;
    default:              return false;
  }
}

// ---------- Public event API ----------

export function onTrigger(name) {
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.trigger === name && !isUnlocked(def.id)) unlock(def);
  }
}

export function bumpCounter(counter, amount = 1) {
  ensureSaveShape();
  save.counters[counter] = (save.counters[counter] || 0) + amount;
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.count === counter && !isUnlocked(def.id) && save.counters[counter] >= def.threshold) {
      unlock(def);
    }
  }
  persist();
}

export function noteTreat(treatId) {
  ensureSaveShape();
  if (!save.treatsTried.includes(treatId)) {
    save.treatsTried.push(treatId);
  }
  onTrigger('treat'); // first-treat one-shot
  // Re-check custom achievements (foodCritic) — cheap.
  checkAll();
}

export function noteDayPhase(phase) {
  ensureSaveShape();
  if (phase === 'day'   && !save.sawDay)   { save.sawDay = true;   persist(); }
  if (phase === 'night' && !save.sawNight) { save.sawNight = true; persist(); }
  checkAll();
}

// Re-evaluate every custom (state-based) achievement. Counter and trigger
// achievements unlock immediately on the relevant event, so this only
// covers the third category. Safe to call from the tick.
export function checkAll() {
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.custom && !isUnlocked(def.id) && passesCustom(def)) unlock(def);
  }
}

// ---------- Achievements modal ----------

let badgeFlagged = false;

// Tag the achievements button with a visual ping until the player opens the
// list. Lets unlocks land even when the user is busy clicking elsewhere.
function flagButtonNew() {
  const btn = document.getElementById('achBtn');
  if (!btn) return;
  btn.classList.add('hasNew');
  badgeFlagged = true;
}

function clearButtonNew() {
  const btn = document.getElementById('achBtn');
  if (btn) btn.classList.remove('hasNew');
  badgeFlagged = false;
}

function renderAchievementsList() {
  const grid = document.getElementById('achGrid');
  const subtitle = document.getElementById('achSubtitle');
  if (!grid || !subtitle) return;
  grid.innerHTML = '';
  let unlockedCount = 0;
  for (const def of ACHIEVEMENT_DEFS) {
    const got = isUnlocked(def.id);
    if (got) unlockedCount++;
    const card = document.createElement('div');
    card.className = 'achCard' + (got ? ' got' : '');
    // Counter-based achievements show progress (e.g. "7/10") so the player
    // can see how close they are. Trigger and custom ones don't have a
    // partial state to show, so we just gate on the icon greyscale.
    let progress = '';
    if (!got && def.count) {
      const cur = (save.counters && save.counters[def.count]) || 0;
      progress = `<div class="achProgress">${Math.min(cur, def.threshold)} / ${def.threshold}</div>`;
    }
    card.innerHTML = `
      <div class="achIcon">${def.icon}</div>
      <div class="achName">${def.name}</div>
      <div class="achDesc">${def.desc}</div>
      ${progress}
      <div class="achReward">+${def.reward}💰</div>`;
    grid.appendChild(card);
  }
  subtitle.textContent = `Unlocked: ${unlockedCount} / ${ACHIEVEMENT_DEFS.length}`;
}

export function openAchievementsModal() {
  const modal = document.getElementById('achModal');
  if (!modal) return;
  ensureSaveShape();
  renderAchievementsList();
  modal.classList.add('show');
  clearButtonNew();
  snd('click');
}

export function closeAchievementsModal() {
  const modal = document.getElementById('achModal');
  if (modal) modal.classList.remove('show');
}

// ---------- Init ----------

// Wire the button + modal once the DOM is ready (called from main.js after
// boot). Idempotent — calling twice would attach duplicate listeners, so
// `init` is only called once from main.js.
export function initAchievements() {
  ensureSaveShape();
  const btn = document.getElementById('achBtn');
  const closeBtn = document.getElementById('closeAch');
  const modal = document.getElementById('achModal');
  if (btn) btn.addEventListener('click', openAchievementsModal);
  if (closeBtn) closeBtn.addEventListener('click', () => { closeAchievementsModal(); snd('click'); });
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAchievementsModal();
    });
  }
  // Catch anything that's *already* satisfied (e.g. an old save that already
  // has the costume but never got the achievement). Guarantees no goals
  // sit perpetually un-claimable.
  checkAll();
}
