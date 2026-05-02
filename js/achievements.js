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
      // Originally required all stats ≥ 99, but with the current decay
      // rates (~0.3-0.4 per second per stat) the slowest action — a
      // 10-20 second nap — meant earlier-filled stats had already
      // slipped below 99 by the time the last one filled. Lowering the
      // bar to 85 keeps the achievement meaningful (player still has to
      // actively care for everything within a window) while making it
      // attainable through normal good play.
      const s = save.stats;
      return s.hunger >= 85 && s.thirst >= 85 && s.energy >= 85 && s.happy >= 85 && s.clean >= 85;
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
    default: {
      // Generic tier-ladder pattern: "<field>_<threshold>" lets the
      // tier() helper in config.js generate dozens of state-based
      // entries without us hand-coding each case here.
      const m = (def.custom || '').match(/^(coinsEarned|coinsSpent|coinsHeld|bestRain|streak|playTime)_(\d+)$/);
      if (!m) return false;
      const field = m[1];
      const threshold = +m[2];
      const c = save.counters || {};
      switch (field) {
        case 'coinsHeld':   return save.coins      >= threshold;
        case 'coinsEarned': return (c.coinsEarned   || 0) >= threshold;
        case 'coinsSpent':  return (c.coinsSpent    || 0) >= threshold;
        case 'bestRain':    return (c.bestRain      || 0) >= threshold;
        case 'streak':      return (save.streak     || 0) >= threshold;
        case 'playTime':    return (c.playSeconds   || 0) >= threshold;
      }
      return false;
    }
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

// How many cards to render per "page". Rendering 10,000+ DOM nodes is too
// slow + visually unusable, so the modal shows the most-relevant 60 by
// default and reveals more in chunks via the Show More button.
const PAGE_SIZE = 60;
let _visibleCount = PAGE_SIZE;

// Reset visible count to the first page whenever the modal opens — saves
// us from accidentally remembering huge expansion across opens.
function resetVisibleCount() { _visibleCount = PAGE_SIZE; }

function renderAchievementsList() {
  const grid = document.getElementById('achGrid');
  const subtitle = document.getElementById('achSubtitle');
  if (!grid || !subtitle) return;
  grid.innerHTML = '';

  // Sort so the "what should I do next?" tasks bubble up:
  //   1. Counter tasks with non-zero progress (closest to done first)
  //   2. Other still-locked tasks
  //   3. Completed tasks last
  // With 10000+ entries, this sort is what makes the panel usable —
  // the visible top page is always the next-actionable goals.
  const ordered = ACHIEVEMENT_DEFS.slice().map(def => {
    const got = isUnlocked(def.id);
    let progress = 0, threshold = 0;
    if (def.count) {
      progress = (save.counters && save.counters[def.count]) || 0;
      threshold = def.threshold || 1;
    }
    let key;
    if (got) key = 2;
    else if (def.count && progress > 0) key = 0 + (1 - Math.min(progress / threshold, 0.999));
    else key = 1;
    return { def, got, progress, threshold, key };
  }).sort((a, b) => a.key - b.key);

  // Count unlocked across the whole set (cheap — no DOM work involved).
  let unlockedCount = 0;
  for (const item of ordered) if (item.got) unlockedCount++;

  // Render only up to `_visibleCount`. Past that, append a Show More
  // button. Skipping DOM nodes is what keeps the 10000-entry modal
  // responsive — a single innerHTML write of 60 cards is fast.
  const slice = ordered.slice(0, _visibleCount);
  for (const { def, got, progress, threshold } of slice) {
    const card = document.createElement('div');
    card.className = 'achCard' + (got ? ' got' : '');
    let progressHtml = '';
    if (!got && def.count) {
      progressHtml = `<div class="achProgress">${Math.min(progress, threshold)} / ${threshold}</div>`;
    }
    card.innerHTML = `
      <div class="achIcon">${def.icon}</div>
      <div class="achName">${def.name}</div>
      <div class="achDesc">${def.desc}</div>
      ${progressHtml}
      <div class="achReward">+${def.reward}💰</div>`;
    grid.appendChild(card);
  }

  const remaining = ordered.length - _visibleCount;
  if (remaining > 0) {
    const btn = document.createElement('button');
    btn.className = 'achShowMore';
    btn.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more (${remaining} hidden)`;
    btn.addEventListener('click', () => {
      _visibleCount += PAGE_SIZE;
      renderAchievementsList();
    });
    grid.appendChild(btn);
  }

  subtitle.textContent = `Unlocked: ${unlockedCount} / ${ACHIEVEMENT_DEFS.length}` +
    (ordered.length > _visibleCount ? ` · showing top ${_visibleCount}` : '');
}

export function openAchievementsModal() {
  const modal = document.getElementById('achModal');
  if (!modal) return;
  ensureSaveShape();
  resetVisibleCount(); // re-collapse to the first page on every open
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
