import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import {
  importTranscript,
  type GameResult,
  type Termination,
  type TimeControl,
} from "@playchess/chess-core";
import { defaultGuestSettings, guestSettingsSchema, type GuestSettings } from "@playchess/theme-config";
import type { ServerEnv } from "@playchess/validation";
import { Prisma, type PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { hashPassword, passwordMatches } from "./password.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { historyQuerySchema, loginSchema, registerSchema, saveGameSchema, settingsPatchSchema } from "./schemas.ts";

const SESSION_COOKIE = "playchess_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

type Account = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  settings: GuestSettings;
};

function apiError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

function settingsFromRow(row: {
  colorScheme: string;
  boardTheme: string;
  showCoordinates: boolean;
  flipBoard: boolean;
  showHighlights: boolean;
}): GuestSettings {
  const parsed = guestSettingsSchema.safeParse(row);
  return parsed.success ? parsed.data : defaultGuestSettings;
}

function toAccount(user: {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  settings: {
    colorScheme: string;
    boardTheme: string;
    showCoordinates: boolean;
    flipBoard: boolean;
    showHighlights: boolean;
  } | null;
}): Account {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    settings: user.settings ? settingsFromRow(user.settings) : defaultGuestSettings,
  };
}

function accountBody(account: Account) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    createdAt: account.createdAt.toISOString(),
    settings: account.settings,
  };
}

async function currentAccount(prisma: PrismaClient, request: FastifyRequest): Promise<Account | null> {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: { settings: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.status !== "active") {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }
  return toAccount(session.user);
}

function setSessionCookie(reply: FastifyReply, env: ServerEnv, sessionId: string) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

async function openSession(prisma: PrismaClient, env: ServerEnv, reply: FastifyReply, userId: string) {
  const session = await prisma.session.create({
    data: {
      id: randomBytes(32).toString("base64url"),
      userId,
      expiresAt: new Date(Date.now() + SESSION_MS),
    },
  });
  setSessionCookie(reply, env, session.id);
}

function gameSummary(game: {
  id: string;
  kind: string;
  status: string;
  result: string | null;
  termination: string | null;
  createdAt: Date;
  initialTimeWhiteMs: number;
  initialTimeBlackMs: number;
  incrementWhiteMs: number;
  incrementBlackMs: number;
  white: { username: string };
  black: { username: string };
  _count: { moves: number };
}) {
  return {
    id: game.id,
    kind: game.kind,
    status: game.status,
    result: game.result,
    termination: game.termination,
    createdAt: game.createdAt.toISOString(),
    moveCount: game._count.moves,
    whiteUsername: game.white.username,
    blackUsername: game.black.username,
    timeControl: {
      initialTimeWhiteMs: game.initialTimeWhiteMs,
      initialTimeBlackMs: game.initialTimeBlackMs,
      incrementWhiteMs: game.incrementWhiteMs,
      incrementBlackMs: game.incrementBlackMs,
      delayType: "none" as const,
      delayWhiteMs: 0,
      delayBlackMs: 0,
    },
  };
}

export async function buildApp(env: ServerEnv, prisma: PrismaClient, options?: { webDist?: string }) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: ["req.headers.cookie", "req.headers.authorization"],
          },
    bodyLimit: 1_000_000,
    trustProxy: env.NODE_ENV === "production",
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  const authLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

  function rateLimited(request: FastifyRequest, reply: FastifyReply, action: string): boolean {
    if (env.NODE_ENV === "test") {
      return false;
    }
    if (authLimiter.allow(`${action}:${request.ip}`)) {
      return false;
    }
    void apiError(reply, 429, "rate-limited", "Too many attempts. Wait a minute and try again.");
    return true;
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return apiError(reply, 400, "validation-failed", "Check the fields and try again.");
    }
    app.log.error(error);
    return apiError(reply, 500, "internal", "Something went wrong.");
  });

  app.get("/api/v1/health", async () => {
    let db: "up" | "down" = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return { ok: db === "up", db };
  });

  app.post("/api/v1/auth/register", async (request, reply) => {
    if (rateLimited(request, reply, "register")) {
      return;
    }
    const body = registerSchema.parse(request.body);
    const passwordHash = await hashPassword(body.password);
    try {
      const user = await prisma.user.create({
        data: {
          username: body.username,
          email: body.email,
          passwordHash,
          settings: { create: defaultGuestSettings },
        },
        include: { settings: true },
      });
      await openSession(prisma, env, reply, user.id);
      return reply.code(201).send(accountBody(toAccount(user)));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return apiError(reply, 409, "account-exists", "That email or username is already registered.");
      }
      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    if (rateLimited(request, reply, "login")) {
      return;
    }
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { settings: true },
    });
    const matches = await passwordMatches(body.password, user?.passwordHash ?? null);
    if (!user || !matches) {
      return apiError(reply, 401, "invalid-credentials", "The email or password is wrong.");
    }
    if (user.status !== "active") {
      return apiError(reply, 403, "account-inactive", "This account cannot sign in.");
    }
    await openSession(prisma, env, reply, user.id);
    return accountBody(toAccount(user));
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/v1/users/me", async (request, reply) => {
    const account = await currentAccount(prisma, request);
    if (!account) {
      return apiError(reply, 401, "unauthenticated", "Sign in to continue.");
    }
    return accountBody(account);
  });

  app.patch("/api/v1/users/me/settings", async (request, reply) => {
    const account = await currentAccount(prisma, request);
    if (!account) {
      return apiError(reply, 401, "unauthenticated", "Sign in to continue.");
    }
    const patch = settingsPatchSchema.parse(request.body);
    const settings = await prisma.userSettings.upsert({
      where: { userId: account.id },
      create: { userId: account.id, ...defaultGuestSettings, ...patch },
      update: patch,
    });
    return settingsFromRow(settings);
  });

  app.post("/api/v1/games", async (request, reply) => {
    const account = await currentAccount(prisma, request);
    if (!account) {
      return apiError(reply, 401, "unauthenticated", "Sign in to save a game.");
    }
    const body = saveGameSchema.parse(request.body);
    const imported = importTranscript({
      ...(body.initialFen ? { initialFen: body.initialFen } : {}),
      moves: body.moves,
      claimedResult: (body.claimedResult ?? null) as GameResult | null,
      claimedTermination: (body.claimedTermination ?? null) as Termination | null,
    });
    if (!imported.ok) {
      const message =
        imported.code === "illegal-move"
          ? "That record contains a move the rules reject."
          : "That game record is not valid.";
      return apiError(reply, 400, imported.code, message);
    }
    const transcript = imported.transcript;
    const last = transcript.moves.at(-1);
    const timeControl: TimeControl = body.timeControl;
    const game = await prisma.game.create({
      data: {
        kind: "local",
        status: transcript.status,
        result: transcript.result,
        termination: transcript.termination,
        rated: false,
        whiteUserId: account.id,
        blackUserId: account.id,
        initialFen: transcript.initialFen,
        finalFen: transcript.finalFen,
        pgn: transcript.pgn,
        version: transcript.moves.length,
        initialTimeWhiteMs: timeControl.initialTimeWhiteMs,
        initialTimeBlackMs: timeControl.initialTimeBlackMs,
        incrementWhiteMs: timeControl.incrementWhiteMs,
        incrementBlackMs: timeControl.incrementBlackMs,
        whiteMs: last?.whiteMs ?? timeControl.initialTimeWhiteMs,
        blackMs: last?.blackMs ?? timeControl.initialTimeBlackMs,
        moves: {
          create: transcript.moves.map((move) => ({
            ply: move.ply,
            uci: move.uci,
            san: move.san,
            fen: move.fen,
            whiteMs: move.whiteMs,
            blackMs: move.blackMs,
            commandId: move.commandId,
          })),
        },
      },
    });
    return reply.code(201).send({ id: game.id });
  });

  app.get("/api/v1/users/me/games", async (request, reply) => {
    const account = await currentAccount(prisma, request);
    if (!account) {
      return apiError(reply, 401, "unauthenticated", "Sign in to see your games.");
    }
    const query = historyQuerySchema.parse(request.query);
    const where = {
      OR: [{ whiteUserId: account.id }, { blackUserId: account.id }],
    };
    const [total, games] = await Promise.all([
      prisma.game.count({ where }),
      prisma.game.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          white: { select: { username: true } },
          black: { select: { username: true } },
          _count: { select: { moves: true } },
        },
      }),
    ]);
    return {
      page: query.page,
      limit: query.limit,
      total,
      games: games.map(gameSummary),
    };
  });

  app.get("/api/v1/games/:id", async (request, reply) => {
    const account = await currentAccount(prisma, request);
    if (!account) {
      return apiError(reply, 401, "unauthenticated", "Sign in to open a game.");
    }
    const params = request.params as { id: string };
    const game = await prisma.game.findUnique({
      where: { id: params.id },
      include: {
        moves: { orderBy: { ply: "asc" } },
        white: { select: { username: true } },
        black: { select: { username: true } },
      },
    });
    if (!game || (game.whiteUserId !== account.id && game.blackUserId !== account.id)) {
      return apiError(reply, 404, "not-found", "That game is not available.");
    }
    return {
      ...gameSummary({ ...game, _count: { moves: game.moves.length } }),
      initialFen: game.initialFen,
      finalFen: game.finalFen,
      pgn: game.pgn,
      whiteMs: game.whiteMs,
      blackMs: game.blackMs,
      moves: game.moves.map((move) => ({
        ply: move.ply,
        uci: move.uci,
        san: move.san,
        fen: move.fen,
        whiteMs: move.whiteMs,
        blackMs: move.blackMs,
        commandId: move.commandId,
      })),
    };
  });

  const webDist = options?.webDist;
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api")) {
        return apiError(reply, 404, "not-found", "That address is not part of the API.");
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}

export function webDistPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
}
