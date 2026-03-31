import { state } from './state.js';
import { DEFAULT_HOTKEYS } from './constants.js';
import { ui, toast } from './ui.js';

export let hotkeys = { ...DEFAULT_HOTKEYS, ...(JSON.parse(localStorage.getItem("bjrl-hotkeys")) || {}) };
let listeningForAction = null;

export function saveHotkeys() {
  localStorage.setItem("bjrl-hotkeys", JSON.stringify(hotkeys));
}

let activeHotkeyCategory = "all";

export function renderHotkeys(filterCat) {
  if (filterCat !== undefined) activeHotkeyCategory = filterCat;
  const cat = activeHotkeyCategory;
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
    { id: "split", label: "Split", category: "Player" },
    { id: "insurance", label: "Insurance", category: "Player" },
    { id: "peek", label: "Peek", category: "Player" },
    { id: "continue", label: "Continue", category: "Result" },
    { id: "gamble", label: "Gamble", category: "Result" },
    { id: "relic1", label: "Left Relic", category: "Relic Choice" },
    { id: "relic2", label: "Right Relic", category: "Relic Choice" },
    { id: "confirmRelic", label: "Confirm Choice", category: "Relic Choice" },
    { id: "skipRelic", label: "Skip Choice", category: "Relic Choice" },
  ];

  const filtered = cat === "all" ? actions : actions.filter(a => a.category === cat);

  let currentCat = null;
  filtered.forEach(act => {
    if (cat === "all" && act.category !== currentCat) {
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

export function setupKeyboardListeners(gameActions, requireConfirmHotkey) {
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
      if (!ui.optionsModal.classList.contains('hidden')) { ui.optionsModal.classList.add('hidden'); ui.menuModal.classList.remove('hidden'); return; }
      if (!ui.hotkeysModal.classList.contains('hidden')) { ui.hotkeysModal.classList.add('hidden'); ui.menuModal.classList.remove('hidden'); return; }
      if (!ui.newRunModal.classList.contains('hidden')) { ui.newRunModal.classList.add('hidden'); ui.menuModal.classList.remove('hidden'); return; }
      if (!ui.relicModal.classList.contains('hidden')) { gameActions.onSkipRelic(); return; }
      if (!ui.relicListModal.classList.contains('hidden')) { ui.relicListModal.classList.add('hidden'); ui.menuModal.classList.remove('hidden'); return; }
      if (!ui.menuModal.classList.contains('hidden')) { ui.menuModal.classList.add('hidden'); return; }
      if (!ui.resultModal.classList.contains('hidden')) { gameActions.onResultContinue(); return; }
      if (!ui.gameOverModal.classList.contains('hidden')) { ui.gameOverModal.classList.add('hidden'); return; }
      ui.menuModal.classList.remove('hidden');
      return;
    }

    // Block all keypresses (except Escape above) when any menu modal is open; Enter triggers primary button
    const menuModals = [ui.menuModal, ui.newRunModal, ui.relicListModal, ui.hotkeysModal, ui.optionsModal];
    const openMenuModal = menuModals.find(m => !m.classList.contains('hidden'));
    if (openMenuModal) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const primary = openMenuModal.querySelector('.modal-content .primary');
        if (primary) primary.click();
      }
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
      if (pressed === hotkeys.deal.toLowerCase() || (hotkeys.deal === "Enter" && isSpaceOrEnter)) requireConfirmHotkey(ui.dealBtn, () => gameActions.onDeal());
      const pills = document.querySelectorAll('.pill');
      if (pressed === hotkeys.betMin && pills[0]) requireConfirmHotkey(pills[0], () => gameActions.quickBet(pills[0].getAttribute('data-bet')));
      if (pressed === hotkeys.betHalf && pills[1]) requireConfirmHotkey(pills[1], () => gameActions.quickBet(pills[1].getAttribute('data-bet')));
      if (pressed === hotkeys.betAllIn && pills[2]) requireConfirmHotkey(pills[2], () => gameActions.quickBet(pills[2].getAttribute('data-bet')));
    } else if (state.phase === 'player') {
      if (pressed === hotkeys.hit) requireConfirmHotkey(ui.hitBtn, () => gameActions.onHit());
      if (pressed === hotkeys.stand) requireConfirmHotkey(ui.standBtn, () => gameActions.onStand());
      if (pressed === hotkeys.double) requireConfirmHotkey(ui.doubleBtn, () => gameActions.onDouble());
      if (pressed === hotkeys.surrender) requireConfirmHotkey(ui.surrenderBtn, () => gameActions.onSurrender());
      if (pressed === hotkeys.split) requireConfirmHotkey(ui.splitBtn, () => gameActions.onSplit());
      if (pressed === hotkeys.insurance) requireConfirmHotkey(ui.insuranceBtn, () => gameActions.onInsurance());
      if (pressed === hotkeys.peek) requireConfirmHotkey(ui.peekBtn, () => gameActions.onPeek());
    }
  });
}

export function resetHotkeysToDefault() {
  hotkeys = { ...DEFAULT_HOTKEYS };
  saveHotkeys();
  renderHotkeys();
  toast("Hotkeys reset to defaults");
}