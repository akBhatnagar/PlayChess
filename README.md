# PlayChess

PlayChess is a browser chess club. Live games will be decided on the server: the move, the clock, and the result commit together. This repository is the greenfield build for [playchess.akshaybhatnagar.in](https://playchess.akshaybhatnagar.in).

**Milestone 3 adds accounts and saved games.** You can still play both sides locally without an account. Signing in stores the game, the appearance settings, and a replay. The server replays the moves with chess.js and does not trust a client result. Multiplayer and bots are later milestones.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Droplet steps. Production secrets stay out of Git.

## Run it

Node.js `22.23.3` or newer (`22.22` minimum; React Router 8 requires it). pnpm `10.33.4` via Corepack.

```bash
nvm use
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install
pnpm dev
```

The app is at http://127.0.0.1:4317. The dev server proxies `/api` to the API on port 4318.

Copy [.env.example](.env.example) when you run the API in Docker Compose. Those placeholders are valid for local checks and rejected if `NODE_ENV=production`. Against a Postgres already listening on this machine, point `DATABASE_URL` at it and keep `SESSION_SECRET` at least 32 characters:

```bash
export DATABASE_URL=postgresql://playchess:playchess@127.0.0.1:5432/playchess
export SESSION_SECRET=local-dev-session-secret-32-characters-min
export WEB_ORIGIN=http://127.0.0.1:4317
export API_HOST=127.0.0.1
export API_PORT=4318
pnpm exec prisma migrate deploy
pnpm dev:api
```

`pnpm dev` and `pnpm dev:api` run together for sign-in and saving. Guest play works if the API is down.

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
| `apps/api` | Fastify accounts, saved games, and the production static host |
| `prisma` | PostgreSQL schema and the init migration |
| `packages/chess-core` | Time controls, local game commands, clocks, chess.js rules |
| `packages/theme-config` | Board themes and guest settings |
| `packages/validation` | Server and public environment schemas |
| `deploy` | Nginx site template and a Postgres backup script |
| `docs/ARCHITECTURE.md` | Architecture, data model, clock rules, milestones |
| `docs/DEPLOYMENT.md` | Droplet plan |
| `docs/LICENSING.md` | Fonts, original pieces, and the Stockfish hold |

## Clocks

Presets are `1+0`, `2+1`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `15+10`, and `30+0`. Times are integer milliseconds. The pool comes from the longer side: `initial + 40 * increment`, with bullet below 3 minutes, blitz below 10, rapid below 30, and classical after that. Delay modes are rejected until their rules are specified.

## Milestone status

| Milestone | What | State |
| --- | --- | --- |
| 1 | Workspace, design system, shell, CI, env validation | Done |
| 2 | Local board, rules, clocks, replay | Done in this tree |
| 3 | Accounts, PostgreSQL, Prisma, saved games | Done in this tree |
| 4 | Multiplayer | Not started |
| 5 | Stockfish bots, after the licence review | Not started |
| 6 | PGN, FEN, analysis | Not started |
| 7 | Ratings and statistics | Not started |
| 8 | Deploy to the existing Droplet | Files are in the repo; the server step needs SSH |
| 9 | Hardening | Not started |
| 10 | Expo app | After the web MVP |
