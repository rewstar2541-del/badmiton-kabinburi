import { describe, expect, it } from "vitest";
import { billFor, datesToFreeze, markPaid, shuttleFee } from "../billing";
import { prepare, reducer, EMPTY_STATE, type State } from "../state";
import { DEFAULT_SETTINGS as S, addYears, annualStatus, type Day, type Game, type MonthlyPayments, type Player } from "../types";

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

describe("แก้ราคา", () => {
  it("เปลี่ยนราคาแล้ว บิลวันก่อนๆ คงราคาเดิม วันนี้ใช้ราคาใหม่", () => {
    const old = day("2026-10-03", [game("g1", 2)]);
    const now = day("2026-10-04", [game("g2", 2)]);
    let st = { ...EMPTY_STATE, players: [daily, monthly], days: [old, now] };
    expect(datesToFreeze(st.days, "2026-10-04")).toEqual(["2026-10-03"]);
    const next = { ...S, courtFee: 50, firstShuttleFee: 40, nextShuttleFee: 30 };
    st = reducer(st, prepare({ type: "updateSettings", settings: next, freeze: { dates: ["2026-10-03"], prices: S } }));
    const [d3, d4] = st.days;
    // 40 + 30 + 25 + 15
    expect(billFor([d3], d3, daily, st.settings, {}).total).toBe(110);
    // 50 + 40 + 30 + 15
    expect(billFor([d4], d4, daily, st.settings, {}).total).toBe(135);
  });

  it("แอดมินแก้ค่าสนาม / ค่าลูกของคนเดียว แล้วคืนค่าปกติได้", () => {
    const d = day("2026-10-04", [game("g1", 2)]);
    let st = { ...EMPTY_STATE, players: [daily, monthly], days: [d] };
    st = reducer(st, prepare({ type: "setBillFees", date: d.date, playerId: "d", courtFee: 0, shuttleFee: 20 }));
    let b = billFor(st.days, st.days[0], daily, S, {});
    expect([b.courtFee, b.shuttleFee, b.total, b.shuttleAdjusted]).toEqual([0, 20, 35, true]);
    // คนอื่นไม่เปลี่ยน
    expect(billFor(st.days, st.days[0], monthly, S, M).shuttleFee).toBe(55);
    st = reducer(st, prepare({ type: "setBillFees", date: d.date, playerId: "d", courtFee: null, shuttleFee: null }));
    b = billFor(st.days, st.days[0], daily, S, {});
    expect([b.courtFee, b.shuttleFee, b.courtAdjusted]).toEqual([40, 55, false]);
  });

  it("แก้ราคาค่าน้ำ และลบสลิป", () => {
    const d = { ...day("2026-10-04", []), slips: [{ id: "s1", playerId: "d", amount: 55, at: 1 }] };
    let st: State = { ...EMPTY_STATE, players: [daily], days: [d] };
    st = reducer(st, prepare({ type: "editDrink", date: d.date, drinkId: "w", amount: 20, note: "น้ำ" }));
    expect(st.days[0].drinks[0].amount).toBe(20);
    st = reducer(st, prepare({ type: "removeSlip", date: d.date, slipId: "s1" }));
    expect(st.days[0].slips).toEqual([]);
  });
});

describe("ล้างประวัติ", () => {
  it("ลบกิจกรรมทั้งหมด เก็บผู้เล่น ตั้งค่า วันงดเล่น และวันจัดก๊วนหลังวันนี้", () => {
    const guest: Player = { id: "g", name: "แขก", level: 1, guestOf: "d" };
    const past = { ...day("2026-10-04", [game("g1", 2)]), announcement: "วันนี้" };
    const future = { date: "2026-10-10", checkIns: [], games: [], drinks: [], announcement: "", signups: [{ playerId: "d", at: 1 }] };
    let st: State = { ...EMPTY_STATE, players: [daily, monthly, guest], days: [past, future], monthly: M, closed: { "2026-10-11": "ปิด" } };
    st = reducer(st, prepare({ type: "clearHistory", today: "2026-10-04" }));
    expect(st.players.map((p) => p.id)).toEqual(["d", "m"]);
    expect(st.monthly).toEqual({});
    expect(st.closed).toEqual({ "2026-10-11": "ปิด" });
    expect(st.days).toEqual([{ date: "2026-10-10", checkIns: [], games: [], drinks: [], announcement: "" }]);
  });
});

describe("บั๊กที่แก้", () => {
  it("ยังไม่เช็คอิน ไม่คิดค่าสนาม", () => {
    const d: Day = { date: "2026-10-04", checkIns: [], games: [], drinks: [] };
    expect(billFor([d], d, daily, S, {}).total).toBe(0);
  });
});

describe("เก็บราคาเดิมของวันนี้ถ้ามีคนจ่ายแล้ว", () => {
  it("วันนี้มีคนจ่ายแล้ว ราคาใหม่เริ่มพรุ่งนี้", () => {
    expect(datesToFreeze([day("2026-10-04", [], true)], "2026-10-04")).toEqual(["2026-10-04"]);
    expect(datesToFreeze([day("2026-10-04", [])], "2026-10-04")).toEqual([]);
  });
});

describe("สมาชิกรายปี", () => {
  const day: Day = { date: "2026-10-10", checkIns: [{ playerId: "a", at: 1 }], games: [], drinks: [] };
  const base = { id: "a", name: "ก", level: 3 as const };
  it("ไม่คิดค่าสนามในช่วงสมาชิก คิดอีกครั้งเมื่อหมดอายุ", () => {
    const m = { ...base, annualFrom: "2026-01-01", annualUntil: "2026-10-10" };
    expect(billFor([day], day, m, S, {})).toMatchObject({ courtFee: 0, annualMember: true });
    expect(billFor([day], day, { ...m, annualUntil: "2026-10-09" }, S, {})).toMatchObject({ courtFee: 40, annualMember: false });
  });
  it("วันหมดอายุตั้งเองได้ และบวกปีไม่ล้นเดือน", () => {
    expect(addYears("2026-01-01", 1)).toBe("2027-01-01");
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
  });
  it("สถานะใกล้หมดอายุ", () => {
    expect(annualStatus({ annualUntil: "2026-10-30" }, "2026-10-10")?.kind).toBe("soon");
    expect(annualStatus({ annualUntil: "2027-10-10" }, "2026-10-10")?.kind).toBe("active");
    expect(annualStatus({ annualUntil: "2026-10-01" }, "2026-10-10")?.kind).toBe("expired");
    expect(annualStatus({}, "2026-10-10")).toBeUndefined();
  });
});

describe("ต่ออายุสมาชิกรายปี", () => {
  it("ตรึงค่าสนามวันเก่าที่หลุดจากช่วงใหม่ ไม่ให้บิลย้อนหลังเปลี่ยน", () => {
    const old: Day = { date: "2026-03-01", checkIns: [{ playerId: "a", at: 1 }], games: [], drinks: [] };
    const st: State = { ...EMPTY_STATE, players: [{ id: "a", name: "ก", level: 3, annualFrom: "2026-01-01", annualUntil: "2026-12-31" }], days: [old] };
    const next = reducer(st, { type: "recordAnnual", playerId: "a", paidOn: "2027-02-01", from: "2027-02-01", until: "2028-02-01", amount: 1, _id: "x", prev: { from: "2026-01-01", until: "2026-12-31" } });
    const p = next.players[0];
    expect(billFor(next.days, next.days[0], p, S, {}).courtFee).toBe(0);
    expect(next.annualPayments).toHaveLength(1);
  });
  it("ลบรายการจ่ายได้", () => {
    const st: State = { ...EMPTY_STATE, annualPayments: [{ id: "x", playerId: "a", paidOn: "2026-01-01", from: "2026-01-01", until: "2027-01-01", amount: 1 }] };
    expect(reducer(st, { type: "removeAnnualPayment", id: "x" }).annualPayments).toEqual([]);
  });
});
