'use strict';

const SUITS       = ['hearts', 'spades', 'diamonds', 'clubs'];
const SUIT_NAMES  = { hearts: 'Hearts', spades: 'Spades', diamonds: 'Diamonds', clubs: 'Clubs' };
const SUIT_GLYPHS = { hearts: '♥',      spades: '♠',      diamonds: '♦',         clubs: '♣' };
const RED_SUITS   = new Set(['hearts', 'diamonds']);
const RANKS       = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES  = {
  'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
  '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King',
};

function isRedSuit(suit) { return RED_SUITS.has(suit); }

// Grid: 5 columns (4 racing lanes + 1 checkpoint column) × NUM_ROWS rows.
// NUM_ROWS counts the start row and the finish row, so the default of 9
// means: 1 start, 7 racing/checkpoint rows, 1 finish. Override via ?rows=N.
const NUM_COLS         = 5;
const CHECKPOINT_COL   = 5;
const NUM_ROWS         = getNumRowsFromQuery();
const FINISH_PROGRESS  = NUM_ROWS - 1;
const CHECKPOINT_COUNT = NUM_ROWS - 2;

function getNumRowsFromQuery() {
  try {
    const v = parseInt(new URLSearchParams(window.location.search).get('rows'), 10);
    if (Number.isFinite(v) && v >= 4 && v <= 14) return v;
  } catch (_) {}
  return 9;
}

const SRC_W = 153, SRC_H = 214;      // card aspect + SVG viewBox
const BOARD_PAD = 8;
const CARD_GAP_FRACTION = 0.09;

const MOVE_MS = 480;
const FLIP_MS = 550;
const CHAIN_PAUSE_MS = 240;
const JOKER_HOLD_MS = 700;

let state = null;
let board, statusEl, drawBtn, newGameBtn, lastCardEl, deckCountEl, effectsEl;
let cardW = 0, cardH = 0, cardGap = 0;

// ---------- Deck setup ----------

function buildDeck() {
  // 52-card deck minus the 4 aces (those sit at the start), plus 4 jokers.
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let i = 1; i <= 4; i++) deck.push({ joker: true, id: i });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newGame() {
  const deck = shuffle(buildDeck());
  const checkpoints = {};
  for (let p = 1; p <= CHECKPOINT_COUNT; p++) {
    checkpoints[p] = { card: deck.pop(), revealed: false };
  }
  const aces = {};
  for (const suit of SUITS) aces[suit] = { progress: 0 };

  state = { deck, aces, checkpoints, winner: null, busy: false };

  layout();
  renderBoard();
  setStatus('Tap the deck to deal the first card.');
  setLastCard(null);
  updateDeckCount();
  drawBtn.disabled = false;
}

// ---------- Layout & geometry ----------

function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

/** Pick a card scale. Integer multiples (1x, 2x, 3x) when there's room to
 *  upscale; continuous downscale on tight screens. */
function chooseScale(availW, availH) {
  const cols = isLandscape() ? NUM_ROWS : NUM_COLS;
  const rows = isLandscape() ? NUM_COLS : NUM_ROWS;
  // Each grid step is cardW + gap (or cardH + gap). gap = cardW * fraction.
  const stepWFactor = SRC_W * (1 + CARD_GAP_FRACTION);
  const stepHFactor = SRC_H + SRC_W * CARD_GAP_FRACTION;  // gap is measured in card-width units
  const sW = (availW - 2 * BOARD_PAD + SRC_W * CARD_GAP_FRACTION) / (cols * stepWFactor);
  const sH = (availH - 2 * BOARD_PAD + SRC_W * CARD_GAP_FRACTION) / (rows * stepHFactor);
  let s = Math.min(sW, sH);
  if (s >= 1) s = Math.min(Math.floor(s), 4);
  return Math.max(0.18, s);
}

function heightOf(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  return el ? el.offsetHeight : 0;
}

function layout() {
  const header   = heightOf('header');
  const status_  = heightOf(statusEl);
  const controls = heightOf('#controls');
  const lastCard = heightOf(lastCardEl);
  const slack    = isLandscape() ? 30 : 36;

  const availW = window.innerWidth  * (isLandscape() ? 0.97 : 0.96);
  const availH = window.innerHeight - header - status_ - controls - lastCard - slack;

  const scale = chooseScale(availW, availH);
  cardW   = SRC_W * scale;
  cardH   = SRC_H * scale;
  cardGap = Math.max(2, SRC_W * scale * CARD_GAP_FRACTION);

  const cols = isLandscape() ? NUM_ROWS : NUM_COLS;
  const rows = isLandscape() ? NUM_COLS : NUM_ROWS;
  const boardW = cols * cardW + (cols - 1) * cardGap + 2 * BOARD_PAD;
  const boardH = rows * cardH + (rows - 1) * cardGap + 2 * BOARD_PAD;
  board.style.width  = boardW + 'px';
  board.style.height = boardH + 'px';

  const fl = board.querySelector('.finish-line');
  if (fl) {
    if (isLandscape()) {
      fl.style.cssText = `top:${BOARD_PAD}px;bottom:${BOARD_PAD}px;right:${BOARD_PAD}px;left:auto;width:${cardW}px;height:auto`;
    } else {
      fl.style.cssText = `top:${BOARD_PAD}px;bottom:auto;left:${BOARD_PAD}px;right:${BOARD_PAD}px;height:${cardH}px;width:auto`;
    }
  }
}

function geomFor(col, row) {
  const stepW = cardW + cardGap;
  const stepH = cardH + cardGap;
  if (isLandscape()) {
    return {
      left: BOARD_PAD + (NUM_ROWS - row) * stepW,
      top:  BOARD_PAD + (col - 1)        * stepH,
    };
  }
  return {
    left: BOARD_PAD + (col - 1) * stepW,
    top:  BOARD_PAD + (row - 1) * stepH,
  };
}

function applyPos(el) {
  const col = parseInt(el.dataset.col, 10);
  const row = parseInt(el.dataset.row, 10);
  const g = geomFor(col, row);
  el.style.left   = g.left + 'px';
  el.style.top    = g.top  + 'px';
  el.style.width  = cardW  + 'px';
  el.style.height = cardH  + 'px';
}

function reflowAll() {
  layout();
  const cards = board.querySelectorAll('.card');
  cards.forEach(c => c.classList.add('no-anim'));
  cards.forEach(applyPos);
  void board.offsetWidth;
  cards.forEach(c => c.classList.remove('no-anim'));
}

// ---------- Card elements ----------

function describeCard(card) {
  if (card.joker) return 'a Joker';
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

// ---------- SVG card markup ----------

function svgFace(card) {
  if (card.joker) return svgJoker(card.id);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const color = isRed ? '#c2272d' : '#1a1a1a';
  const glyph = SUIT_GLYPHS[card.suit];
  const rankSize = card.rank === '10' ? 64 : 86;
  return `<svg viewBox="0 0 153 214" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect x="3" y="3" width="147" height="208" rx="12" fill="#fdfaf3" stroke="${color}" stroke-width="2.5"/>
    <text x="76.5" y="100" font-size="${rankSize}" font-weight="900" fill="${color}" text-anchor="middle" font-family="'Cinzel', Georgia, 'Times New Roman', serif">${card.rank}</text>
    <text x="76.5" y="174" font-size="70" fill="${color}" text-anchor="middle" font-family="'Cinzel', Georgia, 'Times New Roman', serif">${glyph}</text>
  </svg>`;
}

function svgJoker(id) {
  const palettes = [
    ['#c2272d', '#d4af37'],
    ['#1a1a1a', '#d4af37'],
    ['#5b3da5', '#26c0c7'],
    ['#1c5c2a', '#d4af37'],
  ];
  const [ring, accent] = palettes[(id - 1) % palettes.length];
  return `<svg viewBox="0 0 153 214" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect x="3" y="3" width="147" height="208" rx="12" fill="#fdfaf3" stroke="${ring}" stroke-width="2.5"/>
    <text x="76.5" y="80" font-size="22" font-weight="800" fill="${ring}" text-anchor="middle" letter-spacing="3" font-family="'Cinzel', Georgia, 'Times New Roman', serif">JOKER</text>
    <text x="76.5" y="178" font-size="108" font-weight="900" fill="${accent}" text-anchor="middle" font-family="'Cinzel', Georgia, 'Times New Roman', serif">★</text>
  </svg>`;
}

function svgBack() {
  return `<svg viewBox="0 0 153 214" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect x="3" y="3" width="147" height="208" rx="12" fill="#7a1d1d" stroke="#d4af37" stroke-width="2.5"/>
    <rect x="10" y="10" width="133" height="194" rx="8" fill="#5b1414" stroke="#d4af37" stroke-width="1" stroke-dasharray="6 4"/>
    <text x="76.5" y="132" font-size="84" font-weight="900" fill="#d4af37" text-anchor="middle" font-family="'Cinzel', Georgia, 'Times New Roman', serif">★</text>
  </svg>`;
}

function makeCardEl() {
  const el = document.createElement('div');
  el.className = 'card';
  const face = document.createElement('div');
  face.className = 'card-face';
  el.appendChild(face);
  return el;
}

function setCardPos(el, col, row) {
  el.dataset.col = String(col);
  el.dataset.row = String(row);
  applyPos(el);
}

function setCardPosInstant(el, col, row) {
  el.dataset.col = String(col);
  el.dataset.row = String(row);
  el.classList.add('no-anim');
  applyPos(el);
  void el.offsetWidth;
  el.classList.remove('no-anim');
}

function paintFace(el, card) {
  el.classList.remove('facedown');
  el.classList.toggle('joker-card', !!card.joker);
  el.querySelector('.card-face').innerHTML = svgFace(card);
}

function paintBack(el) {
  el.classList.add('facedown');
  el.querySelector('.card-face').innerHTML = svgBack();
}

// ---------- Rendering ----------

function renderBoard() {
  board.querySelectorAll('.card').forEach(el => el.remove());

  for (let p = 1; p <= CHECKPOINT_COUNT; p++) {
    const cp = state.checkpoints[p];
    const el = makeCardEl();
    el.classList.add('checkpoint');
    el.dataset.checkpoint = String(p);
    setCardPosInstant(el, CHECKPOINT_COL, NUM_ROWS - p);
    if (cp.revealed) paintFace(el, cp.card);
    else             paintBack(el);
    board.appendChild(el);
  }

  for (const suit of SUITS) {
    const el = makeCardEl();
    el.classList.add('ace');
    el.dataset.suit = suit;
    setCardPosInstant(el, SUITS.indexOf(suit) + 1, NUM_ROWS - state.aces[suit].progress);
    paintFace(el, { suit, rank: 'A' });
    if (state.winner === suit) el.classList.add('winner');
    board.appendChild(el);
  }
}

// ---------- UI ----------

function setStatus(msg) {
  if (statusEl.textContent === msg) return;
  statusEl.textContent = msg;
  statusEl.classList.remove('changed');
  void statusEl.offsetWidth;          // restart the animation if it was running
  statusEl.classList.add('changed');
}

// ---------- Effects ----------

function triggerConfetti(suit) {
  if (!effectsEl) return;
  const winColor = isRedSuit(suit) ? '#e85c61' : '#1a1a1a';
  const palette = [winColor, '#d4af37', '#f4d98c', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.left = (Math.random() * 100) + '%';
    p.style.background = palette[i % palette.length];
    p.style.width  = (5 + Math.random() * 5) + 'px';
    p.style.height = (9 + Math.random() * 10) + 'px';
    p.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    p.style.setProperty('--drift', (Math.random() * 240 - 120) + 'px');
    p.style.setProperty('--spin', (360 + Math.random() * 720) + 'deg');
    effectsEl.appendChild(p);
    setTimeout(() => p.remove(), 5000);
  }
}

function triggerJokerFlash() {
  if (!effectsEl) return;
  const f = document.createElement('div');
  f.className = 'joker-flash';
  effectsEl.appendChild(f);
  setTimeout(() => f.remove(), 950);
}

function protestLeaders(leaders) {
  for (const suit of leaders) {
    const el = board.querySelector(`.card.ace[data-suit="${suit}"]`);
    if (el) {
      el.classList.remove('protest');
      void el.offsetWidth;
      el.classList.add('protest');
      setTimeout(() => el.classList.remove('protest'), 600);
    }
  }
}

function updateDeckCount() { deckCountEl.textContent = `${state.deck.length} left`; }

function setLastCard(card) {
  const v = lastCardEl.querySelector('.value');
  if (!card) { v.innerHTML = '—'; return; }
  v.innerHTML = `<span class="mini" aria-label="${describeCard(card)}">${svgFace(card)}</span>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Game flow ----------

function declareWinner(suit) {
  state.winner = suit;
  const el = board.querySelector(`.card.ace[data-suit="${suit}"]`);
  if (el) el.classList.add('winner');
  setStatus(`\u{1F3C6} ${SUIT_NAMES[suit]} wins the race!`);
  triggerConfetti(suit);
}

/** Step one ace up one row. Returns { won, checkpoint }. */
async function moveAce(suit) {
  const a = state.aces[suit];
  a.progress += 1;
  const aceEl = board.querySelector(`.card.ace[data-suit="${suit}"]`);
  if (aceEl) {
    setCardPos(aceEl, SUITS.indexOf(suit) + 1, NUM_ROWS - a.progress);
    const glow = isRedSuit(suit) ? 'glow-red' : 'glow-black';
    aceEl.classList.add('bump', glow);
    setTimeout(() => aceEl.classList.remove('bump'), 360);
    setTimeout(() => aceEl.classList.remove(glow),    560);
  }
  await delay(MOVE_MS);
  if (a.progress >= FINISH_PROGRESS) return { won: true, checkpoint: null };
  const cp = state.checkpoints[a.progress];
  if (cp && !cp.revealed)            return { won: false, checkpoint: a.progress };
  return { won: false, checkpoint: null };
}

async function revealCheckpoint(p) {
  const cp = state.checkpoints[p];
  cp.revealed = true;
  const cpEl = board.querySelector(`.card.checkpoint[data-checkpoint="${p}"]`);
  if (cpEl) {
    cpEl.classList.add('flipping');
    setTimeout(() => paintFace(cpEl, cp.card), FLIP_MS / 2);
    await delay(FLIP_MS);
    cpEl.classList.remove('flipping');
  }
  return cp.card;
}

/** Apply the effect of a freshly-shown card. Returns true if game is won. */
async function resolveCard(card, prefix) {
  if (card.joker) return handleJoker(prefix);
  setStatus(`${prefix}${describeCard(card)} — ${SUIT_NAMES[card.suit]} advances.`);
  await delay(CHAIN_PAUSE_MS);
  return advanceChain(card.suit);
}

async function advanceChain(suit) {
  const r = await moveAce(suit);
  if (r.won) { declareWinner(suit); return true; }
  if (r.checkpoint != null) {
    const next = await revealCheckpoint(r.checkpoint);
    await delay(CHAIN_PAUSE_MS);
    return resolveCard(next, 'Checkpoint reveals ');
  }
  return false;
}

/** Joker rule: every ace NOT in first place advances by one. Aces tied for
 *  the lead don't move. Then any checkpoints those aces just landed on are
 *  revealed and chained — exactly as if each ace had been advanced normally. */
async function handleJoker(prefix) {
  const max = Math.max(...SUITS.map(s => state.aces[s].progress));
  const advancing = SUITS.filter(s => state.aces[s].progress < max);
  const leaders   = SUITS.filter(s => state.aces[s].progress === max);

  triggerJokerFlash();

  if (advancing.length === 0) {
    setStatus(`${prefix}Joker! All aces tied — nobody moves.`);
    protestLeaders(leaders);
    await delay(JOKER_HOLD_MS);
    return false;
  }

  setStatus(`${prefix}Joker! Trailing aces catch up.`);
  protestLeaders(leaders);
  await delay(280);

  const results = await Promise.all(advancing.map(moveAce));
  for (let i = 0; i < advancing.length; i++) {
    if (results[i].won) { declareWinner(advancing[i]); return true; }
  }
  for (let i = 0; i < advancing.length; i++) {
    if (results[i].checkpoint != null) {
      const next = await revealCheckpoint(results[i].checkpoint);
      await delay(CHAIN_PAUSE_MS);
      const won = await resolveCard(next, 'Checkpoint reveals ');
      if (won) return true;
    }
  }
  return false;
}

async function drawCard() {
  if (!state || state.busy || state.winner) return;
  if (state.deck.length === 0) {
    setStatus('The deck is empty. Shuffle a new game!');
    drawBtn.disabled = true;
    return;
  }
  state.busy = true;
  drawBtn.disabled = true;

  const card = state.deck.pop();
  setLastCard(card);
  updateDeckCount();

  let won;
  if (card.joker) {
    setStatus(`Dealer turns a Joker!`);
    await delay(450);
    won = await handleJoker(`Dealer's `);
  } else {
    setStatus(`Dealer turns ${describeCard(card)}. ${SUIT_NAMES[card.suit]} advances.`);
    await delay(220);
    won = await advanceChain(card.suit);
  }

  state.busy = false;
  if (!won) drawBtn.disabled = false;
}

// ---------- Wiring ----------

function onKey(e) {
  if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A')) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!drawBtn.disabled) drawCard();
  } else if (e.key === 'r' || e.key === 'R') {
    newGame();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  board       = document.getElementById('board');
  statusEl    = document.getElementById('status');
  drawBtn     = document.getElementById('draw-btn');
  newGameBtn  = document.getElementById('new-game-btn');
  lastCardEl  = document.getElementById('last-card');
  deckCountEl = document.getElementById('deck-count');
  effectsEl   = document.getElementById('effects');

  drawBtn.addEventListener('click', drawCard);
  newGameBtn.addEventListener('click', newGame);
  document.addEventListener('keydown', onKey);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reflowAll, 80);
  });
  window.addEventListener('orientationchange', () => setTimeout(reflowAll, 120));

  newGame();
});
