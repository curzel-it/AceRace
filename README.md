# Ace Race

A card race of pure luck — dealt by your browser. Pick a suit, then watch
the deck decide.

Play it live: [**curzel.it/acerace**](https://curzel.it/acerace)

---

## The game (with real cards)

Requires a 56-card deck — standard 52 plus 4 jokers. Up to 4 players. Aces
are removed from the deck and set aside.

Each player picks a suit. The track is a 5-column grid. The default is 9
rows total — 1 starting row, 7 checkpoint rows, 1 finish row — but the
length is configurable (see [Customising the track](#customising-the-track)).

- The 4 aces sit face-up on the bottom row, one per column.
- One card per row in between is placed face-down in the rightmost column.
- The rest of the deck is the dealer's draw pile.

```
empty | empty | empty | empty |  empty   |   ← finish
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
empty | empty | empty | empty | face down|
  A♥  |  A♠   |  A♦   |  A♣  |  empty   |   ← start
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
framework, no build step. Card faces are generated as inline SVG so the
rank and suit stay crisp and legible at any size — particularly on small
mobile cards.

- **Portrait** — aces race bottom → top; face-down checkpoints down the
  right side.
- **Landscape** — track rotates 90°: aces race left → right; checkpoints
  along the bottom. Rotation is handled live; resizing the window swaps
  layouts without dropping game state.
- **Effects** — cards glide between rows, the moving ace gets a
  suit-coloured halo, checkpoints flip with a gold sparkle, joker draws
  flash the whole screen, the leaders shake while the trailers catch up,
  and the winner gets confetti. `prefers-reduced-motion` is honoured.
- **Controls** — `Space` / `Enter` draws the next card, `R` starts a new
  game. The on-screen "Draw" and "New game" buttons do the same.

### Customising the track

Add `?rows=N` to the URL to change the track length. `N` includes the
start and finish rows, so the number of checkpoints (and the number of
intermediate steps an ace has to take to win) is `N − 2`.

- `?rows=5` — quick game, 3 checkpoints, ~3 moves to win.
- `?rows=9` — default, 7 checkpoints.
- `?rows=14` — long game, 12 checkpoints, draw pile down to 40 cards.

Valid range: 4–14.

### Files

| File         | What it is                                          |
| ------------ | --------------------------------------------------- |
| `index.html` | Markup for header, board, controls, effects layer.  |
| `styles.css` | Felt + gold theme, animations, effects.             |
| `script.js`  | Deck, game loop, chain-reveal, SVG cards, layout.   |

### Run locally

```sh
python3 -m http.server 8000
open http://localhost:8000
```

Any static file server works — there is no build step.

### Deploy

GitHub Pages serves `main` from the repo root, publishing to
<https://curzel.it/acerace>.
