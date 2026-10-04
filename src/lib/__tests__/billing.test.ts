import { describe, expect, it } from "vitest";
import { billFor, markPaid, shuttleFee } from "../billing";
import { DEFAULT_SETTINGS as S, type Day, type Game, type MonthlyPayments, type Player } from "../types";

const daily: Player = { id: "d", name: "รายวัน", level: 3 };
const monthly: Player = { id: "m", name: "รายเดือน", level: 3 };
/** "m" จ่ายรายเดือนของ ต.ค. 2026 แล้ว */
const M: MonthlyPayments = { "2026-10": { m: 1 } };

function game(id: string, shuttles: number, ids = ["d", "m", "x", "y"]): Game {
  return { id, court: 1, playerIds: ids as Game["playerIds"], startedAt: 0, endedAt: 1, shuttles };
}

function day(date: string, games: Game[], paid = false): Day {
  return {
    date,
    checkIns: [
      { playerId: "d", at: 0, paidAt: paid ? 1 : undefined },
      { playerId: "m", at: 0, paidAt: paid ? 1 : undefined },
    ],
    games,
    drinks: [{ id: "w", playerId: "d", amount: 15, note: "น้ำ" }],
  };
}

describe("billing", () => {
  it("ลูกแรก 30 ลูกต่อไป 25", () => {
    expect(shuttleFee(0, S)).toBe(0);
    expect(shuttleFee(1, S)).toBe(30);
    expect(shuttleFee(5, S)).toBe(130);
  });

  it("ตัวอย่างในเอกสาร: รายวัน 5 ลูก น้ำ 15 = 185, รายเดือน = 130 + น้ำ", () => {
    const d = day("2026-10-04", [game("g1", 2), game("g2", 3)]);
    expect(billFor([d], d, daily, S, M).total).toBe(185);
    const m = billFor([d], d, monthly, S, M);
    expect(m.courtFee).toBe(0);
    expect(m.total).toBe(130);
  });

  it("เช็คอินแต่ไม่ได้เล่น จ่ายแค่ค่าสนาม", () => {
    const d: Day = { date: "2026-10-04", checkIns: [{ playerId: "d", at: 0 }], games: [], drinks: [] };
    expect(billFor([d], d, daily, S, M).total).toBe(40);
  });

  it("ยอดค้างยกมารวมวันถัดไป และจ่ายแล้วปิดทั้งหมด", () => {
    const d1 = day("2026-10-01", [game("g1", 1)]);
    const d2 = day("2026-10-04", [game("g2", 1)]);
    const days = [d1, d2];
    const b = billFor(days, d2, daily, S, M);
    expect(b.carriedOver).toBe(40 + 30 + 15);
    expect(b.total).toBe(2 * 85);

    const after = markPaid(days, "2026-10-04", "d", 99);
    expect(billFor(after, after[1], daily, S, M)).toMatchObject({ carriedOver: 0, paid: true });
    // คนอื่นไม่โดนปิดยอด
    expect(after[1].checkIns.find((c) => c.playerId === "m")?.paidAt).toBeUndefined();
  });

  it("วันที่จ่ายแล้วไม่ถูกยกมา", () => {
    const d1 = day("2026-10-01", [game("g1", 1)], true);
    const d2 = day("2026-10-04", []);
    expect(billFor([d1, d2], d2, daily, S, M).carriedOver).toBe(0);
  });

  it("รายเดือนนับแยกตามเดือน: จ่าย ต.ค. แล้ว แต่ พ.ย. ยังไม่จ่าย ต้องคิดค่าสนาม", () => {
    const oct = day("2026-10-31", []);
    const nov = day("2026-11-01", []);
    expect(billFor([oct], oct, monthly, S, M)).toMatchObject({ courtFee: 0, monthlyMember: true });
    expect(billFor([nov], nov, monthly, S, M)).toMatchObject({ courtFee: 40, monthlyMember: false });
  });

  it("แอดมินยกเลิกสถานะรายเดือน ระบบกลับมาคิดค่าสนาม", () => {
    const d = day("2026-10-04", []);
    expect(billFor([d], d, monthly, S, { "2026-10": {} }).courtFee).toBe(40);
  });
});
