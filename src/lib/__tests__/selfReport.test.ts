import { describe, expect, it } from "vitest";
import { DISPUTE_MS, disputable, reducer, resultOf, EMPTY_STATE } from "../state";
import type { Day, Game } from "../types";

const g: Game = { id: "g", court: 1, playerIds: ["a1", "a2", "b1", "b2"], startedAt: 0, shuttles: 1 };

describe("ผู้เล่นกดผลเอง", () => {
  it("ทีมเราชนะ/แพ้/เสมอ แปลงเป็นทีมที่ชนะ", () => {
    expect(resultOf(g, "a2", "win")).toEqual({ winner: "A" });
    expect(resultOf(g, "b1", "win")).toEqual({ winner: "B" });
    expect(resultOf(g, "a1", "lose")).toEqual({ winner: "B" });
    expect(resultOf(g, "b2", "draw")).toEqual({ draw: true });
  });

  it("กด ไม่ตรง ได้เฉพาะอีกทีม ภายใน 2 นาที และครั้งเดียว", () => {
    const day: Day = { date: "d", checkIns: [], drinks: [], games: [{ ...g, endedAt: 1000, winner: "A", reportedBy: "a1" }] };
    expect(disputable(day, "b1", 1000 + 60_000)?.id).toBe("g");
    expect(disputable(day, "a2", 1000)).toBeUndefined();
    expect(disputable(day, "b1", 1000 + DISPUTE_MS)).toBeUndefined();
    const admin: Day = { ...day, games: [{ ...g, endedAt: 1000, winner: "A" }] };
    expect(disputable(admin, "b1", 1000)).toBeUndefined();
    const s = reducer({ ...EMPTY_STATE, days: [day] }, { type: "disputeGame", date: "d", gameId: "g", playerId: "b1" });
    expect(disputable(s.days[0], "b2", 1000)).toBeUndefined();
    // แอดมินแก้ผลแล้ว ป้ายหาย
    const fixed = reducer(s, { type: "setResult", date: "d", gameId: "g", winner: "B" });
    expect(fixed.days[0].games[0]).toMatchObject({ winner: "B", disputedBy: undefined });
  });
});
