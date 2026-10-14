import {
  applyCommand,
  createLocalGame,
  expireIfNeeded,
  isLate,
  presetById,
  type CommandResult,
  type GameCommand,
  type LocalGame,
  type Side,
} from "@playchess/chess-core";
import { create } from "zustand";

type LocalPlayState = {
  presetId: string | null;
  game: LocalGame | null;
  /** Null means the live position. A number is a replay ply. */
  reviewPly: number | null;
  nowMs: number;
  notice: string | null;
  start: (presetId: string) => void;
  load: (game: LocalGame) => void;
  move: (uci: string) => CommandResult | null;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  tick: () => void;
  review: (ply: number | null) => void;
  reset: () => void;
};

let commandSeq = 0;

function nextCommandId(): string {
  commandSeq += 1;
  return `local-${commandSeq}`;
}

let nowFn: () => number = () => Date.now();

/** Tests inject a clock so the board never waits on a real timeout. */
export function setLocalClock(clock: () => number) {
  nowFn = clock;
}

export function resetLocalClock() {
  nowFn = () => Date.now();
  commandSeq = 0;
}

function noticeFor(result: CommandResult): string | null {
  if (result.ok) {
    return null;
  }
  switch (result.code) {
    case "illegal-move":
      return "That move is not legal.";
    case "promotion-required":
      return "Choose a piece to promote to.";
    case "stale-version":
      return "That move was out of date.";
    case "game-over":
      return "The game is already over.";
    case "wrong-side":
      return "That action is for the other side.";
    case "no-draw-offer":
      return "There is no draw offer to answer.";
    case "not-expired":
      return null;
    default:
      return null;
  }
}

type CommandBody =
  | { type: "move"; uci: string }
  | { type: "resign"; side: Side }
  | { type: "offer-draw"; side: Side }
  | { type: "accept-draw"; side: Side }
  | { type: "decline-draw"; side: Side };

function commandWithMeta(game: LocalGame, nowMs: number, body: CommandBody): GameCommand {
  const meta = { id: nextCommandId(), expectedVersion: game.version, nowMs };
  switch (body.type) {
    case "move":
      return { ...meta, type: "move", uci: body.uci };
    case "resign":
      return { ...meta, type: "resign", side: body.side };
    case "offer-draw":
      return { ...meta, type: "offer-draw", side: body.side };
    case "accept-draw":
      return { ...meta, type: "accept-draw", side: body.side };
    case "decline-draw":
      return { ...meta, type: "decline-draw", side: body.side };
    default: {
      const unreachable: never = body;
      return unreachable;
    }
  }
}

function apply(
  get: () => LocalPlayState,
  set: (partial: Partial<LocalPlayState>) => void,
  body: CommandBody,
) {
  const game = get().game;
  if (!game) {
    return null;
  }
  const nowMs = nowFn();
  const result = applyCommand(game, commandWithMeta(game, nowMs, body));
  if (result.ok) {
    set({ game: result.game, reviewPly: null, nowMs, notice: null });
  } else {
    set({ nowMs, notice: noticeFor(result) });
  }
  return result;
}

export const useLocalGame = create<LocalPlayState>((set, get) => ({
  presetId: null,
  game: null,
  reviewPly: null,
  nowMs: nowFn(),
  notice: null,
  start: (presetId) => {
    const preset = presetById(presetId);
    if (!preset) {
      return;
    }
    const nowMs = nowFn();
    set({
      presetId,
      game: createLocalGame({ timeControl: preset, nowMs }),
      reviewPly: null,
      nowMs,
      notice: null,
    });
  },
  load: (game) => {
    set({
      presetId: null,
      game,
      reviewPly: null,
      nowMs: nowFn(),
      notice: null,
    });
  },
  move: (uci) => apply(get, set, { type: "move", uci }),
  resign: () => {
    const game = get().game;
    if (!game) {
      return;
    }
    apply(get, set, { type: "resign", side: game.turn });
  },
  offerDraw: () => {
    const game = get().game;
    if (!game) {
      return;
    }
    apply(get, set, { type: "offer-draw", side: game.turn });
  },
  acceptDraw: () => {
    const offer = get().game?.drawOffer;
    if (!offer) {
      return;
    }
    apply(get, set, { type: "accept-draw", side: offer === "w" ? "b" : "w" });
  },
  declineDraw: () => {
    const offer = get().game?.drawOffer;
    if (!offer) {
      return;
    }
    apply(get, set, { type: "decline-draw", side: offer === "w" ? "b" : "w" });
  },
  tick: () => {
    const nowMs = nowFn();
    const { game, nowMs: previous } = get();
    if (!game || game.status === "finished" || !isLate(game.clocks, nowMs)) {
      if (previous !== nowMs) {
        set({ nowMs });
      }
      return;
    }
    const next = expireIfNeeded(game, nowMs, nextCommandId());
    if (next !== game) {
      set({ game: next, reviewPly: null, nowMs, notice: null });
      return;
    }
    if (previous !== nowMs) {
      set({ nowMs });
    }
  },
  review: (ply) => {
    set({ reviewPly: ply });
  },
  reset: () => {
    set({
      presetId: null,
      game: null,
      reviewPly: null,
      nowMs: nowFn(),
      notice: null,
    });
  },
}));
