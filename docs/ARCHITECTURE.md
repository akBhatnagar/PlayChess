# PlayChess architecture

This is the plan for the greenfield build. Milestone 1 implements the workspace, the design system, the responsive shell, environment validation, and the time-control model. Later milestones follow the same document. Nothing here has been deployed.

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
| API, later | Node.js, TypeScript, Fastify, Socket.IO |
| Database, later | PostgreSQL, Prisma migrations |
| Rules, next milestone | chess.js, after a quick API and licence check |
| Engine, later | Stockfish only after the licence note in `docs/LICENSING.md` |
| Tests | Vitest, Testing Library, Playwright |
| Packages | pnpm workspaces |
| CI | GitHub Actions: install, lint, typecheck, unit tests, production build, Playwright smoke |
| Deploy, later | Docker Compose, Nginx, Let's Encrypt. Redis stays out until more than one app instance needs it |

React Router 8 requires Node.js `>= 22.22`. `.nvmrc` pins `22.23.3`.

## Folder structure

```
apps/web/                  React shell. Live in this milestone.
packages/chess-core/       Time controls and rating-pool classification. Live.
packages/theme-config/     Guest appearance settings. Live.
packages/validation/       Server and public environment schemas. Live.
packages/shared-types/     Later, when the API and client share response types.
packages/game-protocol/    Later, with Socket.IO.
packages/api-client/       Later, when the web app calls the API.
apps/api/                  Later. Fastify modules.
apps/engine-worker/        Later, only if the engine runs out of process.
apps/mobile/               After the web MVP. Expo, reusing these packages.
prisma/                    Later, with the first migration.
deploy/nginx/              Later, as a template. Not installed on the Droplet.
```

Empty packages are not created ahead of the code that needs them.

## Runtime shape

```
Browser  --HTTPS REST-->  Fastify API  -->  PostgreSQL
        --Socket.IO---->  same API process, one game lock at a time
```

The browser is a view. For a live game it may show an optimistic move, then it must adopt `game:moveAccepted` or roll back on `game:moveRejected`. Client-supplied FEN, clocks, results, and ratings are never authoritative.

PostgreSQL is the durable record. Redis is optional later for presence or a multi-instance queue. The first deployment is one API container and one database container on a private Compose network.

The web app in this milestone does not call an API. TanStack Query is mounted so the data layer has a home. Guest appearance is the only state, and it lives in `localStorage` under `playchess.guest-settings` after Zod validation. Corrupt values fall back to defaults.

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

### Clock rules for the next milestone

These rules are specified now so the local-play milestone can test them. They are not implemented yet.

- The server clock is authoritative. The client clock is a display estimate between snapshots.
- Elapsed time for the side to move is `serverNow - turnStartedAt`.
- A move is late when elapsed time is greater than or equal to the remaining time. The game ends as a timeout on that side, and the move is not applied. No increment is added.
- A move is in time when elapsed time is strictly less than the remaining time. Remaining time becomes `remaining - elapsed + increment` after the move is accepted.
- Increment applies after every accepted move, including ply 1. It does not apply on timeout, resignation, or a rejected move.
- Move, position, clocks, and game version commit in one transaction. A repeated command id does not move or increment twice.
- Concurrent moves for one game are serialized. The command must carry the expected game version or ply. A stale version is rejected.
- Tests will use a controllable clock, not sleeps.
- Delay modes stay unimplemented until their semantics are written with the same level of detail.

## Data model

Not migrated yet. The first Prisma milestone should create these tables with foreign keys, non-guessable public ids, and indexes for player/date history, game/ply, and rating lookup.

| Entity | Core fields |
| --- | --- |
| User | id, username, email, password hash, status, createdAt |
| UserSettings | userId, theme, sound, notation, accessibility |
| Game | id, white and black user ids, status, result, termination, time-control config, start and final FEN, PGN, timestamps |
| GameMove | gameId, ply, UCI, SAN, FEN after the move, clocks after the move |
| Rating | userId, pool, rating, deviation, volatility |
| GameRating | gameId, userId, before, after, delta, pool, unique so a result rates once |
| Analysis | gameId, owner, engine name, version, config, status, createdAt |
| AnalysisMove | analysis id, ply, score type and value, perspective, depth, principal variation |
| Challenge | creator, hashed invite token, settings, status, expiry |

Friendship, tournament, puzzle attempt, and report wait until those features are built. The schema should not block the MVP on them.

Invitation tokens are stored as hashes. Password hashes, emails, private analysis, and moderator notes are not returned to other users. Account deletion and retention need a written policy before public launch.

Rating algorithm: Glicko-2 is the candidate. It will be evaluated when ratings are implemented, then documented with before/after tests. A result updates a rating exactly once.

## HTTP and socket contracts

Not implemented. Paths are reserved.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Sign in |
| GET | `/api/v1/users/me` | Current profile |
| PATCH | `/api/v1/users/me/settings` | Persist settings |
| POST | `/api/v1/games` | Create a game |
| GET | `/api/v1/games/:id` | Authorized game |
| GET | `/api/v1/users/me/games` | Paginated history |
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

The interface is a chess room, not an admin dashboard. The board is the largest object on the home and settings pages.

- Type: Fraunces for headings, Source Sans 3 for text. Both are SIL Open Font licensed and self-hosted through Fontsource.
- Colour: warm paper and a deep green in the light room; a green-black room with a light green action colour in the dark room.
- Boards: Club green, Walnut, Ocean. Tokens are CSS variables switched by `data-board-theme` on the document, and on each theme swatch so the swatches stay accurate.
- Pieces: original geometric drawings. One set.
- Controls that change pixels today: room colour, board theme, coordinates, flip, highlight ring on the empty e4 square.
- Settings persist in `localStorage` for this browser. Signed-in persistence waits for accounts.
- Shell routes: Home, Play (preset picker), Review, History, Profile, Settings, Sign in. Review, history, profile, and sign-in explain what will arrive. They do not pretend the feature works.
- Accessibility in this shell: skip link, landmarks, button and link names, visible focus, `prefers-reduced-motion`, contrast-minded ink and muted colours, 44px menu target, whole-row checkbox labels.

## Security decisions already in force

- `.env.example` holds placeholders. Production mode rejects `change-me` and `replace-with`, and requires `https` for `WEB_ORIGIN`.
- The public schema has one key, `VITE_API_ORIGIN`. Session secrets and database URLs are not part of that schema.
- No secrets are committed.
- Auth, rate limits, CORS, and upload limits arrive with the API. They are not stubbed.

## Milestones

Section 15 of the specification is the working order. This delivery is milestone 1. Section 14 called the same work milestone 0.

| Milestone | Scope | Status |
| --- | --- | --- |
| 1 | Workspace, design system, responsive shell, CI, env validation | This commit |
| 2 | Local board, legal moves, clocks, replay | Next |
| 3 | PostgreSQL, Prisma, accounts, settings, persistence | Waiting |
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
- Guest settings are per browser, not per account. Signing in later must define how they merge.
- The decorative board is a starting-position preview. It does not enforce chess rules. That is milestone 2.
