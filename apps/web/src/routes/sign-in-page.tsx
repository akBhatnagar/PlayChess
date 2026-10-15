import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { loginAccount, registerAccount } from "@/lib/api.ts";
import { applyAccountSettings, sessionQueryKey } from "@/state/session.ts";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

export function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result =
      mode === "register"
        ? await registerAccount({ username, email, password })
        : await loginAccount({ email, password });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    applyAccountSettings(result.account);
    client.setQueryData(sessionQueryKey, result.account);
    await navigate("/profile");
  }

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Account</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          A signed-in game can be saved, listed, and replayed. Local play still works in this browser if you stay a
          guest.
        </p>
      </header>
      <form className="grid gap-4 rounded-2xl border bg-card p-5" onSubmit={(event) => void submit(event)}>
        {mode === "register" ? (
          <label className="grid gap-2 text-sm font-semibold">
            Username
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={20}
              required
            />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={10}
            required
          />
        </label>
        {mode === "register" ? (
          <p className="text-sm text-muted-foreground">
            Use 3 to 20 letters, numbers, or underscores, and a password of at least 10 characters.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
        <button
          type="button"
          className="min-h-11 text-left text-sm font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "sign-in" ? "register" : "sign-in");
            setError(null);
          }}
        >
          {mode === "sign-in" ? "Create an account" : "I already have an account"}
        </button>
      </form>
      <Button asChild variant="outline" className="h-11 w-fit px-5">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
