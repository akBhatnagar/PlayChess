import { z } from "zod";

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\/\S+$/u, "Expected a postgres:// or postgresql:// URL");

const placeholder = /change-me|replace-with/i;

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrl,
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.url(),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4318),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (placeholder.test(env.SESSION_SECRET)) {
      ctx.addIssue({
        code: "custom",
        message: "Replace SESSION_SECRET before production.",
        path: ["SESSION_SECRET"],
      });
    }

    if (placeholder.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        message: "Replace DATABASE_URL before production.",
        path: ["DATABASE_URL"],
      });
    }

    if (!env.WEB_ORIGIN.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        message: "WEB_ORIGIN must use https in production.",
        path: ["WEB_ORIGIN"],
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const publicEnvSchema = z.object({
  VITE_API_ORIGIN: z.url().default("http://127.0.0.1:4318"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const PUBLIC_ENV_KEYS = ["VITE_API_ORIGIN"] as const;

export function parseServerEnv(source: Readonly<Record<string, string | undefined>>): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function parsePublicEnv(source: Readonly<Record<string, string | undefined>>): PublicEnv {
  return publicEnvSchema.parse(source);
}

export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [index, line] of contents.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Invalid environment line ${index + 1}.`);
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
      throw new Error(`Invalid environment name on line ${index + 1}.`);
    }

    result[key] = value;
  }

  return result;
}
