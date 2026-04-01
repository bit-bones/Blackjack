import { state, resetHandFlags, handTotal, generateSeed, initRng } from './state.js';
import { ui, updateTopbar, resetChipTracking, renderRelicsList, renderHands, setPhaseControls, setTotalsStyles, showHint, toast, createCardEl, renderSplitHands, animateCardsToPlayerArea, updateBetButtons, showConfirmModal, clearConfirmStates, updateModalBounds } from './ui.js';
import { onDeal, onHit, onStand, onSplit, onInsurance, nextRound, onGamblePayout, pickRelic, getRelicChoicesIfReady, endHand, drawTo, checkDealerBlackjack } from './actions.js';
import { setupKeyboardListeners, renderHotkeys, resetHotkeysToDefault, hotkeys } from './hotkeys.js';
import { INITIAL_CHIPS, ALL_RELICS, MAX_BET } from './constants.js';
import { setSfxVolume, getSfxVolume } from './sfx.js';
import { getTracks, setTrackEnabled, setMusicVolume, getMusicVolume, setShuffle, getShuffle, skip, toggleMute, isMuted, onTrackChange } from './music.js';

// --- Options persistence ---------------------------------------------------
const OPTIONS_KEY = 'bjrl-options';

function saveOptions() {
  const data = {
    bettingStyle: state.bettingStyle,
    unitSize: state.unitSize,
    confirmMode: state.confirmMode,
    showLastResult: state.showLastResult,
    musicVolume: getMusicVolume(),
    sfxVolume: getSfxVolume(),
    shuffle: getShuffle(),
    disabledTracks: getTracks().filter(t => !t.enabled).map(t => t.id),
  };
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(data));
}

function loadOptions() {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.bettingStyle) state.bettingStyle = data.bettingStyle;
    if (typeof data.unitSize === 'number' && data.unitSize > 0) state.unitSize = data.unitSize;
    if (data.confirmMode) state.confirmMode = data.confirmMode;
    if (typeof data.showLastResult === 'boolean') state.showLastResult = data.showLastResult;
    if (typeof data.musicVolume === 'number') setMusicVolume(data.musicVolume);
    if (typeof data.sfxVolume === 'number') setSfxVolume(data.sfxVolume);
    if (typeof data.shuffle === 'boolean') setShuffle(data.shuffle);
    if (Array.isArray(data.disabledTracks)) {
      data.disabledTracks.forEach(id => setTrackEnabled(id, false));
    }
  } catch (_) { /* ignore corrupt data */ }
}

function init() {
  loadOptions();
  state.minBet = 5;
  if (!state.seed) initRng(generateSeed());
  updateTopbar();
  renderRelicsList();
  renderHands();
  state.phase = "betting";
  setPhaseControls();
  updateBetButtons();
  showHint("Place your bet and press Deal.");
  updateModalBounds();
}

window.addEventListener('resize', updateModalBounds);

// Keep modal bounds fresh whenever any modal is shown
new MutationObserver(() => updateModalBounds()).observe(
  document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }
);

// Action Glue
const gameActions = {
  onDeal, onHit, onStand, onSplit, onInsurance, onGamblePayout, pickRelic,
  onSkipRelic: () => { state.stars = 0; updateTopbar(); ui.relicModal.classList.add("hidden"); nextRound(); },
  onResultContinue: () => {
    ui.resultModal.classList.add("hidden");

    // If splitting and there are more hands to play, transition
    if (state.isSplitting && state.splitHands.length > 0) {
      transitionToSplitHand();
      return;
    }

    // All hands settled — compute net result and net loss for Martingale Master
    state.lastHandNetResult = state.chips - state.chipsBeforeHand;
    state.lastHandNetLoss = Math.max(0, -state.lastHandNetResult);

    // Determine label for last-result display
    if (!state.isSplitting || state.splitHandResults.length <= 1) {
      // When insurance was taken, derive label from hand-only result (exclude insurance)
      const insNetDelta = state.insuranceTaken
        ? (state.insurancePayout > 0 ? state.insurancePayout : -state.insuranceBet)
        : 0;
      const handOnlyResult = state.lastHandNetResult - insNetDelta;
      if (handOnlyResult > 0) {
        state.lastResultLabel = "Win";
      } else if (handOnlyResult < 0) {
        state.lastResultLabel = state.lastInfo.startsWith("Surrender") ? "Surrender" : "Lose";
      } else {
        state.lastResultLabel = "Push";
      }
    } else {
      // Split hands — label will be derived from splitHandResults in UI
      state.lastResultLabel = null;
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
    ui.menuModal.classList.add("hidden");
    ui.gameOverModal.classList.add("hidden");
    ui.newRunSeedInput.value = "";
    ui.newRunRelicsToggle.checked = true;
    ui.newRunModal.classList.remove("hidden");
  },
  onNewRunStart: () => {
    const hasProgress = state.chips !== INITIAL_CHIPS || state.minBet !== 5 || state.relics.length > 0 || state.stars > 0 || state.streak > 0 || state.phase !== "betting";
    const needsConfirm = !state.pendingGameOver && hasProgress;
    const doStart = () => {
    ui.newRunModal.classList.add("hidden");
    const classicMode = !ui.newRunRelicsToggle.checked;
    const seedInput = ui.newRunSeedInput.value.trim().toUpperCase();
    const seed = seedInput || generateSeed();

    state.chips = INITIAL_CHIPS; state.bet = 25; state.minBet = 5; state.stars = 0; state.streak = 0;
    state.relics = []; state.cheated = !!seedInput; state.flags.usedResurrectionThisRun = false;
    state.lastHandNetLoss = 0; state.lastHandNetResult = null; state.lastResultLabel = null; state.splitHandResults = []; state.chipsBeforeHand = 0;
    state.insuranceBet = 0; state.insuranceTaken = false; state.insurancePayout = 0; state.dealerBJChecked = false; state._insuranceSettled = false;
    state.classicMode = classicMode;
    initRng(seed);
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
    resetChipTracking();
    renderRelicsList(); updateTopbar(); renderHands();
    // explicitly clear DOM and totals to be safe
    ui.dealerHandEl.innerHTML = ""; ui.playerHandEl.innerHTML = "";
    ui.dealerTotalEl.textContent = "Total: 0"; ui.playerTotalEl.textContent = "Total: 0";
    ui.splitArea.style.display = "none";
    ui.splitHandsContainer.innerHTML = "";
    // remove any win/lose/push classes left from previous run
    setTotalsStyles(null);
    setPhaseControls(); showHint("New run! Adjust bet and press Deal.");
    };
    if (needsConfirm) {
      showConfirmModal("Start new run? Current progress will be lost.", doStart);
    } else {
      doStart();
    }
  },
  quickBet: (type) => {
    const maxBet = Math.min(MAX_BET, state.chips);
    if (type === "min") {
      state.bet = Math.min(state.minBet, state.chips);
    } else if (type === "half") {
      state.bet = Math.max(state.minBet, Math.floor(state.chips / 2));
    } else if (type === "allin") {
      state.bet = Math.max(state.minBet, state.chips);
    } else if (type === "prevHalf") {
      if (state.previousBet <= 0) return;
      state.bet = Math.max(state.minBet, Math.floor(state.previousBet / 2));
    } else if (type === "prevSame") {
      if (state.previousBet <= 0) return;
      state.bet = state.previousBet;
    } else if (type === "prevDouble") {
      if (state.previousBet <= 0) return;
      state.bet = state.previousBet * 2;
    } else if (type === "unitMinus") {
      state.bet = Math.max(state.minBet, state.bet - state.unitSize);
    } else if (type === "unitSet") {
      state.bet = state.unitSize;
    } else if (type === "unitPlus") {
      state.bet = state.bet + state.unitSize;
    }
    state.bet = Math.max(state.minBet, Math.min(state.bet, maxBet));
    updateTopbar(); setPhaseControls();
  },
  onDouble: () => {
    if (state.phase !== "player" || state.chips < state.bet) return;
    // If dealer shows ace and BJ not yet checked, check now (player declined insurance)
    if (!state.dealerBJChecked && state.dealerHand[0].rank === "A") {
      if (checkDealerBlackjack()) return;
    }
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
    if (state.phase !== "player") return;
    // If dealer shows ace and BJ not yet checked, check now (player declined insurance)
    if (!state.dealerBJChecked && state.dealerHand[0].rank === "A") {
      if (checkDealerBlackjack()) return;
    }
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

  // Animate cards from split area down to player area
  animateCardsToPlayerArea(state.playerHand);
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

// Double-press confirm logic
let pendingConfirmBtn = null;

function requireConfirm(btn, action) {
  if (state.confirmMode === "single") { action(); return; }
  if (pendingConfirmBtn === btn) {
    btn.classList.remove("confirm-pending");
    pendingConfirmBtn = null;
    action();
  } else {
    clearConfirmStates();
    btn.classList.add("confirm-pending");
    pendingConfirmBtn = btn;
  }
}

function requireConfirmHotkey(btn, action) {
  if (state.confirmMode === "single") { action(); return; }
  if (pendingConfirmBtn === btn) {
    clearConfirmStates();
    pendingConfirmBtn = null;
    action();
  } else {
    clearConfirmStates();
    if (btn) btn.classList.add("confirm-pending");
    pendingConfirmBtn = btn;
  }
}

// Button Events
ui.dealBtn.addEventListener("click", () => requireConfirm(ui.dealBtn, onDeal));
ui.hitBtn.addEventListener("click", () => requireConfirm(ui.hitBtn, onHit));
ui.standBtn.addEventListener("click", () => requireConfirm(ui.standBtn, onStand));
ui.doubleBtn.addEventListener("click", () => requireConfirm(ui.doubleBtn, gameActions.onDouble));
ui.surrenderBtn.addEventListener("click", () => requireConfirm(ui.surrenderBtn, gameActions.onSurrender));
ui.splitBtn.addEventListener("click", () => requireConfirm(ui.splitBtn, onSplit));
ui.insuranceBtn.addEventListener("click", () => requireConfirm(ui.insuranceBtn, onInsurance));
ui.peekBtn.addEventListener("click", () => requireConfirm(ui.peekBtn, gameActions.onPeek));
ui.resultContinueBtn.addEventListener("click", gameActions.onResultContinue);
ui.resultGambleBtn.addEventListener("click", onGamblePayout);
ui.restartBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.skipRelicBtn.addEventListener("click", gameActions.onSkipRelic);
ui.menuNewRunBtn.addEventListener("click", gameActions.onMenuNewRun);
ui.menuRelicsBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); switchRelicTab("current"); ui.relicListModal.classList.remove("hidden"); });
ui.menuHotkeysBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); renderHotkeys(); ui.hotkeysModal.classList.remove("hidden"); });
ui.menuResumeBtn.addEventListener("click", () => { ui.menuModal.classList.add("hidden"); });
document.querySelector(".logo").addEventListener("click", () => {
  const menuModals = [ui.menuModal, ui.newRunModal, ui.relicListModal, ui.hotkeysModal, ui.optionsModal];
  const anyOpen = menuModals.some(m => !m.classList.contains("hidden"));
  if (anyOpen) {
    menuModals.forEach(m => m.classList.add("hidden"));
  } else {
    ui.menuSeedValue.textContent = state.seed || "";
    ui.menuModal.classList.remove("hidden");
  }
});
ui.newRunStartBtn.addEventListener("click", gameActions.onNewRunStart);
ui.newRunBackBtn.addEventListener("click", () => { ui.newRunModal.classList.add("hidden"); ui.menuModal.classList.remove("hidden"); });
ui.copySeedBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(state.seed || "").then(() => toast("Seed copied!"));
});
ui.closeRelicListBtn.addEventListener("click", () => { ui.relicListModal.classList.add("hidden"); ui.menuModal.classList.remove("hidden"); });
ui.relicTabCurrent.addEventListener("click", () => switchRelicTab("current"));
ui.relicTabAll.addEventListener("click", () => switchRelicTab("all"));
ui.closeHotkeysBtn.addEventListener("click", () => { ui.hotkeysModal.classList.add("hidden"); ui.menuModal.classList.remove("hidden"); });
ui.resetHotkeysBtn.addEventListener("click", resetHotkeysToDefault);

// Hotkey category tabs
document.querySelectorAll('.hotkey-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.hotkey-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderHotkeys(tab.getAttribute('data-hotkey-cat'));
  });
});

ui.betRange.addEventListener("input", () => {
  let val = Math.round(Number(ui.betRange.value) / 5) * 5;
  val = Math.max(0, val);
  state.bet = val;
  ui.betEl.textContent = state.bet;
  setPhaseControls();
});

document.querySelectorAll(".pill").forEach(btn => {
  btn.addEventListener("click", () => requireConfirm(btn, () => gameActions.quickBet(btn.getAttribute("data-bet"))));
});

// Options modal wiring
const musicVolumeSlider = document.getElementById('musicVolume');
const musicVolumeVal    = document.getElementById('musicVolumeVal');
const sfxVolumeSlider   = document.getElementById('sfxVolume');
const sfxVolumeVal      = document.getElementById('sfxVolumeVal');
const shuffleToggle     = document.getElementById('shuffleToggle');
const songListEl        = document.getElementById('songList');

function renderSongList() {
  songListEl.innerHTML = '';
  getTracks().forEach(track => {
    const row = document.createElement('label');
    row.className = 'song-row' + (track.enabled ? '' : ' disabled');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = track.enabled;
    cb.addEventListener('change', () => {
      setTrackEnabled(track.id, cb.checked);
      row.classList.toggle('disabled', !cb.checked);
      saveOptions();
    });
    const info = document.createElement('div');
    info.className = 'song-info';
    info.innerHTML = `<span class="song-title">${track.title}</span><span class="song-artist">${track.artist}</span>`;
    row.appendChild(cb);
    row.appendChild(info);
    songListEl.appendChild(row);
  });
}

ui.menuOptionsBtn.addEventListener("click", () => {
  ui.menuModal.classList.add("hidden");
  // Sync radio buttons with current state
  const radios = document.querySelectorAll('input[name="bettingStyle"]');
  radios.forEach(r => { r.checked = r.value === state.bettingStyle; });
  const confirmRadios = document.querySelectorAll('input[name="confirmMode"]');
  confirmRadios.forEach(r => { r.checked = r.value === state.confirmMode; });
  ui.unitSizeInput.value = state.unitSize;
  ui.unitSizeRow.style.display = state.bettingStyle === "units" ? "" : "none";
  ui.showLastResultToggle.checked = state.showLastResult;
  // Sync audio controls
  musicVolumeSlider.value = Math.round(getMusicVolume() * 100);
  musicVolumeVal.textContent = musicVolumeSlider.value;
  sfxVolumeSlider.value = Math.round(getSfxVolume() * 100);
  sfxVolumeVal.textContent = sfxVolumeSlider.value;
  shuffleToggle.checked = getShuffle();
  renderSongList();
  ui.optionsModal.classList.remove("hidden");
});
document.querySelectorAll('input[name="bettingStyle"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    state.bettingStyle = e.target.value;
    ui.unitSizeRow.style.display = state.bettingStyle === "units" ? "" : "none";
    updateBetButtons();
    saveOptions();
  });
});
document.querySelectorAll('input[name="confirmMode"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    state.confirmMode = e.target.value;
    clearConfirmStates();
    pendingConfirmBtn = null;
    saveOptions();
  });
});
ui.unitSizeInput.addEventListener("change", () => {
  const val = parseInt(ui.unitSizeInput.value, 10);
  if (val > 0) {
    state.unitSize = val;
    updateBetButtons();
    saveOptions();
  } else {
    ui.unitSizeInput.value = state.unitSize;
  }
});
ui.showLastResultToggle.addEventListener("change", () => {
  state.showLastResult = ui.showLastResultToggle.checked;
  setPhaseControls();
  saveOptions();
});
musicVolumeSlider.addEventListener("input", () => {
  const v = Number(musicVolumeSlider.value);
  musicVolumeVal.textContent = v;
  setMusicVolume(v / 100);
  saveOptions();
});
sfxVolumeSlider.addEventListener("input", () => {
  const v = Number(sfxVolumeSlider.value);
  sfxVolumeVal.textContent = v;
  setSfxVolume(v / 100);
  saveOptions();
});
shuffleToggle.addEventListener("change", () => {
  setShuffle(shuffleToggle.checked);
  saveOptions();
});
ui.closeOptionsBtn.addEventListener("click", () => {
  ui.optionsModal.classList.add("hidden");
  ui.menuModal.classList.remove("hidden");
});

// Music controller bar
const musicMuteBtn    = document.getElementById('musicMuteBtn');
const musicSkipBtn    = document.getElementById('musicSkipBtn');
const musicNowPlaying = document.getElementById('musicNowPlaying');
let _nowPlayingTimer  = null;

musicMuteBtn.addEventListener('click', () => {
  const muted = toggleMute();
  musicMuteBtn.textContent = muted ? '🔈' : '🔊';
});
musicSkipBtn.addEventListener('click', () => skip());

onTrackChange(track => {
  musicNowPlaying.textContent = `${track.artist} – ${track.title}`;
  musicNowPlaying.classList.add('visible');
  clearTimeout(_nowPlayingTimer);
  _nowPlayingTimer = setTimeout(() => {
    musicNowPlaying.classList.remove('visible');
  }, 4000);
});

function renderAllRelicsList() {
  ui.allRelicsListEl.innerHTML = "";
  ALL_RELICS.forEach(rel => {
    const el = document.createElement("div"); el.className = "relic";
    el.innerHTML = `<div class="icon">${rel.icon}</div><div><div class="name">${rel.name}</div><div class="desc">${rel.desc}</div></div><button class="activate-btn">Activate</button>`;
    el.querySelector(".activate-btn").addEventListener("click", () => {
      if (!state.relics.find(r => r.id === rel.id)) {
        const activate = () => {
          state.relics.push(rel); state.cheated = true; renderRelicsList(); updateTopbar(); toast(`Activated: ${rel.name}`);
        };
        if (!state.cheated) {
          showConfirmModal(`Activate '${rel.name}'? Highscores will be disabled for this run.`, activate);
        } else {
          activate();
        }
      }
    });
    ui.allRelicsListEl.appendChild(el);
  });
}

function renderCurrentRelicsList() {
  ui.currentRelicsListEl.innerHTML = "";
  if (state.relics.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "color: var(--muted); padding: 180px 0; text-align: center;";
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
    ui.relicListDescEl.textContent = "Activating relics will disable highscores.";
    renderAllRelicsList();
  }
}

setupKeyboardListeners(gameActions, requireConfirmHotkey);
init();
