import { routes } from "@/routes/routes.tsx";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { GUEST_SETTINGS_STORAGE_KEY, defaultGuestSettings } from "@playchess/theme-config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useGuestSettings.getState().reload();
});

afterEach(() => {
  cleanup();
});

describe("PlayChess shell", () => {
  it("opens on the club table and links to the lobby", async () => {
    const user = userEvent.setup();
    renderAt("/");

    expect(screen.getByRole("heading", { level: 1, name: /record of every move/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    await user.click(screen.getByRole("link", { name: "Choose a clock" }));
    expect(screen.getByRole("heading", { level: 1, name: "Choose a clock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /15 \+ 10/ })).toBeInTheDocument();
  });

  it("shows the stored milliseconds for the selected preset", async () => {
    const user = userEvent.setup();
    renderAt("/play");

    await user.click(screen.getByRole("button", { name: /5 \+ 3/ }));
    expect(screen.getByRole("heading", { level: 2, name: "5 + 3" })).toBeInTheDocument();
    expect(screen.getAllByText("300,000 ms, plus 3,000 ms").length).toBeGreaterThan(0);
    expect(screen.getByText("Blitz pool")).toBeInTheDocument();
  });

  it("changes the board theme, orientation, coordinates, and highlight", async () => {
    const user = userEvent.setup();
    renderAt("/settings");

    expect(screen.getByRole("img", { name: /club green board, white at the bottom/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Walnut/ }));
    expect(document.documentElement).toHaveAttribute("data-board-theme", "walnut");
    expect(screen.getByRole("img", { name: /walnut board, white at the bottom/i })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Black at the bottom/ }));
    expect(screen.getByRole("img", { name: /walnut board, black at the bottom/i })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Coordinates/ }));
    expect(screen.queryByText("8", { selector: "[data-coordinate='rank']" })).not.toBeInTheDocument();

    expect(screen.getByTestId("highlight-ring")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Highlight colour/ }));
    expect(screen.queryByTestId("highlight-ring")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
  });

  it("restores a saved board theme from this browser", () => {
    localStorage.setItem(
      GUEST_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...defaultGuestSettings, boardTheme: "ocean", colorScheme: "light" }),
    );
    useGuestSettings.getState().reload();
    renderAt("/");

    expect(screen.getByRole("img", { name: /ocean board/i })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-board-theme", "ocean");
  });

  it("explains an unknown address", () => {
    renderAt("/missing-page");
    expect(screen.getByRole("heading", { name: /off the board/i })).toBeInTheDocument();
  });

  it("opens the menu", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeInTheDocument();
  });
});
