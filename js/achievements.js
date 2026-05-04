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

// Count how many achievements the player has unlocked. Used by the
// meta combos (Apprentice / Halfway / Century) to gate themselves on
// overall progress through the catalog.
function countUnlocked() {
  if (!save.achievements) return 0;
  let n = 0;
  for (const k of Object.keys(save.achievements)) {
    if (save.achievements[k]?.unlocked) n++;
  }
  return n;
}

// Count distinct items owned (toys + costumes + themes). Used by combos
// like Hoarder, Shopaholic, Lasting Legacy.
function countOwnedItems() {
  let n = 0;
  if (save.owned) for (const k of Object.keys(save.owned)) if (save.owned[k]) n++;
  if (Array.isArray(save.themesOwned)) n += save.themesOwned.length;
  return n;
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

    // ---- Combo / multi-condition checks ----
    case 'combo_carer':       return Object.values(save.stats || {}).every(v => v >= 70);
    case 'combo_hoarder': {
      let n = 0;
      for (const k of Object.keys(save.owned || {})) if (save.owned[k]) n++;
      n += (save.themesOwned || []).length;
      return n >= 10;
    }
    case 'combo_hardWorker':  return ((save.counters?.wheelRuns) || 0) >= 100 && ((save.counters?.cleaned) || 0) >= 100;
    case 'combo_spa':         return ((save.counters?.baths) || 0) >= 10 && (save.stats?.clean || 0) >= 95;
    case 'combo_highRoller':  return ((save.counters?.coinsSpent) || 0) >= 1000 && ((save.counters?.coinsEarned) || 0) >= 2000;
    case 'combo_socialite':   return ((save.counters?.visitorsReceived) || 0) >= 5 &&
                                     !!(save.achievements?.petVisitor?.unlocked) &&
                                     !!(save.achievements?.feedVisitor?.unlocked);
    case 'combo_marathon':    return ((save.counters?.wheelRuns) || 0) >= 50 && ((save.counters?.playSeconds) || 0) >= 3600;
    case 'combo_collector':   return !!save.owned?.ball && !!save.owned?.tunnel && !!save.owned?.ladder &&
                                     !!save.owned?.bow && !!save.owned?.hat && !!save.owned?.crown;
    case 'combo_gardener':    return save.activeTheme === 'meadow' && ((save.counters?.visitorsReceived) || 0) >= 5;
    case 'combo_sunChaser':   return save.activeTheme === 'sunset' && save.sawDay === true;
    case 'combo_nightOwl':    return save.activeTheme === 'lavender' && save.sawNight === true;
    case 'combo_blossom':     return save.activeTheme === 'cherryBlossom' &&
                                     !!(save.achievements?.foodCritic?.unlocked);
    case 'combo_royalCourt':  return !!save.owned?.crown && !!save.owned?.wizard;
    case 'combo_foodie':      return ((save.counters?.treatsFed) || 0) >= 50 &&
                                     !!(save.achievements?.foodCritic?.unlocked);
    case 'combo_cuddleSage':  return ((save.counters?.pets) || 0) >= 200 &&
                                     !!save.owned?.bow && !!save.owned?.hat && !!save.owned?.crown;
    case 'combo_cleanFreak':  return ((save.counters?.cleaned) || 0) >= 100 && !!save.owned?.roomba;
    // Second batch
    case 'combo_firstHour':    return ((save.counters?.playSeconds) || 0) >= 3600;
    case 'combo_themeCurator': return Array.isArray(save.themesOwned) && save.themesOwned.length >= 4;
    case 'combo_allToys':      return !!save.owned?.ball && !!save.owned?.tunnel && !!save.owned?.ladder && !!save.owned?.roomba;
    case 'combo_tourGuide':    return ((save.counters?.visitorsReceived) || 0) >= 10 &&
                                      Array.isArray(save.themesOwned) && save.themesOwned.length >= 5;
    case 'combo_multiPet':     return ((save.counters?.pets) || 0) >= 100 && ((save.counters?.treatsFed) || 0) >= 50;
    case 'combo_botMaster':    return !!save.owned?.roomba && ((save.counters?.cleaned) || 0) >= 200;
    case 'combo_fashionShow':  return !!save.owned?.bow && !!save.owned?.hat && !!save.owned?.crown &&
                                      !!save.owned?.wizard && save.activeTheme && save.activeTheme !== 'classic';
    case 'combo_noStress':     return Object.values(save.stats || {}).every(v => v >= 80);
    case 'combo_goodHabits':   return (save.streak || 0) >= 7 && ((save.counters?.wheelRuns) || 0) >= 50;
    case 'combo_trueLove':     return ((save.counters?.pets) || 0) >= 500;
    // Third batch — meta and lifestyle.
    case 'combo_balanced':     return ((save.counters?.pets) || 0) >= 50 &&
                                      ((save.counters?.wheelRuns) || 0) >= 50 &&
                                      ((save.counters?.cleaned) || 0) >= 50;
    case 'combo_ach10':        return countUnlocked() >= 10;
    case 'combo_ach25':        return countUnlocked() >= 25;
    case 'combo_ach100':       return countUnlocked() >= 100;
    case 'combo_cozy':         return ((save.counters?.naps) || 0) >= 3 &&
                                      ((save.counters?.chews) || 0) >= 3 &&
                                      ((save.counters?.baths) || 0) >= 3;
    case 'combo_handyman':     return !!save.owned?.ladder && ((save.counters?.wheelRuns) || 0) >= 100;
    case 'combo_luckyDay':     return (save.streak || 0) >= 3 && save.coins >= 100;
    case 'combo_taste':        return !!(save.achievements?.rich?.unlocked) &&
                                      !!(save.achievements?.foodCritic?.unlocked);
    case 'combo_basicCare':    return !!(save.achievements?.bottomsUp?.unlocked) &&
                                      !!(save.achievements?.sweetDreams?.unlocked) &&
                                      !!(save.achievements?.squeakyClean?.unlocked);
    case 'combo_fitness':      return ((save.counters?.wheelRuns) || 0) >= 100 && (save.stats?.clean || 0) >= 80;
    case 'combo_shopaholic':   return ((save.counters?.coinsSpent) || 0) >= 500 && countOwnedItems() >= 5;
    case 'combo_bigSpender2':  return ((save.counters?.coinsSpent) || 0) >= 5000;
    case 'combo_legacy':       return (save.streak || 0) >= 14 && countOwnedItems() >= 3;
    case 'combo_freeSpirit':   return save.sawDay === true && save.sawNight === true &&
                                      ((save.counters?.visitorsReceived) || 0) >= 5;
    case 'combo_cleanLife':    return !!save.owned?.roomba && (save.stats?.clean || 0) >= 95;

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

// How many list rows to render per "page". Rendering 10,000+ DOM nodes
// is too slow + visually unusable, so the modal shows the most-relevant
// 100 by default and reveals more in chunks via the Show More button.
// 100 was chosen because each compact list row is ~50px tall — 100 rows
// takes a few pages of scrolling, which feels right for a long task list.
const PAGE_SIZE = 100;
let _visibleCount = PAGE_SIZE;

// Filter / search / sort state — drive the modal navigation. Reset on
// each open.
let _filterMode = 'all';      // 'all' | 'progress' | 'done'
let _categoryFilter = 'all';  // 'all' or one of the CATEGORY ids below
let _searchTerm = '';
let _sortMode = 'progress';   // 'progress' | 'name' | 'reward' | 'threshold'

// Counter → category mapping. Used by categoryOf() to bucket every
// achievement into a high-level group for the dropdown filter.
const COUNTER_CATEGORIES = {
  pets: 'pets', wheelRuns: 'wheel', cleaned: 'clean', naps: 'sleep',
  baths: 'bath', chews: 'chew', photos: 'photo', treatsFed: 'food',
  visitorsReceived: 'visits', coinsEarned: 'money', coinsSpent: 'money',
};

// Compute how many achievements live in each category. Catalog is
// static, so we cache the result on first call. Used by the dropdown
// to show "(15,043)" etc. next to each option label.
let _categoryCountsCache = null;
function categoryCounts() {
  if (_categoryCountsCache) return _categoryCountsCache;
  const counts = {};
  for (const def of ACHIEVEMENT_DEFS) {
    const cat = categoryOf(def);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  _categoryCountsCache = counts;
  return counts;
}

// Inject the live counts into each status tab — "All (100,131)",
// "In progress (47)", "Done (28)". Counts come from the (already
// computed) ordered cache so this is cheap. dataset.baseLabel saves
// the original text so reformat is idempotent across renders.
function updateFilterTabCounts(ordered) {
  let inProg = 0, done = 0;
  for (const it of ordered) {
    if (it.got) done++;
    else if (it.def.count && it.progress > 0) inProg++;
  }
  const total = ordered.length;
  document.querySelectorAll('.achFilter').forEach(b => {
    if (!b.dataset.baseLabel) b.dataset.baseLabel = b.textContent;
    const base = b.dataset.baseLabel;
    let n = 0;
    if (b.dataset.filter === 'all') n = total;
    else if (b.dataset.filter === 'progress') n = inProg;
    else if (b.dataset.filter === 'done') n = done;
    b.textContent = `${base} (${n.toLocaleString()})`;
  });
}

// Inject the per-category count into the dropdown labels — the
// option's original text ("🤗 Pets") becomes "🤗 Pets (15,043)".
// Saves the original in data-base-label so reformat is idempotent.
function updateCategoryDropdownLabels() {
  const sel = document.getElementById('achCategory');
  if (!sel) return;
  const counts = categoryCounts();
  for (const opt of sel.options) {
    if (!opt.dataset.baseLabel) opt.dataset.baseLabel = opt.textContent;
    const base = opt.dataset.baseLabel;
    const n = opt.value === 'all' ? ACHIEVEMENT_DEFS.length : (counts[opt.value] || 0);
    opt.textContent = `${base} (${n.toLocaleString()})`;
  }
}

// Bucket a single achievement def into a category. Falls back to 'other'
// for stragglers — the modal shows them under "Other" without breaking.
function categoryOf(def) {
  if (def.custom && def.custom.startsWith('combo_')) return 'combos';
  if (def.count) return COUNTER_CATEGORIES[def.count] || 'other';
  if (def.custom) {
    if (/^coins(Earned|Spent|Held)_/.test(def.custom) ||
        def.custom === 'rich' || def.custom === 'bigSpender') return 'money';
    if (def.custom === 'foodCritic' || def.custom === 'sweetTooth') return 'food';
    if (/^streak_/.test(def.custom)) return 'streak';
    if (def.custom === 'bestRain' || /^bestRain_/.test(def.custom)) return 'minigame';
    if (def.custom === 'maxStats' || def.custom === 'dayNight') return 'stats';
    if (/^playTime_/.test(def.custom)) return 'time';
    if (/^own/.test(def.custom) || def.custom === 'allCosmetics') return 'collect';
  }
  if (def.trigger) {
    if (def.trigger === 'pet' || def.trigger === 'petVisitor') return 'pets';
    if (def.trigger === 'feed' || def.trigger === 'treat' || def.trigger === 'feedVisitor') return 'food';
    if (def.trigger === 'drink')  return 'water';
    if (def.trigger === 'nap')    return 'sleep';
    if (def.trigger === 'bath')   return 'bath';
    if (def.trigger === 'chew')   return 'chew';
    if (def.trigger === 'equip')  return 'collect';
    if (def.trigger === 'visitor') return 'visits';
    if (def.trigger === 'ladder') return 'play';
    if (def.trigger === 'treatRain' || def.trigger === 'treatStorm') return 'minigame';
    if (def.trigger.startsWith('streak')) return 'streak';
  }
  return 'other';
}

// Reset visible count to the first page whenever the modal opens — saves
// us from accidentally remembering huge expansion across opens.
function resetVisibleCount() { _visibleCount = PAGE_SIZE; }

// Apply both filter mode and search term to a row entry. Search is case-
// insensitive and matches both name and description.
function passesFilters(item) {
  if (_filterMode === 'progress') {
    if (item.got) return false;
    if (item.def.count && (item.progress || 0) === 0) return false;
  }
  if (_filterMode === 'done' && !item.got) return false;
  if (_categoryFilter !== 'all' && categoryOf(item.def) !== _categoryFilter) return false;
  if (_searchTerm) {
    const hay = (item.def.name + ' ' + item.def.desc).toLowerCase();
    if (!hay.includes(_searchTerm)) return false;
  }
  return true;
}

// Sort the full achievement catalog by relevance:
//   1. Counter tasks with non-zero progress (closest to done first)
//   2. Other still-locked tasks
//   3. Completed tasks last
// At 100,000+ entries this is the expensive operation (~50-100ms), so
// the result is cached at modal open and reused for every keystroke
// in the search box / category dropdown / filter tabs. Cache is
// invalidated on close.
let _orderedCache = null;

function buildOrderedCache() {
  // First pass: build the row metadata (got / progress / threshold).
  const items = ACHIEVEMENT_DEFS.slice().map(def => {
    const got = isUnlocked(def.id);
    let progress = 0, threshold = 0;
    if (def.count) {
      progress = (save.counters && save.counters[def.count]) || 0;
      threshold = def.threshold || 1;
    }
    return { def, got, progress, threshold };
  });

  // Sort according to the current mode. Each branch produces a stable
  // ordering — comparator returns ±1 / 0 from a single field.
  switch (_sortMode) {
    case 'name':
      items.sort((a, b) => a.def.name.localeCompare(b.def.name));
      break;
    case 'reward':
      // Highest reward first — the "what's worth doing" view.
      items.sort((a, b) => (b.def.reward || 0) - (a.def.reward || 0));
      break;
    case 'threshold':
      // Smallest goals first — the "easiest pickings" view. Custom
      // entries without an explicit threshold sort as 0 (top).
      items.sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
      break;
    case 'progress':
    default:
      // Default progress sort: in-progress closest to done first,
      // then untouched, then completed. Same heuristic as before.
      for (const it of items) {
        if (it.got) it.key = 2;
        else if (it.def.count && it.progress > 0)
          it.key = 1 - Math.min(it.progress / it.threshold, 0.999);
        else it.key = 1;
      }
      items.sort((a, b) => a.key - b.key);
  }
  return items;
}

function renderAchievementsList(opts) {
  opts = opts || {};
  const grid = document.getElementById('achGrid');
  const subtitle = document.getElementById('achSubtitle');
  if (!grid || !subtitle) return;
  grid.innerHTML = '';

  if (!_orderedCache) _orderedCache = buildOrderedCache();
  const ordered = _orderedCache;

  // Show/hide the clear-filters button based on whether any filter is
  // non-default. Cheap to check on every render.
  const clearBtn = document.getElementById('achClear');
  if (clearBtn) {
    const hasFilter = _filterMode !== 'all' || _categoryFilter !== 'all' || _searchTerm !== '';
    clearBtn.hidden = !hasFilter;
  }

  // Update each status tab's label with a live count: "All (100,131)",
  // "In progress (47)", "Done (28)". Counts are over the full catalog
  // (not the current category/search filter) so the tabs always
  // communicate "global state".
  updateFilterTabCounts(ordered);

  // Count unlocked across the whole set (cheap — no DOM work involved).
  let unlockedCount = 0;
  for (const item of ordered) if (item.got) unlockedCount++;

  // Apply filter tab + search box BEFORE pagination. The unlocked count
  // above is intentionally over the full set — the player should always
  // see "X / 10090 total" even when they've filtered down to a subset.
  const filtered = ordered.filter(passesFilters);

  // Render only up to `_visibleCount`. Past that, append a Show More
  // button. The list row layout — icon | name+desc stack | right-aligned
  // progress + reward — is much denser than the old card grid, so many
  // more rows fit per page.
  const slice = filtered.slice(0, _visibleCount);
  for (const { def, got, progress, threshold } of slice) {
    const row = document.createElement('div');
    row.className = 'achRow' + (got ? ' got' : '');
    let progressText = '';
    let barHtml = '';
    if (!got && def.count) {
      const pct = Math.min(100, Math.round((progress / threshold) * 100));
      progressText = `<div class="achProgress">${Math.min(progress, threshold)} / ${threshold}</div>`;
      // Visual bar makes scanability much better — at 100k entries, a
      // single horizontal bar communicates "how close" faster than
      // reading numbers. Width is clamped at 100% in case `progress`
      // exceeds threshold (defensive — shouldn't happen with our
      // current bumpCounter logic).
      barHtml = `<div class="achBar"><div class="achBarFill" style="width:${pct}%"></div></div>`;
    }
    row.innerHTML = `
      <div class="achIcon">${def.icon}</div>
      <div class="achMid">
        <div class="achName">${def.name}</div>
        <div class="achDesc">${def.desc}</div>
        ${barHtml}
      </div>
      <div class="achRight">
        ${progressText}
        <div class="achReward">+${def.reward}💰</div>
      </div>`;
    grid.appendChild(row);
  }

  const remaining = filtered.length - _visibleCount;
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

  // Subtitle: total unlocked + (when filtering) how many match.
  const filterNote = (_filterMode !== 'all' || _searchTerm)
    ? ` · ${filtered.length} match`
    : '';
  const sliceNote = (filtered.length > _visibleCount)
    ? ` · showing top ${_visibleCount}`
    : '';
  subtitle.textContent =
    `Unlocked: ${unlockedCount} / ${ACHIEVEMENT_DEFS.length}${filterNote}${sliceNote}`;

  // Filter changes should bring the player back to the top of the list —
  // otherwise after switching filters they'd be looking at random middle
  // rows from the previous filter's view. Show More opts out so the
  // player keeps their scroll position when expanding the page.
  if (opts.scrollToTop) {
    const box = document.querySelector('.achModalBox');
    if (box) box.scrollTop = 0;
  }
}

export function openAchievementsModal() {
  const modal = document.getElementById('achModal');
  if (!modal) return;
  ensureSaveShape();
  // Re-collapse to first page + reset filters on every open so the
  // player isn't surprised by stale "in progress" / search state.
  resetVisibleCount();
  _filterMode = 'all';
  _categoryFilter = 'all';
  _searchTerm = '';
  _sortMode = 'progress';
  document.querySelectorAll('.achFilter').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === 'all');
  });
  const search = document.getElementById('achSearch');
  if (search) search.value = '';
  const cat = document.getElementById('achCategory');
  if (cat) cat.value = 'all';
  const sortSel = document.getElementById('achSort');
  if (sortSel) sortSel.value = 'progress';

  renderAchievementsList();
  modal.classList.add('show');
  clearButtonNew();
  snd('click');
}

export function closeAchievementsModal() {
  const modal = document.getElementById('achModal');
  if (modal) modal.classList.remove('show');
  // Drop the sort cache so the next open rebuilds with current state
  // (achievements unlocked since last open will move to the bottom).
  _orderedCache = null;
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

  // Filter tab buttons. Click → switch active tab class + re-render.
  // Resets the page back to the first 100 since the filtered list
  // looks different now. scrollToTop:true brings the box back to row 0.
  const filterBtns = document.querySelectorAll('.achFilter');
  filterBtns.forEach(b => {
    b.addEventListener('click', () => {
      _filterMode = b.dataset.filter || 'all';
      filterBtns.forEach(x => x.classList.toggle('active', x === b));
      _visibleCount = PAGE_SIZE;
      renderAchievementsList({ scrollToTop: true });
    });
  });

  // Search box — debounce-free; re-render on every keystroke. With ~100k
  // entries the filter+sort+slice is still well under one frame thanks
  // to the sort cache.
  const search = document.getElementById('achSearch');
  if (search) {
    search.addEventListener('input', () => {
      _searchTerm = (search.value || '').trim().toLowerCase();
      _visibleCount = PAGE_SIZE;
      renderAchievementsList({ scrollToTop: true });
    });
  }

  // Category dropdown — second filter dimension on top of the All/Progress/
  // Done tabs and the search box. Lets the player drill into "all pet
  // tasks" or "all combos" etc. when 100k+ entries get unwieldy.
  const cat = document.getElementById('achCategory');
  if (cat) {
    cat.addEventListener('change', () => {
      _categoryFilter = cat.value || 'all';
      _visibleCount = PAGE_SIZE;
      renderAchievementsList({ scrollToTop: true });
    });
  }

  // Sort dropdown — re-orders the cached list. Must invalidate the
  // sort cache (it baked in the previous _sortMode) so the rebuild
  // picks up the new mode.
  const sortSel = document.getElementById('achSort');
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      _sortMode = sortSel.value || 'progress';
      _orderedCache = null; // force rebuild with the new sort
      _visibleCount = PAGE_SIZE;
      renderAchievementsList({ scrollToTop: true });
    });
  }

  // Clear-filters button — single click resets all filter and sort
  // controls back to defaults.
  const clearBtn = document.getElementById('achClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _filterMode = 'all';
      _categoryFilter = 'all';
      _searchTerm = '';
      _sortMode = 'progress';
      _orderedCache = null;
      filterBtns.forEach(x => x.classList.toggle('active', x.dataset.filter === 'all'));
      if (search) search.value = '';
      if (cat) cat.value = 'all';
      if (sortSel) sortSel.value = 'progress';
      _visibleCount = PAGE_SIZE;
      renderAchievementsList({ scrollToTop: true });
    });
  }

  // Catch anything that's *already* satisfied (e.g. an old save that already
  // has the costume but never got the achievement). Guarantees no goals
  // sit perpetually un-claimable.
  checkAll();

  // Format dropdown labels with per-category counts. Catalog is static,
  // so once at init is enough.
  updateCategoryDropdownLabels();
}
