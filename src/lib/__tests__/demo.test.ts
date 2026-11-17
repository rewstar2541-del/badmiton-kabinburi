import { describe, expect, it } from "vitest";
import { demoState } from "../demo";
import { today } from "../state";

describe("demoState", () => {
  it("จัดเกมวันนี้ด้วยระบบจริง: มีเกมจบแล้ว เกมกำลังเล่น 2 สนาม และคิวรอสนาม 1", () => {
    const s = demoState();
    const day = s.days.find((d) => d.date === today())!;
    expect(day.games.filter((g) => g.endedAt).length).toBe(6);
    expect(day.games.filter((g) => !g.endedAt).map((g) => g.court).sort()).toEqual([1, 2]);
    expect(day.queued?.map((q) => q.court)).toEqual([1]);
    // ไม่มีใครอยู่สองที่พร้อมกัน
    const busy = [...day.games.filter((g) => !g.endedAt), ...(day.queued ?? [])].flatMap((g) => g.playerIds);
    expect(new Set(busy).size).toBe(busy.length);
  });
});
