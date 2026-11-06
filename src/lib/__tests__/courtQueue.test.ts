import { describe, expect, it } from "vitest";
import { autoNext, courtPlan, courtQueue, nextMatch, plannedCourt, queueBlockers, queuedSpot, waitingQueue } from "../matchmaking";
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
