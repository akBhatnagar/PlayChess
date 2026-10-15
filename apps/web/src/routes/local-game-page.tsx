import { Chessboard } from "@/components/board/chessboard.tsx";
import { formatClock } from "@/components/board/format-clock.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { saveLocalGame } from "@/lib/api.ts";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { useLocalGame } from "@/state/local-game.ts";
import { useSession } from "@/state/session.ts";
import {
  displayedClockMs,
  legalMoves,
  positionAt,
  presetById,
  ratingPoolLabel,
  type LocalGame,
  type Side,
} from "@playchess/chess-core";
import { useEffect, useState } from "react";
import { Link } from "react-router";

const PROMOTION = [
  { piece: "q", label: "Queen" },
  { piece: "r", label: "Rook" },
  { piece: "b", label: "Bishop" },
  { piece: "n", label: "Knight" },
] as const;

function statusLine(game: LocalGame, inCheck: boolean): string {
  if (game.status === "finished") {
    switch (game.termination) {
      case "checkmate":
        return game.result === "1-0" ? "Checkmate. White wins." : "Checkmate. Black wins.";
      case "stalemate":
        return "Stalemate. The game is drawn.";
      case "timeout":
        return game.result === "1-0"
          ? "Black ran out of time. White wins."
          : "White ran out of time. Black wins.";
      case "resignation":
        return game.result === "1-0" ? "Black resigned. White wins." : "White resigned. Black wins.";
      case "draw-agreement":
        return "Draw by agreement.";
      case "threefold":
        return "Draw by threefold repetition.";
      case "fifty-move":
        return "Draw by the fifty-move rule.";
      case "insufficient":
        return "Draw by insufficient material.";
      default:
        return "Game over.";
    }
  }

  const side = game.turn === "w" ? "White" : "Black";
  if (game.drawOffer) {
    const offerer = game.drawOffer === "w" ? "White" : "Black";
    return `${offerer} offers a draw. ${side} to move.`;
  }
  if (inCheck) {
    return `${side} to move, in check.`;
  }
  return `${side} to move.`;
}

function ClockFace({
  label,
  ms,
  active,
}: {
  label: string;
  ms: number;
  active: boolean;
}) {
  const low = active && ms < 10_000;
  return (
    <div
      role="timer"
      aria-label={`${label} clock`}
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
        low && "border-destructive bg-destructive text-white",
      )}
    >
      <span className="text-sm font-semibold tracking-[0.14em] uppercase">{label}</span>
      <span className="font-heading text-3xl leading-none tabular-nums">{formatClock(ms)}</span>
    </div>
  );
}

export function LocalGamePage() {
  const settings = useGuestSettings((state) => state.settings);
  const presetId = useLocalGame((state) => state.presetId);
  const game = useLocalGame((state) => state.game);
  const reviewPly = useLocalGame((state) => state.reviewPly);
  const nowMs = useLocalGame((state) => state.nowMs);
  const notice = useLocalGame((state) => state.notice);
  const move = useLocalGame((state) => state.move);
  const resign = useLocalGame((state) => state.resign);
  const offerDraw = useLocalGame((state) => state.offerDraw);
  const acceptDraw = useLocalGame((state) => state.acceptDraw);
  const declineDraw = useLocalGame((state) => state.declineDraw);
  const tick = useLocalGame((state) => state.tick);
  const review = useLocalGame((state) => state.review);

  const [selection, setSelection] = useState<{
    version: number;
    review: number | null;
    square: string;
  } | null>(null);
  const [promotion, setPromotion] = useState<{
    version: number;
    review: number | null;
    from: string;
    to: string;
  } | null>(null);
  const [resignOpen, setResignOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      tick();
    }, 100);
    return () => {
      window.clearInterval(id);
    };
  }, [tick]);

  if (!game) {
    return (
      <div className="max-w-xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Local</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">No local game in this tab</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Choose a clock and start. The game stays in this tab, and refreshing clears it.
        </p>
        <Button asChild className="mt-6 h-11 px-5 text-base">
          <Link to="/play">Choose a clock</Link>
        </Button>
      </div>
    );
  }

  const current = game;
  const reviewing = reviewPly !== null && reviewPly < current.moves.length;
  const selected =
    selection && selection.version === current.version && selection.review === reviewPly
      ? selection.square
      : null;
  const pendingPromotion =
    promotion && promotion.version === current.version && promotion.review === reviewPly
      ? promotion
      : null;
  const shownPly = reviewing ? reviewPly : game.moves.length;
  const view = positionAt(game, shownPly);
  const liveClocks = displayedClockMs(game.clocks, nowMs);
  const clocks = reviewing ? { whiteMs: view.whiteMs, blackMs: view.blackMs } : liveClocks;
  const inputDisabled = reviewing || game.status !== "active";
  const legal = inputDisabled ? [] : legalMoves(game);
  const targets = selected
    ? [...new Set(legal.filter((item) => item.from === selected).map((item) => item.to))]
    : [];
  const preset = presetId ? presetById(presetId) : undefined;
  const bottomIsWhite = !settings.flipBoard;
  const topSide: Side = bottomIsWhite ? "b" : "w";
  const bottomSide: Side = bottomIsWhite ? "w" : "b";

  function onSquare(square: string) {
    if (!square) {
      setSelection(null);
      return;
    }
    if (inputDisabled) {
      return;
    }
    const fromHere = selected ? legal.filter((item) => item.from === selected && item.to === square) : [];
    if (selected && fromHere.length > 0) {
      if (fromHere.some((item) => item.promotion)) {
        setPromotion({ version: current.version, review: reviewPly, from: selected, to: square });
        return;
      }
      const uci = fromHere[0]?.uci;
      if (uci) {
        move(uci);
      }
      return;
    }
    const ownPiece = view.pieces.some((piece) => piece.square === square && piece.color === current.turn);
    if (ownPiece && legal.some((item) => item.from === square)) {
      setSelection({ version: current.version, review: reviewPly, square });
      return;
    }
    setSelection(null);
  }

  function step(delta: number) {
    const next = shownPly + delta;
    if (next <= 0) {
      review(current.moves.length === 0 ? null : 0);
      return;
    }
    if (next >= current.moves.length) {
      review(null);
      return;
    }
    review(next);
  }

  const sideToMove = game.turn === "w" ? "White" : "Black";

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Local</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Local game</h1>
          <p className="mt-2 text-muted-foreground">
            {preset ? `${preset.label} · ${ratingPoolLabel(preset.category)}` : "Clock on this board"}
            . Both sides from this seat.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11">
          <Link to="/play">Back to the lobby</Link>
        </Button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mx-auto grid w-full max-w-[640px] gap-3">
          <ClockFace
            label={topSide === "w" ? "White" : "Black"}
            ms={topSide === "w" ? clocks.whiteMs : clocks.blackMs}
            active={!reviewing && game.clocks.active === topSide}
          />
          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-22rem))]">
          <Chessboard
            pieces={view.pieces}
            turn={view.turn}
            flipBoard={settings.flipBoard}
            showCoordinates={settings.showCoordinates}
            showHighlights={settings.showHighlights}
            lastFrom={view.lastFrom}
            lastTo={view.lastTo}
            checkSquare={view.checkSquare}
            selected={inputDisabled ? null : selected}
            targets={targets}
            inputDisabled={inputDisabled}
            onSquare={onSquare}
          />
          </div>
          <ClockFace
            label={bottomSide === "w" ? "White" : "Black"}
            ms={bottomSide === "w" ? clocks.whiteMs : clocks.blackMs}
            active={!reviewing && game.clocks.active === bottomSide}
          />
        </div>

        <aside className="grid gap-4">
          <section className="rounded-2xl border bg-card p-4" aria-live="polite">
            <h2 className="text-2xl">{reviewing ? "Replay" : statusLine(game, view.inCheck)}</h2>
            {reviewing ? (
              <p className="mt-2 text-muted-foreground">
                {shownPly === 0
                  ? "Viewing the start."
                  : `Viewing move ${shownPly}${view.san ? `, ${view.san}` : ""}.`}{" "}
                Moves stay off until you return to the live position.
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">
                Decided in this browser, with the same rules the server checks when you save.
              </p>
            )}
            {notice ? <p className="mt-2 text-destructive">{notice}</p> : null}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => step(-1)} disabled={shownPly === 0}>
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => step(1)}
              disabled={shownPly === game.moves.length}
            >
              Forward
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => review(null)} disabled={!reviewing}>
              Back to live
            </Button>
          </div>

          <section aria-label="Move list" className="rounded-2xl border bg-card p-4">
            <h2 className="text-2xl">Moves</h2>
            {game.moves.length === 0 ? (
              <p className="mt-2 text-muted-foreground">Moves will appear here.</p>
            ) : (
              <ol className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                {Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, index) => {
                  const white = game.moves[index * 2];
                  const black = game.moves[index * 2 + 1];
                  return (
                    <li key={white?.ply ?? index} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                      {white ? (
                        <MoveButton
                          move={white}
                          current={shownPly === white.ply}
                          onClick={() => review(white.ply === game.moves.length ? null : white.ply)}
                        />
                      ) : (
                        <span />
                      )}
                      {black ? (
                        <MoveButton
                          move={black}
                          current={shownPly === black.ply}
                          onClick={() => review(black.ply === game.moves.length ? null : black.ply)}
                        />
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {game.drawOffer ? (
              <>
                <Button type="button" className="h-11" onClick={acceptDraw} disabled={inputDisabled}>
                  Accept draw
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={declineDraw} disabled={inputDisabled}>
                  Decline draw
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="h-11" onClick={offerDraw} disabled={inputDisabled}>
                Offer draw
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => setResignOpen(true)}
              disabled={inputDisabled}
            >
              Resign
            </Button>
          </div>
          <SaveLocalGame />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Refreshing the tab clears the live board. A saved copy stays on the account. Online play is not available yet.
          </p>
        </aside>
      </div>

      <Dialog
        open={pendingPromotion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPromotion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a piece</DialogTitle>
            <DialogDescription>The pawn promotes before the move is played.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {PROMOTION.map((choice) => (
              <Button
                key={choice.piece}
                type="button"
                className="h-11"
                onClick={() => {
                  if (!pendingPromotion) {
                    return;
                  }
                  move(`${pendingPromotion.from}${pendingPromotion.to}${choice.piece}`);
                  setPromotion(null);
                }}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resign this game?</DialogTitle>
            <DialogDescription>
              {sideToMove} loses. Resigning does not add an increment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setResignOpen(false)}>
              Keep playing
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                resign();
                setResignOpen(false);
              }}
            >
              Resign now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveLocalGame() {
  const session = useSession();
  const game = useLocalGame((state) => state.game);
  const savedGameId = useLocalGame((state) => state.savedGameId);
  const savedVersion = useLocalGame((state) => state.savedVersion);
  const noteSaved = useLocalGame((state) => state.noteSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game) {
    return null;
  }

  if (!session.data) {
    return (
      <p className="text-sm">
        <Link to="/sign-in" className="font-semibold text-primary underline-offset-4 hover:underline">
          Sign in to save this game
        </Link>
      </p>
    );
  }

  const saved = savedGameId !== null && savedVersion === game.version;

  return (
    <div className="grid gap-2">
      {saved && savedGameId ? (
        <Button asChild variant="outline" className="h-11">
          <Link to={`/review/${savedGameId}`}>Saved. Open the replay</Link>
        </Button>
      ) : (
        <Button
          type="button"
          className="h-11"
          disabled={pending}
          onClick={() => {
            const version = game.version;
            setPending(true);
            setError(null);
            void saveLocalGame({
              initialFen: game.initialFen,
              claimedResult: game.result,
              claimedTermination: game.termination,
              moves: game.moves.map((move) => ({
                uci: move.uci,
                whiteMs: move.whiteMs,
                blackMs: move.blackMs,
                commandId: move.commandId,
              })),
              timeControl: game.timeControl,
            }).then((result) => {
              setPending(false);
              if ("error" in result) {
                setError(result.error);
                return;
              }
              if (useLocalGame.getState().game?.version === version) {
                noteSaved(result.id, version);
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save to your account"}
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function MoveButton({
  move,
  current,
  onClick,
}: {
  move: { ply: number; san: string };
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Move ${move.ply}, ${move.san}`}
      aria-current={current ? "step" : undefined}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-lg px-2 text-left font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        current && "bg-accent",
      )}
    >
      {move.san}
    </button>
  );
}
