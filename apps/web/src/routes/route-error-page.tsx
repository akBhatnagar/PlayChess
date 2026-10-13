import { Button } from "@/components/ui/button.tsx";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "The page stopped while loading.";

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Something interrupted this page</p>
      <h1 className="mt-2 font-heading text-4xl">Try the table again</h1>
      <p className="mt-4 text-lg text-muted-foreground">{detail}</p>
      <div className="mt-6">
        <Button asChild className="h-11 px-5">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
