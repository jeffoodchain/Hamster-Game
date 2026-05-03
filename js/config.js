/*
 * config.js
 *
 * Static, frozen-in-time game data. Nothing in this file changes at runtime —
 * for things that *do* change, see state.js. Everything here is plain data
 * (no DOM, no canvas, no side effects), so it can be imported by any module
 * without circular-dependency risk.
 *
 * Exports:
 *   HAMS           — the six selectable hamsters and their colors
 *   SEED_TYPES     — basket seed kinds (cycled when the basket is initialized)
 *   POOP_INTERVAL  — frames between automatic poops while the hamster wanders
 *   SHOP_ITEMS     — items grouped by tab (toys / treats / cosmetics)
 *   TREAT_EFFECTS  — stat boosts a treat applies when eaten
 *   DEFAULT_SAVE   — initial values for a fresh save (also used as a schema
 *                    when loading older saves to fill in missing fields)
 */

export const HAMS = [
  { name: '貝貝', roman: 'pépé',   type: 'dwarf',  body: '#f2eeea', belly: '#fdfaf7', ear: '#ebbdad', earIn: '#f0c8b8', nose: '#d4968a', eye: '#1a1008', stripe: null,      desc: 'White Dwarf',       fat: 1.0,  yuanbao: false },
  { name: '大蜜', roman: 'mii',    type: 'dwarf',  body: '#8a8276', belly: '#ccc8b8', ear: '#b09888', earIn: '#d4b0a0', nose: '#907060', eye: '#1a1008', stripe: '#5a5650', desc: 'Grey Agouti Dwarf', fat: 1.0,  yuanbao: false },
  { name: '臭臭', roman: 'stanky', type: 'dwarf',  body: '#b0adb8', belly: '#dcdae4', ear: '#c0b0c8', earIn: '#d8c8dc', nose: '#b09098', eye: '#1a1028', stripe: '#888098', desc: 'Blue-Grey Dwarf',   fat: 1.0,  yuanbao: false },
  { name: '蛋蛋', roman: 'egg',    type: 'syrian', body: '#d48c3a', belly: '#f0d080', ear: '#c07030', earIn: '#e09858', nose: '#c06040', eye: '#1a0808', stripe: null,      desc: 'Golden Syrian',     fat: 1.0,  yuanbao: false },
  { name: '沐沐', roman: 'mumu',   type: 'syrian', body: '#f5f0ec', belly: '#fffcfa', ear: '#f0b8a8', earIn: '#ffd0c0', nose: '#d08070', eye: '#c03020', stripe: null,      desc: 'Albino Syrian',     fat: 1.0,  yuanbao: false },
  { name: '阿財', roman: 'A tsai', type: 'dwarf',  body: '#8a8276', belly: '#ccc8b8', ear: '#b09888', earIn: '#d4b0a0', nose: '#907060', eye: '#1a1008', stripe: '#5a5650', desc: 'Chubby Dwarf',      fat: 1.15, yuanbao: true  },
];

export const SEED_TYPES = ['sunflower', 'millet', 'pumpkin'];

// 2400 frames ≈ 40s at 60fps. Tuned so the cage gets messy fast enough to be
// engaging but not so fast that cleaning becomes a chore.
export const POOP_INTERVAL = 2400;

export const SHOP_ITEMS = {
  toys: [
    { id: 'ball',   emoji: '🔴', name: 'Bouncy Ball',     desc: 'Hamster will play with it.',                price:  30, type: 'toy' },
    { id: 'tunnel', emoji: '🟦', name: 'Crawl Tunnel',    desc: 'Decorative tube on floor.',                  price:  60, type: 'toy' },
    { id: 'ladder', emoji: '🪜', name: 'Climbing Ladder', desc: 'Hamster climbs, perches, and slides!',       price:  80, type: 'toy' },
    { id: 'roomba', emoji: '🤖', name: '掃地機器人',         desc: 'Auto-cleans poops & shells (+1💰 each).',     price: 120, type: 'toy' },
  ],
  treats: [
    { id: 'carrot',   emoji: '🥕', name: 'Carrot',         desc: '+30 hunger, +15 happy',  price:  8, type: 'treat' },
    { id: 'apple',    emoji: '🍎', name: 'Apple Slice',    desc: '+40 hunger, +20 happy',  price: 14, type: 'treat' },
    { id: 'cucumber', emoji: '🥒', name: 'Cucumber',       desc: '+25 hunger, +20 thirst', price: 12, type: 'treat' },
    { id: 'cookie',   emoji: '🍪', name: 'Hamster Cookie', desc: '+50 hunger, +35 happy',  price: 22, type: 'treat' },
    { id: 'cake',     emoji: '🍰', name: 'Hamster Cake',   desc: '+60 hunger, +50 happy',  price: 35, type: 'treat' },
  ],
  cosmetics: [
    { id: 'bow',    emoji: '🎀', name: 'Pink Bow',    desc: 'A cute little bow.',         price:  35, type: 'cosmetic' },
    { id: 'hat',    emoji: '🎩', name: 'Top Hat',     desc: 'Very fancy.',                price:  65, type: 'cosmetic' },
    { id: 'crown',  emoji: '👑', name: 'Royal Crown', desc: 'Hamster monarch.',           price: 160, type: 'cosmetic' },
    { id: 'wizard', emoji: '🧙', name: 'Wizard Hat',  desc: 'Pointy purple, gold stars.', price: 220, type: 'cosmetic' },
  ],
  // Habitat themes — repaint the cage's wall, floor, and decorative surfaces.
  // Classic is free; the others unlock for coins. Apply pattern matches
  // cosmetics (own → equip), but uses save.themesOwned + save.activeTheme.
  themes: [
    { id: 'classic',        emoji: '🏡', name: 'Classic',        desc: 'The original look.',           price:   0, type: 'theme' },
    { id: 'meadow',         emoji: '🌿', name: 'Meadow',         desc: 'Green pasture vibes.',          price:  50, type: 'theme' },
    { id: 'sunset',         emoji: '🌅', name: 'Sunset',         desc: 'Warm peach + terracotta.',      price:  80, type: 'theme' },
    { id: 'lavender',       emoji: '💜', name: 'Lavender',       desc: 'Soft purple dreamspace.',       price: 120, type: 'theme' },
    { id: 'cherryBlossom',  emoji: '🌸', name: 'Cherry Blossom', desc: 'Pink walls, cream floor.',      price: 140, type: 'theme' },
  ],
};

// Looked up by treat id when the hamster finishes eating a purchased treat.
export const TREAT_EFFECTS = {
  carrot:   { hunger: 30, happy: 15 },
  apple:    { hunger: 40, happy: 20 },
  cucumber: { hunger: 25, thirst: 20, happy: 5 },
  cookie:   { hunger: 50, happy: 35 },
  cake:     { hunger: 60, happy: 50 },
};

export const SAVE_KEY = 'hamsterGameSave_v2';

export const DEFAULT_SAVE = {
  coins: 25,
  selected: 0,
  muted: false,
  owned: { ball: false, tunnel: false, ladder: false, roomba: false, bow: false, hat: false, crown: false },
  equipped: 'none',
  stats: { hunger: 80, thirst: 80, energy: 80, happy: 80, clean: 80 },
  // Achievement progression. `counters` are running totals; `achievements`
  // is a per-id { unlocked, at } map; `treatsTried` is a list of treat ids
  // ever fed; `sawDay`/`sawNight` flip true once the player has seen each
  // phase of the cycle. See achievements.js.
  counters: {
    wheelRuns: 0, cleaned: 0, pets: 0,
    // Surfaced in the Stats panel (stats.js). Earned-vs-balance is a
    // common "lifetime" measure; play time + bests round it out.
    coinsEarned: 0, visitorsReceived: 0, treatsFed: 0,
    bestRain: 0, longestStreak: 0, playSeconds: 0,
    // Long-tail milestone counters (achievements.js). naps/baths/chews
    // count successful completions of the matching mode; coinsSpent is
    // bumped on every non-free shop purchase; photos counts screenshots.
    naps: 0, baths: 0, chews: 0, coinsSpent: 0, photos: 0,
  },
  achievements: {},
  treatsTried: [],
  sawDay: false,
  sawNight: false,
  // Daily streak (see streak.js). lastVisit is a YYYY-MM-DD local-date
  // string; streak is the consecutive-day count, currently the day the
  // player is on (so a 1-day streak means "today is the first day").
  lastVisit: '',
  streak: 0,
  // Habitat theme. `themesOwned` always contains 'classic' (the free
  // default). `activeTheme` is the one buildBg() reads from.
  themesOwned: ['classic'],
  activeTheme: 'classic',
};

// Habitat color palettes. Each theme repaints the wall, floor, bedding
// strands, and a few decorative surfaces (sand patch, hay, fence). The
// non-themed elements (stump, burrow, plant tufts, stones, hut, wheel,
// etc.) keep their original colors so they read as consistent across
// themes — the "theme" is the room around the props, not the props.
//
// Used by background.js. Keep new themes consistent with this shape so
// buildBg can read every key blindly.
export const THEMES = {
  classic: {
    name: 'Classic',
    wall:      '#ede8d5',
    floor:     '#d4c49e',
    bedding:   'rgba(170,140,95,0.5)',
    sand:      '#c8b888',
    hay:       '#e8dfbc',
    fence:     '#c4a06a',
    fenceRail: 'rgba(180,138,88,0.4)',
    glass:     'rgba(180,210,230,0.5)',
    rim:       '#cacaca',
  },
  meadow: {
    name: 'Meadow',
    wall:      '#dceadc',
    floor:     '#b6c8a4',
    bedding:   'rgba(110,140,75,0.5)',
    sand:      '#a8c298',
    hay:       '#d4e0b8',
    fence:     '#8aa478',
    fenceRail: 'rgba(120,150,90,0.4)',
    glass:     'rgba(180,230,200,0.5)',
    rim:       '#a4b89c',
  },
  sunset: {
    name: 'Sunset',
    wall:      '#f4ddc8',
    floor:     '#dca888',
    bedding:   'rgba(170,90,60,0.45)',
    sand:      '#e8bd98',
    hay:       '#f0c8a4',
    fence:     '#b88058',
    fenceRail: 'rgba(180,100,60,0.4)',
    glass:     'rgba(255,210,170,0.55)',
    rim:       '#caa48a',
  },
  lavender: {
    name: 'Lavender',
    wall:      '#e8dcf0',
    floor:     '#bba8d0',
    bedding:   'rgba(140,100,170,0.45)',
    sand:      '#cab8d8',
    hay:       '#dac4e8',
    fence:     '#a484b8',
    fenceRail: 'rgba(160,120,190,0.4)',
    glass:     'rgba(220,200,240,0.55)',
    rim:       '#b4a4c0',
  },
  cherryBlossom: {
    name: 'Cherry Blossom',
    wall:      '#fce4ec',
    floor:     '#f0c8d8',
    bedding:   'rgba(180,100,140,0.4)',
    sand:      '#f0c0d0',
    hay:       '#fce0e8',
    fence:     '#d8a0b8',
    fenceRail: 'rgba(180,120,150,0.4)',
    glass:     'rgba(255,200,220,0.55)',
    rim:       '#e0a8c0',
  },
};

// Roman numeral tier suffixes — "Cuddler I", "Cuddler II", etc. Goes
// up to VII just to leave headroom; we never expand past five tiers
// in practice but the cost is zero.
const TIER_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Generate a tiered set of achievements for a single counter or state
// field. Returns an array of achievement defs ready to spread into
// ACHIEVEMENT_DEFS.
//
//   counter:'pets', levels:[5, 25] → [{ count:'pets', threshold:5,
//                                       reward:8 }, { ..., threshold:25,
//                                       reward:13 }]
//   custom:'coinsHeld', levels:[100,500] → entries with custom:
//                                       'coinsHeld_100', 'coinsHeld_500'
//
// Reward grows exponentially with tier (×1.55 per step), rounded.
function tier({ idP, label, icon, counter, custom, levels, baseR, desc }) {
  return levels.map((threshold, i) => {
    const ach = {
      id: `${idP}${threshold}`,
      icon,
      name: `${label} ${TIER_LABELS[i] || `Lv${i + 1}`}`,
      desc: desc(threshold),
      reward: Math.round(baseR * Math.pow(1.55, i)),
    };
    if (custom) {
      ach.custom = `${custom}_${threshold}`;
    } else {
      ach.count = counter;
      ach.threshold = threshold;
    }
    return ach;
  });
}

// Achievement definitions. Each entry is one unlockable goal. The exact
// trigger model depends on which optional fields are present:
//
//   trigger:'name'    — fires on a one-shot event (onTrigger('name') in
//                       achievements.js). Used for "do X once" goals.
//   count:'counter',
//   threshold:N       — counter-based: bumpCounter('counter') in
//                       achievements.js increments save.counters[counter] and
//                       unlocks once it reaches threshold.
//   custom:'key'      — checked by the switch in achievements.js's
//                       checkCustom() against current save state. Used for
//                       state-derived goals like "max all stats" or
//                       "own every cosmetic".
//
// All achievements grant `reward` coins on unlock and pop a toast. Order
// here is the order they appear in the achievements modal — early ones are
// the easy onboarding ones, later ones are the long-term goals.
export const ACHIEVEMENT_DEFS = [
  { id: 'firstBite',    icon: '🌻', name: 'First Bite',         desc: 'Feed your hamster a seed.',          reward:  5, trigger: 'feed' },
  { id: 'bottomsUp',    icon: '💧', name: 'Bottoms Up',         desc: 'Drink from the water bottle.',       reward:  5, trigger: 'drink' },
  { id: 'sweetDreams',  icon: '😴', name: 'Sweet Dreams',       desc: 'Take a nap in the hut.',             reward:  5, trigger: 'nap' },
  { id: 'firstFriend',  icon: '❤️', name: 'First Friend',        desc: 'Pet your hamster.',                  reward:  5, trigger: 'pet' },
  { id: 'crunchTime',   icon: '🪵', name: 'Crunch Time',        desc: 'Chew the wood log.',                 reward:  5, trigger: 'chew' },
  { id: 'squeakyClean', icon: '🛁', name: 'Squeaky Clean',      desc: 'Take a sand bath.',                  reward:  5, trigger: 'bath' },
  { id: 'firstTreat',   icon: '🥕', name: 'Treat Time',         desc: 'Buy and feed a treat.',              reward:  5, trigger: 'treat' },
  { id: 'fashionista',  icon: '🎀', name: 'Fashionista',        desc: 'Wear a costume.',                    reward: 10, trigger: 'equip' },

  { id: 'wheel1',       icon: '🎡', name: 'On a Roll',          desc: 'Complete a wheel run.',              reward:  5, count: 'wheelRuns', threshold:  1 },
  { id: 'wheel10',      icon: '🏃', name: 'Wheel Warrior',      desc: 'Complete 10 wheel runs.',            reward: 25, count: 'wheelRuns', threshold: 10 },
  { id: 'wheel50',      icon: '🏆', name: 'Marathon Hammie',    desc: 'Complete 50 wheel runs.',            reward: 75, count: 'wheelRuns', threshold: 50 },
  { id: 'tidy10',       icon: '♻️', name: 'Tidy',                desc: 'Clean up 10 messes.',                reward: 10, count: 'cleaned',   threshold: 10 },
  { id: 'tidy50',       icon: '🧹', name: 'Janitor',            desc: 'Clean up 50 messes.',                reward: 30, count: 'cleaned',   threshold: 50 },
  { id: 'pet50',        icon: '💖', name: 'Cuddle Bug',         desc: 'Pet your hamster 50 times.',         reward: 30, count: 'pets',      threshold: 50 },

  { id: 'bouncy',       icon: '🔴', name: 'Bouncy',             desc: 'Buy the bouncy ball.',               reward: 10, custom: 'ownBall' },
  { id: 'tunnelVision', icon: '🟦', name: 'Tunnel Vision',      desc: 'Buy the crawl tunnel.',              reward: 15, custom: 'ownTunnel' },
  { id: 'royalty',      icon: '👑', name: 'Royalty',            desc: 'Buy the Royal Crown.',               reward: 30, custom: 'ownCrown' },
  { id: 'hatTrick',     icon: '🎩', name: 'Hat Trick',          desc: 'Own all three costumes.',            reward: 50, custom: 'allCosmetics' },
  { id: 'foodCritic',   icon: '👨‍🍳', name: 'Food Critic',         desc: 'Try every treat type.',              reward: 50, custom: 'foodCritic' },
  { id: 'rich',         icon: '💰', name: 'Rich Rodent',        desc: 'Hold 200 coins at once.',            reward: 30, custom: 'rich' },
  { id: 'maxStats',     icon: '🌟', name: 'Hamster Whisperer',  desc: 'Get all five stats above 85.',         reward:100, custom: 'maxStats' },
  { id: 'dayNight',     icon: '🌗', name: 'Day & Night',        desc: 'See both day and night.',            reward: 15, custom: 'dayNight' },

  // Treat Rain mini-game
  { id: 'treatRain',    icon: '🌧️', name: 'Storm Catcher',      desc: 'Play a Treat Rain round.',            reward: 10, trigger: 'treatRain' },
  { id: 'treatStorm',   icon: '⚡', name: 'Eye of the Storm',    desc: 'Catch 25+ treats in one round.',      reward: 60, trigger: 'treatStorm' },

  // Visiting friend
  { id: 'visitor',      icon: '👋', name: 'Friendly Neighbor',  desc: 'Have a friend hamster visit.',        reward: 15, trigger: 'visitor' },
  { id: 'petVisitor',   icon: '💞', name: 'Best Friends',       desc: 'Pet a visiting friend.',              reward: 20, trigger: 'petVisitor' },
  { id: 'feedVisitor',  icon: '🎁', name: 'Generous',           desc: 'Feed a visiting friend a seed.',      reward: 25, trigger: 'feedVisitor' },

  // Climbing ladder
  { id: 'ladder',       icon: '🪜', name: 'Top of the World',   desc: 'Climb the ladder to the top.',        reward: 20, trigger: 'ladder' },

  // Daily streak
  { id: 'streak3',      icon: '🌟', name: 'Daily Visitor',      desc: 'Reach a 3-day login streak.',         reward: 25, trigger: 'streak3' },
  { id: 'streak7',      icon: '⭐', name: 'Weekly Habit',       desc: 'Reach a 7-day login streak.',         reward: 75, trigger: 'streak7' },

  // Premium content
  { id: 'sweetTooth',   icon: '🍰', name: 'Sweet Tooth',        desc: 'Eat a Hamster Cake.',                 reward: 25, custom: 'sweetTooth' },
  { id: 'robotics',     icon: '🤖', name: 'Automation',         desc: 'Buy the cleaning bot.',               reward: 30, custom: 'ownRoomba' },

  // Long-tail milestones — these accumulate over many sessions
  { id: 'daydreamer',    icon: '😴', name: 'Daydreamer',        desc: 'Take 10 naps.',                       reward: 30, count: 'naps',   threshold: 10 },
  { id: 'bathLover',     icon: '🛀', name: 'Bath Lover',        desc: 'Take 10 sand baths.',                 reward: 30, count: 'baths',  threshold: 10 },
  { id: 'woodWhisperer', icon: '🪓', name: 'Wood Whisperer',    desc: 'Chew the log 20 times.',              reward: 30, count: 'chews',  threshold: 20 },
  { id: 'photographer',  icon: '📸', name: 'Photographer',      desc: 'Take 10 snapshots.',                  reward: 25, count: 'photos', threshold: 10 },
  { id: 'bigSpender',    icon: '💸', name: 'Big Spender',       desc: 'Spend 500 coins lifetime.',           reward: 50, custom: 'bigSpender' },

  // ---- Generated tier ladders (~50 entries) ----
  // Each block expands a counter or state field across multiple thresholds.
  // The helper below grows progression naturally without 100+ hand-written
  // entries. Counter-based ladders rely on bumpCounter() in achievements.js;
  // custom-based ones use the generic "<field>_<threshold>" pattern handled
  // in passesCustom (achievements.js).
  ...tier({ idP:'petTier_',    label:'Cuddler',     icon:'❤️',  counter:'pets',             levels:[5, 25, 250, 1000],         baseR: 8, desc:n=>`Pet your hamster ${n} times.` }),
  ...tier({ idP:'wheelTier_',  label:'Wheel Pro',   icon:'🎡',  counter:'wheelRuns',        levels:[100, 250, 1000],           baseR:30, desc:n=>`Complete ${n} wheel runs.` }),
  ...tier({ idP:'cleanTier_',  label:'Cleaner',     icon:'♻️',  counter:'cleaned',          levels:[1, 5, 200, 1000],          baseR: 5, desc:n=>`Clean up ${n} mess${n===1?'':'es'}.` }),
  ...tier({ idP:'napTier_',    label:'Sleeper',     icon:'😴',  counter:'naps',             levels:[1, 25, 100],               baseR:10, desc:n=>`Take ${n} nap${n===1?'':'s'}.` }),
  ...tier({ idP:'bathTier_',   label:'Bather',      icon:'🛁',  counter:'baths',            levels:[1, 25, 100],               baseR:10, desc:n=>`Take ${n} sand bath${n===1?'':'s'}.` }),
  ...tier({ idP:'chewTier_',   label:'Chewer',      icon:'🪵',  counter:'chews',            levels:[1, 5, 100, 500],           baseR: 5, desc:n=>`Chew the log ${n} time${n===1?'':'s'}.` }),
  ...tier({ idP:'photoTier_',  label:'Snap',        icon:'📸',  counter:'photos',           levels:[1, 25, 50],                baseR:10, desc:n=>`Take ${n} snapshot${n===1?'':'s'}.` }),
  ...tier({ idP:'feedTier_',   label:'Caretaker',   icon:'🌻',  counter:'treatsFed',        levels:[1, 5, 25, 100],            baseR: 8, desc:n=>`Feed ${n} treat${n===1?'':'s'}.` }),
  ...tier({ idP:'visTier_',    label:'Host',        icon:'👋',  counter:'visitorsReceived', levels:[5, 25, 100],               baseR:30, desc:n=>`Receive ${n} friend visits.` }),

  // State-based custom checks (resolved generically in achievements.js)
  ...tier({ idP:'earned_',  label:'Earner',    icon:'💰', custom:'coinsEarned', levels:[100, 500, 2000, 10000, 50000], baseR:25, desc:n=>`Earn ${n} coins lifetime.` }),
  ...tier({ idP:'spent_',   label:'Spender',   icon:'💸', custom:'coinsSpent',  levels:[100, 1000, 5000],              baseR:25, desc:n=>`Spend ${n} coins lifetime.` }),
  ...tier({ idP:'hold_',    label:'Saver',     icon:'💎', custom:'coinsHeld',   levels:[100, 500, 1000, 5000],         baseR:25, desc:n=>`Hold ${n} coins at once.` }),
  ...tier({ idP:'rain_',    label:'Catcher',   icon:'🌧️', custom:'bestRain',    levels:[5, 15, 50],                    baseR:25, desc:n=>`Catch ${n}+ treats in one round.` }),
  ...tier({ idP:'streakN_', label:'Devotee',   icon:'⭐', custom:'streak',      levels:[14, 30, 100],                  baseR:60, desc:n=>`Reach a ${n}-day login streak.` }),
  ...tier({ idP:'time_',    label:'Dedicated', icon:'⏱️', custom:'playTime',    levels:[1800, 7200, 36000, 180000],    baseR:30, desc:n=>{
    const h = n / 3600;
    return h >= 1 ? `Play for ${h} hour${h === 1 ? '' : 's'} total.` : `Play for ${Math.round(n/60)} minutes total.`;
  } }),

  // ---- Combo / multi-condition achievements ----
  // These check multiple state conditions at once, so they're harder
  // than single-counter tier ladders and add meaningful variety.
  // Custom check ids start with "combo_" — handled in achievements.js.
  { id: 'comboCarer',       icon: '🌈', name: 'Caring Hand',     desc: 'All five stats above 70 at once.',     reward:  60, custom: 'combo_carer' },
  { id: 'comboHoarder',     icon: '📦', name: 'Hoarder',         desc: 'Own 10+ different items / themes.',    reward:  80, custom: 'combo_hoarder' },
  { id: 'comboHardWorker',  icon: '💪', name: 'Hard Worker',     desc: 'Wheel runs ≥100 AND messes ≥100.',     reward: 100, custom: 'combo_hardWorker' },
  { id: 'comboSpaLover',    icon: '✨', name: 'Spa Lover',       desc: 'Baths ≥10 AND clean stat ≥95.',         reward:  60, custom: 'combo_spa' },
  { id: 'comboBigSpender',  icon: '💳', name: 'High Roller',     desc: 'Spend 1000+ AND earn 2000+ coins.',     reward: 100, custom: 'combo_highRoller' },
  { id: 'comboSocialite',   icon: '🥰', name: 'Socialite',       desc: '5+ visits, plus pet AND feed a friend.', reward:  80, custom: 'combo_socialite' },
  { id: 'comboMarathon',    icon: '⏳', name: 'Marathon',        desc: '50 wheel runs AND 1+ hour played.',     reward: 100, custom: 'combo_marathon' },
  { id: 'comboCollector',   icon: '🎯', name: 'Completionist',   desc: 'Own all toys AND all costumes.',        reward: 150, custom: 'combo_collector' },
  { id: 'comboGardener',    icon: '🌿', name: 'Garden Host',     desc: 'Meadow theme + 5 friend visits.',       reward:  60, custom: 'combo_gardener' },
  { id: 'comboSunChaser',   icon: '🌅', name: 'Sun Chaser',      desc: 'Sunset theme active during day.',       reward:  40, custom: 'combo_sunChaser' },
  { id: 'comboNightOwl',    icon: '🌌', name: 'Night Owl',       desc: 'Lavender theme + saw the night.',       reward:  40, custom: 'combo_nightOwl' },
  { id: 'comboBlossom',     icon: '🌸', name: 'Blossom',         desc: 'Cherry Blossom theme + Food Critic.',    reward:  60, custom: 'combo_blossom' },
  { id: 'comboRoyalCourt',  icon: '🏰', name: 'Royal Court',     desc: 'Own crown + wizard hat.',               reward:  80, custom: 'combo_royalCourt' },
  { id: 'comboFoodie',      icon: '🍱', name: 'True Foodie',     desc: '50+ treats fed AND tried every type.',  reward:  80, custom: 'combo_foodie' },
  { id: 'comboCuddleSage',  icon: '🤍', name: 'Cuddle Sage',     desc: 'Pet 200+ times AND own all costumes.',  reward: 100, custom: 'combo_cuddleSage' },
  { id: 'comboCleanFreak',  icon: '🧽', name: 'Clean Freak',     desc: 'Cleaned 100+ AND own the cleaning bot.', reward:  80, custom: 'combo_cleanFreak' },
  // Second batch — multi-condition checks against new combinations.
  { id: 'comboFirstHour',   icon: '🕐', name: 'First Hour',      desc: 'Play for 1 hour in a single session.', reward:  60, custom: 'combo_firstHour' },
  { id: 'comboThemeCurator',icon: '🖼️', name: 'Theme Curator',   desc: 'Own 4 or more habitat themes.',         reward:  80, custom: 'combo_themeCurator' },
  { id: 'comboAllToys',     icon: '🧸', name: 'Toy Collector',   desc: 'Own all four toys.',                    reward: 100, custom: 'combo_allToys' },
  { id: 'comboTourGuide',   icon: '🗺️', name: 'Tour Guide',      desc: '10+ visits AND 5+ themes owned.',       reward: 120, custom: 'combo_tourGuide' },
  { id: 'comboMultiPet',    icon: '💞', name: 'Pet & Feed',      desc: '100+ pets AND 50+ treats fed.',         reward:  90, custom: 'combo_multiPet' },
  { id: 'comboBotMaster',   icon: '⚙️', name: 'Bot Master',      desc: 'Own roomba AND cleaned 200+.',          reward:  90, custom: 'combo_botMaster' },
  { id: 'comboFashionShow', icon: '👗', name: 'Fashion Show',    desc: 'Own all costumes AND non-classic theme.', reward:  90, custom: 'combo_fashionShow' },
  { id: 'comboNoStress',    icon: '🌷', name: 'No Stress',       desc: 'All five stats above 80 simultaneously.', reward:  80, custom: 'combo_noStress' },
  { id: 'comboGoodHabits',  icon: '📅', name: 'Good Habits',     desc: '7-day streak AND 50+ wheel runs.',      reward: 100, custom: 'combo_goodHabits' },
  { id: 'comboTrueLove',    icon: '💗', name: 'True Love',       desc: '500+ pets total.',                      reward: 120, custom: 'combo_trueLove' },
  // Third batch — meta and lifestyle combos.
  { id: 'comboBalanced',    icon: '⚖️', name: 'Balanced',        desc: 'Pets, wheel, AND cleans all ≥ 50.',     reward:  90, custom: 'combo_balanced' },
  { id: 'comboBeginner',    icon: '🐣', name: 'Apprentice',      desc: 'Unlock 10+ achievements.',              reward:  30, custom: 'combo_ach10' },
  { id: 'comboHalfway',     icon: '🌗', name: 'Halfway There',   desc: 'Unlock 25+ achievements.',              reward:  80, custom: 'combo_ach25' },
  { id: 'comboCenturion',   icon: '💯', name: 'Century',         desc: 'Unlock 100+ achievements.',             reward: 250, custom: 'combo_ach100' },
  { id: 'comboCozyDay',     icon: '☕', name: 'Cozy Day',        desc: '3+ naps AND 3+ chews AND 3+ baths.',    reward:  60, custom: 'combo_cozy' },
  { id: 'comboHandyman',    icon: '🔧', name: 'Handyman',        desc: 'Own ladder AND 100+ wheel runs.',       reward:  80, custom: 'combo_handyman' },
  { id: 'comboLuckyDay',    icon: '🍀', name: 'Lucky Day',       desc: '3-day streak AND 100+ coins held.',     reward:  60, custom: 'combo_luckyDay' },
  { id: 'comboTaste',       icon: '🍴', name: 'Refined Taste',   desc: 'Rich Rodent AND Food Critic.',          reward: 100, custom: 'combo_taste' },
  { id: 'comboBasicCare',   icon: '🌟', name: 'Basic Care',      desc: 'Drink AND nap AND bath in one save.',    reward:  40, custom: 'combo_basicCare' },
  { id: 'comboFitness',     icon: '💪', name: 'Fitness',         desc: '100+ wheel runs AND clean stat ≥ 80.',  reward:  80, custom: 'combo_fitness' },
  { id: 'comboShopaholic',  icon: '🛍️', name: 'Shopaholic',      desc: 'Spend 500+ AND own 5+ items.',           reward: 100, custom: 'combo_shopaholic' },
  { id: 'comboBigSpender2', icon: '💎', name: 'Diamond Spender', desc: 'Spend 5000 coins lifetime.',            reward: 200, custom: 'combo_bigSpender2' },
  { id: 'comboLegacy',      icon: '🏛️', name: 'Lasting Legacy',  desc: '14-day streak AND 3+ items owned.',     reward: 150, custom: 'combo_legacy' },
  { id: 'comboFreeSpirit',  icon: '🦋', name: 'Free Spirit',     desc: 'Saw day AND night AND 5+ visits.',       reward:  80, custom: 'combo_freeSpirit' },
  { id: 'comboCleanLife',   icon: '🪞', name: 'Clean Life',      desc: 'Own roomba AND clean stat ≥ 95.',       reward:  60, custom: 'combo_cleanLife' },

  // ---- Massive 10×2000 task ladders (=20,000 entries) ----
  // Linear-threshold ladders: 1000 tiers each across 10 counter categories.
  // Most thresholds are unreachable in normal play (and that's fine — the
  // user explicitly asked for 10000 tasks). The achievements modal
  // paginates so we never try to render 10000 DOM nodes at once. Rewards
  // are capped at 9999 to avoid silly inflation; the modal sort keeps the
  // closest-to-done at the top so the player always has visible next steps.
  ...generateMassTiers(),
];

// Mass tier generator. Runs once at module load and produces 10,000 entries.
// Implemented separately from the regular tier() helper because (a) the
// reward formula is different (linear, capped, not exponential) and (b)
// keeping the spec list compact makes the data easy to read.
function generateMassTiers() {
  const specs = [
    { idP:'mPet_',   label:'Cuddle',  icon:'💕', counter:'pets',             baseLevel:10, baseR:3, desc:n=>`Pet your hamster ${n} times.` },
    { idP:'mWheel_', label:'Wheel',   icon:'🏃', counter:'wheelRuns',        baseLevel:5,  baseR:5, desc:n=>`Complete ${n} wheel runs.` },
    { idP:'mClean_', label:'Tidy',    icon:'✨', counter:'cleaned',          baseLevel:5,  baseR:3, desc:n=>`Clean up ${n} messes.` },
    { idP:'mNap_',   label:'Sleep',   icon:'💤', counter:'naps',             baseLevel:1,  baseR:5, desc:n=>`Take ${n} naps.` },
    { idP:'mBath_',  label:'Bath',    icon:'🫧', counter:'baths',            baseLevel:1,  baseR:5, desc:n=>`Take ${n} sand baths.` },
    { idP:'mChew_',  label:'Chew',    icon:'🌳', counter:'chews',            baseLevel:5,  baseR:3, desc:n=>`Chew the log ${n} times.` },
    { idP:'mPhoto_', label:'Photo',   icon:'🎞️', counter:'photos',           baseLevel:1,  baseR:5, desc:n=>`Take ${n} snapshots.` },
    { idP:'mTreat_', label:'Foodie',  icon:'🥬', counter:'treatsFed',        baseLevel:1,  baseR:5, desc:n=>`Feed ${n} treats.` },
    { idP:'mVisit_', label:'Greeter', icon:'🫂', counter:'visitorsReceived', baseLevel:1,  baseR:8, desc:n=>`Receive ${n} friend visits.` },
    { idP:'mCoin_',  label:'Wealth',  icon:'🪙', custom: 'coinsEarned',      baseLevel:50, baseR:5, desc:n=>`Earn ${n} coins lifetime.` },
  ];
  const out = [];
  for (const spec of specs) {
    // 10,000 tiers per category × 10 categories = 100,000 mass entries.
    for (let i = 0; i < 10000; i++) {
      const threshold = spec.baseLevel * (i + 1);
      const reward = Math.min(9999, spec.baseR + Math.floor(threshold * 0.08));
      const ach = {
        id: `${spec.idP}${threshold}`,
        icon: spec.icon,
        name: `${spec.label} ${i + 1}`,
        desc: spec.desc(threshold),
        reward,
      };
      if (spec.custom) {
        ach.custom = `${spec.custom}_${threshold}`;
      } else {
        ach.count = spec.counter;
        ach.threshold = threshold;
      }
      out.push(ach);
    }
  }
  return out;
}
