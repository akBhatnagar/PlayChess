import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit.ts";

describe("auth rate limiter", () => {
  it("allows a burst and then refuses until the window moves", () => {
    let now = 1_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });

    expect(limiter.allow("register:127.0.0.1")).toBe(true);
    expect(limiter.allow("register:127.0.0.1")).toBe(true);
    expect(limiter.allow("register:127.0.0.1")).toBe(false);
    expect(limiter.allow("login:127.0.0.1")).toBe(true);

    now += 60_001;
    expect(limiter.allow("register:127.0.0.1")).toBe(true);
  });
});
