import { AppShell } from "@/components/shell/app-shell.tsx";
import { HomePage } from "@/routes/home-page.tsx";
import { NotFoundPage } from "@/routes/not-found-page.tsx";
import { PlaceholderPage } from "@/routes/placeholder-page.tsx";
import { LocalGamePage } from "@/routes/local-game-page.tsx";
import { PlayPage } from "@/routes/play-page.tsx";
import { RouteErrorPage } from "@/routes/route-error-page.tsx";
import { SettingsPage } from "@/routes/settings-page.tsx";
import { SignInPage } from "@/routes/sign-in-page.tsx";
import type { RouteObject } from "react-router";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "play", element: <PlayPage /> },
      { path: "play/local", element: <LocalGamePage /> },
      {
        path: "review",
        element: (
          <PlaceholderPage
            kicker="Review"
            title="Replay waits for a saved game"
            body="Move lists, PGN, and engine lines will open on this page once a game can be stored."
          />
        ),
      },
      {
        path: "history",
        element: (
          <PlaceholderPage
            kicker="History"
            title="Finished games will line up here"
            body="Date, opponent, result, and clock will be listed once games are saved."
          />
        ),
      },
      {
        path: "profile",
        element: (
          <PlaceholderPage
            kicker="Profile"
            title="Ratings follow the account"
            body="Pools, results, and recent games will show here once you can sign in."
          />
        ),
      },
      { path: "settings", element: <SettingsPage /> },
      { path: "sign-in", element: <SignInPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
