import { state, handTotal, isBlackjack, hasRelic, getRelicHookValue, resetHandFlags, shuffleInPlace } from './state.js';
import { ui, renderHands, revealDealerCard, updateTopbar, setPhaseControls, setTotalsStyles, showHint, toast, createCardEl, renderRelicsList, renderSplitHands, dealToSplitHand, animateCardToSplitArea } from './ui.js';
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

  // Calculate animation offset from shoe to target position
  const shoe = document.querySelector('.deck-stack');
  if (shoe) {
    const shoeRect = shoe.getBoundingClientRect();
    el.style.visibility = 'hidden';
    el.style.animation = 'none';
    container.appendChild(el);
    const cardRect = el.getBoundingClientRect();
    const dx = shoeRect.left + shoeRect.width / 2 - (cardRect.left + cardRect.width / 2);
    const dy = shoeRect.top + shoeRect.height / 2 - (cardRect.top + cardRect.height / 2);
    el.style.setProperty('--deal-x', `${Math.round(dx)}px`);
    el.style.setProperty('--deal-y', `${Math.round(dy)}px`);
    el.style.removeProperty('visibility');
    el.style.removeProperty('animation');
    void el.offsetWidth;
  } else {
    container.appendChild(el);
  }

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

  // Clear split state
  state.splitHands = [];
  state.splitBets = [];
  state.splitResults = [];
  state.isSplitting = false;
  state.splitHandIndex = 1;
  state.splitFromAces = false;
  state.dealerHasPlayed = false;
  ui.splitArea.style.display = "none";
  ui.splitHandsContainer.innerHTML = "";

  setTotalsStyles(null);
  setPhaseControls();
  showHint("Dealing...");

  ui.dealerHandEl.innerHTML = "";
  ui.playerHandEl.innerHTML = "";
  ui.dealerTotalEl.textContent = "Total: 0";
  ui.playerTotalEl.textContent = "Total: 0";

  // Stagger the 4-card deal: player, dealer, player, dealer(hidden)
  // Disable controls during deal animation
  state.phase = "dealing";
  const dealSteps = [
    () => drawTo(state.playerHand),
    () => drawTo(state.dealerHand),
    () => drawTo(state.playerHand),
    () => drawTo(state.dealerHand, true),
  ];

  const DELAY = 200; // ms between each card
  dealSteps.forEach((step, i) => {
    setTimeout(() => {
      step();
      // After last card, check for blackjack and enable controls
      if (i === dealSteps.length - 1) {
        state.phase = "player";

        // Check for split eligibility (same value pair)
        if (state.playerHand[0].value === state.playerHand[1].value) {
          state.flags.canSplit = true;
        }

        const splitHint = state.flags.canSplit ? ", or Split" : "";
        showHint("Your move: Hit, Stand, Double, Surrender" + splitHint + ".");
        setPhaseControls();

        const playerBJ = isBlackjack(state.playerHand);
        const dealerBJ = isBlackjack(state.dealerHand);
        if (playerBJ || dealerBJ) {
          state.flags.dealerRevealed = true;
          revealDealerCard();
          if (playerBJ && dealerBJ) endHand("push");
          else if (playerBJ) endHand("blackjack");
          else endHand("lose");
        }
      }
    }, i * DELAY);
  });
}

export function onHit() {
  if (state.phase !== "player") return;
  state.phase = "animating"; // lock input during animation
  drawTo(state.playerHand);
  state.flags.canDouble = false;
  state.flags.canSurrender = false;

  const ANIM_DELAY = 450; // let deal animation finish

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
      state.phase = "player";
      setPhaseControls();
    }, 180);
    return;
  }

  if (after > 21) {
    // Let the card animation play, then show bust
    setTimeout(() => {
      ui.playerHandEl.classList.add("shake");
      setTimeout(() => ui.playerHandEl.classList.remove("shake"), 250);
      standOrBust();
    }, ANIM_DELAY);
  } else {
    // Let animation finish then re-enable controls
    setTimeout(() => {
      state.phase = "player";
      setPhaseControls();
    }, ANIM_DELAY);
  }
}

export function onStand() {
  if (state.phase !== "player") return;
  state.phase = "animating"; // lock input during dealer play
  state.flags.canDouble = false;
  state.flags.canSurrender = false;
  standOrBust();
}

export function onSplit() {
  if (state.phase !== "player") return;
  const totalHands = state.splitHandIndex + state.splitHands.length;
  if (totalHands >= 4) return;
  if (state.chips < state.bet) return;
  if (state.playerHand.length !== 2 || state.playerHand[0].value !== state.playerHand[1].value) return;

  state.isSplitting = true;
  const isAces = state.playerHand[0].rank === "A";
  if (isAces) state.splitFromAces = true;
  state.dealerHasPlayed = false;

  // Deduct chips for new hand's bet
  const newBet = state.bet;
  state.chips -= newBet;
  updateTopbar();

  // Move second card to a new split hand
  const secondCard = state.playerHand.pop();
  state.splitHands.push([secondCard]);
  state.splitBets.push(newBet);

  // Animate the card moving up to the split area
  animateCardToSplitArea(state.playerHand, state.splitHands.length - 1);

  // Disable controls during dealing
  state.phase = "dealing";
  state.flags.canSplit = false;
  state.flags.canSurrender = false;
  setPhaseControls();

  // Deal one card to current hand, then one to the new split hand
  const DELAY = 300;
  setTimeout(() => {
    drawTo(state.playerHand);
    setTimeout(() => {
      // Deal card to the new split hand with animation
      const splitIdx = state.splitHands.length - 1;
      const splitCard = state.deck.pop();
      state.splitHands[splitIdx].push(splitCard);
      dealToSplitHand(splitIdx, splitCard);

      state.phase = "player";

      // Check if we can re-split (new pair after the deal)
      const totalAfter = state.splitHandIndex + state.splitHands.length;
      if (state.playerHand.length === 2 && state.playerHand[0].value === state.playerHand[1].value && totalAfter < 4) {
        state.flags.canSplit = true;
      }
      state.flags.canDouble = !state.splitFromAces && state.playerHand.length === 2 && state.chips >= state.bet;

      if (isAces) {
        // Can't hit after splitting aces, auto-stand
        showHint("Split Aces — one card each. Standing...");
        setTimeout(() => onStand(), 400);
      } else {
        const totalH = state.splitHandIndex + state.splitHands.length;
        showHint(`Play Hand ${state.splitHandIndex} of ${totalH}.`);
        setPhaseControls();
      }
    }, 400);
  }, DELAY);
}

function standOrBust() {
  const t = handTotal(state.playerHand).total;
  if (t > 21) {
    endHand("lose");
    return;
  }

  // If dealer already played (second hand of split), settle directly
  if (state.dealerHasPlayed) {
    state.flags.dealerRevealed = true;
    settle();
    return;
  }

  state.phase = "dealer";
  state.flags.dealerRevealed = true;
  revealDealerCard();
  showHint("Dealer plays...");
  setPhaseControls();
  setTimeout(dealerPlay, 450);
}

function dealerPlay() {
  const CARD_DELAY = 500; // ms between each dealer card
  let dt = handTotal(state.dealerHand);

  // Collect all cards the dealer needs to draw
  const cardsToDraw = [];
  while (dt.total < 17) {
    const card = state.deck.pop();
    state.dealerHand.push(card);
    cardsToDraw.push(card);
    dt = handTotal(state.dealerHand);
  }

  // Remove them from the hand array — we'll re-add as we animate
  for (let i = 0; i < cardsToDraw.length; i++) {
    state.dealerHand.pop();
  }

  if (cardsToDraw.length === 0) {
    settle();
    return;
  }

  // Animate each card one at a time
  cardsToDraw.forEach((card, i) => {
    setTimeout(() => {
      state.dealerHand.push(card);
      const el = createCardEl(card);

      // Animate from shoe
      const shoe = document.querySelector('.deck-stack');
      if (shoe) {
        const shoeRect = shoe.getBoundingClientRect();
        el.style.visibility = 'hidden';
        el.style.animation = 'none';
        ui.dealerHandEl.appendChild(el);
        const cardRect = el.getBoundingClientRect();
        const dx = shoeRect.left + shoeRect.width / 2 - (cardRect.left + cardRect.width / 2);
        const dy = shoeRect.top + shoeRect.height / 2 - (cardRect.top + cardRect.height / 2);
        el.style.setProperty('--deal-x', `${Math.round(dx)}px`);
        el.style.setProperty('--deal-y', `${Math.round(dy)}px`);
        el.style.removeProperty('visibility');
        el.style.removeProperty('animation');
        void el.offsetWidth;
      } else {
        ui.dealerHandEl.appendChild(el);
      }

      ui.dealerTotalEl.textContent = `Total: ${handTotal(state.dealerHand).total}`;

      // After last card, wait for animation then settle
      if (i === cardsToDraw.length - 1) {
        setTimeout(settle, 450);
      }
    }, i * CARD_DELAY);
  });
}

function settle() {
  if (state.isSplitting) state.dealerHasPlayed = true;
  const p = handTotal(state.playerHand).total;
  const d = handTotal(state.dealerHand).total;

  // For split aces + 10 card = 21, pay 1:1 as "win" not "blackjack"
  let outcome;
  if (d > 21) outcome = "win";
  else if (p > d) outcome = "win";
  else if (p < d) outcome = "lose";
  else outcome = "push";
  endHand(outcome);
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
    if (opts.surrendered && hasRelic("cool-headed")) { /* keep streak */ } else { state.streak = 0; }
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
  if (hasRelic("cool-headed") && outcome === "lose" && opts.surrendered) escalation = 0;
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

  // Don't trigger game over if there are more split hands to play
  if (state.isSplitting && state.splitHands.length > 0) {
    state.pendingGameOver = false;
  }

  updateTopbar();
  revealDealerCard();
  showHint(info);
  state.lastOutcome = outcome;
  state.lastInfo = info;

  setTimeout(() => {
    const canGamble = (outcome === "win" || outcome === "blackjack") && hasRelic("double-or-nothing");
    openResultModal(outcome, info, state.chips, starGain, state.stars, canGamble);
  }, 500);
}

export function openResultModal(outcome, info, chipTotal, starGain, starTotal, canGamble = false) {
  let title = outcome === "blackjack" ? "Blackjack!" : outcome === "win" ? "You Win!" : outcome === "lose" ? "Dealer Wins" : "Push";
  if (state.isSplitting) {
    const totalHands = state.splitHandIndex + state.splitHands.length;
    title = `Hand ${state.splitHandIndex}/${totalHands}: ` + title;
  }
  ui.resultTitleEl.textContent = title;
  // build structured result line so parts can be colored/updated independently
  const outcomeClass = outcome === "win" ? "result-win" : outcome === "lose" ? "result-lose" : outcome === "push" ? "result-push" : "result-blackjack";
  ui.resultMainTextEl.className = "result-text label " + outcomeClass;
  ui.resultMainTextEl.innerHTML = "";
  const outcomeSpan = document.createElement("span");
  outcomeSpan.className = "outcome-text";
  outcomeSpan.textContent = info;
  ui.resultMainTextEl.appendChild(outcomeSpan);
  // show total of chip bonuses at end for wins/blackjack
  if (outcome === "win" || outcome === "blackjack") {
    // determine base amount (what would be shown if there are no extra bonuses)
    let baseVal = 0;
    if (outcome === "blackjack") baseVal = Math.floor(state.bet * getRelicHookValue("blackjackPayout", 1.5));
    else baseVal = state.bet;
    const val = state.lastWinDelta;
    // only show the aggregate total if there are extra bonuses beyond the base amount
    if (val !== baseVal) {
      const totalSpan = document.createElement("span");
      totalSpan.className = "win-total";
      totalSpan.style.marginLeft = "8px";
      totalSpan.textContent = ` (${val})`;
      totalSpan.style.color = val > 0 ? 'var(--success)' : '#888';
      ui.resultMainTextEl.appendChild(totalSpan);
    }
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
  state.splitHands = []; state.splitBets = [];
  state.splitResults = [];
  state.isSplitting = false; state.splitHandIndex = 0;
  state.splitFromAces = false; state.dealerHasPlayed = false;
  ui.dealerHandEl.innerHTML = ""; ui.playerHandEl.innerHTML = "";
  ui.dealerTotalEl.textContent = "Total: 0"; ui.playerTotalEl.textContent = "Total: 0";
  ui.splitArea.style.display = "none";
  ui.splitHandsContainer.innerHTML = "";
  showHint("Next hand ready — adjust bet and press Deal.");
  state.pendingGameOver = false; state.isAllIn = false; state.lastWinDelta = 0;
  updateTopbar();
  setPhaseControls();
}

export function onGamblePayout() {
  if (!hasRelic("double-or-nothing") || state.lastWinDelta <= 0) return;
  ui.resultGambleBtn.disabled = true;
  const amount = state.lastWinDelta;
  // Rebuild the left result line so the total is guaranteed at the very end
  const baseInfo = ui.resultMainTextEl.querySelector('.outcome-text')?.textContent || '';
  const leftContainer = ui.resultMainTextEl;
  leftContainer.innerHTML = '';

  const outcomeSpan = document.createElement('span');
  outcomeSpan.className = 'outcome-text';
  outcomeSpan.textContent = baseInfo;
  leftContainer.appendChild(outcomeSpan);

  const labelSpan = document.createElement('span');
  labelSpan.textContent = ' Gamble: ';
  labelSpan.style.color = '#888';
  leftContainer.appendChild(labelSpan);

  const resultSpan = document.createElement('span');
  let newTotal = 0;
  if (Math.random() < 0.5) {
    state.chips += amount; toast(`Gamble success! +${amount}`);
    resultSpan.textContent = `Doubled! +${amount} ⚠️`;
    resultSpan.style.color = 'var(--success)';
    newTotal = state.lastWinDelta * 2;
  } else {
    state.chips -= amount; toast(`Gamble failed! -${amount}`);
    resultSpan.textContent = `Lost! -${amount} ⚠️`;
    resultSpan.style.color = 'var(--danger)';
    newTotal = 0;
  }
  leftContainer.appendChild(resultSpan);

  const totalSpan = document.createElement('span');
  totalSpan.className = 'win-total';
  totalSpan.style.marginLeft = '8px';
  totalSpan.textContent = ` (${newTotal})`;
  totalSpan.style.color = newTotal > 0 ? 'var(--success)' : '#888';
  leftContainer.appendChild(totalSpan);

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