import { state, handTotal, isBlackjack, hasRelic, getRelicHookValue, resetHandFlags, shuffleInPlace } from './state.js';
import { ui, renderHands, updateTopbar, setPhaseControls, setTotalsStyles, showHint, toast, createCardEl, renderRelicsList } from './ui.js';
import { SUITS, RANKS, RANK_VALUE, ALL_RELICS, INITIAL_CHIPS, MAX_BET } from './constants.js';

export function newShuffledDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit: s, rank: r, value: RANK_VALUE(r) });
    }
  }
  return shuffleInPlace(deck);
}

export function drawTo(hand, hidden = false) {
  const card = state.deck.pop();
  hand.push(card);
  const container = (hand === state.playerHand) ? ui.playerHandEl : ui.dealerHandEl;
  const el = createCardEl(card, hidden);
  container.appendChild(el);
  if (hand === state.playerHand) {
    ui.playerTotalEl.textContent = `Total: ${handTotal(state.playerHand).total}`;
  } else {
    const t = state.flags.dealerRevealed ? handTotal(state.dealerHand).total : handTotal([state.dealerHand[0]]).total;
    ui.dealerTotalEl.textContent = `Total: ${t}`;
  }
}

export function onDeal() {
  if (state.phase !== "betting") return;
  const wager = Math.max(state.minBet, Math.min(state.bet, Math.min(state.chips, MAX_BET)));
  if (wager < state.minBet || wager > state.chips) return;
  state.bet = wager;
  state.isAllIn = (wager === state.chips);
  state.chips -= wager;
  updateTopbar();
  startHand();
}

export function startHand() {
  state.phase = "player";
  resetHandFlags();
  state.deck = newShuffledDeck();
  state.dealerHand = [];
  state.playerHand = [];
  setTotalsStyles(null);
  showHint("Your move: Hit, Stand, Double, or Surrender.");

  drawTo(state.playerHand);
  drawTo(state.dealerHand);
  drawTo(state.playerHand);
  drawTo(state.dealerHand, true);

  renderHands();
  setPhaseControls();

  const playerBJ = isBlackjack(state.playerHand);
  const dealerBJ = isBlackjack(state.dealerHand);

  if (playerBJ || dealerBJ) {
    state.flags.dealerRevealed = true;
    renderHands(true);
    if (playerBJ && dealerBJ) endHand("push");
    else if (playerBJ) endHand("blackjack");
    else endHand("lose");
  }
}

export function onHit() {
  if (state.phase !== "player") return;
  drawTo(state.playerHand);
  state.flags.canDouble = false;
  state.flags.canSurrender = false;

  const after = handTotal(state.playerHand).total;

  if (after > 21 && hasRelic("lucky-coin") && !state.flags.usedLuckyCoinThisHand) {
    state.flags.usedLuckyCoinThisHand = true;
    ui.playerHandEl.lastElementChild.classList.add("shake");
    setTimeout(() => {
      state.playerHand.pop();
      ui.playerHandEl.removeChild(ui.playerHandEl.lastElementChild);
      const smallRanks = ["2", "3", "4", "5"];
      const r = smallRanks[Math.floor(Math.random() * smallRanks.length)];
      const s = SUITS[Math.floor(Math.random() * SUITS.length)];
      const replacement = { suit: s, rank: r, value: RANK_VALUE(r) };
      state.playerHand.push(replacement);
      ui.playerHandEl.appendChild(createCardEl(replacement));
      ui.playerTotalEl.textContent = `Total: ${handTotal(state.playerHand).total}`;
      showHint("Lucky Coin saved you from a bust!");
      setPhaseControls();
    }, 180);
    return;
  }

  if (after > 21) {
    ui.playerHandEl.classList.add("shake");
    setTimeout(() => ui.playerHandEl.classList.remove("shake"), 250);
    standOrBust();
  } else {
    setPhaseControls();
  }
}

export function onStand() {
  if (state.phase !== "player") return;
  state.flags.canDouble = false;
  state.flags.canSurrender = false;
  standOrBust();
}

function standOrBust() {
  const t = handTotal(state.playerHand).total;
  if (t > 21) {
    endHand("lose");
    return;
  }
  state.phase = "dealer";
  state.flags.dealerRevealed = true;
  renderHands(true);
  showHint("Dealer plays...");
  setPhaseControls();
  setTimeout(dealerPlay, 350);
}

function dealerPlay() {
  let dt = handTotal(state.dealerHand);
  while (dt.total < 17) {
    drawTo(state.dealerHand);
    dt = handTotal(state.dealerHand);
  }
  settle();
}

function settle() {
  const p = handTotal(state.playerHand).total;
  const d = handTotal(state.dealerHand).total;
  if (d > 21) endHand("win");
  else if (p > d) endHand("win");
  else if (p < d) endHand("lose");
  else endHand("push");
}

export function endHand(outcome, opts = {}) {
  state.phase = "payout";
  setTotalsStyles(outcome);
  setPhaseControls();

  let delta = 0;
  let info = "";
  let starGain = 0;

  if (outcome === "blackjack") {
    const win = Math.floor(state.bet * getRelicHookValue("blackjackPayout", 1.5));
    delta = state.bet + win;
    let totalShown = win;
    starGain = 2;
    state.streak += 1;
    info = `Blackjack! +${Math.floor(state.bet * 1.5)}🪙`;
    if (hasRelic("blackjack-boost")) {
      const bonus = Math.floor(state.bet * 0.5);
      totalShown += bonus;
      info += ` +${bonus}👑`;
    }
    const endBonus = getRelicHookValue("chipEndBonus", 0);
    if (endBonus) { state.chips += endBonus; totalShown += endBonus; info += ` +${endBonus}💧`; }
    state.lastWinDelta = totalShown;
  } else if (outcome === "win") {
    let baseWin = state.bet;
    let totalShown = baseWin;
    let infoParts = [`Win +${baseWin}🪙`];
    if (hasRelic("momentum") && state.streak >= 2) {
      const b = Math.floor(state.bet * getRelicHookValue("streakWinBoost", 0.25));
      totalShown += b; infoParts.push(`+${b}⚡`);
    }
    if (hasRelic("gold-rush")) {
      const b = Math.floor(state.bet * getRelicHookValue("winBonusPercent", 0.5));
      totalShown += b; infoParts.push(`+${b}💰`);
    }
    const endBonus = getRelicHookValue("chipEndBonus", 0);
    if (endBonus) { state.chips += endBonus; totalShown += endBonus; infoParts.push(`+${endBonus}💧`); }
    info = infoParts.join(' ');
    delta = state.bet + (totalShown - (endBonus || 0));
    starGain = 1;
    state.streak += 1;
    state.lastWinDelta = totalShown;
  } else if (outcome === "push") {
    delta = state.bet;
    info = "Push";
    if (!hasRelic("push-it")) state.streak = 0;
  } else if (outcome === "lose") {
    info = opts.surrendered ? "Surrender" : "Lose";
    state.streak = 0;
  }

  if ((outcome === "win" || outcome === "blackjack") && hasRelic("risky-gain") && state.isAllIn) starGain += 1;
  if (outcome === "lose" && hasRelic("gold-rush")) {
    const p = Math.floor(state.chips * getRelicHookValue("lossPenaltyPercent", 0.1));
    state.chips -= p; info += ` -${p}💰`;
  }
  if (outcome === "lose" && state.chips <= 0 && hasRelic("Resurrection-token") && !state.flags.usedResurrectionThisRun) {
    const refund = Math.floor(INITIAL_CHIPS * 0.5);
    state.chips = refund; state.flags.usedResurrectionThisRun = true;
    info += ` Resurrected! +${refund}🔄`; state.pendingGameOver = false;
    toast("Resurrection Token activated!");
  }

  state.chips += delta;
  state.stars += starGain;

  let escalation = (outcome === "win" || outcome === "blackjack") ? 0 : 5;
  if (hasRelic("big-winner") && outcome === "lose") escalation = 10;
  if (hasRelic("push-it") && outcome === "push") escalation = 0;
  state.minBet += escalation;
  if (hasRelic("big-winner") && (outcome === "win" || outcome === "blackjack") && state.streak > 1) {
    state.minBet -= (state.streak - 1) * 5;
  }
  if (state.minBet < 5) state.minBet = 5;

  if (state.chips > state.highScore) {
    state.highScore = state.chips;
    localStorage.setItem("bjrl-highscore", String(state.highScore));
  }

  state.pendingGameOver = state.chips < state.minBet;
  updateTopbar();
  renderHands(true);
  showHint(info);
  state.lastOutcome = outcome;
  state.lastInfo = info;

  setTimeout(() => {
    const canGamble = (outcome === "win" || outcome === "blackjack") && hasRelic("double-or-nothing");
    openResultModal(outcome, info, state.chips, starGain, state.stars, canGamble);
  }, 250);
}

export function openResultModal(outcome, info, chipTotal, starGain, starTotal, canGamble = false) {
  let title = outcome === "blackjack" ? "Blackjack!" : outcome === "win" ? "You Win!" : outcome === "lose" ? "Dealer Wins" : "Push";
  ui.resultTitleEl.textContent = title;
  // build structured result line so parts can be colored/updated independently
  ui.resultMainTextEl.className = "result-text label";
  ui.resultMainTextEl.innerHTML = "";
  const outcomeSpan = document.createElement("span");
  outcomeSpan.className = outcome === "win" ? "result-win" : outcome === "lose" ? "result-lose" : outcome === "push" ? "result-push" : "result-blackjack";
  outcomeSpan.textContent = info;
  ui.resultMainTextEl.appendChild(outcomeSpan);
  // show total of chip bonuses at end for wins/blackjack
  if ((outcome === "win" || outcome === "blackjack") && state.lastWinDelta > 0) {
    const totalSpan = document.createElement("span");
    totalSpan.className = "win-total";
    totalSpan.style.marginLeft = "8px";
    totalSpan.textContent = ` (${state.lastWinDelta})`;
    ui.resultMainTextEl.appendChild(totalSpan);
  }
  ui.resultChipTotalEl.textContent = `${chipTotal} 🪙`;

  if (starGain > 0) {
    ui.resultStarsRowEl.style.display = "";
    ui.resultStarsTextEl.textContent = `Stars +${starGain}`;
    ui.resultStarTotalEl.textContent = `${starTotal} ✨`;
  } else {
    ui.resultStarsRowEl.style.display = "none";
  }

  if (canGamble && state.lastWinDelta > 0) {
    ui.resultGambleBtn.style.display = "";
    ui.resultGambleBtn.disabled = false;
  } else {
    ui.resultGambleBtn.style.display = "none";
  }
  ui.resultModal.classList.remove("hidden");
}

export function nextRound() {
  setTotalsStyles(null);
  state.phase = "betting";
  state.bet = Math.max(state.minBet, Math.min(state.bet, Math.min(state.chips, MAX_BET)));
  state.dealerHand = []; state.playerHand = [];
  ui.dealerHandEl.innerHTML = ""; ui.playerHandEl.innerHTML = "";
  ui.dealerTotalEl.textContent = "Total: 0"; ui.playerTotalEl.textContent = "Total: 0";
  showHint("Next hand ready — adjust bet and press Deal.");
  state.pendingGameOver = false; state.isAllIn = false; state.lastWinDelta = 0;
  updateTopbar();
  setPhaseControls();
}

export function onGamblePayout() {
  if (!hasRelic("double-or-nothing") || state.lastWinDelta <= 0) return;
  ui.resultGambleBtn.disabled = true;
  const amount = state.lastWinDelta;
  // append a neutral 'Gamble:' label
  const labelSpan = document.createElement("span");
  labelSpan.textContent = " Gamble: ";
  labelSpan.style.color = "#888";
  ui.resultMainTextEl.appendChild(labelSpan);

  const resultSpan = document.createElement("span");
  if (Math.random() < 0.5) {
    state.chips += amount; toast(`Gamble success! +${amount}`);
    resultSpan.className = "result-win";
    resultSpan.textContent = `Doubled! +${amount}`;
    // update displayed total to doubled amount
    const totalSpan = ui.resultMainTextEl.querySelector('.win-total');
    if (totalSpan) totalSpan.textContent = ` (${state.lastWinDelta * 2})`;
  } else {
    state.chips -= amount; toast(`Gamble failed! -${amount}`);
    resultSpan.className = "result-lose";
    resultSpan.textContent = `Lost! -${amount}`;
    // update displayed total to reflect loss (0)
    const totalSpan = ui.resultMainTextEl.querySelector('.win-total');
    if (totalSpan) totalSpan.textContent = ` (0)`;
  }
  ui.resultMainTextEl.appendChild(resultSpan);
  updateTopbar();
}

export function pickRelic(rel) {
  state.relics.push(rel);
  renderRelicsList();
  state.stars = 0;
  updateTopbar();
  ui.relicModal.classList.add("hidden");
  toast(`Gained relic: ${rel.name}`);
  nextRound();
}

export function getRelicChoicesIfReady() {
  if (state.stars < 3) return [];
  const notOwned = ALL_RELICS.filter(r => !state.relics.find(x => x.id === r.id));
  if (notOwned.length === 0) { state.stars = 0; updateTopbar(); return []; }
  shuffleInPlace(notOwned);
  return notOwned.slice(0, Math.min(2, notOwned.length));
}