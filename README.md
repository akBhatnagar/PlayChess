# PlayChess

PlayChess is a browser chess club. Live games will be decided on the server: the move, the clock, and the result commit together. This repository is the greenfield build for [playchess.akshaybhatnagar.in](https://playchess.akshaybhatnagar.in).

**Milestone 2 is local chess.** You can move through the shell, choose one of the nine clocks, and play both sides on a board that only accepts legal moves. Clocks, promotions, castling, en passant, checkmate, stalemate, draws, resignation, and replay are in this tab. Appearance choices stay in this browser. Accounts, multiplayer, bots, and deployment are later milestones.

Nothing has been deployed. The DigitalOcean Droplet, DNS, and Nginx are unchanged. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before any server work.

## Run it

Node.js `22.23.3` or newer (`22.22` minimum; React Router 8 requires it). pnpm `10.33.4` via Corepack.

```bash
nvm use
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install
pnpm dev
```

The app is at http://127.0.0.1:4317.

Copy [.env.example](.env.example) to `.env` when the API exists. The example values are placeholders. They are valid for local checks and rejected if `NODE_ENV=production`.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @playchess/web exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` serves the production build on port 4317, so stop `pnpm dev` first. GitHub Actions runs the same lint, typecheck, test, build, and smoke sequence.

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | React, Vite, Tailwind, shadcn/ui shell |
| `packages/chess-core` | Time controls, local game commands, clocks, chess.js rules |
| `packages/theme-config` | Board themes and guest settings |
| `packages/validation` | Server and public environment schemas |
| `docs/ARCHITECTURE.md` | Architecture, data model, clock rules, milestones |
| `docs/DEPLOYMENT.md` | Droplet plan, waiting for approval |
| `docs/LICENSING.md` | Fonts, original pieces, and the Stockfish hold |

## Clocks

Presets are `1+0`, `2+1`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `15+10`, and `30+0`. Times are integer milliseconds. The pool comes from the longer side: `initial + 40 * increment`, with bullet below 3 minutes, blitz below 10, rapid below 30, and classical after that. Delay modes are rejected until their rules are specified.

## Milestone status

| Milestone | What | State |
| --- | --- | --- |
| 1 | Workspace, design system, shell, CI, env validation | Done |
| 2 | Local board, rules, clocks, replay | Done in this tree |
| 3 | Accounts, PostgreSQL, Prisma, saved games | Not started |
| 4 | Multiplayer | Not started |
| 5 | Stockfish bots, after the licence review | Not started |
| 6 | PGN, FEN, analysis | Not started |
| 7 | Ratings and statistics | Not started |
| 8 | Deploy to the existing Droplet | Blocked on your approval |
| 9 | Hardening | Not started |
| 10 | Expo app | After the web MVP |
