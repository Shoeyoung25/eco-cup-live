# Eco Cup Live Scores

View-only scoreboard for Eco Cup members: game night games and each team's token standings, updating live.

**Link:** https://shoeyoung25.github.io/eco-cup-live/

`index.html` is a single static page. It only reads `gamenight/results` from the Eco Cup Firebase Realtime Database and has no way to edit. Its `GAMES` payout table must match the one in the game night tracker so the totals agree.

## Trivia night

- **Hub:** https://shoeyoung25.github.io/eco-cup-live/trivia/ : players tap their team.
- **Team page:** `trivia/team/?t=N` : answers, Prats tokens and wager weights. Any number of phones can share one team page.
- **Question screen:** `trivia/screen/` : for the projector; shows questions, pictures, plays music twice, and a live board of who has answered.

These pages only follow what the operator dashboard (in the eco-cup repo) does. `trivia/js/core.js`, `trivia/js/db.js` and `trivia/js/base.css` must stay identical to the copies there. Tests: `node --test trivia/tests/core.test.mjs`.
