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
