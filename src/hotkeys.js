import { state } from './state.js';
import { DEFAULT_HOTKEYS } from './constants.js';
import { ui, toast } from './ui.js';

export let hotkeys = JSON.parse(localStorage.getItem("bjrl-hotkeys")) || { ...DEFAULT_HOTKEYS };
let listeningForAction = null;

export function saveHotkeys() {
  localStorage.setItem("bjrl-hotkeys", JSON.stringify(hotkeys));
}

export function renderHotkeys() {
  ui.hotkeysListEl.innerHTML = "";
  const actions = [
    { id: "deal", label: "Deal Hand", category: "Betting" },
    { id: "betMin", label: "Min Bet", category: "Betting" },
    { id: "betHalf", label: "Half Bet", category: "Betting" },
    { id: "betAllIn", label: "All-in Bet", category: "Betting" },
    { id: "hit", label: "Hit", category: "Player" },
    { id: "stand", label: "Stand", category: "Player" },
    { id: "double", label: "Double", category: "Player" },
    { id: "surrender", label: "Surrender", category: "Player" },
    { id: "peek", label: "Peek", category: "Player" },
    { id: "continue", label: "Continue", category: "Result" },
    { id: "gamble", label: "Gamble", category: "Result" },
    { id: "relic1", label: "Left Relic", category: "Relic Choice" },
    { id: "relic2", label: "Right Relic", category: "Relic Choice" },
    { id: "confirmRelic", label: "Confirm Choice", category: "Relic Choice" },
    { id: "skipRelic", label: "Skip Choice", category: "Relic Choice" },
  ];

  let currentCat = null;
  actions.forEach(act => {
    if (act.category !== currentCat) {
      currentCat = act.category;
      const header = document.createElement("div");
      header.className = "hotkey-group-header";
      header.textContent = currentCat;
      ui.hotkeysListEl.appendChild(header);
    }
    const row = document.createElement("div");
    row.className = "hotkey-row";
    row.innerHTML = `${act.label} <div class="hotkey-key">${hotkeys[act.id] === " " ? "Space" : hotkeys[act.id]}</div>`;
    const keyEl = row.querySelector(".hotkey-key");
    keyEl.addEventListener("click", () => {
      if (listeningForAction) return;
      listeningForAction = act.id;
      keyEl.classList.add("listening");
      keyEl.textContent = "...";
    });
    ui.hotkeysListEl.appendChild(row);
  });
}

export function setupKeyboardListeners(gameActions) {
  window.addEventListener('keydown', (e) => {
    if (listeningForAction) {
      e.preventDefault();
      const newKey = e.key === " " ? " " : (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      hotkeys[listeningForAction] = newKey;
      saveHotkeys();
      listeningForAction = null;
      renderHotkeys();
      toast("Hotkey updated!");
      return;
    }

    const pressed = e.key.toLowerCase();
    const isSpaceOrEnter = (e.key === 'Enter' || e.key === ' ');

    if (e.key === 'Escape') {
      if (!ui.hotkeysModal.classList.contains('hidden')) { ui.hotkeysModal.classList.add('hidden'); return; }
      if (!ui.relicModal.classList.contains('hidden')) { gameActions.onSkipRelic(); return; }
      if (!ui.relicListModal.classList.contains('hidden')) { ui.relicListModal.classList.add('hidden'); return; }
      if (!ui.menuModal.classList.contains('hidden')) { ui.menuModal.classList.add('hidden'); return; }
      if (!ui.resultModal.classList.contains('hidden')) { gameActions.onResultContinue(); return; }
      if (!ui.gameOverModal.classList.contains('hidden')) { ui.gameOverModal.classList.add('hidden'); return; }
      ui.menuModal.classList.remove('hidden');
      return;
    }

    if (!ui.gameOverModal.classList.contains('hidden')) {
      if (pressed === hotkeys.continue.toLowerCase() || (hotkeys.continue === "Enter" && isSpaceOrEnter)) gameActions.onMenuNewRun();
      return;
    }

    if (!ui.resultModal.classList.contains('hidden')) {
      if (pressed === hotkeys.continue.toLowerCase() || (hotkeys.continue === "Enter" && isSpaceOrEnter)) gameActions.onResultContinue();
      if (pressed === hotkeys.gamble.toLowerCase() && ui.resultGambleBtn.style.display !== 'none') gameActions.onGamblePayout();
      return;
    }

    if (!ui.relicModal.classList.contains('hidden')) {
      if (pressed === hotkeys.relic1.toLowerCase()) gameActions.highlightRelic(0);
      if (pressed === hotkeys.relic2.toLowerCase()) gameActions.highlightRelic(1);
      if (pressed === hotkeys.confirmRelic.toLowerCase() || (hotkeys.confirmRelic === "Enter" && isSpaceOrEnter)) {
        if (state.selectedRelicIndex >= 0) gameActions.pickRelic(state.currentRelicChoices[state.selectedRelicIndex]);
      }
      if (pressed === hotkeys.skipRelic.toLowerCase()) gameActions.onSkipRelic();
      return;
    }

    if (state.phase === 'betting') {
      if (pressed === hotkeys.deal.toLowerCase() || (hotkeys.deal === "Enter" && isSpaceOrEnter)) gameActions.onDeal();
      if (pressed === hotkeys.betMin) gameActions.quickBet('min');
      if (pressed === hotkeys.betHalf) gameActions.quickBet('half');
      if (pressed === hotkeys.betAllIn) gameActions.quickBet('allin');
    } else if (state.phase === 'player') {
      if (pressed === hotkeys.hit) gameActions.onHit();
      if (pressed === hotkeys.stand) gameActions.onStand();
      if (pressed === hotkeys.double) gameActions.onDouble();
      if (pressed === hotkeys.surrender) gameActions.onSurrender();
      if (pressed === hotkeys.peek) gameActions.onPeek();
    }
  });
}

export function resetHotkeysToDefault() {
  hotkeys = { ...DEFAULT_HOTKEYS };
  saveHotkeys();
  renderHotkeys();
  toast("Hotkeys reset to defaults");
}