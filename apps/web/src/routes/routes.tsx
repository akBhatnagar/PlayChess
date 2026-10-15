import { AppShell } from "@/components/shell/app-shell.tsx";
import { HomePage } from "@/routes/home-page.tsx";
import { NotFoundPage } from "@/routes/not-found-page.tsx";
import { HistoryPage } from "@/routes/history-page.tsx";
import { LocalGamePage } from "@/routes/local-game-page.tsx";
import { PlayPage } from "@/routes/play-page.tsx";
import { ProfilePage } from "@/routes/profile-page.tsx";
import { ReviewGamePage, ReviewIndexPage } from "@/routes/review-page.tsx";
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
      { path: "review", element: <ReviewIndexPage /> },
      { path: "review/:gameId", element: <ReviewGamePage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "sign-in", element: <SignInPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
