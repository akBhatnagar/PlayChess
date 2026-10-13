import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router";

export function SignInPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Account</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Sign-in opens with saved games</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Accounts, passwords, and profiles arrive with the database milestone. This page is the
        place they will live. Appearance already stays in this browser from Settings.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild className="h-11 px-5">
          <Link to="/settings">Adjust the board</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 px-5">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
