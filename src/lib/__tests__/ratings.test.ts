import { describe, expect, it } from "vitest";
import { clampStars, daySummary, lastFinishedGame } from "../ratings";
import { EMPTY_STATE, reducer } from "../state";
import type { Day, Game } from "../types";

const G = (id: string, endedAt: number | undefined, ratings?: Record<string, number>): Game => ({
  id,
  court: 1,
  playerIds: ["a", "b", "c", "d"],
  startedAt: endedAt ? endedAt - 10 : 1,
  endedAt,
  shuttles: 1,
  ratings,
});
const day = (games: Game[]): Day => ({ date: "2026-10-25", checkIns: [], games, drinks: [] });

describe("game ratings", () => {
  it("asks about the latest finished game only", () => {
    const d = day([G("g1", 100), G("g2", 200), G("g3", undefined)]);
    expect(lastFinishedGame(d, "a")?.id).toBe("g2");
    expect(lastFinishedGame(d, "z")).toBeUndefined();
  });
  it("clamps stars to 1-5", () => {
    expect([clampStars(0), clampStars(3.4), clampStars(9)]).toEqual([1, 3, 5]);
  });
  it("summarises the day and lists low games lowest first", () => {
    const s = daySummary(day([G("g1", 100, { a: 5, b: 4 }), G("g2", 200, { a: 2, c: 3 }), G("g3", 300, { a: 1 }), G("g4", 400)]));
    expect(s.count).toBe(5);
    expect(s.games).toBe(3);
    expect(s.avg).toBe(3);
    expect(s.low.map((r) => r.game.id)).toEqual(["g3", "g2"]);
  });
  it("only records ratings from players of a finished game", () => {
    const state = { ...EMPTY_STATE, days: [day([G("g1", 100), G("g2", undefined)])] };
    let s = reducer(state, { type: "rateGame", date: "2026-10-25", gameId: "g1", playerId: "a", stars: 4 });
    s = reducer(s, { type: "rateGame", date: "2026-10-25", gameId: "g1", playerId: "z", stars: 1 });
    s = reducer(s, { type: "rateGame", date: "2026-10-25", gameId: "g2", playerId: "a", stars: 1 });
    expect(s.days[0].games[0].ratings).toEqual({ a: 4 });
    expect(s.days[0].games[1].ratings).toBeUndefined();
  });
});
