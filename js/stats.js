/*
 * stats.js
 *
 * Lifetime statistics panel — surfaces the persistent counters scattered
 * across the codebase into one "look how far I've come" view. Accessed via
 * the 📊 button on the HUD.
 *
 * What's tracked here that *wasn't* tracked before:
 *   coinsEarned       — total coins earned ever (distinct from save.coins,
 *                        which is the current balance)
 *   visitorsReceived  — count of visiting friend hamsters
 *   treatsFed         — total treats fed (any type)
 *   bestRain          — highest single-round score in Treat Rain
 *   longestStreak     — highest daily-streak number ever reached
 *   playSeconds       — accumulated real-time play seconds
 *
 * Other counters reused from the achievements layer:
 *   wheelRuns, cleaned, pets — already incremented by behavior.js / input.js.
 *
 * Hooks (callable from any module):
 *   bumpStat(name, n=1)
 *   setIfHigher(name, value)
 *   tickPlayTime()      — call once per frame from the main loop
 *
 * The modal is rendered fresh each open from save.counters; there's no
 * polling, so opening it during gameplay is cheap.
 */

import { save, view } from './state.js';
import { snd } from './audio.js';
import { persist } from './save.js';
import { ACHIEVEMENT_DEFS } from './config.js';
import { initSaveIO } from './saveio.js';

const TRACKED_KEYS = [
  'wheelRuns', 'cleaned', 'pets',
  'coinsEarned', 'visitorsReceived', 'treatsFed',
  'bestRain', 'longestStreak', 'playSeconds',
];

// Backfill any counter the current save is missing — older saves predate
// this layer and would otherwise NaN their way through arithmetic.
function ensureCounters() {
  if (!save.counters) save.counters = {};
  for (const k of TRACKED_KEYS) {
    if (typeof save.counters[k] !== 'number') save.counters[k] = 0;
  }
}

export function bumpStat(name, amount = 1) {
  ensureCounters();
  save.counters[name] = (save.counters[name] || 0) + amount;
  persist();
}

// "High score" updater — only writes when the new value is bigger.
// Used for bestRain and longestStreak.
export function setIfHigher(name, value) {
  ensureCounters();
  if (value > (save.counters[name] || 0)) {
    save.counters[name] = value;
    persist();
  }
}

// Accumulate playSeconds. Called from the main loop every frame; we only
// actually bump the counter once per real-time second to keep persist()
// out of the hot path.
let lastPlaySecondFrame = 0;
export function tickPlayTime() {
  if (view.frame - lastPlaySecondFrame >= 60) {
    lastPlaySecondFrame = view.frame;
    bumpStat('playSeconds', 1);
  }
}

// "1h 23m", or "23m" if under an hour. We don't bother showing seconds —
// at the granularity this game runs at, minute-resolution feels right.
function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderStats() {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  ensureCounters();
  const c = save.counters;
  const achUnlocked = save.achievements
    ? Object.keys(save.achievements).filter(k => save.achievements[k].unlocked).length
    : 0;

  const stats = [
    { icon: '💰', label: 'Coins earned',      val: c.coinsEarned },
    { icon: '💎', label: 'Coins on hand',     val: save.coins },
    { icon: '🎡', label: 'Wheel runs',        val: c.wheelRuns },
    { icon: '♻️', label: 'Messes cleaned',    val: c.cleaned },
    { icon: '❤️', label: 'Pets given',        val: c.pets },
    { icon: '🥕', label: 'Treats fed',        val: c.treatsFed },
    { icon: '👋', label: 'Friend visits',     val: c.visitorsReceived },
    { icon: '🌧️', label: 'Best Treat Rain',   val: c.bestRain },
    { icon: '🌟', label: 'Current streak',    val: (save.streak || 0) + ' day' + (save.streak === 1 ? '' : 's') },
    { icon: '⭐', label: 'Longest streak',    val: c.longestStreak + ' day' + (c.longestStreak === 1 ? '' : 's') },
    { icon: '🏆', label: 'Achievements',      val: achUnlocked + ' / ' + ACHIEVEMENT_DEFS.length },
    { icon: '⏱️', label: 'Time played',       val: fmtTime(c.playSeconds || 0) },
  ];

  grid.innerHTML = stats.map(s => `
    <div class="statCard">
      <div class="statIcon">${s.icon}</div>
      <div class="statLabel">${s.label}</div>
      <div class="statValue">${s.val}</div>
    </div>
  `).join('');
}

export function openStatsModal() {
  const modal = document.getElementById('statsModal');
  if (!modal) return;
  renderStats();
  modal.classList.add('show');
  snd('click');
}

export function closeStatsModal() {
  const modal = document.getElementById('statsModal');
  if (modal) modal.classList.remove('show');
}

export function initStats() {
  ensureCounters();
  const btn = document.getElementById('statsBtn');
  const closeBtn = document.getElementById('closeStats');
  const modal = document.getElementById('statsModal');
  if (btn) btn.addEventListener('click', openStatsModal);
  if (closeBtn) closeBtn.addEventListener('click', () => { closeStatsModal(); snd('click'); });
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeStatsModal();
    });
  }
  // The export/import buttons live inside this modal — wire them up here
  // rather than its own init so they're guaranteed to exist by the time
  // we touch them.
  initSaveIO();
}
