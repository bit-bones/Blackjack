import { state, handTotal, hasRelic } from './state.js';
import { MAX_BET } from './constants.js';

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// DOM Cache
export const ui = {
  minBetEl: $("#minBet"),
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
  splitBtn: $("#splitBtn"),
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
  gameOverMessageEl: $("#gameOverMessage"),
  finalHighScoreEl: $("#finalHighScore"),
  restartBtn: $("#restartBtn"),
  menuModal: $("#menuModal"),
  menuNewRunBtn: $("#menuNewRunBtn"),
  menuRelicsBtn: $("#menuRelicsBtn"),
  menuHotkeysBtn: $("#menuHotkeysBtn"),
  menuResumeBtn: $("#menuResumeBtn"),
  relicListModal: $("#relicListModal"),
  allRelicsListEl: $("#allRelicsList"),
  currentRelicsListEl: $("#currentRelicsList"),
  relicListDescEl: $("#relicListDesc"),
  relicTabCurrent: $("#relicTabCurrent"),
  relicTabAll: $("#relicTabAll"),
  closeRelicListBtn: $("#closeRelicListBtn"),
  hotkeysModal: $("#hotkeysModal"),
  hotkeysListEl: $("#hotkeysList"),
  closeHotkeysBtn: $("#closeHotkeysBtn"),
  resetHotkeysBtn: $("#resetHotkeysBtn"),
  toastEl: $("#toast"),
  splitArea: $("#splitArea"),
  splitHandsContainer: $("#splitHandsContainer"),
  newRunModal: $("#newRunModal"),
  newRunRelicsToggle: $("#newRunRelicsToggle"),
  newRunSeedInput: $("#newRunSeed"),
  newRunStartBtn: $("#newRunStartBtn"),
  newRunBackBtn: $("#newRunBackBtn"),
  menuSeedRow: $("#menuSeedRow"),
  menuSeedValue: $("#menuSeedValue"),
  copySeedBtn: $("#copySeedBtn"),
};

export function createCardEl(card, faceDown = false) {
  const el = document.createElement("div");
  el.className = "card deal-in";

  if (faceDown) {
    el.classList.add("face-down");
  }

  const red = (card.suit === "♥" || card.suit === "♦");
  el.classList.add(red ? "red" : "black");

  // create structured inner elements that match styles.css
  const rankEl = document.createElement("div");
  rankEl.className = "rank";
  rankEl.textContent = card.rank;

  const suitEl = document.createElement("div");
  suitEl.className = "suit";
  suitEl.textContent = card.suit;

  const pipEl = document.createElement("div");
  pipEl.className = "pip";
  pipEl.textContent = card.suit;

  el.appendChild(rankEl);
  el.appendChild(suitEl);
  el.appendChild(pipEl);

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

/** Flip only the dealer's hidden card face-up without rebuilding any other cards */
export function revealDealerCard() {
  const hiddenEl = ui.dealerHandEl.children[1];
  if (!hiddenEl || !hiddenEl.classList.contains('face-down')) return;

  const card = state.dealerHand[1];
  hiddenEl.classList.remove('face-down');
  hiddenEl.classList.add('flip-reveal');

  // Populate card content (rank/suit/pip) that was hidden
  const rankEl = hiddenEl.querySelector('.rank');
  const suitEl = hiddenEl.querySelector('.suit');
  const pipEl = hiddenEl.querySelector('.pip');
  if (rankEl) rankEl.textContent = card.rank;
  if (suitEl) suitEl.textContent = card.suit;
  if (pipEl) pipEl.textContent = card.suit;

  // Update dealer total to show full hand
  ui.dealerTotalEl.textContent = `Total: ${handTotal(state.dealerHand).total}`;
}

export function updateTopbar() {
  ui.minBetEl.textContent = state.minBet;
  ui.chipsEl.textContent = state.chips;
  ui.betEl.textContent = state.bet;
  ui.streakEl.textContent = `${state.streak} 🔥`;  // Added flame emoji for win streak
  ui.starsEl.textContent = state.stars;
  // Hide stars and streak in classic mode
  const starsStat = ui.starsEl.closest(".stat");
  const streakStat = ui.streakEl.closest(".stat");
  if (starsStat) starsStat.style.display = state.classicMode ? "none" : "";
  if (streakStat) streakStat.style.display = state.classicMode ? "none" : "";
  // Hide min bet escalation display in classic mode
  const minBetStat = ui.minBetEl.closest(".stat");
  if (minBetStat) minBetStat.style.display = state.classicMode ? "none" : "";
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
  // Toggle phase class on controls for mobile layout swapping
  const controlsEl = document.querySelector('.controls');
  if (controlsEl) {
    controlsEl.classList.remove('phase-betting', 'phase-playing');
    controlsEl.classList.add(state.phase === 'betting' ? 'phase-betting' : 'phase-playing');
  }

  [ui.hitBtn, ui.standBtn, ui.doubleBtn, ui.surrenderBtn, ui.splitBtn, ui.peekBtn].forEach(b => b.disabled = true);

  if (state.phase === "betting") {
    ui.dealBtn.disabled = state.bet < state.minBet || state.bet > state.chips;
    ui.betRange.disabled = false;
    $$(".pill").forEach(b => b.disabled = false);

  } else if (state.phase === "player") {
    ui.dealBtn.disabled = true;
    ui.betRange.disabled = true;
    $$(".pill").forEach(b => b.disabled = true);

    ui.hitBtn.disabled = false;
    ui.standBtn.disabled = false;

    const canDoubleNow = state.flags.canDouble && state.playerHand.length === 2 && (state.chips >= state.bet);
    ui.doubleBtn.disabled = !canDoubleNow;
    ui.surrenderBtn.disabled = !state.flags.canSurrender;

    const totalHands = Math.max(1, state.splitHandIndex) + state.splitHands.length;
    const hasPair = state.playerHand.length === 2 && state.playerHand[0] && state.playerHand[1] && state.playerHand[0].value === state.playerHand[1].value;
    const canSplitNow = hasPair && totalHands < 4 && state.chips >= state.bet;
    ui.splitBtn.disabled = !canSplitNow;

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
  const relicsAside = document.querySelector("aside.relics");
  if (state.classicMode) {
    if (relicsAside) relicsAside.style.display = "none";
    return;
  }
  if (relicsAside) relicsAside.style.display = "";
  state.relics.forEach(r => {
    const el = document.createElement("div");
    el.className = "relic";
    el.innerHTML = `<div class="icon">${r.icon}</div><div><div class="name">${r.name}</div><div class="desc">${r.desc}</div></div>`;
    ui.relicsContainer.appendChild(el);
  });
}

/** Render all waiting split hands in the middle area */
export function renderSplitHands() {
  ui.splitHandsContainer.innerHTML = "";
  if (state.splitHands.length === 0) {
    ui.splitArea.style.display = "none";
    return;
  }
  ui.splitArea.style.display = "";
  state.splitHands.forEach((hand, i) => {
    const slot = document.createElement("div");
    slot.className = "split-hand-slot waiting";
    slot.setAttribute("data-split-index", String(i));

    const label = document.createElement("div");
    label.className = "split-hand-label";
    label.textContent = `Hand ${state.splitHandIndex + i + 1}`;
    slot.appendChild(label);

    const handDiv = document.createElement("div");
    handDiv.className = "hand";
    hand.forEach(c => {
      handDiv.appendChild(createCardEl(c));
    });
    slot.appendChild(handDiv);
    ui.splitHandsContainer.appendChild(slot);
  });
}

/** Deal a card from the shoe into a specific split hand slot with animation */
export function dealToSplitHand(splitIndex, card) {
  const slot = ui.splitHandsContainer.querySelector(`[data-split-index="${splitIndex}"]`);
  if (!slot) return;
  const handDiv = slot.querySelector(".hand");
  if (!handDiv) return;

  const el = createCardEl(card);
  const shoe = document.querySelector('.deck-stack');
  if (shoe) {
    const shoeRect = shoe.getBoundingClientRect();
    el.style.visibility = 'hidden';
    el.style.animation = 'none';
    handDiv.appendChild(el);
    const cardRect = el.getBoundingClientRect();
    const dx = shoeRect.left + shoeRect.width / 2 - (cardRect.left + cardRect.width / 2);
    const dy = shoeRect.top + shoeRect.height / 2 - (cardRect.top + cardRect.height / 2);
    el.style.setProperty('--deal-x', `${Math.round(dx)}px`);
    el.style.setProperty('--deal-y', `${Math.round(dy)}px`);
    el.style.removeProperty('visibility');
    el.style.removeProperty('animation');
    void el.offsetWidth;
  } else {
    handDiv.appendChild(el);
  }
}

/**
 * Animate a card element from a source position to its current position.
 * Measures sourceRect vs card's actual rect and sets custom properties
 * for the move-card animation.
 */
function animateMove(el, fromRect) {
  el.classList.remove('deal-in', 'move-card');
  el.style.animation = 'none';
  el.style.visibility = 'hidden';
  void el.offsetWidth;
  const toRect = el.getBoundingClientRect();
  const dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2);
  const dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
  el.style.setProperty('--move-x', `${Math.round(dx)}px`);
  el.style.setProperty('--move-y', `${Math.round(dy)}px`);
  el.style.removeProperty('visibility');
  el.style.removeProperty('animation');
  el.classList.add('move-card');
  void el.offsetWidth;
}

/**
 * Move the second card from the player hand up into a newly-created split slot.
 * Returns the slot element so the caller can chain a deal animation afterwards.
 */
export function animateCardToSplitArea(hand, splitIndex) {
  // Grab the current position of the last card in the player hand (the one being moved)
  const playerCards = ui.playerHandEl.children;
  const movingEl = playerCards[playerCards.length - 1];
  if (!movingEl) return;
  const fromRect = movingEl.getBoundingClientRect();

  // Remove it from player hand display
  ui.playerHandEl.removeChild(movingEl);
  ui.playerTotalEl.textContent = `Total: ${handTotal(state.playerHand).total}`;

  // Re-render split hands so the slot exists with the card in it
  renderSplitHands();

  // Find the card element that was just rendered in the split slot
  const slot = ui.splitHandsContainer.querySelector(`[data-split-index="${splitIndex}"]`);
  if (!slot) return;
  const slotCard = slot.querySelector('.hand .card');
  if (!slotCard) return;

  animateMove(slotCard, fromRect);
}

/**
 * Animate all cards from a split hand slot down into the player hand area.
 * Captures positions from the slot, renders cards into playerHandEl, then animates.
 */
export function animateCardsToPlayerArea(cards) {
  // Capture where the cards currently are in the split slot before we change anything
  // We need to find the slot that's about to be removed (index 0 since we shift)
  const slot = ui.splitHandsContainer.querySelector('[data-split-index="0"]');
  const fromRects = [];
  if (slot) {
    const slotCards = slot.querySelectorAll('.hand .card');
    slotCards.forEach(el => fromRects.push(el.getBoundingClientRect()));
  }

  // Now render the player hand with the new cards
  ui.playerHandEl.innerHTML = "";
  cards.forEach(c => {
    const el = createCardEl(c);
    el.classList.remove('deal-in');
    ui.playerHandEl.appendChild(el);
  });
  ui.playerTotalEl.textContent = `Total: ${handTotal(state.playerHand).total}`;

  // Animate each card from its old position
  const newCards = ui.playerHandEl.children;
  for (let i = 0; i < newCards.length && i < fromRects.length; i++) {
    animateMove(newCards[i], fromRects[i]);
  }
}
