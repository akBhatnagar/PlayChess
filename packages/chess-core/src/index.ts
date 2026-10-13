export {
  BLITZ_LIMIT_MS,
  BULLET_LIMIT_MS,
  INCREMENT_MOVE_ESTIMATE,
  RAPID_LIMIT_MS,
  classifyRatingPool,
  delayTypes,
  estimatedDurationMs,
  ratingPoolLabel,
  ratingPoolSchema,
  ratingPools,
  timeControlPresetSchema,
  timeControlSchema,
} from "./time-control";
export type { RatingPool, TimeControl, TimeControlPreset } from "./time-control";
export { TIME_CONTROL_PRESETS, presetById, presetsMatchClassifier } from "./presets";
