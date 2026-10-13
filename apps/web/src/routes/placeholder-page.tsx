import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router";

export function PlaceholderPage({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">{kicker}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6">
        <Button asChild variant="outline" className="h-11 px-5">
          <Link to="/play">Choose a clock instead</Link>
        </Button>
      </div>
    </div>
  );
}
