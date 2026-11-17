import { describe, expect, it } from "vitest";
import { demoFresh, demoState, DEMO_VERSION } from "../demo";
import { today } from "../state";
import { autoNext, pendingStart, RELAXED_LEVEL_GAP } from "../matchmaking";
import { courtsOfDay, lastRoundOf, strength } from "../types";

describe("demoState", () => {
  it("ตั้งค่าสนามเหมือนก๊วนจริง: 4 สนาม เบอร์ 1-4 แอดมินจัดเอง เตรียมลงสนาม 20 วินาที รอบสุดท้ายปิด", () => {
    const s = demoState();
    const day = s.days.find((d) => d.date === today())!;
    expect(courtsOfDay(s.settings, day)).toEqual([1, 2, 3, 4]);
    expect(s.settings.autoAssign).toBe(false);
    expect(s.settings.fixedCourt).toBe(false);
    expect(s.settings.startDelay).toBe(20);
    expect(lastRoundOf(s.settings, today())).toBe(false);
  });

  it("เปิดเดโมแล้วเห็นเตรียมลงสนาม: สนาม 1 (บนสุด) เพิ่งจบ คู่ที่จัดไว้นับถอยหลัง 20 วินาที", () => {
    const before = Date.now();
    const s = demoState();
    const day = s.days.find((d) => d.date === today())!;
    expect(day.games.filter((g) => !g.endedAt).map((g) => g.court).sort()).toEqual([2, 3, 4]);
    const p = pendingStart(day, 1, s.settings)!;
    expect(p).not.toBeNull();
    expect(p.startAt! - before).toBeGreaterThanOrEqual(20000);
    expect(p.startAt! - Date.now()).toBeLessThanOrEqual(20000);
    // สนามอื่นไม่มีนับถอยหลัง (สนาม 2 มีคิวแต่ยังเล่นอยู่)
    expect([2, 3, 4].map((c) => pendingStart(day, c, s.settings))).toEqual([null, null, null]);
    expect((day.queued ?? []).map((q) => q.court).sort()).toEqual([1, 2]);
  });

  it("จัดเกมวันนี้ด้วยระบบจริง และไม่มีใครอยู่สองที่พร้อมกัน", () => {
    const s = demoState();
    const day = s.days.find((d) => d.date === today())!;
    expect(day.games.filter((g) => g.endedAt).length).toBeGreaterThanOrEqual(12);
    const busy = [...day.games.filter((g) => !g.endedAt), ...(day.queued ?? [])].flatMap((g) => g.playerIds);
    expect(new Set(busy).size).toBe(busy.length);
    // มีคนรอลงอยู่ (ให้ลองจัดคู่เอง) และเหลือ 1 คนยังไม่เช็คอิน
    expect(day.checkIns.length).toBe(s.players.length - 1);
    expect(day.checkIns.length - busy.length).toBeGreaterThanOrEqual(4);
  });

  it("รอบสุดท้ายเปิดแล้วกดผลไม่ลงคู่ต่อไป (ใช้ autoNext ตัวจริง)", () => {
    const s = demoState();
    const day = s.days.find((d) => d.date === today())!;
    const g = day.games.find((x) => !x.endedAt && x.court === 2)!;
    expect(autoNext(day, s.players, [1, 2, 3, 4], g, false, false)).not.toBeNull();
    expect(autoNext(day, s.players, [1, 2, 3, 4], g, true, false)).toBeNull();
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

describe("demoFresh", () => {
  it("เดโมรุ่นเก่า ไม่มีข้อมูลรุ่น หรือสร้างวันก่อน ต้องสร้างใหม่", () => {
    expect(demoFresh(null)).toBe(false);
    expect(demoFresh({})).toBe(false);
    expect(demoFresh({ version: DEMO_VERSION - 1, date: today() })).toBe(false);
    expect(demoFresh({ version: DEMO_VERSION, date: "2000-01-01" })).toBe(false);
    expect(demoFresh({ version: DEMO_VERSION, date: today() })).toBe(true);
  });
});
