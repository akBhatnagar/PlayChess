import type { GuestSettings } from "@playchess/theme-config";

export type Account = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  settings: GuestSettings;
};

export type GameSummary = {
  id: string;
  kind: string;
  status: string;
  result: string | null;
  termination: string | null;
  createdAt: string;
  moveCount: number;
  whiteUsername: string;
  blackUsername: string;
  timeControl: {
    initialTimeWhiteMs: number;
    initialTimeBlackMs: number;
    incrementWhiteMs: number;
    incrementBlackMs: number;
    delayType: "none";
    delayWhiteMs: number;
    delayBlackMs: number;
  };
};

export type SavedGameDetail = GameSummary & {
  initialFen: string;
  finalFen: string;
  pgn: string;
  whiteMs: number;
  blackMs: number;
  moves: {
    ply: number;
    uci: string;
    san: string;
    fen: string;
    whiteMs: number;
    blackMs: number;
    commandId: string;
  }[];
};

export type HistoryPage = {
  page: number;
  limit: number;
  total: number;
  games: GameSummary[];
};

type ApiError = { error?: { code?: string; message?: string } };

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error?.message ?? "The request did not succeed.";
  } catch {
    return "The request did not succeed.";
  }
}

export async function fetchSession(): Promise<Account | null> {
  try {
    const response = await fetch("/api/v1/users/me", { credentials: "same-origin" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Account;
  } catch {
    return null;
  }
}

export async function registerAccount(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ account: Account } | { error: string }> {
  try {
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      return { error: await readError(response) };
    }
    return { account: (await response.json()) as Account };
  } catch {
    return { error: "The account service is not reachable." };
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<{ account: Account } | { error: string }> {
  try {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      return { error: await readError(response) };
    }
    return { account: (await response.json()) as Account };
  } catch {
    return { error: "The account service is not reachable." };
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // The cookie is cleared locally even if the API is down.
  }
}

export async function patchSettings(patch: Partial<GuestSettings>): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/users/me/settings", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchHistory(): Promise<HistoryPage | null> {
  const response = await fetch("/api/v1/users/me/games", { credentials: "same-origin" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as HistoryPage;
}

export async function fetchGame(id: string): Promise<SavedGameDetail | null> {
  const response = await fetch(`/api/v1/games/${id}`, { credentials: "same-origin" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SavedGameDetail;
}

export async function saveLocalGame(body: {
  initialFen: string;
  claimedResult: string | null;
  claimedTermination: string | null;
  moves: { uci: string; whiteMs: number; blackMs: number; commandId: string }[];
  timeControl: SavedGameDetail["timeControl"];
}): Promise<{ id: string } | { error: string }> {
  try {
    const response = await fetch("/api/v1/games", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { error: await readError(response) };
    }
    return (await response.json()) as { id: string };
  } catch {
    return { error: "The account service is not reachable." };
  }
}
