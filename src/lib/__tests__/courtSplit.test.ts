import { describe, expect, it } from "vitest";
import { splitByHour, type Span } from "../courtSplit";

describe("หารค่าสนามตามชั่วโมง", () => {
  it("คนมา 1 ทุ่มจ่ายชั่วโมงแรกเพิ่ม คนมา 2 ทุ่มหารเฉพาะชั่วโมงหลัง", () => {
    const spans = new Map<string, Span>([
      ["early", { from: 19, to: 21 }],
      ["late", { from: 20, to: 21 }],
    ]);
    const out = splitByHour(spans, 19, 21, 400);
    expect(out.get("early")).toBe(600);
    expect(out.get("late")).toBe(200);
  });

  it("คนที่ไม่หารไม่มียอด และปัดเป็นบาท", () => {
    const spans = new Map<string, Span>([
      ["a", { from: 19, to: 20 }],
      ["b", { from: 19, to: 20 }],
      ["c", { from: 19, to: 20 }],
      ["skip", null],
    ]);
    const out = splitByHour(spans, 19, 20, 100);
    expect(out.get("a")).toBe(33);
    expect(out.has("skip")).toBe(false);
  });
});

describe("สนามเช่าในบิล", () => {
  it("ค่าเริ่มต้นตามชั่วโมงที่เช็คอิน (เวลาไทย) และคนแก้ยอดเองไม่นับ", async () => {
    const { rentShares } = await import("../courtSplit");
    const at = (h: number) => Date.parse(`2026-10-31T${String(h).padStart(2, "0")}:10:00+07:00`);
    const rent = { start: 19, end: 21, perHour: 400 };
    const out = rentShares(rent, [
      { playerId: "early", at: at(19) },
      { playerId: "late", at: at(20) },
      { playerId: "coach", at: at(19), courtFee: 0 },
    ]);
    expect(out.get("early")).toBe(600);
    expect(out.get("late")).toBe(200);
    expect(out.has("coach")).toBe(false);
  });
});

describe("สนามเช่า: จ่ายแล้วยอดไม่เปลี่ยน", () => {
  it("คนที่จ่ายก่อนคนอื่นมา ยอดคงที่ตามตอนจ่าย", async () => {
    const { dayAmount } = await import("../billing");
    const { DEFAULT_SETTINGS } = await import("../types");
    const at = (h: number, m = 10) => Date.parse(`2026-10-31T${String(h).padStart(2, "0")}:${m}:00+07:00`);
    const player = (id: string) => ({ id, name: id, level: "N" as never, gender: "male" as const });
    const day = {
      date: "2026-10-31",
      games: [],
      drinks: [],
      rent: { start: 19, end: 21, perHour: 400 },
      checkIns: [
        { playerId: "a", at: at(19), paidAt: at(19, 30), hours: { from: 19, to: 20 } },
        { playerId: "b", at: at(19, 40), hours: { from: 19, to: 21 } },
      ],
    };
    // a จ่ายตอนอยู่คนเดียว: ชั่วโมงแรกเต็ม 400 / b มาทีหลัง: ชั่วโมงแรก 200 + ชั่วโมงสอง 400
    expect(dayAmount(day as never, player("a") as never, DEFAULT_SETTINGS, {}).courtFee).toBe(400);
    expect(dayAmount(day as never, player("b") as never, DEFAULT_SETTINGS, {}).courtFee).toBe(600);
  });
});
