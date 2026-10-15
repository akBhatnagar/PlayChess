# PlayChess architecture

This is the plan for the greenfield build. Milestones 1 and 2 are the shell and local chess. Milestone 3 adds accounts, PostgreSQL, and saved games. Later milestones follow the same document.

## Repository

| Item | Value |
| --- | --- |
| Intended GitHub repository | https://github.com/akBhatnagar/PlayChess.git |
| GitHub state when this milestone started | Public repository, default branch `main`, size 0, no commits |
| This workspace | Branch `main`, one existing empty commit (`Initialize project`), remote `origin` pointing at the Cursor workspace remote rather than GitHub |
| Production URL | https://playchess.akshaybhatnagar.in |
| Hosting | The existing DigitalOcean Droplet, after a separate approval |

The GitHub remote was not rewritten onto `origin`. History already on `main` stays as it is. No force-push.

## Stack

| Layer | Choice |
| --- | --- |
| Web | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix) |
| Routing and data | React Router 8, TanStack Query |
| Client UI state | Zustand for guest appearance settings only |
| Validation | Zod 4 |
| API | Node.js, TypeScript, Fastify. Socket.IO arrives with multiplayer |
| Database | PostgreSQL, Prisma migrations |
| Rules | chess.js 1.4.0 (BSD-2-Clause), inside `packages/chess-core` |
| Engine, later | Stockfish only after the licence note in `docs/LICENSING.md` |
| Tests | Vitest, Testing Library, Playwright |
| Packages | pnpm workspaces |
| CI | GitHub Actions: install, lint, typecheck, unit tests, production build, Playwright smoke |
| Deploy, later | Docker Compose, Nginx, Let's Encrypt. Redis stays out until more than one app instance needs it |

React Router 8 requires Node.js `>= 22.22`. `.nvmrc` pins `22.23.3`.

## Folder structure

```
apps/web/                  React shell and account pages.
apps/api/                  Fastify accounts, saved games, and the production static host.
packages/chess-core/       Time controls, local game commands, clocks, and transcript import.
packages/theme-config/     Appearance settings.
packages/validation/       Server and public environment schemas.
packages/shared-types/     Later, when responses outgrow the current modules.
packages/game-protocol/    Later, with Socket.IO.
packages/api-client/       Later, if the fetch helpers move out of the web app.
apps/engine-worker/        Later, only if the engine runs out of process.
apps/mobile/               After the web MVP. Expo, reusing these packages.
prisma/                    Schema and the init migration.
deploy/nginx/              Site template. Not installed until the Droplet step.
```

Empty packages are not created ahead of the code that needs them.

## Runtime shape

```
Browser  --HTTPS REST-->  Fastify API  -->  PostgreSQL
        --Socket.IO---->  same API process, one game lock at a time
```

The browser is a view. For a live game it may show an optimistic move, then it must adopt `game:moveAccepted` or roll back on `game:moveRejected`. Client-supplied FEN, clocks, results, and ratings are never authoritative.

PostgreSQL is the durable record. Redis is optional later for presence or a multi-instance queue. The first deployment is one API container and one database container on a private Compose network.

The browser calls `/api` on the same origin. Vite proxies that path to port 4318 in development. Production Fastify serves the built web app and the API together, so the session cookie can stay `SameSite=Lax`. Guest appearance still lives in `localStorage` under `playchess.guest-settings` after Zod validation. Corrupt values fall back to defaults. A signed-in session copies the account settings once, and later changes are patched to the account.

## Time controls

Implemented in `@playchess/chess-core`.

| Field | Meaning |
| --- | --- |
| `initialTimeWhiteMs`, `initialTimeBlackMs` | Starting clock, integer milliseconds |
| `incrementWhiteMs`, `incrementBlackMs` | Added after an accepted move |
| `delayType` | Only `"none"` is accepted |
| `delayWhiteMs`, `delayBlackMs` | Must be `0` until a delay mode is specified |
| `category` on presets | Bullet, blitz, rapid, or classical |

Presets:

| Label | Initial | Increment | Pool |
| --- | --- | --- | --- |
| 1 + 0 | 60 000 ms | 0 | Bullet |
| 2 + 1 | 120 000 ms | 1 000 ms | Bullet |
| 3 + 0 | 180 000 ms | 0 | Blitz |
| 3 + 2 | 180 000 ms | 2 000 ms | Blitz |
| 5 + 0 | 300 000 ms | 0 | Blitz |
| 5 + 3 | 300 000 ms | 3 000 ms | Blitz |
| 10 + 0 | 600 000 ms | 0 | Rapid |
| 15 + 10 | 900 000 ms | 10 000 ms | Rapid |
| 30 + 0 | 1 800 000 ms | 0 | Classical |

Pool classification uses the longer side:

```
estimated = initialMs + 40 * incrementMs
bullet     estimated < 3 minutes
blitz      estimated < 10 minutes
rapid      estimated < 30 minutes
classical  otherwise
```

`3 + 0`, `10 + 0`, and `30 + 0` sit on the boundaries and are blitz, rapid, and classical. Time odds use the longer side so a one-minute-versus-ten-minute game is rapid, not bullet. `rated` is not part of the preset. It is chosen when a game is created.

### Clock rules

Local games run these rules in the browser. `packages/chess-core` owns the functions, and a later server milestone will call the same ones. An online result will not be decided in the browser. The client clock stays a display estimate between snapshots.

- Elapsed time for the side to move is `now - turnStartedAt`. Tests pass `now`; they do not sleep.
- A move is late when elapsed time is greater than or equal to the remaining time. The game ends as a timeout on that side, and the move is not applied. No increment is added. The flagged side is stored at 0.
- A move is in time when elapsed time is strictly less than the remaining time. Remaining time becomes `remaining - elapsed + increment` after the move is accepted.
- Increment applies after every accepted move, including ply 1. It does not apply on timeout, resignation, an agreed draw, or a rejected move.
- Move, position, clocks, and game version commit together. A repeated command id returns the current game and does not move or increment twice.
- The command carries the expected game version. A stale version is rejected and the clocks stay as they were.
- Resignation and an accepted draw subtract elapsed time and then stop the clock, without adding increment. A draw offer itself does not stop or rewind the clock.
- chess.js 1.4.0 reports threefold repetition and the fifty-move rule through `isDraw()` as soon as the count is reached. Local games end on that signal. They are not claim-only. Checkmate, stalemate, insufficient material, timeout, resignation, and agreed draws are stored as their own terminations.
- Delay modes stay unimplemented until their semantics are written with the same level of detail.

When multiplayer exists, the server clock is the one that commits. Concurrent moves for one game are serialized there. The browser keeps showing the estimate between snapshots.

## Data model

Migrated in `prisma/migrations/20261015120000_init`: User, Session, UserSettings, Game, and GameMove. Public ids are UUIDs except the session id, which is 32 random bytes. Local saves store the same account on both seats, with `kind` `local` and `rated` false. Online games must later refuse one account on both seats.

| Entity | Core fields |
| --- | --- |
| User | id, username, email, password hash, status, createdAt |
| Session | id, userId, expiresAt |
| UserSettings | userId, color scheme, board theme, coordinates, flip, highlights |
| Game | id, white and black user ids, status, result, termination, time-control config, start and final FEN, PGN, clocks, timestamps |
| GameMove | gameId, ply, UCI, SAN, FEN after the move, clocks after the move, command id |

Rating, GameRating, Analysis, AnalysisMove, and Challenge are not in this migration. Those shapes stay in the spec until their milestones, so this schema is not a guess at them. Friendship, tournament, puzzle attempt, and report wait as well.

`POST /api/v1/games` replays the UCI list with chess.js. Positions, SAN, and chess endings are derived. Timeout, resignation, and an agreed draw are accepted only while the position is still ongoing. Illegal moves reject the save. Clocks are the non-negative integers the browser committed for that local game.

Password hashes use Node `scrypt` (`scrypt$salt$hash`). An unknown email still runs scrypt. The session cookie is `playchess_session`, httpOnly, `SameSite=Lax`, secure in production, and lasts 30 days. Email is returned only from `/api/v1/users/me`. A game the caller does not play in is a 404. Register and login are limited to 10 attempts per minute per address, and that limit is off when `NODE_ENV=test`.

Account deletion and retention are not implemented. They are required before a public launch. Deleting a user who owns a game is also blocked by the foreign key until a deletion policy exists.

Rating algorithm: Glicko-2 is the candidate. It will be evaluated when ratings are implemented, then documented with before/after tests. A result updates a rating exactly once.

## HTTP and socket contracts

Implemented now:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Process and database, with no secrets |
| POST | `/api/v1/auth/register` | Register and set the session cookie |
| POST | `/api/v1/auth/login` | Sign in |
| POST | `/api/v1/auth/logout` | Delete the session |
| GET | `/api/v1/users/me` | Current profile, including email |
| PATCH | `/api/v1/users/me/settings` | Persist appearance |
| POST | `/api/v1/games` | Save a local transcript |
| GET | `/api/v1/games/:id` | A game the caller plays in |
| GET | `/api/v1/users/me/games` | Paginated history |

Still reserved:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/games/import-pgn` | Import PGN |
| GET | `/api/v1/games/:id/pgn` | Export PGN |
| POST | `/api/v1/games/:id/analysis` | Queue analysis |
| GET | `/api/v1/analysis/:id` | Analysis status and results |

Socket events:

- Client: `game:join`, `game:move`, `game:offerDraw`, `game:resign`, `game:reconnect`
- Server: `game:state`, `game:moveAccepted`, `game:moveRejected`, `game:clock`, `game:finished`

Every payload gets a Zod schema and a stable error code. The server broadcasts a state only after it has been stored.

Move transaction, when multiplayer exists:

1. Authenticate the socket and authorize the seat.
2. Validate the schema, command id, and expected version.
3. Lock the game. Confirm it is active and it is that seat's turn.
4. Check the move with the rules library and compute elapsed time.
5. Apply the clock rules above, including timeout ordering.
6. Commit move, clocks, version, position, and any result together.
7. Broadcast the committed state.
8. Treat a retry of the same command id as success without a second write.

## Design system

The interface is a chess room, not an admin dashboard. The board is the largest object on the home, settings, and local-game pages.

- Type: Fraunces for headings, Source Sans 3 for text. Both are SIL Open Font licensed and self-hosted through Fontsource.
- Colour: warm paper and a deep green in the light room; a green-black room with a light green action colour in the dark room.
- Boards: Club green, Walnut, Ocean. Tokens are CSS variables switched by `data-board-theme` on the document, and on each theme swatch so the swatches stay accurate.
- Pieces: original geometric drawings. One set.
- Controls that change pixels today: room colour, board theme, coordinates, flip, highlight ring on the empty e4 square of the preview, and the same tokens on the local board (last move, legal moves, and the king in check).
- Settings persist in `localStorage` for this browser, and on the account when someone is signed in.
- Shell routes: Home, Play (preset picker), Play local, Review, History, Profile, Settings, Sign in. Review opens a saved game. History lists saves. The live local game is still decided in this tab and is cleared on refresh. The saved copy remains.
- Accessibility in this shell: skip link, landmarks, button and link names, visible focus, `prefers-reduced-motion`, contrast-minded ink and muted colours, 44px menu target, whole-row checkbox labels.

## Security decisions already in force

- `.env.example` holds placeholders. Production mode rejects `change-me` and `replace-with`, and requires `https` for `WEB_ORIGIN`.
- The public schema has one key, `VITE_API_ORIGIN`. Session secrets and database URLs are not part of that schema.
- No secrets are committed.
- Auth uses an httpOnly session cookie. Register and login are rate limited outside tests. CORS allows `WEB_ORIGIN` with credentials. The API body limit is 1 MB. Logs redact cookies and authorization headers.

## Milestones

Section 15 of the specification is the working order. This delivery is milestone 2. Section 14 called the shell work milestone 0.

| Milestone | Scope | Status |
| --- | --- | --- |
| 1 | Workspace, design system, responsive shell, CI, env validation | Done |
| 2 | Local board, legal moves, clocks, replay | Done in this tree |
| 3 | PostgreSQL, Prisma, accounts, settings, persistence | Done in this tree |
| 4 | Server-authoritative multiplayer, matchmaking, challenges, reconnect | Waiting |
| 5 | Stockfish bots, after the licence review | Waiting |
| 6 | PGN, FEN, analysis | Waiting |
| 7 | Ratings, history, statistics | Waiting |
| 8 | Docker Compose, Nginx, HTTPS, DNS, backups, rollback on the existing Droplet | Waiting for approval |
| 9 | Security, accessibility, and load hardening | Waiting |
| 10 | Expo app | After the web MVP |

## Risks

- The workspace `origin` remote is not GitHub. Publishing to `akBhatnagar/PlayChess` needs credentials this environment does not assume.
- React Router 8 will not install on Node older than 22.22.
- Stockfish's GPL duties are unresolved. The engine is intentionally absent.
- DNS for `akshaybhatnagar.in` may still be served by Vercel while the name is registered at GoDaddy. The authoritative provider has to be identified before any record is added. Nameservers stay as they are unless you approve a change.
- The Droplet already hosts other work. A later deploy must add a vhost and a Compose project named `playchess` without replacing global Nginx, publishing port 5432, or pruning other containers.
- Delay modes are rejected on purpose. Adding one without a tested definition would make clocks ambiguous.
- Signing in applies the account's appearance once. Edits after that are written locally and patched. A guest's unsaved theme is replaced by the account settings at sign-in.
- The home and settings boards are still starting-position previews. The local game at `/play/local` is the board that enforces the rules.
- Refreshing the tab drops the live local game. A signed-in player can save a copy first. The server checks the moves again.
