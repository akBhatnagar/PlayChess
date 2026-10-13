import {
  classifyRatingPool,
  type RatingPool,
  type TimeControl,
  type TimeControlPreset,
} from "./time-control";

function symmetricPreset(
  id: string,
  initialMs: number,
  incrementMs: number,
  category: RatingPool,
): TimeControlPreset {
  const minutes = initialMs / 60_000;
  const incrementSeconds = incrementMs / 1_000;
  const timeControl: TimeControl = {
    initialTimeWhiteMs: initialMs,
    initialTimeBlackMs: initialMs,
    incrementWhiteMs: incrementMs,
    incrementBlackMs: incrementMs,
    delayType: "none",
    delayWhiteMs: 0,
    delayBlackMs: 0,
  };

  return {
    id,
    label: `${minutes} + ${incrementSeconds}`,
    category,
    ...timeControl,
  };
}

/** Presets from the PlayChess specification. Categories are checked against the classifier. */
export const TIME_CONTROL_PRESETS: readonly TimeControlPreset[] = [
  symmetricPreset("bullet-1-0", 60_000, 0, "bullet"),
  symmetricPreset("bullet-2-1", 120_000, 1_000, "bullet"),
  symmetricPreset("blitz-3-0", 180_000, 0, "blitz"),
  symmetricPreset("blitz-3-2", 180_000, 2_000, "blitz"),
  symmetricPreset("blitz-5-0", 300_000, 0, "blitz"),
  symmetricPreset("blitz-5-3", 300_000, 3_000, "blitz"),
  symmetricPreset("rapid-10-0", 600_000, 0, "rapid"),
  symmetricPreset("rapid-15-10", 900_000, 10_000, "rapid"),
  symmetricPreset("classical-30-0", 1_800_000, 0, "classical"),
];

export function presetById(id: string): TimeControlPreset | undefined {
  return TIME_CONTROL_PRESETS.find((preset) => preset.id === id);
}

export function presetsMatchClassifier(
  presets: readonly TimeControlPreset[] = TIME_CONTROL_PRESETS,
): boolean {
  return presets.every((preset) => classifyRatingPool(preset) === preset.category);
}
