import { INITIAL_CHIPS } from './constants.js';

export const state = {
  chips: INITIAL_CHIPS,
  bet: 25,
  minBet: 5,

  deck: [],
  dealerHand: [],
  playerHand: [],

  phase: "betting", // betting | player | dealer | payout
  flags: {
    dealerRevealed: false,
    canDouble: true,
    canSurrender: true,
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
  state.flags.usedLuckyCoinThisHand = false;
  state.flags.usedPeekThisHand = false;
}

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}