import { state, resetHandFlags } from './state.js';
import { ui, updateTopbar, renderRelicsList, renderHands, setPhaseControls, showHint, toast } from './ui.js';
import { onDeal, onHit, onStand, nextRound, onGamblePayout, pickRelic, getRelicChoicesIfReady, endHand } from './actions.js';
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
  onDeal, onHit, onStand, onGamblePayout, pickRelic,
  onSkipRelic: () => { state.stars = 0; updateTopbar(); ui.relicModal.classList.add("hidden"); nextRound(); },
  onResultContinue: () => {
    ui.resultModal.classList.add("hidden");
    if (state.pendingGameOver) { ui.finalHighScoreEl.textContent = state.highScore; ui.gameOverModal.classList.remove("hidden"); return; }
    const choices = getRelicChoicesIfReady();
    if (choices.length > 0) openRelicChoiceModal(choices);
    else nextRound();
  },
  onMenuNewRun: () => {
    ui.menuModal.classList.add("hidden"); ui.gameOverModal.classList.add("hidden");
    state.chips = INITIAL_CHIPS; state.bet = 25; state.minBet = 5; state.stars = 0; state.streak = 0;
    state.relics = []; state.cheated = false; state.flags.usedResurrectionThisRun = false;
    resetHandFlags(); renderRelicsList(); updateTopbar(); renderHands();
    state.phase = "betting"; setPhaseControls(); showHint("New run! Adjust bet and press Deal.");
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
    state.chips -= state.bet; state.bet *= 2; updateTopbar();
    import('./actions.js').then(m => { m.drawTo(state.playerHand); gameActions.onStand(); });
  },
  onSurrender: () => {
    const refund = Math.floor(state.bet * (state.relics.find(r => r.id === "cool-headed") ? 0.6 : 0.5));
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
ui.peekBtn.addEventListener("click", gameActions.onPeek);
ui.resultContinueBtn.addEventListener("click", gameActions.onResultContinue);
ui.resultGambleBtn.addEventListener("click", onGamblePayout);
ui.restartBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.skipRelicBtn.addEventListener("click", gameActions.onSkipRelic);
ui.menuNewRunBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.menuRelicsBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); ui.relicListModal.classList.remove("hidden"); renderAllRelicsList(); });
ui.menuHotkeysBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); renderHotkeys(); ui.hotkeysModal.classList.remove("hidden"); });
ui.menuResumeBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); });
ui.closeRelicListBtn.addEventListener("click", () => ui.relicListModal.classList.add("hidden"));
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

setupKeyboardListeners(gameActions);
init();
