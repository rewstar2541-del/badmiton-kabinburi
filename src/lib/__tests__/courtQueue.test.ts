import { describe, expect, it } from "vitest";
import { autoNext, clubPlan, courtPlan, courtQueue, nextMatch, plannedCourt, queueBlockers, queuedSpot, waitingQueue } from "../matchmaking";
import { reducer, type State, EMPTY_STATE } from "../state";
import type { Day, Player } from "../types";

const players: Player[] = "abcdefghij".split("").map((id) => ({ id, name: id, level: 3 }));
const date = "2026-11-01";

function day(extra: Partial<Day> = {}): Day {
  return { date, checkIns: players.map((p, i) => ({ playerId: p.id, at: i })), games: [], drinks: [], ...extra };
}

describe("คิวรอลงแยกสนาม", () => {
  const playing = { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"] as [string, string, string, string], startedAt: 10, shuttles: 1 };
  const q1 = { id: "q1", court: 1, playerIds: ["e", "f", "g", "h"] as [string, string, string, string], at: 20 };

  it("คนที่จัดคิวสนามไว้แล้ว ไม่อยู่ในคิวรวม และไม่ถูกแนะนำซ้ำ", () => {
    const d = day({ games: [playing], queued: [q1] });
    expect(waitingQueue(d, players).map((e) => e.player.id)).toEqual(["i", "j"]);
    expect(nextMatch(d, players)).toBeNull();
  });

  it("บอกได้ว่าอยู่คิวสนามไหน ลำดับที่เท่าไร", () => {
    const q2 = { ...q1, id: "q2", playerIds: ["i", "j", "a", "b"] as [string, string, string, string], at: 30 };
    const d = day({ queued: [q2, q1] });
    expect(courtQueue(d, 1).map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(queuedSpot(d, "i")).toMatchObject({ court: 1, pos: 2 });
    expect(queuedSpot(d, "c")).toBeNull();
  });

  it("คนในคู่ที่พัก/กลับบ้าน/ยังเล่นสนามอื่น ลงไม่ได้", () => {
    const other = { ...playing, id: "g2", court: 2, playerIds: ["e", "x", "y", "z"] as [string, string, string, string] };
    const d = day({ games: [other], queued: [q1] });
    d.checkIns = d.checkIns.map((c) => (c.playerId === "f" ? { ...c, resting: true } : c.playerId === "g" ? { ...c, paidAt: 1 } : c));
    expect(queueBlockers(d, q1).sort()).toEqual(["e", "f", "g"]);
    // เกมที่กำลังจะจบ ไม่นับว่ายังอยู่บนสนาม
    expect(queueBlockers(d, q1, "g2").sort()).toEqual(["f", "g"]);
  });

  it("ลงสนามจากคิว: เริ่มเกมและเอาคู่นั้นออกจากคิว", () => {
    let s: State = { ...EMPTY_STATE, players, days: [day()] };
    s = reducer(s, { type: "queueGame", date, court: 2, playerIds: q1.playerIds, _id: "q9", _at: 5 });
    expect(s.days[0].queued).toHaveLength(1);
    s = reducer(s, { type: "startGame", date, court: 2, playerIds: q1.playerIds, queuedId: "q9", _id: "g9", _at: 6 });
    expect(s.days[0].queued).toEqual([]);
    expect(s.days[0].games.at(-1)).toMatchObject({ id: "g9", court: 2 });
    s = reducer(s, { type: "queueGame", date, court: 2, playerIds: q1.playerIds, _id: "q10", _at: 7 });
    s = reducer(s, { type: "unqueueGame", date, id: "q10" });
    expect(s.days[0].queued).toEqual([]);
  });
});

describe("แบ่งคิวรวมขึ้นรอแต่ละสนามอัตโนมัติ", () => {
  it("คิว 1-4 รอสนาม 1 คิว 5-8 รอสนาม 2 คนไม่ซ้ำกัน", () => {
    const d = day();
    const plan = courtPlan(d, players, 3);
    const c1 = plan.get(1)!.playerIds;
    const c2 = plan.get(2)!.playerIds;
    expect(c1).toContain("a");
    expect(new Set([...c1, ...c2]).size).toBe(8);
    // เหลือ 2 คน ไม่พอสนาม 3
    expect(plan.has(3)).toBe(false);
    expect(plannedCourt(plan, c2[0])?.court).toBe(2);
  });

  it("สนามที่แอดมินจัดคิวเองใช้คู่นั้น", () => {
    const d = day({ queued: [{ id: "q1", court: 1, playerIds: ["g", "h", "i", "j"], at: 1 }] });
    const plan = courtPlan(d, players, 2);
    expect(plan.get(1)).toMatchObject({ queuedId: "q1" });
    expect(plan.get(2)!.playerIds).toContain("a");
  });

  it("แนะนำใหม่ได้คนชุดใหม่ ไม่วนกลับชุดเดิม", () => {
    const d = day();
    const first = nextMatch(d, players)!;
    const second = nextMatch(d, players, 8, [first])!;
    const third = nextMatch(d, players, 8, [first, second])!;
    const overlap = (x: string[], y: string[]) => x.filter((id) => y.includes(id)).length;
    expect(overlap(first, second)).toBeLessThan(4);
    expect(overlap(second, third)).toBeLessThan(4);
    expect(new Set([...first, ...second, ...third]).size).toBeGreaterThan(6);
  });

  it("ไม่จัดคนที่เพิ่งเล่นด้วยกันมาเจอกันซ้ำถ้าเลี่ยงได้", () => {
    const ended = (id: string, ids: string[], at: number) => ({ id, court: 1, playerIds: ids as [string, string, string, string], startedAt: at, endedAt: at + 1, shuttles: 1 });
    // ทุกคนเล่นมาแล้ว 1 เกม เท่ากัน: a b c d เคยเจอกัน
    const d = day({ games: [ended("g1", ["a", "b", "c", "d"], 100), ended("g2", ["e", "f", "g", "h"], 100), ended("g3", ["i", "j", "a", "e"], 50)] });
    const m = nextMatch(d, players)!;
    expect(m.filter((id) => ["a", "b", "c", "d"].includes(id)).length).toBeLessThan(3);
  });
});

describe("สนามที่จบก่อนได้คนที่รอนานสุด", () => {
  it("สนามว่างได้คิว 1-4 ก่อน และสนามที่กำลังจบได้คู่แรก", () => {
    const g = (id: string, court: number, ids: string[], at: number) => ({ id, court, playerIds: ids as [string, string, string, string], startedAt: at, shuttles: 1 });
    const many: Player[] = "abcdefghijklmnop".split("").map((id) => ({ id, name: id, level: 3 }));
    const d: Day = { date, checkIns: many.map((p, i) => ({ playerId: p.id, at: i })), drinks: [], games: [g("g1", 1, ["m", "n", "o", "p"], 5)] };
    const free = courtPlan(d, many, 2);
    expect(free.get(2)!.playerIds).toContain("a");
    const ending = courtPlan(d, many, 2, 1);
    expect(ending.get(1)!.playerIds).toContain("a");
  });
});

describe("รอบสุดท้าย ไม่ลงคู่ต่อไป", () => {
  const g = { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"] as [string, string, string, string], startedAt: 10, shuttles: 1 };
  const d = day({ games: [g] });

  it("ปกติ: จบเกมแล้วคนที่รออยู่ลงต่อ", () => {
    expect(autoNext(d, players, [1, 2], g)?.playerIds).toHaveLength(4);
  });

  it("รอบสุดท้าย: ไม่ลงต่อ แม้มีคนรอและมีคู่ที่จัดคิวไว้", () => {
    expect(autoNext(d, players, [1, 2], g, true)).toBeNull();
    const q = { id: "q1", court: 1, playerIds: ["e", "f", "g", "h"] as [string, string, string, string], at: 20 };
    expect(autoNext(day({ games: [g], queued: [q] }), players, [1, 2], g, true)).toBeNull();
  });
});

describe("โหมดจัดคนลงอัตโนมัติ ปิด", () => {
  const playing = { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"] as [string, string, string, string], startedAt: 10, shuttles: 1 };
  const q2 = { id: "q2", court: 2, playerIds: ["e", "f", "g", "h"] as [string, string, string, string], at: 20 };

  it("ไม่ดึงคนจากคิวรวมขึ้นรอสนามไหน มีแค่คู่ที่แอดมินจัดไว้เอง", () => {
    const d = day({ games: [playing], queued: [q2] });
    const plan = courtPlan(d, players, [1, 2], undefined, false);
    expect([...plan.keys()]).toEqual([2]);
    expect(plan.get(2)?.queuedId).toBe("q2");
    // ปิด + ไม่มีคิวที่แอดมินจัด = ไม่มีคู่รอสนามไหนเลย (เปิดอยู่จะได้ 1 คู่จากคนรอ 6 คน)
    const free = day({ games: [playing] });
    expect(courtPlan(free, players, [1, 2], undefined, false).size).toBe(0);
    expect(courtPlan(free, players, [1, 2]).size).toBe(1);
  });

  it("เกมจบแล้วไม่ลงคู่จากคิวรวมให้ แต่คู่ที่แอดมินจัดคิวสนามนั้นไว้ยังลงต่อ", () => {
    const d = day({ games: [playing] });
    expect(autoNext(d, players, [1, 2], playing, false, false)).toBeNull();
    expect(autoNext(d, players, [1, 2], playing)).not.toBeNull();
    const q1 = { ...q2, id: "q1", court: 1 };
    expect(autoNext(day({ games: [playing], queued: [q1] }), players, [1, 2], playing, false, false)?.queuedId).toBe("q1");
  });

  it("clubPlan อ่านโหมดจากตั้งค่า (ไม่มีค่า = เปิด)", () => {
    const d = day({ games: [playing] });
    expect(clubPlan(d, players, { courtCount: 2, autoAssign: false }).size).toBe(0);
    expect(clubPlan(d, players, { courtCount: 2 }).size).toBe(1);
  });
});

describe("โหมดรอสนามเดิม (ไม่โยกสนาม)", () => {
  const many: Player[] = "abcdefghijklmnop".split("").map((id) => ({ id, name: id, level: 3 }));
  const g = (id: string, court: number, ids: string[], at: number, endedAt?: number) => ({ id, court, playerIds: ids as [string, string, string, string], startedAt: at, shuttles: 1, ...(endedAt ? { endedAt } : {}) });
  // สนาม 2 เริ่มก่อน (น่าจะจบก่อน) คิว 1-4 จึงรอสนาม 2, คิว 5-8 รอสนาม 1
  const playing = [g("g1", 1, ["i", "j", "k", "l"], 20), g("g2", 2, ["m", "n", "o", "p"], 10)];
  const d: Day = { date, checkIns: many.map((p, i) => ({ playerId: p.id, at: i })), drinks: [], games: playing };

  it("ปิด (ค่าเดิม): สนาม 1 จบก่อน ดึงคู่ที่รอสนาม 2 มาลง", () => {
    const shown = courtPlan(d, many, [1, 2]);
    expect(shown.get(2)!.playerIds).toContain("a");
    expect(autoNext(d, many, [1, 2], playing[0])!.playerIds).toContain("a");
  });

  it("เปิด: สนาม 1 จบก่อน ได้คู่ที่รอสนาม 1 อยู่ คู่ของสนาม 2 ยังรอสนาม 2", () => {
    const shown = courtPlan(d, many, [1, 2], undefined, true, true);
    const next = autoNext(d, many, [1, 2], playing[0], false, true, true)!;
    expect(next.playerIds).toEqual(shown.get(1)!.playerIds);
    expect(next.playerIds).not.toContain("a");
    expect(clubPlan(d, many, { courtCount: 2, fixedCourt: true }, 1).get(1)!.playerIds).toEqual(shown.get(1)!.playerIds);
  });

  it("เปิด: สนามที่ว่างแล้วไม่แย่งคู่ที่รอสนามอื่นอยู่", () => {
    // e f g h รอสนาม 2 อยู่ก่อนสนาม 1 จบ พอสนาม 1 ว่าง คู่นี้ยังรอสนาม 2
    const few: Player[] = "abcdefghmnop".split("").map((id) => ({ id, name: id, level: 3 }));
    const d2: Day = { date, checkIns: few.map((p, i) => ({ playerId: p.id, at: i })), drinks: [], games: [g("g0", 1, ["a", "b", "c", "d"], 20, 30), playing[1]] };
    expect(courtPlan(d2, few, [1, 2], undefined, true, true).get(2)!.playerIds.sort()).toEqual(["e", "f", "g", "h"]);
    // ปิด: คู่นั้นย้ายไปสนาม 1 ที่ว่าง
    expect(courtPlan(d2, few, [1, 2]).get(1)!.playerIds.sort()).toEqual(["e", "f", "g", "h"]);
  });

  it("เปิด: สนามว่างที่ไม่มีคู่ไหนรอตอนว่าง ยังได้คู่ใหม่ก่อน (ไม่ให้คนใหม่ไปรอสนามที่ยังเล่นอยู่)", () => {
    // สนาม 2 จบตอน 30 ไม่มีคนรอ คนใหม่ 4 คนมาตอน 40 ต้องได้สนาม 2 ที่ว่าง ไม่ใช่รอสนาม 1
    const ppl: Player[] = "abcdijklmnop".split("").map((id) => ({ id, name: id, level: 3 }));
    const d3: Day = {
      date,
      checkIns: ppl.map((p) => ({ playerId: p.id, at: "abcd".includes(p.id) ? 40 : 0, ...("mnop".includes(p.id) ? { resting: true } : {}) })),
      drinks: [],
      games: [g("g1", 1, ["i", "j", "k", "l"], 10), g("g2", 2, ["m", "n", "o", "p"], 20, 30)],
    };
    expect([...courtPlan(d3, ppl, [1, 2], undefined, true, true).keys()]).toEqual([2]);
  });
});
