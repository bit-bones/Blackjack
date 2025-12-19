export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const RANK_VALUE = (r) => {
  if (r === "A") return 11;
  if (["J", "Q", "K"].includes(r)) return 10;
  return parseInt(r, 10);
};

export const INITIAL_CHIPS = 100;
export const MAX_BET = 1000;

export const DEFAULT_HOTKEYS = {
  deal: "Enter",
  hit: "1",
  stand: "2",
  double: "3",
  surrender: "4",
  peek: "5",
  betMin: "1",
  betHalf: "2",
  betAllIn: "3",
  gamble: "g",
  continue: "Enter",
  relic1: "1",
  relic2: "2",
  confirmRelic: "Enter",
  skipRelic: "Escape"
};

export const ALL_RELICS = [
  {
    id: "lucky-coin",
    name: "Lucky Coin",
    icon: "🪙",
    desc: "Once per hand, if your first hit would bust, redraw that card with a small one.",
    hooks: { onPlayerHitBustSafe: true }
  },
  {
    id: "blackjack-boost",
    name: "Royal Payout",
    icon: "👑",
    desc: "Blackjack pays 2:1 instead of 3:2.",
    hooks: { blackjackPayout: 2.0 }
  },
  {
    id: "peek",
    name: "Card Counter’s Peek",
    icon: "👁️",
    desc: "Once per hand, peek at the dealer’s hole card.",
    hooks: { canPeek: true }
  },
  {
    id: "chip-drip",
    name: "Chip Drip",
    icon: "💧",
    desc: "Gain +1 chip after every hand, win or lose.",
    hooks: { chipEndBonus: 1 }
  },
  {
    id: "momentum",
    name: "Momentum",
    icon: "⚡",
    desc: "With a streak of 2+, wins pay +25%.",
    hooks: { streakWinBoost: 0.25 }
  },
  {
    id: "cool-headed",
    name: "Cool-Headed",
    icon: "🧊",
    desc: "Surrender refunds 60% of your bet (instead of 50%).",
    hooks: { surrenderRefund: 0.6 }
  },
  {
    id: "risky-gain",
    name: "Risky Gain",
    icon: "🎲",
    desc: "Going all-in on a winning hand grants an extra star."
  },
  {
    id: "Resurrection-token",
    name: "Resurrection Token",
    icon: "🔄",
    desc: "Once per run, if you bust, resurrect with 50% of your chips refunded.",
    hooks: { canResurrect: true }
  },
  {
    id: "gold-rush",
    name: "Gold Rush",
    icon: "💰",
    desc: "Wins pay +50% extra, but losses deduct an extra 10% of your remaining chips.",
    hooks: { winBonusPercent: 0.5, lossPenaltyPercent: 0.1 }
  },
  {
    id: "double-or-nothing",
    name: "Double or Nothing",
    icon: "⚠️",
    desc: "After a win, gamble your payout for a 50/50 chance to double it or lose it all.",
    hooks: { canGambleWin: true }
  },
  {
    id: "push-it",
    name: "Push it",
    icon: "🤝",
    desc: "Push hands no longer raise the minimum bet or reset your win streak."
  },
  {
    id: "big-winner",
    name: "Big Winner",
    icon: "🏆",
    desc: "Wins past 1 streak reduce min bet by (streak-1)*5. Losses increase min bet by 10."
  }
];