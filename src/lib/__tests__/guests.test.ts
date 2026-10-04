import { describe, expect, it } from "vitest";
import { billFor } from "../billing";
import { EMPTY_STATE, guestCheck, prepare, reducer, type State } from "../state";

const D = "2026-10-04";

function setup(): State {
  let s: State = { ...EMPTY_STATE, players: [{ id: "h", name: "โฮสต์", level: 3 }] };
  s = reducer(s, prepare({ type: "setAnnouncement", date: D, message: "มีก๊วน" }));
  s = reducer(s, prepare({ type: "checkIn", date: D, playerId: "h" }, 1));
  s = reducer(s, prepare({ type: "addGuest", date: D, hostId: "h", name: "เพื่อน", level: 2 }, 2, () => "g"));
  return s;
}

describe("แขก", () => {
  it("เพิ่มแขกแล้วเช็คอินให้ทันที", () => {
    const s = setup();
    expect(s.players.find((p) => p.id === "g")).toMatchObject({ guestOf: "h", level: 2 });
    expect(s.days[0].checkIns.map((c) => c.playerId)).toEqual(["h", "g"]);
  });

  it("ค่าใช้จ่ายของแขกรวมในบิลคนพามา และจ่ายครั้งเดียวปิดทั้งคู่", () => {
    let s = setup();
    s = reducer(s, prepare({ type: "addDrink", date: D, playerId: "g", amount: 15, note: "น้ำ" }));
    const host = s.players[0];
    const bill = billFor(s.days, s.days[0], host, s.settings, s.monthly, s.players);
    expect(bill.guests).toEqual([{ playerId: "g", name: "เพื่อน", amount: 40 + 15 }]);
    expect(bill.total).toBe(40 + 40 + 15);
    s = reducer(s, prepare({ type: "markPaid", date: D, playerId: "h" }, 9));
    expect(s.days[0].checkIns.every((c) => c.paidAt === 9)).toBe(true);
    expect(billFor(s.days, s.days[0], host, s.settings, s.monthly, s.players)).toMatchObject({ paid: true, total: 95, guests: [{ playerId: "g", name: "เพื่อน", amount: 55 }] });
    s = reducer(s, prepare({ type: "unmarkPaid", date: D, playerId: "h" }));
    expect(s.days[0].checkIns.every((c) => !c.paidAt)).toBe(true);
  });

  it("ยกเลิกจ่ายแล้วยอดค้างวันก่อนกลับมาด้วย แต่วันที่จ่ายไปแล้วก่อนหน้าไม่ถูกเปิด", () => {
    const P = "2026-10-01", Q = "2026-10-02";
    let s: State = { ...EMPTY_STATE, players: [{ id: "h", name: "โฮสต์", level: 3 }] };
    for (const d of [P, Q, D]) s = reducer(s, prepare({ type: "checkIn", date: d, playerId: "h" }, 1));
    s = reducer(s, prepare({ type: "markPaid", date: P, playerId: "h" }, 5));
    s = reducer(s, prepare({ type: "markPaid", date: D, playerId: "h" }, 9));
    s = reducer(s, prepare({ type: "unmarkPaid", date: D, playerId: "h" }));
    const paid = (d: string) => s.days.find((x) => x.date === d)!.checkIns[0].paidAt;
    expect([paid(P), paid(Q), paid(D)]).toEqual([5, undefined, undefined]);
  });

  it("จ่ายรายเดือนเองแล้วไม่คิดค่าสนามวันนี้", () => {
    let s = setup();
    s = reducer(s, prepare({ type: "setMonthlyPaid", month: "2026-10", playerId: "h", paid: true }, 5));
    expect(billFor(s.days, s.days[0], s.players[0], s.settings, s.monthly, s.players).total).toBe(40);
  });

  it("พาแขกได้ไม่เกิน 3 คน และแขกพาแขกต่อไม่ได้", () => {
    let s = setup();
    expect(guestCheck(s, D, "g", "x")).toBe("คำสั่งไม่ถูกต้อง");
    s = reducer(s, prepare({ type: "addGuest", date: D, hostId: "h", name: "2", level: 3 }));
    s = reducer(s, prepare({ type: "addGuest", date: D, hostId: "h", name: "3", level: 3 }));
    expect(guestCheck(s, D, "h", "4")).toBe("พาแขกได้ไม่เกิน 3 คนต่อวัน");
    expect(guestCheck(s, "2026-10-05", "h", "4")).toBe("วันนี้ยังไม่มีประกาศจัดก๊วน");
  });
});

describe("สมัครเอง", () => {
  it("แอดมินอนุมัติแล้วไม่ค้างสถานะรอ", () => {
    let s = reducer(EMPTY_STATE, prepare({ type: "addPlayer", player: { name: "ใหม่", level: 1, pending: true } }, 1, () => "n"));
    expect(s.players[0].pending).toBe(true);
    s = reducer(s, prepare({ type: "updatePlayer", player: { ...s.players[0], level: 3, pending: false } }));
    expect(s.players[0]).toMatchObject({ level: 3, pending: false });
  });
});
