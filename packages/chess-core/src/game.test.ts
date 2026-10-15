import { describe, expect, it } from "vitest";
import { displayedClockMs } from "./clock";
import {
  applyCommand,
  createLocalGame,
  expireIfNeeded,
  importTranscript,
  positionAt,
  type GameCommand,
  type LocalGame,
} from "./game";
import type { TimeControl } from "./time-control";

function control(overrides: Partial<TimeControl> = {}): TimeControl {
  return {
    initialTimeWhiteMs: 60_000,
    initialTimeBlackMs: 60_000,
    incrementWhiteMs: 0,
    incrementBlackMs: 0,
    delayType: "none",
    delayWhiteMs: 0,
    delayBlackMs: 0,
    ...overrides,
  };
}

function start(overrides: Partial<TimeControl> = {}, nowMs = 0, initialFen?: string): LocalGame {
  return createLocalGame({
    timeControl: control(overrides),
    nowMs,
    ...(initialFen ? { initialFen } : {}),
  });
}

function command(partial: GameCommand): GameCommand {
  return partial;
}

function mustMove(game: LocalGame, uci: string, nowMs: number, id = `${uci}-${nowMs}`): LocalGame {
  const result = applyCommand(
    game,
    command({
      id,
      expectedVersion: game.version,
      type: "move",
      uci,
      nowMs,
    }),
  );
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.game;
}

describe("local clocks", () => {
  it("adds the increment after the first move", () => {
    const game = start({
      initialTimeWhiteMs: 300_000,
      initialTimeBlackMs: 300_000,
      incrementWhiteMs: 3_000,
      incrementBlackMs: 3_000,
    });
    const next = mustMove(game, "e2e4", 1_000);
    expect(next.clocks.whiteMs).toBe(302_000);
    expect(next.clocks.blackMs).toBe(300_000);
    expect(next.clocks.active).toBe("b");
    expect(next.clocks.turnStartedAtMs).toBe(1_000);
  });

  it("flags when elapsed time equals the remaining time and does not apply the move", () => {
    const game = start({ initialTimeWhiteMs: 1_000, initialTimeBlackMs: 1_000, incrementWhiteMs: 500 });
    const result = applyCommand(
      game,
      command({ id: "late", expectedVersion: 0, type: "move", uci: "e2e4", nowMs: 1_000 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.game.moves).toHaveLength(0);
    expect(result.game.status).toBe("finished");
    expect(result.game.termination).toBe("timeout");
    expect(result.game.result).toBe("0-1");
    expect(result.game.clocks.whiteMs).toBe(0);
    expect(result.game.clocks.blackMs).toBe(1_000);
    expect(result.game.version).toBe(1);
    expect(result.game.clocks.active).toBeNull();
  });

  it("accepts a move one millisecond before the flag", () => {
    const game = start({ initialTimeWhiteMs: 1_000, initialTimeBlackMs: 1_000 });
    const next = mustMove(game, "e2e4", 999);
    expect(next.status).toBe("active");
    expect(next.clocks.whiteMs).toBe(1);
    expect(next.moves).toHaveLength(1);
  });

  it("keeps asymmetric time odds on the side that moved", () => {
    const game = start({
      initialTimeWhiteMs: 5_000,
      initialTimeBlackMs: 20_000,
      incrementWhiteMs: 1_000,
      incrementBlackMs: 3_000,
    });
    const whiteMoved = mustMove(game, "e2e4", 1_000);
    expect(whiteMoved.clocks.whiteMs).toBe(5_000);
    const blackMoved = mustMove(whiteMoved, "e7e5", 3_000);
    expect(blackMoved.clocks.blackMs).toBe(21_000);
    expect(blackMoved.clocks.whiteMs).toBe(5_000);
  });

  it("does not move or increment twice for a duplicate command id", () => {
    const game = start({ incrementWhiteMs: 2_000, incrementBlackMs: 2_000 });
    const move = command({ id: "same", expectedVersion: 0, type: "move", uci: "e2e4", nowMs: 1_000 });
    const once = applyCommand(game, move);
    const twice = applyCommand(once.ok ? once.game : game, move);
    expect(once.ok && twice.ok && twice.duplicate).toBe(true);
    if (!once.ok || !twice.ok) {
      return;
    }
    expect(twice.game.moves).toHaveLength(1);
    expect(twice.game.version).toBe(1);
    expect(twice.game.clocks.whiteMs).toBe(once.game.clocks.whiteMs);
    expect(twice.game).toBe(once.game);
  });

  it("rejects a stale version without touching the clocks", () => {
    const game = start({ incrementWhiteMs: 2_000 });
    const once = mustMove(game, "e2e4", 1_000);
    const stale = applyCommand(
      once,
      command({ id: "next", expectedVersion: 0, type: "move", uci: "e7e5", nowMs: 2_000 }),
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) {
      return;
    }
    expect(stale.code).toBe("stale-version");
    expect(stale.game).toBe(once);
  });

  it("does not add increment when a side resigns", () => {
    const game = start({
      initialTimeWhiteMs: 10_000,
      incrementWhiteMs: 5_000,
      incrementBlackMs: 5_000,
    });
    const result = applyCommand(
      game,
      command({ id: "resign", expectedVersion: 0, type: "resign", side: "w", nowMs: 1_000 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.game.termination).toBe("resignation");
    expect(result.game.result).toBe("0-1");
    expect(result.game.clocks.whiteMs).toBe(9_000);
    expect(result.game.moves).toHaveLength(0);
  });

  it("does not add increment on an agreed draw", () => {
    const game = start({
      initialTimeWhiteMs: 10_000,
      incrementWhiteMs: 4_000,
    });
    const offered = applyCommand(
      game,
      command({ id: "offer", expectedVersion: 0, type: "offer-draw", side: "w", nowMs: 500 }),
    );
    expect(offered.ok).toBe(true);
    if (!offered.ok) {
      return;
    }
    expect(offered.game.clocks.whiteMs).toBe(10_000);
    expect(offered.game.clocks.turnStartedAtMs).toBe(0);
    const accepted = applyCommand(
      offered.game,
      command({ id: "accept", expectedVersion: 1, type: "accept-draw", side: "b", nowMs: 1_500 }),
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    expect(accepted.game.termination).toBe("draw-agreement");
    expect(accepted.game.result).toBe("1/2-1/2");
    expect(accepted.game.clocks.whiteMs).toBe(8_500);
  });

  it("estimates the running clock without changing the game", () => {
    const game = start({ initialTimeWhiteMs: 10_000 });
    const before = JSON.stringify(game);
    expect(displayedClockMs(game.clocks, 2_500)).toEqual({ whiteMs: 7_500, blackMs: 60_000 });
    expect(JSON.stringify(game)).toBe(before);
  });

  it("flags from the display clock once elapsed time reaches the remaining time", () => {
    const game = start({ initialTimeWhiteMs: 1_000 });
    expect(expireIfNeeded(game, 999, "early")).toBe(game);
    const flagged = expireIfNeeded(game, 1_000, "flag");
    expect(flagged.termination).toBe("timeout");
    expect(flagged.moves).toHaveLength(0);
    expect(expireIfNeeded(flagged, 1_500, "flag")).toBe(flagged);
  });
});

describe("local rules", () => {
  it("plays fool's mate", () => {
    let game = start();
    game = mustMove(game, "f2f3", 1_000);
    game = mustMove(game, "e7e5", 2_000);
    game = mustMove(game, "g2g4", 3_000);
    game = mustMove(game, "d8h4", 4_000);
    expect(game.moves.map((move) => move.san)).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(game.status).toBe("finished");
    expect(game.termination).toBe("checkmate");
    expect(game.result).toBe("0-1");
    const extra = applyCommand(
      game,
      command({ id: "too-late", expectedVersion: game.version, type: "move", uci: "e2e3", nowMs: 5_000 }),
    );
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.code).toBe("game-over");
    }
  });

  it("rejects an illegal move without changing the version or the clocks", () => {
    const game = start({ incrementWhiteMs: 1_000 });
    const result = applyCommand(
      game,
      command({ id: "bad", expectedVersion: 0, type: "move", uci: "e2e5", nowMs: 400 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("illegal-move");
    expect(result.game).toBe(game);
  });

  it("castles on both wings and rejects castling through or out of check", () => {
    const both = mustMove(
      start({}, 0, "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"),
      "e1g1",
      100,
    );
    const castled = mustMove(both, "e8c8", 200);
    expect(castled.moves.map((move) => move.san)).toEqual(["O-O", "O-O-O"]);
    expect(castled.fen).toContain("2kr3r");
    expect(castled.fen).toContain("R4RK1");

    const through = start({}, 0, "r3k2r/8/8/8/8/8/6b1/R3K2R w KQkq - 0 1");
    const blocked = applyCommand(
      through,
      command({ id: "through", expectedVersion: 0, type: "move", uci: "e1g1", nowMs: 100 }),
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.game.fen).toBe(through.fen);
    }

    const checked = start({}, 0, "r3k2r/8/8/8/8/8/8/R3K2r w KQq - 0 1");
    const out = applyCommand(
      checked,
      command({ id: "out", expectedVersion: 0, type: "move", uci: "e1g1", nowMs: 100 }),
    );
    expect(out.ok).toBe(false);
  });

  it("plays en passant", () => {
    const game = mustMove(
      start({}, 0, "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3"),
      "e5d6",
      100,
    );
    expect(game.moves[0]?.san).toBe("exd6");
    expect(game.fen.startsWith("rnbqkbnr/ppp1pppp/3P4")).toBe(true);
  });

  it("promotes to queen, rook, bishop, or knight", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    for (const piece of ["q", "r", "b", "n"] as const) {
      const game = mustMove(start({}, 0, fen), `a7a8${piece}`, 100, `promo-${piece}`);
      expect(game.moves[0]?.uci).toBe(`a7a8${piece}`);
      expect(game.fen.startsWith(piece === "q" ? "Q" : piece.toUpperCase())).toBe(true);
    }
    const missing = applyCommand(
      start({}, 0, fen),
      command({ id: "bare", expectedVersion: 0, type: "move", uci: "a7a8", nowMs: 100 }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("promotion-required");
      expect(missing.game.moves).toHaveLength(0);
    }
  });

  it("recognises a stalemate position", () => {
    const game = start({}, 0, "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(game.status).toBe("finished");
    expect(game.termination).toBe("stalemate");
    expect(game.result).toBe("1/2-1/2");
    expect(game.clocks.active).toBeNull();
  });

  it("ends by insufficient material, including after a capture", () => {
    const bare = start({}, 0, "8/8/8/8/8/4k3/8/4K3 w - - 0 1");
    expect(bare.termination).toBe("insufficient");

    const captured = mustMove(start({}, 0, "8/8/8/8/8/8/7k/Kq6 w - - 0 1"), "a1b1", 100);
    expect(captured.termination).toBe("insufficient");
    expect(captured.result).toBe("1/2-1/2");
  });

  it("ends on threefold repetition the way chess.js reports it", () => {
    const uci = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    let game = start({ initialTimeWhiteMs: 600_000, initialTimeBlackMs: 600_000 });
    uci.forEach((move, index) => {
      game = mustMove(game, move, (index + 1) * 1_000);
    });
    expect(game.termination).toBe("threefold");
    expect(game.result).toBe("1/2-1/2");
    expect(game.moves).toHaveLength(8);
  });

  it("ends on the fifty-move rule the way chess.js reports it", () => {
    const game = mustMove(
      start({}, 0, "4k3/8/8/8/8/4R3/4K3/8 w - - 99 70"),
      "e3a3",
      100,
    );
    expect(game.termination).toBe("fifty-move");
    expect(game.result).toBe("1/2-1/2");
  });

  it("rebuilds a saved game from the moves and keeps a timeout that the position cannot show", () => {
    const saved = importTranscript({
      moves: [
        { uci: "e2e4", whiteMs: 302_000, blackMs: 300_000, commandId: "m1" },
        { uci: "e7e5", whiteMs: 302_000, blackMs: 299_000, commandId: "m2" },
      ],
      claimedResult: "0-1",
      claimedTermination: "timeout",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.transcript.status).toBe("finished");
    expect(saved.transcript.termination).toBe("timeout");
    expect(saved.transcript.moves.map((move) => move.san)).toEqual(["e4", "e5"]);
    expect(saved.transcript.finalFen).toBe(saved.transcript.moves[1]?.fen);

    const mate = importTranscript({
      moves: [
        { uci: "f2f3", whiteMs: 1, blackMs: 1, commandId: "a" },
        { uci: "e7e5", whiteMs: 1, blackMs: 1, commandId: "b" },
        { uci: "g2g4", whiteMs: 1, blackMs: 1, commandId: "c" },
        { uci: "d8h4", whiteMs: 1, blackMs: 1, commandId: "d" },
      ],
      claimedResult: "1-0",
      claimedTermination: "resignation",
    });
    expect(mate.ok).toBe(true);
    if (!mate.ok) {
      return;
    }
    expect(mate.transcript.termination).toBe("checkmate");
    expect(mate.transcript.result).toBe("0-1");

    const illegal = importTranscript({
      moves: [{ uci: "e2e5", whiteMs: 1, blackMs: 1, commandId: "bad" }],
    });
    expect(illegal.ok).toBe(false);
  });

  it("replays each ply from the stored moves", () => {
    let game = start();
    game = mustMove(game, "e2e4", 1_000);
    game = mustMove(game, "e7e5", 2_000);
    game = mustMove(game, "g1f3", 3_000);
    expect(positionAt(game, 0).fen).toBe(game.initialFen);
    expect(positionAt(game, 0).lastFrom).toBeNull();
    game.moves.forEach((move, index) => {
      const view = positionAt(game, index + 1);
      expect(view.fen).toBe(move.fen);
      expect(view.san).toBe(move.san);
      expect(view.whiteMs).toBe(move.whiteMs);
      expect(view.lastFrom).toBe(move.uci.slice(0, 2));
      expect(view.lastTo).toBe(move.uci.slice(2, 4));
    });
  });
});
