import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnvFile, parsePublicEnv, parseServerEnv } from "./env";

const examplePath = new URL("../../../.env.example", import.meta.url);

describe("environment validation", () => {
  it("parses the committed example as a local development environment", () => {
    const example = parseEnvFile(readFileSync(examplePath, "utf8"));
    const server = parseServerEnv(example);
    const client = parsePublicEnv(example);

    expect(server.NODE_ENV).toBe("development");
    expect(server.API_PORT).toBe(4318);
    expect(server.DATABASE_URL.startsWith("postgresql://")).toBe(true);
    expect(client.VITE_API_ORIGIN).toBe("http://127.0.0.1:4318");
    expect(client).not.toHaveProperty("SESSION_SECRET");
    expect(client).not.toHaveProperty("DATABASE_URL");
  });

  it("rejects the example placeholders when NODE_ENV is production", () => {
    const example = parseEnvFile(readFileSync(examplePath, "utf8"));
    expect(() => parseServerEnv({ ...example, NODE_ENV: "production" })).toThrow(/SESSION_SECRET|DATABASE_URL|https/);
  });

  it("accepts a production environment with real-looking values", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://playchess:a-real-secret@postgres:5432/playchess",
      SESSION_SECRET: "a-production-session-secret-with-32-plus",
      WEB_ORIGIN: "https://playchess.akshaybhatnagar.in",
    });

    expect(env.WEB_ORIGIN).toBe("https://playchess.akshaybhatnagar.in");
    expect(env.API_HOST).toBe("0.0.0.0");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects a short session secret and a public database URL scheme", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://playchess:secret@postgres:5432/playchess",
        SESSION_SECRET: "too-short",
        WEB_ORIGIN: "http://127.0.0.1:4317",
      }),
    ).toThrow();

    expect(() =>
      parseServerEnv({
        DATABASE_URL: "mysql://playchess:secret@postgres:5432/playchess",
        SESSION_SECRET: "a-production-session-secret-with-32-plus",
        WEB_ORIGIN: "http://127.0.0.1:4317",
      }),
    ).toThrow();
  });

  it("ignores comments and blank lines in env files", () => {
    expect(parseEnvFile("# comment\n\nAPI_PORT=4318\n")).toEqual({ API_PORT: "4318" });
  });
});
