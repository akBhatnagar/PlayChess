import type { TimeControl } from "./time-control";

export type Side = "w" | "b";

export type ClockState = {
  whiteMs: number;
  blackMs: number;
  /** Null while the clock is stopped. */
  turnStartedAtMs: number | null;
  /** Side whose clock is running. Null while stopped. */
  active: Side | null;
};

export function otherSide(side: Side): Side {
  return side === "w" ? "b" : "w";
}

export function elapsedMs(clocks: ClockState, nowMs: number): number {
  if (clocks.turnStartedAtMs === null) {
    return 0;
  }
  return Math.max(0, nowMs - clocks.turnStartedAtMs);
}

export function remainingMs(clocks: ClockState, side: Side): number {
  return side === "w" ? clocks.whiteMs : clocks.blackMs;
}

/** A turn is late when elapsed time is greater than or equal to the remaining time. */
export function isLate(clocks: ClockState, nowMs: number): boolean {
  if (clocks.active === null) {
    return false;
  }
  return elapsedMs(clocks, nowMs) >= remainingMs(clocks, clocks.active);
}

/**
 * Display estimate between committed snapshots. Does not change the stored clock.
 * The active side shows remaining minus elapsed, floored at zero.
 */
export function displayedClockMs(
  clocks: ClockState,
  nowMs: number,
): { whiteMs: number; blackMs: number } {
  if (clocks.active === null) {
    return { whiteMs: clocks.whiteMs, blackMs: clocks.blackMs };
  }
  const shown = Math.max(0, remainingMs(clocks, clocks.active) - elapsedMs(clocks, nowMs));
  return clocks.active === "w"
    ? { whiteMs: shown, blackMs: clocks.blackMs }
    : { whiteMs: clocks.whiteMs, blackMs: shown };
}

function withRemaining(clocks: ClockState, side: Side, ms: number): ClockState {
  return side === "w" ? { ...clocks, whiteMs: ms } : { ...clocks, blackMs: ms };
}

/**
 * Commit the active side's elapsed time.
 * Increment is added only when the turn is in time and `increment` is true.
 * A late turn flags that side at zero and stops the clock. The move is not this function's job.
 * `nextActive` null stops the clock after an in-time commit.
 */
export function commitTurn(
  clocks: ClockState,
  timeControl: TimeControl,
  nowMs: number,
  options: { increment: boolean; nextActive: Side | null },
): { clocks: ClockState; timedOut: boolean } {
  if (clocks.active === null || clocks.turnStartedAtMs === null) {
    return { clocks, timedOut: false };
  }

  const side = clocks.active;
  if (isLate(clocks, nowMs)) {
    return {
      timedOut: true,
      clocks: {
        ...withRemaining(clocks, side, 0),
        turnStartedAtMs: null,
        active: null,
      },
    };
  }

  const increment = options.increment
    ? side === "w"
      ? timeControl.incrementWhiteMs
      : timeControl.incrementBlackMs
    : 0;
  const nextRemaining = remainingMs(clocks, side) - elapsedMs(clocks, nowMs) + increment;
  const updated = withRemaining(clocks, side, nextRemaining);

  if (options.nextActive === null) {
    return {
      timedOut: false,
      clocks: { ...updated, turnStartedAtMs: null, active: null },
    };
  }

  return {
    timedOut: false,
    clocks: { ...updated, turnStartedAtMs: nowMs, active: options.nextActive },
  };
}
