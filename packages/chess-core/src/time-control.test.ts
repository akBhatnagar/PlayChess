import { describe, expect, it } from "vitest";
import { TIME_CONTROL_PRESETS, presetsMatchClassifier } from "./presets";
import {
  classifyRatingPool,
  timeControlSchema,
  type TimeControl,
} from "./time-control";

function control(overrides: Partial<TimeControl> = {}): TimeControl {
  return {
    initialTimeWhiteMs: 300_000,
    initialTimeBlackMs: 300_000,
    incrementWhiteMs: 0,
    incrementBlackMs: 0,
    delayType: "none",
    delayWhiteMs: 0,
    delayBlackMs: 0,
    ...overrides,
  };
}

describe("time control presets", () => {
  it("lists the nine specification presets in order", () => {
    expect(TIME_CONTROL_PRESETS.map((preset) => preset.label)).toEqual([
      "1 + 0",
      "2 + 1",
      "3 + 0",
      "3 + 2",
      "5 + 0",
      "5 + 3",
      "10 + 0",
      "15 + 10",
      "30 + 0",
    ]);
  });

  it("stores symmetric millisecond values", () => {
    const blitz = TIME_CONTROL_PRESETS.find((preset) => preset.id === "blitz-5-3");
    expect(blitz).toMatchObject({
      initialTimeWhiteMs: 300_000,
      initialTimeBlackMs: 300_000,
      incrementWhiteMs: 3_000,
      incrementBlackMs: 3_000,
      delayType: "none",
      delayWhiteMs: 0,
      delayBlackMs: 0,
      category: "blitz",
    });
  });

  it("matches the documented pool boundaries, including exact cutovers", () => {
    expect(presetsMatchClassifier()).toBe(true);
    expect(classifyRatingPool(control({ initialTimeWhiteMs: 179_999, initialTimeBlackMs: 179_999 }))).toBe(
      "bullet",
    );
    expect(classifyRatingPool(control({ initialTimeWhiteMs: 180_000, initialTimeBlackMs: 180_000 }))).toBe(
      "blitz",
    );
    expect(classifyRatingPool(control({ initialTimeWhiteMs: 600_000, initialTimeBlackMs: 600_000 }))).toBe(
      "rapid",
    );
    expect(classifyRatingPool(control({ initialTimeWhiteMs: 1_800_000, initialTimeBlackMs: 1_800_000 }))).toBe(
      "classical",
    );
  });

  it("classifies time odds from the longer side", () => {
    expect(
      classifyRatingPool(
        control({
          initialTimeWhiteMs: 60_000,
          initialTimeBlackMs: 600_000,
        }),
      ),
    ).toBe("rapid");
  });

  it("counts increment in the estimate", () => {
    expect(
      classifyRatingPool(
        control({
          initialTimeWhiteMs: 120_000,
          initialTimeBlackMs: 120_000,
          incrementWhiteMs: 1_000,
          incrementBlackMs: 1_000,
        }),
      ),
    ).toBe("bullet");
  });

  it("rejects negative times, fractional milliseconds, and delay", () => {
    expect(timeControlSchema.safeParse(control({ initialTimeWhiteMs: -1 })).success).toBe(false);
    expect(timeControlSchema.safeParse(control({ incrementWhiteMs: 1.5 })).success).toBe(false);
    expect(timeControlSchema.safeParse({ ...control(), delayType: "bronstein" }).success).toBe(false);
    expect(timeControlSchema.safeParse(control({ delayWhiteMs: 5_000 })).success).toBe(false);
  });
});
