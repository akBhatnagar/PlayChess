import { BoardPreview } from "@/components/board/board-preview.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { Link } from "react-router";

const notes = [
  {
    title: "Nine clocks",
    body: "From 1 + 0 through 30 + 0, including 3 + 2, 5 + 3, and 15 + 10. Each one is stored as whole milliseconds.",
  },
  {
    title: "A board you can retune",
    body: "Club green, walnut, or ocean. Coordinates and which side sits at the bottom stay with this browser.",
  },
  {
    title: "A local game, then the server",
    body: "Local games follow the clock and the chess rules in this browser. When live games arrive, the same rules commit on the server.",
  },
] as const;

export function HomePage() {
  const settings = useGuestSettings((state) => state.settings);

  return (
    <div className="grid gap-14">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,26rem)]">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">The club table</p>
          <h1 className="mt-3 max-w-xl text-4xl leading-[1.05] text-balance sm:text-6xl">
            A board, a clock, and a record of every move.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            PlayChess is a chess room in the browser. Play both sides of a local game, retune the
            board, and keep the move list in this tab. Online matches and saved games come next.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="h-11 px-5 text-base">
              <Link to="/play">Choose a clock</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5 text-base">
              <Link to="/settings">Board appearance</Link>
            </Button>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-md">
          <BoardPreview
            theme={settings.boardTheme}
            showCoordinates={settings.showCoordinates}
            flipBoard={settings.flipBoard}
            highlightSquare={settings.showHighlights ? "e4" : undefined}
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Starting position
            {settings.showHighlights
              ? ". The ring on e4 is the highlight colour, on an empty square."
              : "."}
          </figcaption>
        </figure>
      </section>
      <section aria-label="What this build includes" className="grid gap-4 md:grid-cols-3">
        {notes.map((note) => (
          <article key={note.title} className="rounded-2xl border bg-card p-5">
            <h2 className="text-2xl">{note.title}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{note.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
