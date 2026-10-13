# Licensing notes

The PlayChess application licence is not chosen yet. The repository owner should add a `LICENSE` file before a public launch. Nothing in this milestone depends on that choice.

## This milestone

| Asset | Status |
| --- | --- |
| Geometric piece drawings in `apps/web/src/components/board/piece-glyph.tsx` | Original, drawn for PlayChess |
| Fraunces | SIL Open Font License 1.1, via `@fontsource/fraunces` |
| Source Sans 3 | SIL Open Font License 1.1, via `@fontsource/source-sans-3` |
| UI primitives | shadcn/ui generated components, Radix primitives, Lucide icons. Their package licences apply |
| chess.js | Not added yet |
| Stockfish | Not added yet |
| Third-party piece sets, sounds, puzzles, openings | Not added yet |

## Before Stockfish or borrowed art

Stockfish is GPL-licensed. Before any engine binary, WASM build, or engine-derived work is added, record the exact version, the licence text, the source-distribution obligation, and whether the engine runs in a separate process. Do not bundle it into the web client until that review is written down.

Piece sets, move sounds, fonts beyond the two above, puzzle collections, and opening books need the same review. Prefer original or clearly licensed assets. Guest settings currently offer one piece style because that is the only set that has been drawn for this project.
