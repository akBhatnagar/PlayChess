import { timeControlSchema } from "@playchess/chess-core";
import { guestSettingsSchema } from "@playchess/theme-config";
import { z } from "zod";

const username = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/u, "Use letters, numbers, and underscores.");

const email = z.string().trim().toLowerCase().email().max(200);

const password = z.string().min(10).max(200);

export const registerSchema = z.object({
  username,
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password,
});

export const settingsPatchSchema = guestSettingsSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Choose a setting to change.",
});

const transcriptMoveSchema = z.object({
  uci: z.string().trim().min(4).max(5),
  whiteMs: z.number().int().nonnegative(),
  blackMs: z.number().int().nonnegative(),
  commandId: z.string().trim().min(1).max(80),
});

export const saveGameSchema = z.object({
  initialFen: z.string().trim().min(1).max(120).optional(),
  claimedResult: z.enum(["1-0", "0-1", "1/2-1/2"]).nullable().optional(),
  claimedTermination: z
    .enum([
      "checkmate",
      "stalemate",
      "timeout",
      "resignation",
      "draw-agreement",
      "threefold",
      "fifty-move",
      "insufficient",
    ])
    .nullable()
    .optional(),
  moves: z.array(transcriptMoveSchema).max(600),
  timeControl: timeControlSchema,
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
