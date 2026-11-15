"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  ROUTE_PLAN_MAX_MOVES,
  stepOnBoard,
  type RoutePlanCell,
  type RoutePlanClientView,
  type RoutePlanMove,
} from "@/game/puzzles";

import { submitPuzzleAction } from "../actions";
import { sceneStore } from "../scene-store";
import { playFeedbackSound } from "../sound";
import { FeedbackDial } from "./feedback-dial";
import { SoundToggle } from "./sound-toggle";

type Verdict =
  | { kind: "none" }
  | { kind: "wrong"; message: string }
  | { kind: "solved"; message: string }
  | { kind: "error"; message: string };

const ARROWS: Array<{ move: RoutePlanMove; label: string; glyph: string }> = [
  { move: "up", label: "Up", glyph: "⬆️" },
  { move: "left", label: "Left", glyph: "⬅️" },
  { move: "right", label: "Right", glyph: "➡️" },
  { move: "down", label: "Down", glyph: "⬇️" },
];

const same = (a: RoutePlanCell, b: RoutePlanCell) => a.x === b.x && a.y === b.y;
/** Columns and rows are numbered from 1 for people. */
const spoken = (cell: RoutePlanCell) => `column ${cell.x + 1}, row ${cell.y + 1}`;

/**
 * Route-plan puzzle (ADR 0020). The whole board is visible (a planning puzzle); the child builds a route with
 * arrow buttons. The browser only simulates moves from the client view to refuse an impossible step with a
 * friendly message: the SERVER decides whether the route is right and the browser never knows a route.
 */
export function RoutePuzzle({
  puzzleId,
  title,
  board,
  solved,
}: {
  puzzleId: string;
  title: string;
  board: RoutePlanClientView;
  solved: boolean;
}) {
  const [moves, setMoves] = useState<RoutePlanMove[]>([]);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "none" });
  const [announce, setAnnounce] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const done = solved || verdict.kind === "solved";
  const locked = pending || done;

  const trail: RoutePlanCell[] = [board.start];
  for (const move of moves) {
    const next = stepOnBoard(board, trail[trail.length - 1] as RoutePlanCell, move);
    if (next) trail.push(next);
  }
  const ship = trail[trail.length - 1] as RoutePlanCell;
  const atGoal = same(ship, board.goal);

  function go(move: RoutePlanMove) {
    if (locked) return;
    if (moves.length >= ROUTE_PLAN_MAX_MOVES) {
      setAnnounce("That is the longest route allowed. Undo a move or clear the chart.");
      return;
    }
    const next = stepOnBoard(board, ship, move);
    if (!next) {
      const to = {
        x: ship.x + (move === "right" ? 1 : move === "left" ? -1 : 0),
        y: ship.y + (move === "down" ? 1 : move === "up" ? -1 : 0),
      };
      const onBoard = to.x >= 0 && to.y >= 0 && to.x < board.width && to.y < board.height;
      setAnnounce(onBoard ? "A rock is in the way." : "That is the edge of the chart.");
      return;
    }
    setMoves([...moves, move]);
    setVerdict({ kind: "none" });
    setAnnounce(
      `${move}. Ship at ${spoken(next)}.${same(next, board.goal) ? " You are at the goal." : ""}`,
    );
  }
  function undo() {
    if (locked || moves.length === 0) return;
    const rest = moves.slice(0, -1);
    setMoves(rest);
    setVerdict({ kind: "none" });
    setAnnounce(`Undid a move. ${rest.length} moves planned.`);
  }
  function clear() {
    if (locked || moves.length === 0) return;
    setMoves([]);
    setVerdict({ kind: "none" });
    setAnnounce("Cleared. The ship is back at the start.");
  }
  function check() {
    if (locked || moves.length === 0) return;
    const form = new FormData();
    form.set("puzzleId", puzzleId);
    form.set("answerJson", JSON.stringify({ moves }));
    startTransition(async () => {
      const result = await submitPuzzleAction(null, form);
      const scene = sceneStore.getState();
      if (!result.ok) {
        setVerdict({ kind: "error", message: result.error.message });
        return;
      }
      const data = result.data as { correct: boolean; feedback?: string };
      if (data.correct) {
        scene.signalSolved();
        playFeedbackSound("solved", scene.soundOn);
        setVerdict({ kind: "solved", message: data.feedback ?? "You solved it!" });
      } else {
        scene.signalWrong();
        playFeedbackSound("oops", scene.soundOn);
        setAttempts((n) => n + 1);
        setVerdict({
          kind: "wrong",
          message: `${data.feedback ?? "Not quite."} Get the ship all the way to the goal without touching a rock.`,
        });
      }
    });
  }

  function onBoardKey(event: React.KeyboardEvent) {
    const map: Record<string, RoutePlanMove> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const move = map[event.key];
    if (!move) return;
    event.preventDefault();
    go(move);
  }

  const reefList = board.reefs.map(spoken).join("; ");

  return (
    <section
      className="space-y-4 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
      data-testid="puzzle"
      data-puzzle-type="route-plan"
      data-solved={done}
      aria-labelledby={`puzzle-${puzzleId}`}
    >
      <div className="flex items-start gap-3">
        <FeedbackDial className="size-16 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id={`puzzle-${puzzleId}`} className="text-lg font-black">
            {title}
          </h3>
          {board.hint ? <p className="text-sm italic">{board.hint}</p> : null}
        </div>
        <SoundToggle />
      </div>

      {done ? (
        <p
          className="cq-pop rounded-2xl bg-pirate-gold/40 p-3 text-center font-black"
          data-testid="puzzle-solved"
        >
          🧭 {title} solved!
        </p>
      ) : (
        <>
          <p className="text-sm font-bold">
            Plan a route from ⚓ to 🏴‍☠️ without touching a 🪨 rock.
          </p>
          <div
            key={attempts}
            tabIndex={0}
            role="group"
            aria-label={`Sea chart, ${board.width} columns by ${board.height} rows. Start at ${spoken(board.start)}. Goal at ${spoken(board.goal)}. Rocks at ${reefList || "none"}. Ship at ${spoken(ship)}. Use the arrow keys or the buttons to move.`}
            onKeyDown={onBoardKey}
            data-testid="route-board"
            className={`mx-auto grid w-full max-w-sm gap-1 rounded-2xl bg-pirate-sea/30 p-2 ${
              verdict.kind === "wrong" ? "cq-shake" : ""
            }`}
            style={{ gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: board.width * board.height }, (_, i) => {
              const cell = { x: i % board.width, y: Math.floor(i / board.width) };
              const isReef = board.reefs.some((r) => same(r, cell));
              const isShip = same(cell, ship);
              const visited = trail.some((t) => same(t, cell));
              const glyph = isShip
                ? "⛵"
                : isReef
                  ? "🪨"
                  : same(cell, board.goal)
                    ? "🏴‍☠️"
                    : same(cell, board.start)
                      ? "⚓"
                      : visited
                        ? "·"
                        : "";
              return (
                <div
                  key={i}
                  aria-hidden="true"
                  data-testid={`route-cell-${cell.x}-${cell.y}`}
                  data-kind={isReef ? "reef" : isShip ? "ship" : visited ? "trail" : "water"}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xl ${
                    isReef
                      ? "bg-pirate-wood/40"
                      : visited
                        ? "bg-pirate-gold/50"
                        : "bg-pirate-parchment/80"
                  }`}
                >
                  {glyph}
                </div>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Steer the ship"
            className="mx-auto grid max-w-56 grid-cols-3 gap-2"
          >
            {ARROWS.map(({ move, label, glyph }) => (
              <Button
                key={move}
                type="button"
                variant="outline"
                disabled={locked}
                data-testid={`route-${move}`}
                aria-label={label}
                className={`min-h-12 rounded-2xl text-xl ${
                  move === "up"
                    ? "col-start-2"
                    : move === "left"
                      ? "col-start-1 row-start-2"
                      : move === "right"
                        ? "col-start-3 row-start-2"
                        : "col-start-2 row-start-3"
                }`}
                onClick={() => go(move)}
              >
                {glyph}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-2xl"
              disabled={locked || moves.length === 0}
              onClick={undo}
              data-testid="route-undo"
            >
              Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-2xl"
              disabled={locked || moves.length === 0}
              onClick={clear}
              data-testid="route-clear"
            >
              Clear
            </Button>
            <span className="text-sm font-bold" data-testid="route-count">
              {moves.length} {moves.length === 1 ? "move" : "moves"}
            </span>
            <Button
              type="button"
              className="ml-auto min-h-11 rounded-2xl font-black"
              disabled={locked || moves.length === 0 || !atGoal}
              onClick={check}
              data-testid="puzzle-check"
            >
              {pending ? "Checking…" : "Set sail"}
            </Button>
          </div>
        </>
      )}

      {/* Polite live region: moves, then the server's verdict. */}
      <p className="sr-only" aria-live="polite" data-testid="puzzle-announce">
        {announce}
      </p>
      <p
        role="status"
        aria-live="polite"
        data-testid="puzzle-feedback"
        data-kind={verdict.kind}
        className={`min-h-6 text-center text-sm font-bold ${
          verdict.kind === "wrong" || verdict.kind === "error" ? "text-danger" : ""
        }`}
      >
        {verdict.kind === "none" ? "" : verdict.message}
      </p>
    </section>
  );
}
