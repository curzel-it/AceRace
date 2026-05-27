# Ace Race

A card race of pure luck — dealt by your browser. Pick a suit, then watch
the deck decide.

Play it live: [**curzel.it/acerace**](https://curzel.it/acerace)

![Ace Race — portrait](https://curzel.it/acerace/) <!-- screenshot once deployed -->

---

## The game (with real cards)

Requires a 56-card deck — standard 52 plus 4 jokers. Up to 4 players. Aces
are removed from the deck and set aside.

Each player picks a suit. The track is a 5×11 grid:

- The 4 aces sit face-up on the bottom row, one per column.
- 9 cards from the deck are placed face-down in the rightmost column,
  starting on the second row from the bottom.
- The remaining 43 cards form the dealer's deck, face-down.

```
empty | empty | empty | empty |  empty   |
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
  A♥  |  A♠   |  A♦   |  A♣  |  empty   |
```

### Loop

1. Dealer flips the top card of the deck.
2. **If it's a suited card:** the ace of that suit moves **up one row**.
   **If it's a joker:** every ace that is *not* in first place moves up one
   row. Aces tied for the lead stay put. (When all four are tied, nobody
   moves.)
3. For each ace that just moved: if it landed on a row whose right-column
   card is still face-down, reveal it and treat the revealed card as a new
   draw — back to step 2. Otherwise, back to step 1.
4. First ace to reach the top row wins.

That's it. No decisions, no skill — just the order of the shuffle. The
joker rule keeps a runaway leader from running away.

---

## This implementation

A single-page, dead-simple HTML + CSS + vanilla JS app. No canvas, no
framework, no build step.

- **Portrait** — aces race bottom → top; face-down checkpoints down the
  right side.
- **Landscape** — track rotates 90°: aces race left → right; checkpoints
  along the bottom. Rotation is handled live; resizing the window swaps
  layouts without dropping game state.
- **Animations** — cards glide between rows, checkpoint reveals flip in
  mid-chain, the winning ace pulses. `prefers-reduced-motion` is honored.
- **Controls** — `Space` / `Enter` draws the next card, `R` starts a new
  game. The on-screen "Draw" and "New game" buttons do the same.

### Files

| File         | What it is                                  |
| ------------ | ------------------------------------------- |
| `index.html` | Markup for header, board, controls, footer. |
| `styles.css` | Felt + gold theme, orientation media query. |
| `script.js`  | Deck shuffle, game loop, chain-reveal logic, JS-driven card positioning. |

### Run locally

```sh
python3 -m http.server 8000
open http://localhost:8000
```

Any static file server works — there is no build step.

### Deploy

GitHub Pages is configured to serve `main` from the repo root. Pushing to
`main` publishes to <https://curzel.it/acerace>.

---

## Cards

Card faces are PNGs from the **Retro Deck** — a hand-drawn, pixel-art
56-card poker deck (52 + 4 jokers), 153 × 214 pixels each. They live in
`cards/` and render with `image-rendering: pixelated`; JS snaps the
displayed size to an integer multiple of the source when there's room.

> **[Retro Deck — pixel-art poker cards on Etsy](https://curzel.it/retro_deck/)**

Filename convention: `<suit>_<rank>.png` with `1` = ace, numbers `2–10`,
and `jack`/`queen`/`king` for face cards. Jokers are `joker_1.png`
through `joker_4.png`. `back.png` is the card back.
