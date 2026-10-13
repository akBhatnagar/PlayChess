import { SiteFooter } from "@/components/shell/site-footer.tsx";
import { SiteHeader } from "@/components/shell/site-header.tsx";
import { ThemeSync } from "@/components/shell/theme-sync.tsx";
import { Outlet } from "react-router";

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <ThemeSync />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
