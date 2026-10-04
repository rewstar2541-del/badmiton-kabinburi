import { describe, expect, it } from "vitest";
import { monthReport } from "../report";
import { EMPTY_STATE, type State } from "../state";

describe("monthReport", () => {
  it("แยกรายวัน รายคน และรวมค่าสมาชิกรายเดือนเป็นรายรับ", () => {
    const state: State = {
      ...EMPTY_STATE,
      players: [
        { id: "a", name: "เอ", level: 3 },
        { id: "b", name: "บี", level: 3 },
      ],
      monthly: { "2026-10": { b: 5 } },
      expenses: [
        { id: "e1", date: "2026-10-01", category: "court", amount: 200, note: "" },
        { id: "e2", date: "2026-10-04", category: "shuttle", amount: 30, note: "" },
        { id: "e3", date: "2026-09-30", category: "other", amount: 999, note: "" },
      ],
      days: [
        {
          date: "2026-10-04",
          checkIns: [
            { playerId: "a", at: 0, paidAt: 9 },
            { playerId: "b", at: 0 },
          ],
          games: [{ id: "g", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 0, endedAt: 1, shuttles: 2 }],
          drinks: [{ id: "x", playerId: "b", amount: 15, note: "" }],
        },
        { date: "2026-09-30", checkIns: [{ playerId: "a", at: 0 }], games: [], drinks: [] },
      ],
    };
    const r = monthReport(state, "2026-10");
    expect(r.days).toHaveLength(1);
    // เอ: 40 + 30 + 25 = 95 จ่ายแล้ว, บี (รายเดือน): 0 + 55 + 15 = 70 ค้าง
    expect(r.days[0]).toMatchObject({ players: 2, games: 1, shuttles: 2, courtFee: 40, total: 165, received: 95, unpaid: 70 });
    expect(r.players.map((p) => [p.name, p.total, p.monthly])).toEqual([
      ["บี", 70, true],
      ["เอ", 95, false],
    ]);
    expect(r.totals).toMatchObject({ monthlyFees: 150, income: 95 + 150, expenses: 230, profit: 245 - 230 });
    expect(r.expenseBy).toEqual({ court: 200, shuttle: 30, other: 0 });
  });
});
