import { Chessboard } from "@/components/board/chessboard.tsx";
import { formatClock } from "@/components/board/format-clock.ts";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { fetchGame, type SavedGameDetail } from "@/lib/api.ts";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { positionAt, type LocalGame } from "@playchess/chess-core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";

function asLocalGame(game: SavedGameDetail): LocalGame {
  return {
    version: game.moves.length,
    initialFen: game.initialFen,
    moves: game.moves,
    fen: game.finalFen,
    turn: "w",
    status: game.status === "finished" ? "finished" : "active",
    result: game.result === "1-0" || game.result === "0-1" || game.result === "1/2-1/2" ? game.result : null,
    termination:
      game.termination === "checkmate" ||
      game.termination === "stalemate" ||
      game.termination === "timeout" ||
      game.termination === "resignation" ||
      game.termination === "draw-agreement" ||
      game.termination === "threefold" ||
      game.termination === "fifty-move" ||
      game.termination === "insufficient"
        ? game.termination
        : null,
    clocks: { whiteMs: game.whiteMs, blackMs: game.blackMs, turnStartedAtMs: null, active: null },
    timeControl: game.timeControl,
    appliedCommandIds: game.moves.map((move) => move.commandId),
    drawOffer: null,
  };
}

export function ReviewIndexPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Review</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Open a saved game</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Replay reads the moves stored with your account. Pick one from history.
      </p>
      <Button asChild className="mt-6 h-11">
        <Link to="/history">Saved games</Link>
      </Button>
    </div>
  );
}

export function ReviewGamePage() {
  const { gameId } = useParams();
  const settings = useGuestSettings((state) => state.settings);
  const [ply, setPly] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => fetchGame(gameId ?? ""),
    enabled: Boolean(gameId),
  });

  if (query.isPending) {
    return <p className="text-muted-foreground">Loading the game.</p>;
  }

  if (!query.data) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-4xl">That game is not available</h1>
        <p className="mt-3 text-muted-foreground">It may belong to another account, or the id is unknown.</p>
        <Button asChild variant="outline" className="mt-6 h-11">
          <Link to="/history">Back to history</Link>
        </Button>
      </div>
    );
  }

  const game = query.data;
  const local = asLocalGame(game);
  const shown = ply === null ? local.moves.length : ply;
  const view = positionAt(local, shown);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Review</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">
            {game.whiteUsername} vs {game.blackUsername}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {game.result ?? "Unfinished"}
            {game.termination ? ` · ${game.termination}` : ""}
          </p>
        </div>
        <Button asChild variant="outline" className="h-11">
          <Link to="/history">Back to history</Link>
        </Button>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mx-auto grid w-full max-w-[640px] gap-3">
          <p className="text-right font-heading text-3xl tabular-nums">{formatClock(view.blackMs)}</p>
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
              selected={null}
              targets={[]}
              inputDisabled
              onSquare={() => undefined}
            />
          </div>
          <p className="font-heading text-3xl tabular-nums">{formatClock(view.whiteMs)}</p>
        </div>
        <aside className="grid gap-4">
          <p className="text-muted-foreground">
            {shown === 0 ? "Viewing the start." : `Viewing move ${shown}${view.san ? `, ${view.san}` : ""}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setPly(Math.max(0, shown - 1))} disabled={shown === 0}>
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setPly(shown + 1 >= local.moves.length ? null : shown + 1)}
              disabled={shown === local.moves.length}
            >
              Forward
            </Button>
          </div>
          <ol className="max-h-80 space-y-1 overflow-y-auto rounded-2xl border bg-card p-4" aria-label="Move list">
            {local.moves.map((move) => (
              <li key={move.ply}>
                <button
                  type="button"
                  aria-current={shown === move.ply ? "step" : undefined}
                  onClick={() => setPly(move.ply === local.moves.length ? null : move.ply)}
                  className={cn(
                    "min-h-11 w-full rounded-lg px-2 text-left font-medium hover:bg-accent",
                    shown === move.ply && "bg-accent",
                  )}
                >
                  {move.ply}. {move.san}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
