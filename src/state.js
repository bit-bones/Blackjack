import { INITIAL_CHIPS } from './constants.js';

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function generateSeed() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = '';
  for (let i = 0; i < 8; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return seed;
}

export function initRng(seedStr) {
  state.seed = seedStr;
  state.rng = mulberry32(hashString(seedStr));
}

export const state = {
  chips: INITIAL_CHIPS,
  bet: 25,
  minBet: 5,

  seed: null,
  rng: null,
  classicMode: false,

  deck: [],
  dealerHand: [],
  playerHand: [],

  // Split state: supports up to 3 re-splits (4 total hands)
  splitHands: [],      // array of hand arrays waiting to be played
  splitBets: [],       // bet for each split hand
  splitResults: [],    // outcome string for each settled hand
  isSplitting: false,
  splitHandIndex: 0,   // which hand is currently being played (0-based across all hands)
  splitFromAces: false,
  dealerHasPlayed: false,

  phase: "betting", // betting | player | dealer | payout
  flags: {
    dealerRevealed: false,
    canDouble: true,
    canSurrender: true,
    canSplit: false,
    usedLuckyCoinThisHand: false,
    usedPeekThisHand: false,
    usedResurrectionThisRun: false,
  },

  streak: 0,
  stars: 0,
  relics: [],
  currentRelicChoices: [],
  selectedRelicIndex: -1,

  highScore: Number(localStorage.getItem("bjrl-highscore") || INITIAL_CHIPS),

  lastOutcome: null,
  lastInfo: "",
  pendingGameOver: false,

  isAllIn: false,
  lastWinDelta: 0,

  cheated: false,
};

export function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += c.value;
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const soft = aces > 0;
  return { total, soft };
}

export function isBlackjack(hand) {
  const t = handTotal(hand);
  return hand.length === 2 && t.total === 21;
}

export function hasRelic(id) {
  return !!state.relics.find(r => r.id === id);
}

export function getRelicHookValue(key, defaultVal) {
  for (const r of state.relics) {
    if (r.hooks && r.hooks[key] != null) return r.hooks[key];
  }
  return defaultVal;
}

export function resetHandFlags() {
  state.flags.dealerRevealed = false;
  state.flags.canDouble = true;
  state.flags.canSurrender = true;
  state.flags.canSplit = false;
  state.flags.usedLuckyCoinThisHand = false;
  state.flags.usedPeekThisHand = false;
}

export function shuffleInPlace(arr) {
  const rng = state.rng || Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}