import { z } from "zod";

export const ratingPools = ["bullet", "blitz", "rapid", "classical"] as const;
export const ratingPoolSchema = z.enum(ratingPools);
export type RatingPool = z.infer<typeof ratingPoolSchema>;

/**
 * Only the unspecified delay mode is rejected on purpose. Bronstein and
 * US delay stay out of the model until their deadline rules are written
 * down and tested.
 */
export const delayTypes = ["none"] as const;

const milliseconds = z.number().int().nonnegative();

export const timeControlSchema = z
  .object({
    initialTimeWhiteMs: milliseconds,
    initialTimeBlackMs: milliseconds,
    incrementWhiteMs: milliseconds,
    incrementBlackMs: milliseconds,
    delayType: z.enum(delayTypes),
    delayWhiteMs: milliseconds,
    delayBlackMs: milliseconds,
  })
  .superRefine((value, ctx) => {
    if (value.delayWhiteMs !== 0 || value.delayBlackMs !== 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "Delay is not accepted yet. Use delayType 'none' and zero delay on both sides.",
        path: ["delayType"],
      });
    }
  });

export type TimeControl = z.infer<typeof timeControlSchema>;

export const timeControlPresetSchema = timeControlSchema.safeExtend({
  id: z.string().min(1),
  label: z.string().min(1),
  category: ratingPoolSchema,
});

export type TimeControlPreset = z.infer<typeof timeControlPresetSchema>;

/** Moves assumed when estimating a control for pool classification. */
export const INCREMENT_MOVE_ESTIMATE = 40;

/** Estimated duration below this is bullet. 3+0 itself is blitz. */
export const BULLET_LIMIT_MS = 3 * 60_000;

/** Estimated duration below this is blitz. 10+0 itself is rapid. */
export const BLITZ_LIMIT_MS = 10 * 60_000;

/** Estimated duration below this is rapid. 30+0 itself is classical. */
export const RAPID_LIMIT_MS = 30 * 60_000;

export function estimatedDurationMs(initialMs: number, incrementMs: number): number {
  return initialMs + INCREMENT_MOVE_ESTIMATE * incrementMs;
}

/**
 * Classify from the longer side so a time-odds game is not filed in a
 * faster pool than the side with more time.
 *
 * estimated = initial + 40 * increment
 * bullet < 3 minutes, blitz < 10 minutes, rapid < 30 minutes, else classical.
 */
export function classifyRatingPool(timeControl: TimeControl): RatingPool {
  const estimated = Math.max(
    estimatedDurationMs(timeControl.initialTimeWhiteMs, timeControl.incrementWhiteMs),
    estimatedDurationMs(timeControl.initialTimeBlackMs, timeControl.incrementBlackMs),
  );

  if (estimated < BULLET_LIMIT_MS) {
    return "bullet";
  }
  if (estimated < BLITZ_LIMIT_MS) {
    return "blitz";
  }
  if (estimated < RAPID_LIMIT_MS) {
    return "rapid";
  }
  return "classical";
}

export function ratingPoolLabel(pool: RatingPool): string {
  switch (pool) {
    case "bullet":
      return "Bullet";
    case "blitz":
      return "Blitz";
    case "rapid":
      return "Rapid";
    case "classical":
      return "Classical";
  }
}
