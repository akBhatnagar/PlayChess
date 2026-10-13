import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { MenuIcon } from "lucide-react";
import { NavLink } from "react-router";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";

const primaryLinks = [
  { to: "/play", label: "Play" },
  { to: "/review", label: "Review" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Profile" },
] as const;

function linkClassName(isActive: boolean) {
  return cn(
    "rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-accent text-foreground",
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border border-t-[3px] border-t-primary bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <NavLink
          to="/"
          end
          className="font-heading text-2xl leading-none text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          PlayChess
        </NavLink>
        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
          {primaryLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => linkClassName(isActive)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive)}>
            Settings
          </NavLink>
          <Button asChild variant="outline" className="h-10 px-3">
            <NavLink to="/sign-in">Sign in</NavLink>
          </Button>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="ml-auto size-11 md:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </Button>
          </DialogTrigger>
          <DialogContent className="top-0! left-0! h-dvh w-full max-w-none! translate-none! place-content-start rounded-none p-6 sm:max-w-none!">
            <DialogHeader>
              <DialogTitle className="font-heading text-3xl">Menu</DialogTitle>
              <DialogDescription>Move around PlayChess.</DialogDescription>
            </DialogHeader>
            <nav aria-label="Mobile" className="mt-4 grid gap-2">
              {[...primaryLinks, { to: "/settings", label: "Settings" }, { to: "/sign-in", label: "Sign in" }].map(
                (link) => (
                  <DialogClose asChild key={link.to}>
                    <NavLink
                      to={link.to}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-base font-semibold text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:bg-accent"
                    >
                      {link.label}
                    </NavLink>
                  </DialogClose>
                ),
              )}
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
