import { state, handTotal, hasRelic } from './state.js';
import { MAX_BET } from './constants.js';
import { playCardSlide } from './sfx.js';

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

/** Remove confirm-pending state from all buttons */
export function clearConfirmStates() {
  document.querySelectorAll('.confirm-pending').forEach(el => el.classList.remove('confirm-pending'));
}

/** Measure the felt element and set CSS custom properties so modals stay within its bounds */
export function updateModalBounds() {
  const felt = document.querySelector('.felt');
  if (!felt) return;
  const rect = felt.getBoundingClientRect();
  const root = document.documentElement;
  root.style.setProperty('--modal-top', `${Math.max(0, rect.top)}px`);
  root.style.setProperty('--modal-bottom', `${Math.max(0, window.innerHeight - rect.bottom)}px`);
}

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
  insuranceBtn: $("#insuranceBtn"),
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
  resultInsuranceRowEl: $("#resultInsuranceRow"),
  resultInsuranceTextEl: $("#resultInsuranceText"),
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
  lastResultEl: $("#lastResult"),
  newRunModal: $("#newRunModal"),
  newRunRelicsToggle: $("#newRunRelicsToggle"),
  newRunSeedInput: $("#newRunSeed"),
  newRunStartBtn: $("#newRunStartBtn"),
  newRunBackBtn: $("#newRunBackBtn"),
  menuSeedRow: $("#menuSeedRow"),
  menuSeedValue: $("#menuSeedValue"),
  copySeedBtn: $("#copySeedBtn"),
  menuOptionsBtn: $("#menuOptionsBtn"),
  optionsModal: $("#optionsModal"),
  unitSizeRow: $("#unitSizeRow"),
  unitSizeInput: $("#unitSizeInput"),
  showLastResultToggle: $("#showLastResultToggle"),
  closeOptionsBtn: $("#closeOptionsBtn"),
  confirmModal: $("#confirmModal"),
  confirmMessage: $("#confirmMessage"),
  confirmOkBtn: $("#confirmOkBtn"),
  confirmCancelBtn: $("#confirmCancelBtn"),
};

export function updateBetButtons() {
  const pills = document.querySelectorAll('.pill');
  if (pills.length < 3) return;
  if (state.bettingStyle === 'previous-bet') {
    pills[0].textContent = '½×';
    pills[1].textContent = 'Same';
    pills[2].textContent = '2×';
    pills[0].setAttribute('data-bet', 'prevHalf');
    pills[1].setAttribute('data-bet', 'prevSame');
    pills[2].setAttribute('data-bet', 'prevDouble');
  } else if (state.bettingStyle === 'units') {
    const u = state.unitSize;
    pills[0].textContent = `−${u}`;
    pills[1].textContent = `${u}`;
    pills[2].textContent = `+${u}`;
    pills[0].setAttribute('data-bet', 'unitMinus');
    pills[1].setAttribute('data-bet', 'unitSet');
    pills[2].setAttribute('data-bet', 'unitPlus');
  } else {
    pills[0].textContent = 'Min';
    pills[1].textContent = 'Half';
    pills[2].textContent = 'All-in';
    pills[0].setAttribute('data-bet', 'min');
    pills[1].setAttribute('data-bet', 'half');
    pills[2].setAttribute('data-bet', 'allin');
  }
}

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

// Track previous chip value for detecting changes in updateTopbar
let _prevChips = null;

/** Reset chip tracking so the next updateTopbar won't animate (use on new run / init) */
export function resetChipTracking() {
  _prevChips = null;
}

export function updateTopbar(skipAnimation = false) {
  const oldChips = _prevChips;
  _prevChips = state.chips;

  ui.minBetEl.textContent = state.minBet;

  // Animate chip changes if the value actually changed
  const chipDelta = (oldChips !== null && !skipAnimation) ? state.chips - oldChips : 0;
  if (chipDelta !== 0) {
    // Don't set textContent directly — let the counter animate it
    animateStatChange(ui.chipsEl, oldChips, state.chips);
  } else {
    ui.chipsEl.textContent = state.chips;
  }

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
  ui.betRange.min = "0";
  ui.betRange.max = Math.min(MAX_BET, state.chips).toString();
  ui.betRange.value = String(Math.min(state.bet, Number(ui.betRange.max)));
}

// Active counting animations keyed by element — used to cancel overlapping counts
const _activeCounters = new Map();

/**
 * Animate a stat value change: show a floating delta and incrementally count to the new value.
 *   el        – the <span> element displaying the number (e.g. ui.chipsEl)
 *   fromValue – the previous numeric value
 *   toValue   – the target numeric value
 */
export function animateStatChange(el, fromValue, toValue) {
  const delta = toValue - fromValue;
  if (delta === 0) return;

  // Prefer alignment to the actual chips value text so the delta appears directly beneath it.
  const chipsRect = el.getBoundingClientRect();
  if (!chipsRect) return;

  // --- floating delta label (appended to body with position: fixed) ---
  const floater = document.createElement('span');
  floater.className = 'stat-delta'
    + (delta < 0 ? ' subtract negative' : ' add positive');
  floater.textContent = (delta > 0 ? '+' : '') + delta;
  floater.style.left = (chipsRect.left + chipsRect.width / 2) + 'px';
  floater.style.top = (chipsRect.bottom + 2) + 'px';
  document.body.appendChild(floater);
  floater.addEventListener('animationend', () => floater.remove());

  // --- incremental counter ---
  // Cancel any in-progress count on this element
  if (_activeCounters.has(el)) {
    cancelAnimationFrame(_activeCounters.get(el));
    _activeCounters.delete(el);
  }

  const startValue = fromValue;
  const endValue = toValue;
  const diff = endValue - startValue;
  const totalSteps = Math.min(Math.abs(diff), 40); // cap to keep it fast
  const stepSize = diff / totalSteps;
  const stepDuration = Math.max(15, 400 / totalSteps); // total ~400ms
  let step = 0;
  let last = performance.now();

  // For additions, delay the count-up to sync with the float-up animation
  const delayMs = delta > 0 ? 500 : 0;
  const startTime = performance.now() + delayMs;

  // Set initial display
  el.textContent = startValue;

  function tick(now) {
    if (now < startTime) {
      _activeCounters.set(el, requestAnimationFrame(tick));
      return;
    }
    if (now - last >= stepDuration) {
      step++;
      last = now;
      const current = step >= totalSteps ? endValue : Math.round(startValue + stepSize * step);
      el.textContent = current;
    }
    if (step < totalSteps) {
      _activeCounters.set(el, requestAnimationFrame(tick));
    } else {
      el.textContent = endValue;
      _activeCounters.delete(el);
    }
  }
  _activeCounters.set(el, requestAnimationFrame(tick));
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

function setMessage(elem, msg) {
  if (typeof msg !== 'string') msg = String(msg);
  if (msg.includes('<span class="chip-icon"></span>') || msg.includes("<span class='chip-icon'></span>")) {
    elem.innerHTML = msg;
  } else {
    elem.textContent = msg;
  }
}

export function showHint(msg) {
  setMessage(ui.hintEl, msg);
}

/** Build and display a hint listing only the currently available player actions */
export function showPlayerHint() {
  const moves = ["Hit", "Stand"];
  if (state.flags.canDouble && state.playerHand.length === 2 && state.chips >= state.bet * (hasRelic("triple-down") ? 2 : 1))
    moves.push(hasRelic("triple-down") ? "Triple" : "Double");
  if (state.flags.canSurrender)
    moves.push("Surrender");

  const totalHands = Math.max(1, state.splitHandIndex) + state.splitHands.length;
  const hasPair = state.playerHand.length === 2
    && state.playerHand[0]?.value === state.playerHand[1]?.value;
  if (hasPair && totalHands < 4 && state.chips >= state.bet)
    moves.push("Split");

  const canInsurance = !state.insuranceTaken && state.playerHand.length === 2
    && state.dealerHand.length === 2 && state.dealerHand[0].rank === "A"
    && Math.floor(state.bet / 2) > 0 && state.chips >= Math.floor(state.bet / 2);
  if (canInsurance)
    moves.push("Insurance");

  showHint("Your move: " + moves.join(", ") + ".");
}

export function toast(msg) {
  setMessage(ui.toastEl, msg);
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

  [ui.hitBtn, ui.standBtn, ui.doubleBtn, ui.surrenderBtn, ui.splitBtn, ui.insuranceBtn, ui.peekBtn].forEach(b => b.disabled = true);

  clearConfirmStates();

  if (state.phase === "betting") {
    ui.dealBtn.disabled = state.bet > state.chips;
    ui.betRange.disabled = false;
    $$(".pill").forEach(b => b.disabled = false);

    // Show last result during betting
    if (state.lastHandNetResult !== null && state.showLastResult) {
      ui.lastResultEl.innerHTML = "";

      const hasInsurance = state.insuranceTaken;
      const useMultiLine = state.splitHandResults.length > 1 || hasInsurance;

      if (useMultiLine) {
        // Compute insurance net delta for separating from hand result
        const insNetDelta = hasInsurance ? (state.insurancePayout > 0 ? state.insurancePayout : -state.insuranceBet) : 0;

        if (state.splitHandResults.length > 1) {
          // Multi-hand split display
          state.splitHandResults.forEach(h => {
            const line = document.createElement("div");
            const sign = h.delta >= 0 ? "+" : "";
            line.textContent = `${h.label} ${sign}${h.delta}`;
            line.className = h.delta > 0 ? "lr-gain" : h.delta < 0 ? "lr-loss" : "lr-even";
            ui.lastResultEl.appendChild(line);
          });
        } else {
          // Single hand line (subtract insurance portion to show hand-only result)
          const handOnly = state.lastHandNetResult - insNetDelta;
          const sign = handOnly >= 0 ? "+" : "";
          const label = state.lastResultLabel || (handOnly > 0 ? "Win" : handOnly < 0 ? "Lose" : "Push");
          const line = document.createElement("div");
          line.textContent = `${label} ${sign}${handOnly}`;
          line.className = handOnly > 0 ? "lr-gain" : handOnly < 0 ? "lr-loss" : "lr-even";
          ui.lastResultEl.appendChild(line);
        }

        if (hasInsurance) {
          const insLine = document.createElement("div");
          const insSign = insNetDelta >= 0 ? "+" : "";
          insLine.textContent = `Insurance ${insSign}${insNetDelta}`;
          insLine.className = insNetDelta > 0 ? "lr-gain" : "lr-loss";
          ui.lastResultEl.appendChild(insLine);
        }

        const sep = document.createElement("div");
        sep.className = "lr-sep";
        ui.lastResultEl.appendChild(sep);
        const total = document.createElement("div");
        const r = state.lastHandNetResult;
        const sign = r >= 0 ? "+" : "";
        total.textContent = `${sign}${r} chips`;
        total.className = r > 0 ? "lr-gain" : r < 0 ? "lr-loss" : "lr-even";
        ui.lastResultEl.appendChild(total);
      } else {
        // Single hand display (no insurance)
        const r = state.lastHandNetResult;
        const sign = r >= 0 ? "+" : "";
        const label = state.lastResultLabel || (r > 0 ? "Win" : r < 0 ? "Lose" : "Push");
        ui.lastResultEl.textContent = `${label} ${sign}${r} chips`;
      }

      const r = state.lastHandNetResult;
      ui.lastResultEl.className = "last-result " + (r > 0 ? "result-gain" : r < 0 ? "result-loss" : "result-even");
      ui.lastResultEl.style.display = "";
    } else {
      ui.lastResultEl.style.display = "none";
    }

  } else if (state.phase === "player") {
    ui.lastResultEl.style.display = "none";
    ui.dealBtn.disabled = true;
    ui.betRange.disabled = true;
    $$(".pill").forEach(b => b.disabled = true);

    ui.hitBtn.disabled = false;
    ui.standBtn.disabled = false;

    const extraBets = hasRelic("triple-down") ? 2 : 1;
    const canDoubleNow = state.flags.canDouble && state.playerHand.length === 2 && (state.chips >= state.bet * extraBets);
    ui.doubleBtn.disabled = !canDoubleNow;
    ui.doubleBtn.textContent = hasRelic("triple-down") ? "Triple" : "Double";
    ui.surrenderBtn.disabled = !state.flags.canSurrender;

    const totalHands = Math.max(1, state.splitHandIndex) + state.splitHands.length;
    const hasPair = state.playerHand.length === 2 && state.playerHand[0] && state.playerHand[1] && state.playerHand[0].value === state.playerHand[1].value;
    const canSplitNow = hasPair && totalHands < 4 && state.chips >= state.bet;
    ui.splitBtn.disabled = !canSplitNow;

    // Insurance: available only on initial 2 cards when dealer shows an Ace
    const canInsurance = !state.insuranceTaken && state.playerHand.length === 2
      && state.dealerHand.length === 2 && state.dealerHand[0].rank === "A"
      && Math.floor(state.bet / 2) > 0 && state.chips >= Math.floor(state.bet / 2);
    ui.insuranceBtn.disabled = !canInsurance;

    const hasPeek = hasRelic("peek");
    ui.peekBtn.disabled = !(hasPeek && !state.flags.usedPeekThisHand);
    ui.peekBtn.style.display = hasPeek ? "inline-block" : "none";
  } else {
    ui.lastResultEl.style.display = "none";
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
  playCardSlide();
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
  playCardSlide();
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
  playCardSlide();
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

let _confirmCleanup = null;

export function showConfirmModal(message, onConfirm) {
  // Clean up any previous listeners
  if (_confirmCleanup) _confirmCleanup();

  ui.confirmMessage.textContent = message;
  ui.confirmModal.classList.remove("hidden");

  const close = () => {
    ui.confirmModal.classList.add("hidden");
    ui.confirmOkBtn.removeEventListener("click", onOk);
    ui.confirmCancelBtn.removeEventListener("click", onCancel);
    _confirmCleanup = null;
  };

  const onOk = () => { close(); onConfirm(); };
  const onCancel = () => { close(); };

  ui.confirmOkBtn.addEventListener("click", onOk);
  ui.confirmCancelBtn.addEventListener("click", onCancel);

  _confirmCleanup = close;
}
