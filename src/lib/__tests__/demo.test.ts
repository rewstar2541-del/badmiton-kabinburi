import { describe, expect, it } from "vitest";
import { demoState } from "../demo";
import { today } from "../state";
import { RELAXED_LEVEL_GAP } from "../matchmaking";
import { strength } from "../types";

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

  it("ประวัติ 2 วันก่อนหน้ามีเกมจบแล้ววันละ 4 เกม", () => {
    const s = demoState();
    const past = s.days.filter((d) => d.date < today() && d.games.length);
    expect(past.map((d) => d.games.filter((g) => g.endedAt).length)).toEqual([4, 4]);
  });

  it("ทุกเกมและคิวในเดโมห่างกันไม่เกินเพดานผ่อนของระบบจัดคู่จริง (2 ระดับ)", () => {
    const s = demoState();
    const lv = (id: string) => strength(s.players.find((p) => p.id === id)!.level);
    for (const day of s.days)
      for (const g of [...day.games, ...(day.queued ?? [])]) {
        const v = g.playerIds.map(lv);
        expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(RELAXED_LEVEL_GAP);
      }
  });
});
