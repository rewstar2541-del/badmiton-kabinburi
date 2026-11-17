import { describe, expect, it } from "vitest";
import { courtPlan, DEFAULT_STRONG, nextMatch, strongRule } from "../matchmaking";
import type { Day, Game, Level, Player } from "../types";

const p = (id: string, level: Level): Player => ({ id, name: id, level });
const MIN = 60_000;
const T = 1_000 * MIN; // เวลาจบเกมแรก
const game = (id: string, ids: string[], start: number, end?: number): Game => ({
  id, court: 1, playerIds: ids as Game["playerIds"], startedAt: start, endedAt: end, shuttles: 1,
});
const dayWith = (players: Player[], games: Game[] = []): Day => ({
  date: "2026-11-17",
  checkIns: players.map((pl, i) => ({ playerId: pl.id, at: i })),
  games,
  drinks: [],
});
const sorted = (m: readonly string[] | null) => [...(m ?? [])].sort();

describe("มือตึงล้วน (หลังบ้าน)", () => {
  it("ตั้งแต่เกมที่ 2 มือตึงลงด้วยกันทั้ง 4 คน แม้คิวสลับกับคนระดับ N", () => {
    const ps = [p("a", 4), p("e", 3), p("b", 4), p("f", 3), p("c", 4), p("g", 3), p("d", 4), p("h", 3)];
    // เกมแรก (วอร์ม) ลงปนกับ N ได้
    const d = dayWith(ps, [game("g1", ["a", "e", "b", "f"], T - 15 * MIN, T), game("g2", ["c", "g", "d", "h"], T - 15 * MIN, T)]);
    expect(sorted(nextMatch(d, ps, 12, [], { now: T + MIN }))).toEqual(["a", "b", "c", "d"]);
    // ปิดกติกา: กลับไปจับตามคิวปกติ (ไม่ใช่มือตึงล้วน)
    expect(sorted(nextMatch(d, ps, 12, [], { strong: null, now: T + MIN }))).not.toEqual(["a", "b", "c", "d"]);
  });

  it("มือตึงไม่ครบ 4 รอก่อน ไม่ดึง N มาลง จนรอเกิน 10 นาทีถึงลงกับระดับต่ำลงมาได้", () => {
    const ps = [p("c", 4), p("d", 4), p("g", 3), p("h", 3), p("a", 4), p("b", 4), p("e", 3), p("f", 3)];
    // a b ลงเกมแรกกับ e f แล้ว (ต่อไปเป็นเกมที่ 2 ต้องมือตึงล้วน) c d ยังไม่ได้ลง (เกมวอร์ม)
    const d = dayWith(ps, [game("g1", ["a", "b", "e", "f"], T - 15 * MIN, T)]);
    const soon = courtPlan(d, ps, 2, undefined, true, false, { now: T + MIN });
    const all = [...soon.values()].map((n) => sorted(n.playerIds));
    // สนามแรก: c d g h (วอร์ม ลงกับ N ได้) สนามที่สองไม่จัด a b ลงกับ e f
    expect(all).toEqual([["c", "d", "g", "h"]]);
    // รอเกิน 10 นาทีแล้ว: a b ลงกับ e f ได้ (ห่าง 1 ระดับตามเพดานปกติ)
    const later = courtPlan(d, ps, 2, undefined, true, false, { now: T + 11 * MIN });
    expect([...later.values()].map((n) => sorted(n.playerIds))).toContainEqual(["a", "b", "e", "f"]);
  });

  it("เกมวอร์ม: มือตึงเลี่ยงเจอคนที่เก่งกว่า ได้ลงกับระดับเดียวกันหรือต่ำลงมา", () => {
    const ps = [p("s", 4), p("v", 5), p("w", 5), p("x", 5), p("n1", 3), p("n2", 3), p("n3", 3)];
    expect(sorted(nextMatch(dayWith(ps), ps, 12, [], { now: T }))).toEqual(["n1", "n2", "n3", "s"]);
    // ปิดกติกา: ได้ลงกับ P ที่อยู่ต้นคิว
    expect(sorted(nextMatch(dayWith(ps), ps, 12, [], { strong: null, now: T }))).toEqual(["s", "v", "w", "x"]);
  });

  it("มือตึง 5 คน: คนที่ไม่ได้ลงวนกันไป ไม่ใช่คนเดิม และรอบถัดไปได้ลงก่อน", () => {
    const ps = ["a", "b", "c", "d", "e"].map((id) => p(id, 4));
    const d = dayWith(ps);
    const out: string[] = [];
    let t = T;
    for (let r = 0; r < 5; r++) {
      const m = nextMatch(d, ps, 12, [], { now: t })!;
      expect(m).not.toBeNull();
      const left = ps.map((x) => x.id).find((id) => !m.includes(id))!;
      // คนที่ไม่ได้ลงรอบก่อน ได้ลงรอบนี้
      if (out.length) expect(m).toContain(out.at(-1));
      out.push(left);
      d.games.push(game(`g${r}`, m, t, t + 12 * MIN));
      t += 12 * MIN;
    }
    expect(new Set(out).size).toBe(5);
  });

  it("ค่าตั้งค่า: ไม่มีค่า = ค่าเริ่มต้น, ปิด = ไม่ใช้กติกา", () => {
    expect(strongRule({})).toEqual(DEFAULT_STRONG);
    expect(strongRule({ strongGroup: { on: false, level: 5, fromGame: 3, waitMin: 15 } })).toBeNull();
    expect(strongRule({ strongGroup: { on: true, level: 5, fromGame: 3, waitMin: 15 } })).toEqual({ level: 5, fromGame: 3, waitMin: 15 });
  });

  it("ระดับ P ล้วน: P เกมที่ 2 ไม่ลงกับ S จนรอเกินเวลา", () => {
    const ps = [p("v", 5), p("w", 5), p("s1", 4), p("s2", 4), p("s3", 4), p("s4", 4)];
    const d = dayWith(ps, [game("g1", ["v", "w", "s1", "s2"], T - 15 * MIN, T)]);
    const rule = { level: 5 as Level, fromGame: 2, waitMin: 10 };
    // S ลงกันเองได้ แต่ P (v w) ยังไม่ลงกับ S
    expect(sorted(nextMatch(d, ps, 12, [], { strong: rule, now: T + MIN }))).toEqual(["s1", "s2", "s3", "s4"]);
    // รอเกิน 10 นาที: P ลงกับ S ได้ (ห่าง 1 ระดับ)
    const after = { ...d, checkIns: d.checkIns.filter((c) => !["s3", "s4"].includes(c.playerId)) };
    expect(nextMatch(after, ps, 12, [], { strong: rule, now: T + MIN })).toBeNull();
    expect(sorted(nextMatch(after, ps, 12, [], { strong: rule, now: T + 11 * MIN }))).toEqual(["s1", "s2", "v", "w"]);
  });
});
