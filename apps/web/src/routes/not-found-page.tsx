import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">404</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">That page is off the board</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        The address does not match a PlayChess page.
      </p>
      <div className="mt-6">
        <Button asChild className="h-11 px-5">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
