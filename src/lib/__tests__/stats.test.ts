import { describe, expect, it } from "vitest";
import { EMPTY_STATE, type State } from "../state";
import { monthSummary } from "../stats";
import type { Player } from "../types";

const me: Player = { id: "a", name: "เอ", level: 3 };

describe("monthSummary", () => {
  it("นับเกม ชนะ ค่าใช้จ่าย และคู่ที่เล่นด้วยบ่อย", () => {
    const state: State = {
      ...EMPTY_STATE,
      players: [me],
      days: [
        {
          date: "2026-10-04",
          checkIns: [{ playerId: "a", at: 0, paidAt: 1 }],
          games: [
            { id: "1", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 0, endedAt: 1, shuttles: 2, winner: "A" },
            { id: "2", court: 1, playerIds: ["c", "d", "b", "a"], startedAt: 2, endedAt: 3, shuttles: 1, winner: "A" },
            { id: "3", court: 1, playerIds: ["a", "c", "b", "d"], startedAt: 4, endedAt: 5, shuttles: 1 },
          ],
          drinks: [{ id: "x", playerId: "a", amount: 15, note: "" }],
        },
        { date: "2026-09-30", checkIns: [{ playerId: "a", at: 0 }], games: [], drinks: [] },
      ],
    };
    const s = monthSummary(state, me, "2026-10");
    expect(s).toMatchObject({ days: 1, games: 3, decided: 2, wins: 1, winRate: 50, shuttles: 4 });
    // ค่าสนาม 40 + ลูก 30 + 25×3 + น้ำ 15
    expect(s.spent).toBe(40 + 30 + 75 + 15);
    expect(s.topPartner).toEqual({ id: "b", games: 2 });
  });

  it("สมาชิกรายเดือนนับค่าสมาชิกแทนค่าสนาม", () => {
    const state: State = {
      ...EMPTY_STATE,
      players: [me],
      monthly: { "2026-10": { a: 1 } },
      days: [{ date: "2026-10-04", checkIns: [{ playerId: "a", at: 0 }], games: [], drinks: [] }],
    };
    expect(monthSummary(state, me, "2026-10").spent).toBe(150);
  });
});
