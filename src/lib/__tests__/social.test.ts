import { describe, expect, it } from "vitest";
import { nextMatch } from "../matchmaking";
import { activePairs, partnerStats, shuttleStock } from "../social";
import { EMPTY_STATE, type State } from "../state";
import type { Day, Player } from "../types";

const P = (id: string, level = 3): Player => ({ id, name: id, level }) as Player;

describe("pair requests", () => {
  const players = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => P(id));
  const base: Day = {
    date: "2026-10-05",
    checkIns: players.map((p, i) => ({ playerId: p.id, at: i })),
    games: [],
    drinks: [],
    pairs: [{ id: "r", from: "a", to: "j", status: "accepted", at: 100 }],
  };
  it("puts an accepted pair on the same team even from the back of the queue", () => {
    const t = nextMatch(base, players)!;
    const team = t.indexOf("a") < 2 ? t.slice(0, 2) : t.slice(2);
    expect(team.sort()).toEqual(["a", "j"]);
  });
  it("is done after they played together once", () => {
    const day = { ...base, games: [{ id: "g", court: 1, playerIds: ["a", "j", "b", "c"] as [string, string, string, string], startedAt: 200, shuttles: 1 }] };
    expect(activePairs(day)).toHaveLength(0);
    expect(activePairs(base)).toHaveLength(1);
  });
});

describe("shuttle stock", () => {
  it("adds purchases and subtracts shuttles used after the last count", () => {
    const state: State = {
      ...EMPTY_STATE,
      stock: { base: 20, countedAt: 1000, low: 12 },
      expenses: [
        { id: "x", date: "2026-10-01", category: "shuttle", amount: 480, note: "", shuttles: 24, at: 2000 },
        { id: "y", date: "2026-09-01", category: "shuttle", amount: 480, note: "", shuttles: 24, at: 500 },
      ],
      days: [
        { date: "2026-10-02", checkIns: [], drinks: [], games: [
          { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 3000, shuttles: 3 },
          { id: "g0", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 900, shuttles: 5 },
        ] },
      ],
    };
    expect(shuttleStock(state)).toMatchObject({ left: 20 + 24 - 3, bought: 24, used: 3 });
    expect(shuttleStock(EMPTY_STATE)).toBeNull();
  });
});

describe("partner stats", () => {
  it("counts wins with partners and losses against rivals", () => {
    const g = (ids: [string, string, string, string], winner: "A" | "B", i: number) => ({ id: "g" + i, court: 1, playerIds: ids, startedAt: i, shuttles: 1, winner });
    const state: State = {
      ...EMPTY_STATE,
      days: [{ date: "2026-10-05", checkIns: [], drinks: [], games: [
        g(["me", "b", "x", "y"], "A", 1),
        g(["me", "b", "x", "z"], "A", 2),
        g(["x", "me", "c", "y"], "B", 3),
      ] }],
    };
    const s = partnerStats(state, "me");
    expect(s.decided).toBe(3);
    expect(s.partners[0]).toEqual({ id: "b", games: 2, wins: 2 });
    // y: เจอ 2 แพ้ 1, c: เจอ 1 แพ้ 1 (แพ้เท่ากัน คนที่เจอบ่อยกว่าขึ้นก่อน)
    expect(s.rivals.slice(0, 2)).toEqual([{ id: "y", games: 2, wins: 1 }, { id: "c", games: 1, wins: 0 }]);
  });
});
