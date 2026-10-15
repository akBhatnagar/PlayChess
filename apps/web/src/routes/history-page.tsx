import { Button } from "@/components/ui/button.tsx";
import { fetchHistory, type GameSummary } from "@/lib/api.ts";
import { useSession } from "@/state/session.ts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

function resultLabel(game: GameSummary): string {
  if (game.status !== "finished" || !game.result) {
    return "Unfinished";
  }
  if (game.result === "1/2-1/2") {
    return "Draw";
  }
  return game.result === "1-0" ? "White won" : "Black won";
}

export function HistoryPage() {
  const session = useSession();
  const history = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    enabled: Boolean(session.data),
  });

  return (
    <div className="grid gap-6">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">History</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Saved games</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Local games you save while signed in are listed here. Each one can be replayed.
        </p>
      </header>
      {session.isPending ? <p className="text-muted-foreground">Checking your session.</p> : null}
      {session.isSuccess && !session.data ? (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-lg">Sign in to see games saved to an account.</p>
          <Button asChild className="mt-4 h-11">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </div>
      ) : null}
      {session.data && history.isPending ? <p className="text-muted-foreground">Loading your games.</p> : null}
      {session.data && history.isError ? (
        <p className="text-destructive">The game list did not load.</p>
      ) : null}
      {session.data && history.data && history.data.games.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5">
          <p>No saved games yet.</p>
          <Button asChild variant="outline" className="mt-4 h-11">
            <Link to="/play">Choose a clock</Link>
          </Button>
        </div>
      ) : null}
      {history.data && history.data.games.length > 0 ? (
        <ul className="grid gap-3">
          {history.data.games.map((game) => (
            <li key={game.id}>
              <Link
                to={`/review/${game.id}`}
                className="grid gap-1 rounded-2xl border bg-card px-4 py-3 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="font-semibold">
                  {game.whiteUsername} vs {game.blackUsername}
                </span>
                <span className="text-sm text-muted-foreground">
                  {resultLabel(game)} · {game.moveCount} {game.moveCount === 1 ? "move" : "moves"} ·{" "}
                  {new Date(game.createdAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
