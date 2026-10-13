import type { BoardThemeId } from "@playchess/theme-config";
import { PieceGlyph, type PieceCode, type PieceColor } from "@/components/board/piece-glyph.tsx";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"] as const satisfies readonly PieceCode[];

type SquarePiece = { piece: PieceCode; color: PieceColor };

const STARTING_PIECES: Record<string, SquarePiece> = {};

function place(rank: string, color: PieceColor, pieces: readonly PieceCode[]) {
  pieces.forEach((piece, index) => {
    const file = FILES[index];
    if (!file) {
      return;
    }
    STARTING_PIECES[`${file}${rank}`] = { piece, color };
  });
}

place("8", "b", BACK_RANK);
place("7", "b", Array.from({ length: 8 }, () => "P" as const));
place("2", "w", Array.from({ length: 8 }, () => "P" as const));
place("1", "w", BACK_RANK);

const THEME_LABEL: Record<BoardThemeId, string> = {
  club: "club green",
  walnut: "walnut",
  ocean: "ocean",
};

export function BoardPreview({
  theme,
  showCoordinates,
  flipBoard,
  highlightSquare,
}: {
  theme: BoardThemeId;
  showCoordinates: boolean;
  flipBoard: boolean;
  highlightSquare?: string;
}) {
  const files = flipBoard ? [...FILES].reverse() : [...FILES];
  const ranks = flipBoard ? [...RANKS].reverse() : [...RANKS];
  const leftFile = files[0];
  const bottomRank = ranks.at(-1);
  const orientation = flipBoard ? "black at the bottom" : "white at the bottom";
  const article = theme === "ocean" ? "an" : "a";

  return (
    <div
      role="img"
      aria-label={`Starting position on ${article} ${THEME_LABEL[theme]} board, ${orientation}.`}
      data-testid="board-preview"
      className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md shadow-[0_16px_40px_-24px_rgba(28,25,20,0.7)] ring-1 ring-foreground/20"
    >
      {ranks.map((rank) =>
        files.map((file) => {
          const square = `${file}${rank}`;
          const fileIndex = FILES.indexOf(file);
          const isDark = (fileIndex + Number(rank)) % 2 === 1;
          const piece = STARTING_PIECES[square];
          const coordinateColor = isDark ? "var(--square-light)" : "var(--square-dark)";

          return (
            <div
              key={square}
              data-square={square}
              data-highlight={highlightSquare === square ? "true" : undefined}
              className="relative flex items-center justify-center"
              style={{ background: isDark ? "var(--square-dark)" : "var(--square-light)" }}
            >
              {highlightSquare === square ? (
                <span
                  data-testid="highlight-ring"
                  className="pointer-events-none absolute inset-[7%] rounded-[4px]"
                  style={{ boxShadow: "inset 0 0 0 3px var(--square-highlight)" }}
                />
              ) : null}
              {piece ? <PieceGlyph piece={piece.piece} color={piece.color} /> : null}
              {showCoordinates && file === leftFile ? (
                <span
                  data-coordinate="rank"
                  className="absolute top-0.5 left-1 text-[0.65rem] leading-none font-semibold"
                  style={{ color: coordinateColor }}
                >
                  {rank}
                </span>
              ) : null}
              {showCoordinates && rank === bottomRank ? (
                <span
                  data-coordinate="file"
                  className="absolute right-1 bottom-0.5 text-[0.65rem] leading-none font-semibold"
                  style={{ color: coordinateColor }}
                >
                  {file}
                </span>
              ) : null}
            </div>
          );
        }),
      )}
    </div>
  );
}
