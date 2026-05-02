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
];
