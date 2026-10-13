import { describe, expect, it } from "vitest";
import {
  defaultGuestSettings,
  guestSettingsSchema,
  readGuestSettings,
  serializeGuestSettings,
} from "./settings";

describe("guest settings", () => {
  it("returns defaults for empty and corrupt storage", () => {
    expect(readGuestSettings(null)).toEqual(defaultGuestSettings);
    expect(readGuestSettings("")).toEqual(defaultGuestSettings);
    expect(readGuestSettings("{")).toEqual(defaultGuestSettings);
    expect(readGuestSettings(JSON.stringify({ boardTheme: "neon" }))).toEqual(defaultGuestSettings);
  });

  it("keeps a valid saved theme and ignores unknown keys", () => {
    const raw = JSON.stringify({
      ...defaultGuestSettings,
      boardTheme: "ocean",
      flipBoard: true,
      extra: true,
    });
    expect(readGuestSettings(raw)).toEqual({
      ...defaultGuestSettings,
      boardTheme: "ocean",
      flipBoard: true,
    });
  });

  it("round-trips through the serializer", () => {
    const settings = {
      ...defaultGuestSettings,
      colorScheme: "dark" as const,
      showCoordinates: false,
      showHighlights: false,
    };
    expect(readGuestSettings(serializeGuestSettings(settings))).toEqual(settings);
  });

  it("rejects an unknown board theme at the schema boundary", () => {
    expect(
      guestSettingsSchema.safeParse({ ...defaultGuestSettings, boardTheme: "marble" }).success,
    ).toBe(false);
  });
});
