import { describe, expect, it } from "vitest";
import { hashPassword, passwordMatches, verifyPassword } from "./password.ts";

describe("passwords", () => {
  it("accepts the password that was hashed and rejects a different one", async () => {
    const stored = await hashPassword("correct-horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse", stored)).toBe(true);
    expect(await verifyPassword("wrong-horse", stored)).toBe(false);
    expect(await verifyPassword("correct-horse", "plain-text")).toBe(false);
    expect(await passwordMatches("correct-horse", null)).toBe(false);
  });
});
