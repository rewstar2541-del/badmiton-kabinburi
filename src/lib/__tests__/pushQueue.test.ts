import { describe, expect, it } from "vitest";
import { bangkokDate, turnSoon } from "../pushQueue";
import type { Day, Player } from "../types";

const players: Player[] = "abcdefghijkl".split("").map((id) => ({ id, name: id, level: 3 }));
const date = "2026-11-07";
const settings = { courtCount: 2, courtNumbers: [] };

function day(extra: Partial<Day> = {}): Day {
  return { date, checkIns: players.map((p, i) => ({ playerId: p.id, at: i })), games: [], drinks: [], ...extra };
}
const g1 = { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"] as [string, string, string, string], startedAt: 10, shuttles: 1 };

describe("แจ้งเตือนอีก 1 เกมถึงคิว", () => {
  it("ไม่มีเกมเล่นอยู่ = ยังไม่แจ้ง (สนามว่าง ลงได้เลย ไม่ใช่อีก 1 เกม)", () => {
    expect(turnSoon(day(), players, settings)).toEqual([]);
  });

  it("แจ้งคู่ถัดไปของสนามที่มีเกมเล่นอยู่ พร้อมเบอร์สนาม", () => {
    const res = turnSoon(day({ games: [g1] }), players, settings);
    const court1 = res.filter((r) => r.court === 1);
    expect(court1).toHaveLength(4);
    expect(court1.every((r) => !["a", "b", "c", "d"].includes(r.playerId))).toBe(true);
    // สนาม 2 ว่างอยู่: คนที่รอสนาม 2 ลงได้เลย ไม่ต้องแจ้ง "อีก 1 เกม"
    expect(res.some((r) => r.court === 2)).toBe(false);
  });

  it("คิวที่แอดมินจัดเองใช้คู่แรกของสนามนั้น และข้ามคนที่ขอพัก", () => {
    const d = day({ games: [g1], queued: [{ id: "q1", court: 1, playerIds: ["i", "j", "k", "l"], at: 1 }] });
    d.checkIns = d.checkIns.map((c) => (c.playerId === "k" ? { ...c, resting: true } : c));
    const res = turnSoon(d, players, settings);
    expect(res.map((r) => r.playerId).sort()).toEqual(["i", "j", "l"]);
    expect(res.every((r) => r.court === 1)).toBe(true);
  });

  it("กันส่งซ้ำนับตามตา: เล่นจบไป 1 เกมแล้ว ตาถัดไปได้คีย์ใหม่", () => {
    const done = { ...g1, id: "g0", playerIds: ["i", "j", "k", "l"] as [string, string, string, string], endedAt: 9 };
    const d = day({ games: [done, g1], queued: [{ id: "q1", court: 1, playerIds: ["i", "j", "k", "l"], at: 1 }] });
    expect(turnSoon(d, players, settings).find((r) => r.playerId === "i")?.key).toBe("turn:1:1");
    expect(turnSoon(day({ games: [g1], queued: [{ id: "q1", court: 1, playerIds: ["i", "j", "k", "l"], at: 1 }] }), players, settings)[0].key).toBe("turn:0:1");
  });

  it("วันที่ตามเวลาไทย", () => {
    expect(bangkokDate(Date.parse("2026-11-06T18:30:00Z"))).toBe("2026-11-07");
    expect(bangkokDate(Date.parse("2026-11-06T16:30:00Z"))).toBe("2026-11-06");
  });
});
