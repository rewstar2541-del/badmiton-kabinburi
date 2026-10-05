import { describe, expect, it } from "vitest";
import { clearCount, clearState } from "../clear";
import { EMPTY_STATE, type State } from "../state";

const state: State = {
  ...EMPTY_STATE,
  players: [{ id: "a", name: "a", level: 3 }],
  days: ["2026-09-01", "2026-10-01"].map((date) => ({
    date,
    checkIns: [{ playerId: "a", at: 0 }],
    games: [{ id: "g" + date, court: 1, playerIds: ["a", "a", "a", "a"], startedAt: 0, shuttles: 1 }],
    drinks: [],
    announcement: "x",
  })),
  expenses: [
    { id: "e1", date: "2026-09-02", category: "court", amount: 100, note: "" },
    { id: "e2", date: "2026-10-02", category: "court", amount: 100, note: "" },
  ],
  stock: { base: 10, countedAt: 0, low: 5 },
};

describe("clear by type and date", () => {
  it("only removes the chosen types inside the range", () => {
    const s = clearState(state, ["games", "expenses"], "2026-09-01", "2026-09-30");
    expect(s.days[0].games).toEqual([]);
    expect(s.days[0].checkIns).toHaveLength(1);
    expect(s.days[1].games).toHaveLength(1);
    expect(s.expenses!.map((e) => e.id)).toEqual(["e2"]);
    expect(s.players).toHaveLength(1);
    expect(s.stock).toBeDefined();
  });
  it("counts what would be removed", () => {
    expect(clearCount(state, "games", "2026-01-01", "2026-12-31")).toBe(2);
    expect(clearCount(state, "signups", "2026-10-01", "2026-10-31")).toBe(1);
    expect(clearState(state, ["stock"], "2026-01-01", "2026-01-02").stock).toBeUndefined();
  });
});
