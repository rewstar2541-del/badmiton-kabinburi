import { describe, expect, it } from "vitest";
import { billFor } from "../billing";
import { monthQualifiers, pointsBalance } from "../loyalty";
import { monthReport } from "../report";
import { EMPTY_STATE, prepare, reducer, type State } from "../state";
import { DEFAULT_LOYALTY as L, DEFAULT_SETTINGS, type Day, type Player } from "../types";

const a: Player = { id: "a", name: "เอ", level: 3 };
const b: Player = { id: "b", name: "บี", level: 3 };
const guest: Player = { id: "g", name: "แขก", level: 3, guestOf: "a" };

/** a มา 8 วันใน ก.ย. b มา 3 วัน แขกมา 8 วัน */
function sept(): Day[] {
  return Array.from({ length: 8 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    checkIns: [{ playerId: "a", at: 0, paidAt: 1 }, ...(i < 3 ? [{ playerId: "b", at: 0, paidAt: 1 }] : []), { playerId: "g", at: 0, paidAt: 1 }],
    games: [],
    drinks: [],
  }));
}

function base(): State {
  return { ...EMPTY_STATE, players: [a, b, guest], settings: { ...DEFAULT_SETTINGS, loyalty: L }, days: sept() };
}

const run = (s: State, ...intents: Parameters<typeof prepare>[0][]) => intents.reduce((st, i) => reducer(st, prepare(i, 1, () => "id-" + Math.random())), s);

describe("คะแนนสะสมความขยัน", () => {
  it("มาครบเดือนได้แต้ม แขกไม่ได้ กดแจกซ้ำไม่เพิ่ม", () => {
    let s = base();
    const q = monthQualifiers(s, "2026-09", L);
    expect(q.map((x) => x.player.id)).toEqual(["a"]);
    s = run(s, { type: "awardPoints", month: "2026-09", playerIds: ["a"], points: L.points }, { type: "awardPoints", month: "2026-09", playerIds: ["a"], points: L.points });
    expect(pointsBalance(s, "a")).toBe(10);
    expect(pointsBalance(s, "b")).toBe(0);
    expect(monthQualifiers(s, "2026-09", L)[0].awarded).toBe(true);
  });

  it("แลกแต้มลดค่าลูก หักแต้มและหักบิล ลดไม่เกินค่าลูก รายงานยอดตรงกัน", () => {
    const date = "2026-10-05";
    let s = base();
    s = { ...s, days: [...s.days, { date, checkIns: [{ playerId: "a", at: 0 }], games: [{ id: "x", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 0, endedAt: 1, shuttles: 1 }], drinks: [] }] };
    s = run(s, { type: "awardPoints", month: "2026-09", playerIds: ["a"], points: 10 }, { type: "redeemPoints", date, playerId: "a", kind: "shuttle", points: 10, amount: 25 });
    expect(pointsBalance(s, "a")).toBe(0);
    const day = s.days.find((d) => d.date === date)!;
    const bill = billFor(s.days, day, a, s.settings, s.monthly);
    // ค่าสนาม 40 + ลูก 30 - ส่วนลด 25
    expect(bill.discount).toBe(25);
    expect(bill.total).toBe(45);
    const r = monthReport(s, "2026-10");
    expect(r.days[0].shuttleFee).toBe(5);
    expect(r.days[0].total).toBe(45);

    // น้ำฟรี แต่ยังไม่มีค่าน้ำ ลดได้ 0
    const s2 = run(s, { type: "redeemPoints", date, playerId: "a", kind: "drink", points: 5, amount: 15 });
    expect(billFor(s2.days, s2.days.find((d) => d.date === date)!, a, s.settings, s.monthly).total).toBe(45);

    // คืนแต้ม
    const id = day.rewards![0].id;
    const s3 = run(s, { type: "removeReward", date, id });
    expect(pointsBalance(s3, "a")).toBe(10);
  });
});
