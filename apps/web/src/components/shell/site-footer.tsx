export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-heading text-base text-foreground">PlayChess</p>
        <p>Clocks in milliseconds. Live results will be decided on the server.</p>
      </div>
    </footer>
  );
}
