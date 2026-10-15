import { Button } from "@/components/ui/button.tsx";
import { useSession } from "@/state/session.ts";
import { Link } from "react-router";

export function ProfilePage() {
  const session = useSession();

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Profile</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Your account</h1>
      </header>
      {session.isPending ? <p className="text-muted-foreground">Checking your session.</p> : null}
      {session.isSuccess && !session.data ? (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-lg leading-relaxed">Sign in to see the name and email on this account.</p>
          <Button asChild className="mt-4 h-11">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </div>
      ) : null}
      {session.data ? (
        <section className="grid gap-4 rounded-2xl border bg-card p-5">
          <h2 className="text-3xl">{session.data.username}</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-semibold">Email</dt>
              <dd className="text-muted-foreground">{session.data.email}</dd>
            </div>
            <div>
              <dt className="font-semibold">Joined</dt>
              <dd className="text-muted-foreground">{new Date(session.data.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ratings are not calculated yet. Deleting an account is not available yet, and a retention policy is
            required before a public launch.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-11">
              <Link to="/history">Saved games</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link to="/settings">Appearance</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
