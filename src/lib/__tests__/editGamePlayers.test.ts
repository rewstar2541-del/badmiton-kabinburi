import { describe, expect, it } from "vitest";
import { shuttleCountFor } from "../billing";
import { gameHistory } from "../social";
import { EMPTY_STATE, reducer, validLineup, type State } from "../state";
import type { Game } from "../types";

const game: Game = { id: "g", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 0, endedAt: 100, shuttles: 3, winner: "A" };
const base = (g: Game = game): State => ({
  ...EMPTY_STATE,
  players: ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, level: 3 }) as State["players"][number]),
  days: [{ date: "2026-11-01", checkIns: ["a", "b", "c", "d", "e"].map((id) => ({ playerId: id, at: 0 })), drinks: [], games: [g] }],
});

describe("แก้คนในเกม (คู่ตีผิด)", () => {
  it("แทนคนผิดด้วยคนที่เล่นจริง ค่าลูกและประวัติย้ายตาม ผลยังเป็นของทีมเดิม", () => {
    const s = reducer(base(), { type: "editGamePlayers", date: "2026-11-01", gameId: "g", playerIds: ["a", "e", "c", "d"], prevIds: game.playerIds });
    const day = s.days[0];
    expect(day.games[0].playerIds).toEqual(["a", "e", "c", "d"]);
    expect(day.games[0].winner).toBe("A");
    expect(shuttleCountFor(day, "b")).toBe(0);
    expect(shuttleCountFor(day, "e")).toBe(3);
    expect(gameHistory(s, "b")).toHaveLength(0);
    const h = gameHistory(s, "e")[0];
    expect(h.mate).toBe("a");
    expect(h.result).toBe("win");
  });

  it("สลับคู่ระหว่างทีม", () => {
    const s = reducer(base(), { type: "editGamePlayers", date: "2026-11-01", gameId: "g", playerIds: ["a", "c", "b", "d"], prevIds: game.playerIds });
    expect(gameHistory(s, "a")[0].mate).toBe("c");
    expect(gameHistory(s, "b")[0].result).toBe("loss");
  });

  it("ไม่แก้เกมที่ยังเล่นอยู่ เกมที่มีเปลี่ยนตัว หรือ 4 คนซ้ำกัน", () => {
    const edit = (g: Game, ids: Game["playerIds"]) => reducer(base(g), { type: "editGamePlayers", date: "2026-11-01", gameId: "g", playerIds: ids, prevIds: g.playerIds }).days[0].games[0].playerIds;
    expect(edit({ ...game, endedAt: undefined }, ["a", "e", "c", "d"])).toEqual(["a", "b", "c", "d"]);
    expect(edit({ ...game, subs: [{ out: "x", in: "b", at: 1, shuttles: 1 }] }, ["a", "e", "c", "d"])).toEqual(["a", "b", "c", "d"]);
    expect(edit(game, ["a", "a", "c", "d"])).toEqual(["a", "b", "c", "d"]);
    expect(validLineup(["a", "b", "c", ""])).toBe(false);
  });
});
