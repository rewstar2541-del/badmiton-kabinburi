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

describe("สนามเช่า: จำนวนคอร์ทไม่เท่ากันแต่ละชั่วโมง", () => {
  it("19-20 4 คอร์ท 20-22 5 คอร์ท คอร์ทละ 200 หารตามชั่วโมงที่อยู่", async () => {
    const { rentShares, rentTotal, normalizeCourts } = await import("../courtSplit");
    const at = (h: number) => Date.parse(`2026-11-01T${String(h).padStart(2, "0")}:05:00+07:00`);
    const rent = { start: 19, end: 22, perHour: 200, courts: [4, 5, 5] };
    expect(rentTotal(rent)).toBe(2800);
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    // 8 คนอยู่ตั้งแต่ 19:00 อีก 2 คนมา 20:00
    const out = rentShares(rent, [...ids.map((id) => ({ playerId: id, at: at(19) })), { playerId: "x", at: at(20) }, { playerId: "y", at: at(20) }]);
    expect(out.get("p0")).toBe(100 + 100 + 100);
    expect(out.get("x")).toBe(200);
    expect([...out.values()].reduce((a, b) => a + b, 0)).toBe(2800);
    expect(normalizeCourts(19, 22, [1, 1, 1])).toBeUndefined();
    expect(normalizeCourts(19, 23, [4, 5])).toEqual([4, 5, 5, 5]);
  });
});

import { clock as clk, rentShares as shares2, rentSpan as span2 } from "../courtSplit";
import { describe as d2, expect as e2, it as i2 } from "vitest";
d2("สนามเช่าเริ่มไม่ตรงชั่วโมง", () => {
  i2("18:30-20:30 ปัดช่วงเวลาและหารถูก", () => {
    const rent = { start: 18.5, end: 20.5, perHour: 200 };
    e2(clk(18.5)).toBe("18:30");
    e2(clk(18.25)).toBe("18:15");
    e2(span2(rent, 0, { from: 19, to: 20.5 })).toEqual({ from: 19, to: 20.5 });
    e2(span2(rent, 0, { from: 18, to: 20 })).toEqual({ from: 18.5, to: 20 });
    const s = shares2(rent, [
      { playerId: "a", at: 0, hours: { from: 18.5, to: 20.5 } },
      { playerId: "b", at: 0, hours: { from: 19.5, to: 20.5 } },
    ]);
    e2(s.get("a")).toBe(300);
    e2(s.get("b")).toBe(100);
    e2(shares2({ start: 18.5, end: 19.25, perHour: 200 }, [{ playerId: "x", at: 0, hours: { from: 18.5, to: 19.25 } }]).get("x")).toBe(150);
  });
});

d2("เวลาระดับนาที", () => {
  i2("19:01 เริ่ม หารตามนาทีจริงและรวมเท่าค่าเช่า", () => {
    const rent = { start: 19 + 1 / 60, end: 21, perHour: 600 };
    const s = shares2(rent, [
      { playerId: "a", at: 0, hours: { from: 19 + 1 / 60, to: 21 } },
      { playerId: "b", at: 0, hours: { from: 20, to: 21 } },
    ]);
    e2((s.get("a") ?? 0) + (s.get("b") ?? 0)).toBe(Math.round(600 * (59 / 60) + 600));
    e2(s.get("b")).toBe(300);
    e2(clk(19 + 1 / 60)).toBe("19:01");
  });
});

describe("สนามเช่าหารเท่ากัน (ตั้งแต่ 16 พ.ย. 2026)", () => {
  // 16 พ.ย.: 19-22 น. คอร์ทละ 200 (4,4,5 คอร์ท) = 2,600 บาท · 5 คนเช็คอิน 19:5x อีก 20 คนเช็คอินหลัง 20:00
  const rent = { start: 19, end: 22, perHour: 200, courts: [4, 4, 5] };
  const at = (m: number) => Date.parse("2026-11-16T19:00:00+07:00") + m * 60_000;
  const mins = [50, 51, 51, 52, 52, ...Array.from({ length: 20 }, (_, i) => 62 + i)];
  const checkIns = mins.map((m, i) => ({ playerId: `p${i}`, at: at(m) }));

  it("ทุกคนจ่ายเท่ากัน ไม่ว่าเช็คอินกี่โมง", async () => {
    const { rentSharesFor } = await import("../courtSplit");
    const out = rentSharesFor("2026-11-16", rent, checkIns);
    expect(new Set(out.values())).toEqual(new Set([104]));
    expect(out.size).toBe(25);
  });

  it("เวลามา-กลับที่ตั้งไว้ไม่มีผล คนแก้ยอดเองไม่นับ", async () => {
    const { rentSharesFor } = await import("../courtSplit");
    const out = rentSharesFor("2026-11-20", { start: 19, end: 21, perHour: 300 }, [
      { playerId: "a", at: at(0), hours: { from: 19, to: 20 } },
      { playerId: "b", at: at(90) },
      { playerId: "coach", at: at(0), courtFee: 0 },
    ]);
    expect(out.get("a")).toBe(300);
    expect(out.get("b")).toBe(300);
    expect(out.has("coach")).toBe(false);
  });

  it("วันก่อนหน้ายังหารตามชั่วโมงแบบเดิม ยอดที่เก็บไปแล้วไม่เปลี่ยน", async () => {
    const { rentSharesFor } = await import("../courtSplit");
    const out = rentSharesFor("2026-11-08", rent, checkIns);
    expect(out.get("p0")).toBe(232);
    expect(out.get("p5")).toBe(72);
  });

  it("บิลวันนี้ใช้ยอดหารเท่ากัน", async () => {
    const { dayAmount } = await import("../billing");
    const day = { date: "2026-11-16", rent, checkIns, games: [], drinks: [] };
    const player = { id: "p0", name: "A" } as unknown as Parameters<typeof dayAmount>[1];
    const s = { courtFee: 50, firstShuttleFee: 0, nextShuttleFee: 0 } as unknown as Parameters<typeof dayAmount>[2];
    expect(dayAmount(day as unknown as Parameters<typeof dayAmount>[0], player, s, {} as Parameters<typeof dayAmount>[3]).courtFee).toBe(104);
  });
});
