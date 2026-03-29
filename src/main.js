import { state, resetHandFlags, handTotal } from './state.js';
import { ui, updateTopbar, renderRelicsList, renderHands, setPhaseControls, setTotalsStyles, showHint, toast, createCardEl, renderSplitHands } from './ui.js';
import { onDeal, onHit, onStand, onSplit, nextRound, onGamblePayout, pickRelic, getRelicChoicesIfReady, endHand, drawTo } from './actions.js';
import { setupKeyboardListeners, renderHotkeys, resetHotkeysToDefault, hotkeys } from './hotkeys.js';
import { INITIAL_CHIPS, ALL_RELICS, MAX_BET } from './constants.js';

function init() {
  state.minBet = 5;
  updateTopbar();
  renderRelicsList();
  renderHands();
  state.phase = "betting";
  setPhaseControls();
  showHint("Place your bet and press Deal.");
}

// Action Glue
const gameActions = {
  onDeal, onHit, onStand, onSplit, onGamblePayout, pickRelic,
  onSkipRelic: () => { state.stars = 0; updateTopbar(); ui.relicModal.classList.add("hidden"); nextRound(); },
  onResultContinue: () => {
    ui.resultModal.classList.add("hidden");

    // If splitting and there are more hands to play, transition
    if (state.isSplitting && state.splitHands.length > 0) {
      transitionToSplitHand();
      return;
    }

    // Clean up split state after all hands settled
    if (state.isSplitting) {
      state.isSplitting = false;
      state.splitHandIndex = 0;
      state.splitFromAces = false;
      state.dealerHasPlayed = false;
      ui.splitArea.style.display = "none";
    }

    if (state.pendingGameOver) {
      ui.finalHighScoreEl.textContent = state.highScore;
      if (state.chips <= 0) {
        ui.gameOverMessageEl.textContent = "You ran out of chips.";
      } else {
        ui.gameOverMessageEl.textContent = `You can't afford the minimum bet of ${state.minBet} chips.`;
      }
      ui.gameOverModal.classList.remove("hidden");
      return;
    }
    const choices = getRelicChoicesIfReady();
    if (choices.length > 0) openRelicChoiceModal(choices);
    else nextRound();
  },
  onMenuNewRun: () => {
    ui.menuModal.classList.add("hidden"); ui.gameOverModal.classList.add("hidden");
    state.chips = INITIAL_CHIPS; state.bet = 25; state.minBet = 5; state.stars = 0; state.streak = 0;
    state.relics = []; state.cheated = false; state.flags.usedResurrectionThisRun = false;
    // clear split state
    state.splitHands = []; state.splitBets = [];
    state.splitResults = [];
    state.isSplitting = false; state.splitHandIndex = 0;
    state.splitFromAces = false; state.dealerHasPlayed = false;
    // clear any existing hands and flags so the UI is fully reset for the new run
    state.dealerHand = [];
    state.playerHand = [];
    resetHandFlags();
    // ensure phase is set before rendering so totals / face-down logic is correct
    state.phase = "betting";
    renderRelicsList(); updateTopbar(); renderHands();
    // explicitly clear DOM and totals to be safe
    ui.dealerHandEl.innerHTML = ""; ui.playerHandEl.innerHTML = "";
    ui.dealerTotalEl.textContent = "Total: 0"; ui.playerTotalEl.textContent = "Total: 0";
    ui.splitArea.style.display = "none";
    ui.splitHandsContainer.innerHTML = "";
    // remove any win/lose/push classes left from previous run
    setTotalsStyles(null);
    setPhaseControls(); showHint("New run! Adjust bet and press Deal.");
  },
  quickBet: (type) => {
    if (type === "min") state.bet = Math.min(state.minBet, state.chips);
    else if (type === "half") state.bet = Math.max(state.minBet, Math.floor(state.chips / 2));
    else if (type === "allin") state.bet = Math.max(state.minBet, state.chips);
    state.bet = Math.max(state.minBet, Math.min(state.bet, Math.min(MAX_BET, state.chips)));
    updateTopbar(); setPhaseControls();
  },
  onDouble: () => {
    if (state.phase !== "player" || state.chips < state.bet) return;
    state.phase = "animating";
    state.chips -= state.bet; state.bet *= 2; updateTopbar();
    import('./actions.js').then(m => {
      m.drawTo(state.playerHand);
      setTimeout(() => {
        state.phase = "player";
        gameActions.onStand();
      }, 450);
    });
  },
  onSurrender: () => {
    const refund = Math.floor(state.bet * (state.relics.find(r => r.id === "cool-headed") ? 0.75 : 0.5));
    state.chips += refund; updateTopbar(); endHand("lose", { surrendered: true });
  },
  onPeek: () => {
    state.flags.usedPeekThisHand = true; const down = ui.dealerHandEl.children[1];
    if (!down) return; down.classList.remove("face-down"); down.classList.add("glow");
    setTimeout(() => { down.classList.add("face-down"); down.classList.remove("glow"); }, 1800);
    setPhaseControls();
  },
  highlightRelic: (index) => {
    state.selectedRelicIndex = index;
    ui.relicChoicesEl.querySelectorAll(".choice").forEach((el, i) => {
      el.style.borderColor = i === index ? "var(--accent-2)" : "";
    });
  }
};

function transitionToSplitHand() {
  // Take the next waiting hand off the queue
  const nextHand = state.splitHands.shift();
  const nextBet = state.splitBets.shift();
  state.splitHandIndex++;

  // Set up the next hand as current
  state.playerHand = nextHand;
  state.bet = nextBet;

  // Render player hand
  ui.playerHandEl.innerHTML = "";
  state.playerHand.forEach(c => {
    ui.playerHandEl.appendChild(createCardEl(c));
  });
  ui.playerTotalEl.textContent = `Total: ${handTotal(state.playerHand).total}`;
  renderSplitHands();

  // Reset flags
  state.flags.canSurrender = false;
  state.flags.canSplit = false;
  setTotalsStyles(null);

  state.phase = "player";

  // Check for re-split eligibility
  const totalHands = state.splitHandIndex + state.splitHands.length;
  if (state.playerHand.length === 2 && state.playerHand[0].value === state.playerHand[1].value && totalHands < 4) {
    state.flags.canSplit = true;
  }
  state.flags.canDouble = !state.splitFromAces && state.playerHand.length === 2 && state.chips >= state.bet;

  if (state.splitFromAces) {
    showHint("Split Aces — auto-standing.");
    setTimeout(() => onStand(), 400);
  } else {
    showHint(`Play Hand ${state.splitHandIndex} of ${totalHands}.`);
    setPhaseControls();
  }
}

function openRelicChoiceModal(choices) {
  state.currentRelicChoices = choices; state.selectedRelicIndex = -1;
  ui.relicChoicesEl.innerHTML = "";
  choices.forEach((rel, idx) => {
    const el = document.createElement("div"); el.className = "choice";
    el.innerHTML = `<div class="icon">${rel.icon}</div><div><div class="name">${rel.name}</div><div class="desc">${rel.desc}</div></div>`;
    el.addEventListener("click", () => pickRelic(rel));
    ui.relicChoicesEl.appendChild(el);
  });
  ui.relicModal.classList.remove("hidden");
}

// Button Events
ui.dealBtn.addEventListener("click", onDeal);
ui.hitBtn.addEventListener("click", onHit);
ui.standBtn.addEventListener("click", onStand);
ui.doubleBtn.addEventListener("click", gameActions.onDouble);
ui.surrenderBtn.addEventListener("click", gameActions.onSurrender);
ui.splitBtn.addEventListener("click", onSplit);
ui.peekBtn.addEventListener("click", gameActions.onPeek);
ui.resultContinueBtn.addEventListener("click", gameActions.onResultContinue);
ui.resultGambleBtn.addEventListener("click", onGamblePayout);
ui.restartBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.skipRelicBtn.addEventListener("click", gameActions.onSkipRelic);
ui.menuNewRunBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.menuRelicsBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); switchRelicTab("current"); ui.relicListModal.classList.remove("hidden"); });
ui.menuHotkeysBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); renderHotkeys(); ui.hotkeysModal.classList.remove("hidden"); });
ui.menuResumeBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); });
document.querySelector(".logo").addEventListener("click", () => { ui.menuModal.classList.remove("hidden"); });
ui.closeRelicListBtn.addEventListener("click", () => ui.relicListModal.classList.add("hidden"));
ui.relicTabCurrent.addEventListener("click", () => switchRelicTab("current"));
ui.relicTabAll.addEventListener("click", () => switchRelicTab("all"));
ui.closeHotkeysBtn.addEventListener("click", () => ui.hotkeysModal.classList.add("hidden"));
ui.resetHotkeysBtn.addEventListener("click", resetHotkeysToDefault);
ui.betRange.addEventListener("input", () => { state.bet = Number(ui.betRange.value); ui.betEl.textContent = state.bet; setPhaseControls(); });

document.querySelectorAll(".pill").forEach(btn => {
  btn.addEventListener("click", () => gameActions.quickBet(btn.getAttribute("data-bet")));
});

function renderAllRelicsList() {
  ui.allRelicsListEl.innerHTML = "";
  ALL_RELICS.forEach(rel => {
    const el = document.createElement("div"); el.className = "relic";
    el.innerHTML = `<div class="icon">${rel.icon}</div><div><div class="name">${rel.name}</div><div class="desc">${rel.desc}</div></div><button class="activate-btn">Activate</button>`;
    el.querySelector(".activate-btn").addEventListener("click", () => {
      if (!state.relics.find(r => r.id === rel.id)) {
        state.relics.push(rel); state.cheated = true; renderRelicsList(); updateTopbar(); toast(`Activated: ${rel.name}`);
      }
    });
    ui.allRelicsListEl.appendChild(el);
  });
}

function renderCurrentRelicsList() {
  ui.currentRelicsListEl.innerHTML = "";
  if (state.relics.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "color: var(--muted); padding: 16px 0; text-align: center;";
    empty.textContent = "No relics collected yet.";
    ui.currentRelicsListEl.appendChild(empty);
    return;
  }
  state.relics.forEach(rel => {
    const el = document.createElement("div"); el.className = "relic";
    el.innerHTML = `<div class="icon">${rel.icon}</div><div><div class="name">${rel.name}</div><div class="desc">${rel.desc}</div></div>`;
    ui.currentRelicsListEl.appendChild(el);
  });
}

function switchRelicTab(tab) {
  if (tab === "current") {
    ui.relicTabCurrent.classList.add("active");
    ui.relicTabAll.classList.remove("active");
    ui.currentRelicsListEl.style.display = "";
    ui.allRelicsListEl.style.display = "none";
    ui.relicListDescEl.textContent = "Relics you've collected this run.";
    renderCurrentRelicsList();
  } else {
    ui.relicTabAll.classList.add("active");
    ui.relicTabCurrent.classList.remove("active");
    ui.allRelicsListEl.style.display = "";
    ui.currentRelicsListEl.style.display = "none";
    ui.relicListDescEl.textContent = "Activate relics for testing (marks run as cheated).";
    renderAllRelicsList();
  }
}

setupKeyboardListeners(gameActions);
init();
