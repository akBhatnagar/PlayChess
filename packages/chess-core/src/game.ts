import { Chess, type PieceSymbol, type Square } from "chess.js";
import {
  commitTurn,
  type ClockState,
  type Side,
} from "./clock";
import { timeControlSchema, type TimeControl } from "./time-control";

export type { ClockState, Side } from "./clock";

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

export type Termination =
  | "checkmate"
  | "stalemate"
  | "timeout"
  | "resignation"
  | "draw-agreement"
  | "threefold"
  | "fifty-move"
  | "insufficient";

export type PlayedMove = {
  ply: number;
  uci: string;
  san: string;
  fen: string;
  whiteMs: number;
  blackMs: number;
  commandId: string;
};

export type LocalGame = {
  version: number;
  initialFen: string;
  moves: PlayedMove[];
  fen: string;
  turn: Side;
  status: "active" | "finished";
  result: GameResult | null;
  termination: Termination | null;
  clocks: ClockState;
  timeControl: TimeControl;
  appliedCommandIds: string[];
  /** Side that has a standing draw offer, if any. */
  drawOffer: Side | null;
};

export type GameCommand = {
  id: string;
  expectedVersion: number;
  nowMs: number;
} & (
  | { type: "move"; uci: string }
  | { type: "resign"; side: Side }
  | { type: "offer-draw"; side: Side }
  | { type: "accept-draw"; side: Side }
  | { type: "decline-draw"; side: Side }
  | { type: "expire" }
);

export type RejectCode =
  | "stale-version"
  | "illegal-move"
  | "game-over"
  | "promotion-required"
  | "wrong-side"
  | "no-draw-offer"
  | "not-expired";

export type CommandResult =
  | { ok: true; game: LocalGame; duplicate: boolean }
  | { ok: false; game: LocalGame; code: RejectCode };

export type BoardPiece = {
  square: string;
  piece: "K" | "Q" | "R" | "B" | "N" | "P";
  color: Side;
};

export type PositionView = {
  ply: number;
  fen: string;
  san: string | null;
  whiteMs: number;
  blackMs: number;
  turn: Side;
  inCheck: boolean;
  checkSquare: string | null;
  lastFrom: string | null;
  lastTo: string | null;
  pieces: BoardPiece[];
};

export type LegalMove = {
  uci: string;
  san: string;
  from: string;
  to: string;
  promotion: string | null;
};

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const PIECE_CODE = {
  k: "K",
  q: "Q",
  r: "R",
  b: "B",
  n: "N",
  p: "P",
} as const;

/**
 * chess.js 1.4.0 treats threefold repetition and the fifty-move rule as
 * immediate draws (`isDraw()`), not as claims. Local games end on that
 * signal. Stalemate is reported before insufficient material, then
 * threefold, then the fifty-move rule.
 */
function readTerminal(chess: Chess): { result: GameResult; termination: Termination } | null {
  if (chess.isCheckmate()) {
    return {
      result: chess.turn() === "w" ? "0-1" : "1-0",
      termination: "checkmate",
    };
  }
  if (chess.isStalemate()) {
    return { result: "1/2-1/2", termination: "stalemate" };
  }
  if (chess.isInsufficientMaterial()) {
    return { result: "1/2-1/2", termination: "insufficient" };
  }
  if (chess.isThreefoldRepetition()) {
    return { result: "1/2-1/2", termination: "threefold" };
  }
  if (chess.isDrawByFiftyMoves()) {
    return { result: "1/2-1/2", termination: "fifty-move" };
  }
  return null;
}

export function parseUci(
  uci: string,
): { from: Square; to: Square; promotion?: PieceSymbol } | null {
  const normalized = uci.trim().toLowerCase();
  if (!UCI_PATTERN.test(normalized)) {
    return null;
  }
  const from = normalized.slice(0, 2) as Square;
  const to = normalized.slice(2, 4) as Square;
  const promotion = normalized[4] as PieceSymbol | undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

function replay(game: LocalGame): Chess {
  const chess = new Chess(game.initialFen);
  for (const move of game.moves) {
    const parsed = parseUci(move.uci);
    if (!parsed) {
      throw new Error(`Stored move ${move.uci} is not UCI.`);
    }
    chess.move(parsed);
  }
  return chess;
}

function reject(game: LocalGame, code: RejectCode): CommandResult {
  return { ok: false, game, code };
}

function remember(game: LocalGame, commandId: string, patch: Partial<LocalGame>): LocalGame {
  return {
    ...game,
    ...patch,
    version: game.version + 1,
    appliedCommandIds: [...game.appliedCommandIds, commandId],
  };
}

function flagTimeout(game: LocalGame, nowMs: number, commandId: string): LocalGame | null {
  const committed = commitTurn(game.clocks, game.timeControl, nowMs, {
    increment: false,
    nextActive: null,
  });
  if (!committed.timedOut || game.clocks.active === null) {
    return null;
  }
  return remember(game, commandId, {
    status: "finished",
    result: game.clocks.active === "w" ? "0-1" : "1-0",
    termination: "timeout",
    clocks: committed.clocks,
    drawOffer: null,
  });
}

export function createLocalGame(input: {
  timeControl: TimeControl;
  nowMs: number;
  initialFen?: string;
}): LocalGame {
  const timeControl = timeControlSchema.parse(input.timeControl);
  let chess: Chess;
  try {
    chess = new Chess(input.initialFen);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid FEN.";
    throw new Error(message);
  }

  const terminal = readTerminal(chess);
  const fen = chess.fen();
  return {
    version: 0,
    initialFen: fen,
    moves: [],
    fen,
    turn: chess.turn(),
    status: terminal ? "finished" : "active",
    result: terminal?.result ?? null,
    termination: terminal?.termination ?? null,
    clocks: {
      whiteMs: timeControl.initialTimeWhiteMs,
      blackMs: timeControl.initialTimeBlackMs,
      turnStartedAtMs: terminal ? null : input.nowMs,
      active: terminal ? null : chess.turn(),
    },
    timeControl,
    appliedCommandIds: [],
    drawOffer: null,
  };
}

function applyMove(game: LocalGame, command: GameCommand & { type: "move" }): CommandResult {
  const parsed = parseUci(command.uci);
  if (!parsed) {
    return reject(game, "illegal-move");
  }

  const chess = replay(game);
  const candidates = chess
    .moves({ square: parsed.from, verbose: true })
    .filter((move) => move.to === parsed.to);
  if (candidates.length === 0) {
    return reject(game, "illegal-move");
  }
  if (candidates.some((move) => move.promotion) && !parsed.promotion) {
    return reject(game, "promotion-required");
  }

  let played;
  try {
    played = chess.move({
      from: parsed.from,
      to: parsed.to,
      ...(parsed.promotion ? { promotion: parsed.promotion } : {}),
    });
  } catch {
    return reject(game, "illegal-move");
  }

  const terminal = readTerminal(chess);
  const committed = commitTurn(game.clocks, game.timeControl, command.nowMs, {
    increment: true,
    nextActive: terminal ? null : chess.turn(),
  });
  const uci = parsed.promotion ? `${parsed.from}${parsed.to}${parsed.promotion}` : `${parsed.from}${parsed.to}`;
  const recorded: PlayedMove = {
    ply: game.moves.length + 1,
    uci,
    san: played.san,
    fen: chess.fen(),
    whiteMs: committed.clocks.whiteMs,
    blackMs: committed.clocks.blackMs,
    commandId: command.id,
  };

  return {
    ok: true,
    duplicate: false,
    game: remember(game, command.id, {
      moves: [...game.moves, recorded],
      fen: chess.fen(),
      turn: chess.turn(),
      status: terminal ? "finished" : "active",
      result: terminal?.result ?? null,
      termination: terminal?.termination ?? null,
      clocks: committed.clocks,
      drawOffer: null,
    }),
  };
}

function applyResign(game: LocalGame, command: GameCommand & { type: "resign" }): CommandResult {
  if (command.side !== game.turn) {
    return reject(game, "wrong-side");
  }
  const committed = commitTurn(game.clocks, game.timeControl, command.nowMs, {
    increment: false,
    nextActive: null,
  });
  return {
    ok: true,
    duplicate: false,
    game: remember(game, command.id, {
      status: "finished",
      result: command.side === "w" ? "0-1" : "1-0",
      termination: "resignation",
      clocks: committed.clocks,
      drawOffer: null,
    }),
  };
}

function applyOffer(game: LocalGame, command: GameCommand & { type: "offer-draw" }): CommandResult {
  if (command.side !== game.turn) {
    return reject(game, "wrong-side");
  }
  return {
    ok: true,
    duplicate: false,
    game: remember(game, command.id, { drawOffer: command.side }),
  };
}

function applyAccept(game: LocalGame, command: GameCommand & { type: "accept-draw" }): CommandResult {
  if (!game.drawOffer || command.side === game.drawOffer) {
    return reject(game, "no-draw-offer");
  }
  const committed = commitTurn(game.clocks, game.timeControl, command.nowMs, {
    increment: false,
    nextActive: null,
  });
  return {
    ok: true,
    duplicate: false,
    game: remember(game, command.id, {
      status: "finished",
      result: "1/2-1/2",
      termination: "draw-agreement",
      clocks: committed.clocks,
      drawOffer: null,
    }),
  };
}

function applyDecline(
  game: LocalGame,
  command: GameCommand & { type: "decline-draw" },
): CommandResult {
  if (!game.drawOffer || command.side === game.drawOffer) {
    return reject(game, "no-draw-offer");
  }
  return {
    ok: true,
    duplicate: false,
    game: remember(game, command.id, { drawOffer: null }),
  };
}

/**
 * Apply one local command. A repeated id returns the current game and does
 * not move or increment again. A stale version is rejected with no clock change.
 * A late command flags the active side and does not apply the move or an increment.
 */
export function applyCommand(game: LocalGame, command: GameCommand): CommandResult {
  if (game.appliedCommandIds.includes(command.id)) {
    return { ok: true, game, duplicate: true };
  }
  if (command.expectedVersion !== game.version) {
    return reject(game, "stale-version");
  }
  if (game.status === "finished") {
    return reject(game, "game-over");
  }

  const timedOut = flagTimeout(game, command.nowMs, command.id);
  if (timedOut) {
    return { ok: true, game: timedOut, duplicate: false };
  }

  switch (command.type) {
    case "expire":
      return reject(game, "not-expired");
    case "move":
      return applyMove(game, command);
    case "resign":
      return applyResign(game, command);
    case "offer-draw":
      return applyOffer(game, command);
    case "accept-draw":
      return applyAccept(game, command);
    case "decline-draw":
      return applyDecline(game, command);
    default: {
      const unreachable: never = command;
      return unreachable;
    }
  }
}

export function expireIfNeeded(game: LocalGame, nowMs: number, commandId: string): LocalGame {
  const result = applyCommand(game, {
    id: commandId,
    expectedVersion: game.version,
    type: "expire",
    nowMs,
  });
  return result.game;
}

export function legalMoves(game: LocalGame): LegalMove[] {
  if (game.status !== "active") {
    return [];
  }
  return replay(game)
    .moves({ verbose: true })
    .map((move) => ({
      uci: move.promotion ? `${move.from}${move.to}${move.promotion}` : `${move.from}${move.to}`,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? null,
    }));
}

export type TranscriptMove = {
  uci: string;
  whiteMs: number;
  blackMs: number;
  commandId: string;
};

export type ImportedMove = TranscriptMove & {
  ply: number;
  san: string;
  fen: string;
};

export type ImportedTranscript = {
  initialFen: string;
  finalFen: string;
  status: "active" | "finished";
  result: GameResult | null;
  termination: Termination | null;
  pgn: string;
  moves: ImportedMove[];
};

const CLOCK_CLAIM: readonly Termination[] = ["timeout", "resignation", "draw-agreement"];
const MAX_TRANSCRIPT_MOVES = 600;

/**
 * Rebuild a saved local game from UCI. Positions and chess results come from
 * the rules. Timeout, resignation, and an agreed draw are accepted only while
 * the position is still ongoing, because those endings are not in the moves.
 */
export function importTranscript(input: {
  initialFen?: string;
  moves: readonly TranscriptMove[];
  claimedResult?: GameResult | null;
  claimedTermination?: Termination | null;
}):
  | { ok: true; transcript: ImportedTranscript }
  | { ok: false; code: "illegal-move" | "invalid-clock" | "duplicate-command" | "too-long" | "inconsistent-result" } {
  if (input.moves.length > MAX_TRANSCRIPT_MOVES) {
    return { ok: false, code: "too-long" };
  }

  const seen = new Set<string>();
  for (const move of input.moves) {
    if (!Number.isInteger(move.whiteMs) || !Number.isInteger(move.blackMs) || move.whiteMs < 0 || move.blackMs < 0) {
      return { ok: false, code: "invalid-clock" };
    }
    if (seen.has(move.commandId)) {
      return { ok: false, code: "duplicate-command" };
    }
    seen.add(move.commandId);
  }

  let chess: Chess;
  try {
    chess = new Chess(input.initialFen);
  } catch {
    return { ok: false, code: "illegal-move" };
  }

  const initialFen = chess.fen();
  const imported: ImportedMove[] = [];
  for (const move of input.moves) {
    const parsed = parseUci(move.uci);
    if (!parsed) {
      return { ok: false, code: "illegal-move" };
    }
    try {
      const played = chess.move(parsed);
      imported.push({
        ply: imported.length + 1,
        uci: parsed.promotion ? `${parsed.from}${parsed.to}${parsed.promotion}` : `${parsed.from}${parsed.to}`,
        san: played.san,
        fen: chess.fen(),
        whiteMs: move.whiteMs,
        blackMs: move.blackMs,
        commandId: move.commandId,
      });
    } catch {
      return { ok: false, code: "illegal-move" };
    }
  }

  const rules = readTerminal(chess);
  const claimedTermination = input.claimedTermination ?? null;
  const claimedResult = input.claimedResult ?? null;
  let status: "active" | "finished" = "active";
  let result: GameResult | null = null;
  let termination: Termination | null = null;

  if (rules) {
    status = "finished";
    result = rules.result;
    termination = rules.termination;
  } else if (claimedTermination) {
    const clockClaim = CLOCK_CLAIM.some((item) => item === claimedTermination);
    const resultMatches =
      (claimedTermination === "draw-agreement" && claimedResult === "1/2-1/2") ||
      ((claimedTermination === "timeout" || claimedTermination === "resignation") &&
        (claimedResult === "1-0" || claimedResult === "0-1"));
    if (!clockClaim || !resultMatches) {
      return { ok: false, code: "inconsistent-result" };
    }
    status = "finished";
    result = claimedResult;
    termination = claimedTermination;
  }

  if (result) {
    chess.setHeader("Result", result);
  }

  return {
    ok: true,
    transcript: {
      initialFen,
      finalFen: chess.fen(),
      status,
      result,
      termination,
      pgn: chess.pgn(),
      moves: imported,
    },
  };
}

export function positionAt(game: LocalGame, ply: number): PositionView {
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) {
    throw new Error(`Ply ${ply} is outside 0..${game.moves.length}.`);
  }

  const chess = new Chess(game.initialFen);
  for (let index = 0; index < ply; index += 1) {
    const move = game.moves[index];
    if (!move) {
      throw new Error(`Missing move at ply ${index + 1}.`);
    }
    const parsed = parseUci(move.uci);
    if (!parsed) {
      throw new Error(`Stored move ${move.uci} is not UCI.`);
    }
    chess.move(parsed);
  }

  const pieces: BoardPiece[] = [];
  chess.board().forEach((rank, rankIndex) => {
    rank.forEach((cell, fileIndex) => {
      if (!cell) {
        return;
      }
      const file = FILES[fileIndex];
      const rankName = RANKS[rankIndex];
      if (!file || !rankName) {
        return;
      }
      pieces.push({
        square: `${file}${rankName}`,
        piece: PIECE_CODE[cell.type],
        color: cell.color,
      });
    });
  });

  const recorded = ply === 0 ? null : (game.moves[ply - 1] ?? null);
  const inCheck = chess.inCheck();
  const king = inCheck
    ? pieces.find((piece) => piece.piece === "K" && piece.color === chess.turn())
    : undefined;

  return {
    ply,
    fen: chess.fen(),
    san: recorded?.san ?? null,
    whiteMs: recorded?.whiteMs ?? game.timeControl.initialTimeWhiteMs,
    blackMs: recorded?.blackMs ?? game.timeControl.initialTimeBlackMs,
    turn: chess.turn(),
    inCheck,
    checkSquare: king?.square ?? null,
    lastFrom: recorded ? recorded.uci.slice(0, 2) : null,
    lastTo: recorded ? recorded.uci.slice(2, 4) : null,
    pieces,
  };
}
