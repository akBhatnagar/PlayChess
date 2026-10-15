import { parseServerEnv } from "@playchess/validation";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

const prisma = new PrismaClient();
const env = parseServerEnv({
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://playchess:playchess@127.0.0.1:5432/playchess",
  SESSION_SECRET: "test-session-secret-must-be-32-characters",
  WEB_ORIGIN: "http://127.0.0.1:4317",
  API_PORT: "4318",
});

const app = await buildApp(env, prisma);

function cookieFrom(response: { headers: { [key: string]: string | string[] | number | undefined } }): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header !== "string") {
    throw new Error("Missing session cookie.");
  }
  return header.split(";")[0] ?? header;
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.gameMove.deleteMany();
  await prisma.game.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("accounts and saved games", () => {
  it("registers, reads the profile, and signs out", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "Ada", email: "Ada@Example.com", password: "correct-horse" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json<{ username: string; email: string }>();
    expect(body.username).toBe("Ada");
    expect(body.email).toBe("ada@example.com");
    expect(body).not.toHaveProperty("passwordHash");

    const cookie = cookieFrom(created);
    const me = await app.inject({ method: "GET", url: "/api/v1/users/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ settings: { boardTheme: string } }>().settings.boardTheme).toBe("club");

    const loggedOut = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
    expect(loggedOut.statusCode).toBe(200);
    const again = await app.inject({ method: "GET", url: "/api/v1/users/me", headers: { cookie } });
    expect(again.statusCode).toBe(401);
  });

  it("rejects a wrong password and a duplicate account", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "ada", email: "ada@example.com", password: "correct-horse" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "ada", email: "other@example.com", password: "correct-horse" },
    });
    expect(duplicate.statusCode).toBe(409);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "ada@example.com", password: "wrong-password" },
    });
    expect(login.statusCode).toBe(401);
    expect(login.json<{ error: { code: string } }>().error.code).toBe("invalid-credentials");
  });

  it("saves a local game for the signed-in player and hides it from everyone else", async () => {
    const owner = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "owner", email: "owner@example.com", password: "correct-horse" },
    });
    const ownerCookie = cookieFrom(owner);
    const saved = await app.inject({
      method: "POST",
      url: "/api/v1/games",
      headers: { cookie: ownerCookie },
      payload: {
        claimedResult: null,
        claimedTermination: null,
        moves: [{ uci: "e2e4", whiteMs: 299_000, blackMs: 300_000, commandId: "m1" }],
        timeControl: {
          initialTimeWhiteMs: 300_000,
          initialTimeBlackMs: 300_000,
          incrementWhiteMs: 0,
          incrementBlackMs: 0,
          delayType: "none",
          delayWhiteMs: 0,
          delayBlackMs: 0,
        },
      },
    });
    expect(saved.statusCode).toBe(201);
    const { id } = saved.json<{ id: string }>();

    const history = await app.inject({
      method: "GET",
      url: "/api/v1/users/me/games",
      headers: { cookie: ownerCookie },
    });
    expect(history.json<{ total: number; games: { id: string }[] }>().total).toBe(1);
    expect(history.json<{ games: { id: string; moveCount: number }[] }>().games[0]).toMatchObject({
      id,
      moveCount: 1,
    });

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/games/${id}`,
      headers: { cookie: ownerCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ moves: { san: string }[] }>().moves[0]?.san).toBe("e4");
    expect(detail.json()).not.toHaveProperty("email");

    const other = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "other", email: "other@example.com", password: "correct-horse" },
    });
    const hidden = await app.inject({
      method: "GET",
      url: `/api/v1/games/${id}`,
      headers: { cookie: cookieFrom(other) },
    });
    expect(hidden.statusCode).toBe(404);

    const illegal = await app.inject({
      method: "POST",
      url: "/api/v1/games",
      headers: { cookie: ownerCookie },
      payload: {
        moves: [{ uci: "e2e5", whiteMs: 1, blackMs: 1, commandId: "bad" }],
        timeControl: {
          initialTimeWhiteMs: 60_000,
          initialTimeBlackMs: 60_000,
          incrementWhiteMs: 0,
          incrementBlackMs: 0,
          delayType: "none",
          delayWhiteMs: 0,
          delayBlackMs: 0,
        },
      },
    });
    expect(illegal.statusCode).toBe(400);
  });

  it("persists board settings for the account", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { username: "theme", email: "theme@example.com", password: "correct-horse" },
    });
    const cookie = cookieFrom(created);
    const patched = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me/settings",
      headers: { cookie },
      payload: { boardTheme: "walnut", flipBoard: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json<{ boardTheme: string; flipBoard: boolean }>().boardTheme).toBe("walnut");

    const me = await app.inject({ method: "GET", url: "/api/v1/users/me", headers: { cookie } });
    expect(me.json<{ settings: { flipBoard: boolean } }>().settings.flipBoard).toBe(true);
  });

  it("reports health without secrets", async () => {
    const health = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true, db: "up" });
    expect(JSON.stringify(health.json())).not.toContain("playchess:");
  });
});
