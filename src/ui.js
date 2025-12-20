import { state } from './state.js';
import { MAX_BET } from './constants.js';

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// DOM Cache
export const ui = {
  chipsEl: $("#chips"),
  betEl: $("#bet"),
  streakEl: $("#streak"),
  starsEl: $("#stars"),
  highScoreEl: $("#highScore"),
  dealerHandEl: $("#dealer-hand"),
  dealerTotalEl: $("#dealer-total"),
  playerHandEl: $("#player-hand"),
  playerTotalEl: $("#player-total"),
  betRange: $("#betRange"),
  dealBtn: $("#dealBtn"),
  hitBtn: $("#hitBtn"),
  standBtn: $("#standBtn"),
  doubleBtn: $("#doubleBtn"),
  surrenderBtn: $("#surrenderBtn"),
  peekBtn: $("#peekBtn"),
  hintEl: $("#hint"),
  relicsContainer: $("#relicsContainer"),
  relicModal: $("#relicModal"),
  relicChoicesEl: $("#relicChoices"),
  skipRelicBtn: $("#skipRelic"),
  resultModal: $("#resultModal"),
  resultTitleEl: $("#resultTitle"),
  resultMainTextEl: $("#resultMainText"),
  resultChipTotalEl: $("#resultChipTotal"),
  resultStarsRowEl: $("#resultStarsRow"),
  resultStarsTextEl: $("#resultStarsText"),
  resultStarTotalEl: $("#resultStarTotal"),
  resultContinueBtn: $("#resultContinueBtn"),
  resultGambleBtn: $("#resultGambleBtn"),
  gameOverModal: $("#gameOverModal"),
  finalHighScoreEl: $("#finalHighScore"),
  restartBtn: $("#restartBtn"),
  menuModal: $("#menuModal"),
  menuNewRunBtn: $("#menuNewRunBtn"),
  menuRelicsBtn: $("#menuRelicsBtn"),
  menuHotkeysBtn: $("#menuHotkeysBtn"),
  relicListModal: $("#relicListModal"),
  allRelicsListEl: $("#allRelicsList"),
  closeRelicListBtn: $("#closeRelicListBtn"),
  hotkeysModal: $("#hotkeysModal"),
  hotkeysListEl: $("#hotkeysList"),
  closeHotkeysBtn: $("#closeHotkeysBtn"),
  resetHotkeysBtn: $("#resetHotkeysBtn"),
  toastEl: $("#toast")
};

export function createCardEl(card, faceDown = false) {
  const el = document.createElement("div");
  el.className = "card deal-in";
  if (faceDown) {
    el.classList.add("face-down");
    return el;
  }
  const red = (card.suit === "♥" || card.suit === "♦");
  el.classList.add(red ? "red" : "black");
  el.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${card.suit}</span><span class="pip">${card.suit}</span>`;
  return el;
}

export function renderHands(revealDealer = false) {
  ui.dealerHandEl.innerHTML = "";
  ui.playerHandEl.innerHTML = "";

  state.dealerHand.forEach((c, i) => {
    const faceDown = (i === 1 && state.phase !== "dealer" && !revealDealer && !state.flags.dealerRevealed);
    ui.dealerHandEl.appendChild(createCardEl(c, faceDown));
  });

  state.playerHand.forEach((c) => {
    ui.playerHandEl.appendChild(createCardEl(c));
  });

  const dealerT = state.phase === "dealer" || revealDealer || state.flags.dealerRevealed
    ? handTotal(state.dealerHand).total
    : (state.dealerHand[0] ? handTotal([state.dealerHand[0]]).total : 0);

  const playerT = handTotal(state.playerHand).total;

  ui.dealerTotalEl.textContent = `Total: ${dealerT || 0}`;
  ui.playerTotalEl.textContent = `Total: ${playerT || 0}`;
}

export function updateTopbar() {
  ui.chipsEl.textContent = state.chips;
  ui.betEl.textContent = state.bet;
  ui.streakEl.textContent = `${state.streak} 🔥`;  // Added flame emoji for win streak
  ui.starsEl.textContent = state.stars;
  if (state.cheated) {
    ui.highScoreEl.innerHTML = '✗';
  } else {
    ui.highScoreEl.textContent = `${state.highScore} 🏆`;  // Added trophy emoji for high score
  }
  ui.betRange.min = String(state.minBet);
  ui.betRange.max = Math.min(MAX_BET, state.chips).toString();
  ui.betRange.value = String(Math.min(state.bet, Number(ui.betRange.max)));
}

export function setTotalsStyles(outcome) {
  ui.dealerTotalEl.classList.remove("win", "lose", "push");
  ui.playerTotalEl.classList.remove("win", "lose", "push");
  if (!outcome) return;
  if (outcome === "win" || outcome === "blackjack") {
    ui.playerTotalEl.classList.add("win");
    ui.dealerTotalEl.classList.add("lose");
  } else if (outcome === "lose") {
    ui.playerTotalEl.classList.add("lose");
    ui.dealerTotalEl.classList.add("win");
  } else if (outcome === "push") {
    ui.playerTotalEl.classList.add("push");
    ui.dealerTotalEl.classList.add("push");
  }
}

export function showHint(msg) {
  ui.hintEl.textContent = msg;
}

export function toast(msg) {
  ui.toastEl.textContent = msg;
  ui.toastEl.classList.add("show");
  setTimeout(() => ui.toastEl.classList.remove("show"), 1600);
}

export function setPhaseControls() {
  [ui.hitBtn, ui.standBtn, ui.doubleBtn, ui.surrenderBtn, ui.peekBtn].forEach(b => b.disabled = true);

  if (state.phase === "betting") {
    ui.dealBtn.disabled = state.bet < state.minBet || state.bet > state.chips;
    ui.betRange.disabled = false;
    $$(".pill").forEach(b => b.disabled = false);
    ui.dealBtn.classList.add("pulse");
    setTimeout(() => ui.dealBtn.classList.remove("pulse"), 1200);
  } else if (state.phase === "player") {
    ui.dealBtn.disabled = true;
    ui.betRange.disabled = true;
    $$(".pill").forEach(b => b.disabled = true);

    ui.hitBtn.disabled = false;
    ui.standBtn.disabled = false;

    const canDoubleNow = state.flags.canDouble && state.playerHand.length === 2 && (state.chips >= state.bet);
    ui.doubleBtn.disabled = !canDoubleNow;
    ui.surrenderBtn.disabled = !state.flags.canSurrender;

    const hasPeek = hasRelic("peek");
    ui.peekBtn.disabled = !(hasPeek && !state.flags.usedPeekThisHand);
    ui.peekBtn.style.display = hasPeek ? "inline-block" : "none";
  } else {
    ui.dealBtn.disabled = true;
    ui.betRange.disabled = true;
    $$(".pill").forEach(b => b.disabled = true);
  }
}

export function renderRelicsList() {
  ui.relicsContainer.innerHTML = "";
  state.relics.forEach(r => {
    const el = document.createElement("div");
    el.className = "relic";
    el.innerHTML = `
      <div class="icon">${r.icon}</div>
      <div class="name">${r.name}</div>
      <div class="desc">${r.desc}</div>
    `;
    ui.relicsContainer.appendChild(el);
  });
}