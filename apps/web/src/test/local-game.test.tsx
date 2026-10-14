import { routes } from "@/routes/routes.tsx";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { resetLocalClock, setLocalClock, useLocalGame } from "@/state/local-game.ts";
import { createLocalGame, presetById } from "@playchess/chess-core";
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
  setLocalClock(() => 10_000_000);
  useLocalGame.getState().reset();
});

afterEach(() => {
  cleanup();
  resetLocalClock();
});

describe("local game", () => {
  it("starts from the lobby and plays a legal move", async () => {
    const user = userEvent.setup();
    renderAt("/play");

    await user.click(screen.getByRole("button", { name: "Start local game" }));
    expect(screen.getByRole("heading", { level: 1, name: "Local game" })).toBeInTheDocument();
    expect(screen.getByText(/Decided in this browser/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /e2, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /e4, empty/ }));

    expect(screen.getByRole("button", { name: "Move 1, e4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /e4, white pawn/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /e2, white pawn/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Black to move." })).toBeInTheDocument();
  });

  it("resumes the same game after a visit to settings", async () => {
    const user = userEvent.setup();
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    await user.click(screen.getByRole("button", { name: /e2, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /e4, empty/ }));
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(screen.getByRole("link", { name: "Play" }));
    await user.click(screen.getByRole("link", { name: "Resume local game" }));

    expect(screen.getByRole("heading", { name: "Local game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move 1, e4" })).toBeInTheDocument();
  });

  it("leaves the position alone when the destination is illegal", async () => {
    const user = userEvent.setup();
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    await user.click(screen.getByRole("button", { name: /e2, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /e5, empty/ }));

    expect(screen.getByRole("button", { name: /e2, white pawn/ })).toBeInTheDocument();
    expect(screen.getByText("Moves will appear here.")).toBeInTheDocument();
  });

  it("steps back through the move list and ignores moves until live", async () => {
    const user = userEvent.setup();
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    await user.click(screen.getByRole("button", { name: /e2, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /e4, empty/ }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText(/Viewing the start/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /e2, white pawn/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /e2, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /e4, empty/ }));
    expect(screen.getByRole("button", { name: /e2, white pawn/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Move 1, e4" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Back to live" }));
    expect(screen.getByRole("button", { name: /e4, white pawn/ })).toBeInTheDocument();
  });

  it("follows the board theme and orientation", () => {
    useGuestSettings.getState().update({ boardTheme: "walnut", flipBoard: true });
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    expect(document.documentElement).toHaveAttribute("data-board-theme", "walnut");
    const squares = screen.getAllByRole("button").filter((button) => button.getAttribute("data-square"));
    expect(squares[0]).toHaveAttribute("data-square", "h1");
    expect(squares[0]).toHaveStyle({ background: "var(--square-light)" });
    expect(screen.getByRole("group", { name: /black at the bottom/i })).toBeInTheDocument();
  });

  it("promotes a pawn from the piece dialog", async () => {
    const user = userEvent.setup();
    const preset = presetById("blitz-5-3");
    if (!preset) {
      throw new Error("Missing 5+3 preset.");
    }
    useLocalGame.getState().load(
      createLocalGame({
        timeControl: preset,
        nowMs: 10_000_000,
        initialFen: "8/P7/8/8/8/8/8/k6K w - - 0 1",
      }),
    );
    renderAt("/play/local");

    await user.click(screen.getByRole("button", { name: /a7, white pawn/ }));
    await user.click(screen.getByRole("button", { name: /a8, empty/ }));
    expect(screen.getByRole("dialog", { name: "Choose a piece" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Queen" }));

    expect(screen.getByRole("button", { name: /Move 1, a8=Q/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /a8, white queen/ })).toBeInTheDocument();
  });

  it("resigns the side to move after confirmation", async () => {
    const user = userEvent.setup();
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    await user.click(screen.getByRole("button", { name: "Resign" }));
    expect(screen.getByRole("dialog", { name: "Resign this game?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resign now" }));

    expect(screen.getByRole("heading", { level: 2, name: "White resigned. Black wins." })).toBeInTheDocument();
  });

  it("plays e4 from the keyboard", async () => {
    const user = userEvent.setup();
    useLocalGame.getState().start("blitz-5-3");
    renderAt("/play/local");

    screen.getByRole("button", { name: /e2, white pawn/ }).focus();
    await user.keyboard("{Enter}{ArrowUp}{ArrowUp}{Enter}");

    expect(screen.getByRole("button", { name: "Move 1, e4" })).toBeInTheDocument();
  });
});
