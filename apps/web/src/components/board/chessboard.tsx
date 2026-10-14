import { PieceGlyph, type PieceCode, type PieceColor } from "@/components/board/piece-glyph.tsx";
import type { BoardPiece, Side } from "@playchess/chess-core";
import { useRef, useState } from "react";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

const PIECE_NAME: Record<PieceCode, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

const COLOR_NAME: Record<PieceColor, string> = {
  w: "white",
  b: "black",
};

function neighbor(square: string, key: string, files: readonly string[], ranks: readonly string[]): string {
  const fileIndex = files.indexOf(square[0] ?? "");
  const rankIndex = ranks.indexOf(square[1] ?? "");
  if (fileIndex < 0 || rankIndex < 0) {
    return square;
  }
  const fileStep = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  const rankStep = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const file = files[Math.max(0, Math.min(files.length - 1, fileIndex + fileStep))];
  const rank = ranks[Math.max(0, Math.min(ranks.length - 1, rankIndex + rankStep))];
  if (!file || !rank) {
    return square;
  }
  return `${file}${rank}`;
}

export function Chessboard({
  pieces,
  turn,
  flipBoard,
  showCoordinates,
  showHighlights,
  lastFrom,
  lastTo,
  checkSquare,
  selected,
  targets,
  inputDisabled,
  onSquare,
}: {
  pieces: readonly BoardPiece[];
  turn: Side;
  flipBoard: boolean;
  showCoordinates: boolean;
  showHighlights: boolean;
  lastFrom: string | null;
  lastTo: string | null;
  checkSquare: string | null;
  selected: string | null;
  targets: readonly string[];
  inputDisabled: boolean;
  onSquare: (square: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState("e2");
  const files = flipBoard ? [...FILES].reverse() : [...FILES];
  const ranks = flipBoard ? [...RANKS].reverse() : [...RANKS];
  const leftFile = files[0];
  const bottomRank = ranks.at(-1);
  const bySquare = new Map(pieces.map((piece) => [piece.square, piece]));
  const orientation = flipBoard ? "black at the bottom" : "white at the bottom";

  function focusSquare(square: string) {
    setFocused(square);
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-square="${square}"]`)?.focus();
  }

  return (
    <div className="grid gap-2">
      <div
        ref={boardRef}
      role="group"
      aria-label={`Chessboard, ${orientation}`}
      data-testid="live-board"
      className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md shadow-[0_16px_40px_-24px_rgba(28,25,20,0.7)] ring-1 ring-foreground/20"
    >
      {ranks.map((rank) =>
        files.map((file) => {
          const square = `${file}${rank}`;
          const fileIndex = FILES.indexOf(file);
          const isDark = (fileIndex + Number(rank)) % 2 === 1;
          const piece = bySquare.get(square);
          const isTarget = targets.includes(square);
          const isLast = showHighlights && (square === lastFrom || square === lastTo);
          const isSelected = square === selected;
          const coordinateColor = isDark ? "var(--square-light)" : "var(--square-dark)";
          const label = piece
            ? `${square}, ${COLOR_NAME[piece.color]} ${PIECE_NAME[piece.piece]}`
            : `${square}, empty`;
          const name = isTarget ? `${label}, legal move` : label;

          return (
            <button
              key={square}
              type="button"
              data-square={square}
              data-legal={isTarget ? "true" : undefined}
              data-check={checkSquare === square ? "true" : undefined}
              tabIndex={focused === square ? 0 : -1}
              aria-label={name}
              aria-pressed={isSelected}
              aria-disabled={inputDisabled}
              onClick={() => {
                setFocused(square);
                if (!inputDisabled) {
                  onSquare(square);
                }
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowRight" ||
                  event.key === "ArrowLeft" ||
                  event.key === "ArrowUp" ||
                  event.key === "ArrowDown"
                ) {
                  event.preventDefault();
                  focusSquare(neighbor(square, event.key, files, ranks));
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!inputDisabled) {
                    onSquare(square);
                  }
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onSquare("");
                }
              }}
              className="relative flex items-center justify-center p-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
              style={{ background: isDark ? "var(--square-dark)" : "var(--square-light)" }}
            >
              {isLast ? (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "color-mix(in srgb, var(--square-highlight) 42%, transparent)" }}
                />
              ) : null}
              {isSelected ? (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 3px var(--square-highlight)" }}
                />
              ) : null}
              {checkSquare === square ? (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 3px var(--destructive)" }}
                />
              ) : null}
              {showHighlights && isTarget ? (
                <span
                  data-testid="legal-dot"
                  className={
                    piece
                      ? "pointer-events-none absolute inset-[8%] rounded-full"
                      : "pointer-events-none absolute size-[28%] rounded-full"
                  }
                  style={
                    piece
                      ? { boxShadow: "inset 0 0 0 3px color-mix(in srgb, var(--square-highlight) 80%, transparent)" }
                      : { background: "color-mix(in srgb, var(--square-highlight) 75%, transparent)" }
                  }
                />
              ) : null}
              {piece ? <PieceGlyph piece={piece.piece} color={piece.color} /> : null}
              {showCoordinates && file === leftFile ? (
                <span
                  data-coordinate="rank"
                  className="pointer-events-none absolute top-0.5 left-1 text-[0.65rem] leading-none font-semibold"
                  style={{ color: coordinateColor }}
                >
                  {rank}
                </span>
              ) : null}
              {showCoordinates && rank === bottomRank ? (
                <span
                  data-coordinate="file"
                  className="pointer-events-none absolute right-1 bottom-0.5 text-[0.65rem] leading-none font-semibold"
                  style={{ color: coordinateColor }}
                >
                  {file}
                </span>
              ) : null}
            </button>
          );
        }),
      )}
      </div>
      <p className="sr-only">
        {turn === "w" ? "White" : "Black"} to move. Arrow keys move between squares. Enter selects a
        piece or plays the move.
      </p>
    </div>
  );
}
