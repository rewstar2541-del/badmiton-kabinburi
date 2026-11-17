import { describe, expect, it } from "vitest";
import { nextMatch, splitTeams, waitingQueue } from "../matchmaking";
import type { Day, Level, Player } from "../types";

const p = (id: string, level: Level): Player => ({ id, name: id, level });

function dayWith(players: Player[], games: Day["games"] = []): Day {
  return {
    date: "2026-10-04",
    checkIns: players.map((pl, i) => ({ playerId: pl.id, at: i })),
    games,
    drinks: [],
  };
}

describe("matchmaking", () => {
  it("แบ่งทีมให้ฝีมือรวมเท่ากัน", () => {
    const { teams } = splitTeams([p("a", 5), p("b", 5), p("c", 1), p("d", 1)]);
    const lv: Record<string, number> = { a: 5, b: 5, c: 1, d: 1 };
    expect(lv[teams[0]] + lv[teams[1]]).toBe(lv[teams[2]] + lv[teams[3]]);
  });

  it("ไม่จับคู่ซ้ำถ้าเลี่ยงได้", () => {
    const four = [p("a", 3), p("b", 3), p("c", 3), p("d", 3)];
    const partners = new Map([["a|b", 1]]);
    const { teams } = splitTeams(four, partners);
    const pairs = [[teams[0], teams[1]].sort().join("|"), [teams[2], teams[3]].sort().join("|")];
    expect(pairs).not.toContain("a|b");
  });

  it("คนบนสนามไม่อยู่ในคิว และคนเล่นน้อยได้ก่อน", () => {
    const ps = ["a", "b", "c", "d", "e", "f"].map((id) => p(id, 3));
    const d = dayWith(ps, [
      { id: "g1", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 10, endedAt: 20, shuttles: 1 },
      { id: "g2", court: 2, playerIds: ["a", "b", "e", "f"], startedAt: 21 , shuttles: 0 },
    ]);
    const q = waitingQueue(d, ps).map((e) => e.player.id);
    expect(q).toEqual(["c", "d"]);
  });

  it("คนต้นคิวได้ลงเสมอ และน้อยกว่า 4 คนไม่จัด", () => {
    const ps = [p("a", 1), p("b", 5), p("c", 5), p("d", 5), p("e", 5), p("f", 1), p("g", 1), p("h", 1)];
    const m = nextMatch(dayWith(ps), ps)!;
    expect(m).toContain("a");
    expect(new Set(m).size).toBe(4);
    expect(nextMatch(dayWith(ps.slice(0, 3)), ps)).toBeNull();
  });

  it("เลือกคนระดับใกล้กัน ไม่ให้มือหนักแบกมือเบา แม้คนระดับเดียวกันอยู่ท้ายคิวกว่า", () => {
    // คิว: P, New, New, BG, P, P, S  -> ควรได้ P,P,P,S ไม่ใช่ P,New,New,BG
    const ps = [p("a", 5), p("b", 1), p("c", 1), p("d", 2), p("e", 5), p("f", 5), p("g", 4)];
    const m = nextMatch(dayWith(ps), ps)!;
    expect([...m].sort()).toEqual(["a", "e", "f", "g"]);
  });

  it("50 คนจัดได้เร็ว", () => {
    const ps = Array.from({ length: 50 }, (_, i) => p(`p${i}`, ((i % 5) + 1) as Level));
    const t = performance.now();
    expect(nextMatch(dayWith(ps), ps)).not.toBeNull();
    expect(performance.now() - t).toBeLessThan(200);
  });

  it("คนขอพักและคนที่จ่ายเงินแล้วไม่อยู่ในคิว", () => {
    const ps = ["a", "b", "c", "d"].map((id) => p(id, 3));
    const d = dayWith(ps);
    d.checkIns[1].resting = true;
    d.checkIns[2].paidAt = 100;
    expect(waitingQueue(d, ps).map((e) => e.player.id)).toEqual(["a", "d"]);
  });

  it("เลี่ยงคนที่ไม่อยากเจอกัน และให้คนที่ขอคู่อยู่ทีมเดียวกัน", () => {
    const ps = ["a", "b", "c", "d", "e"].map((id) => p(id, 3));
    ps[0].avoid = ["b"];
    ps[2].prefer = ["a"];
    const m = nextMatch(dayWith(ps), ps)!;
    expect(m).not.toContain("b");
    const teamOf = (id: string) => (m.indexOf(id as never) < 2 ? "A" : "B");
    expect(teamOf("a")).toBe(teamOf("c"));
  });
});

describe("ระดับ NB", () => {
  it("NB อยู่ระหว่าง BG กับ N ทั้งลำดับและฝีมือ", async () => {
    const { LEVELS, strength } = await import("../types");
    expect(LEVELS.map((l) => l.code)).toEqual(["New", "BG", "NB", "N", "S", "P"]);
    expect(strength(2)).toBeLessThan(strength(6));
    expect(strength(6)).toBeLessThan(strength(3));
  });
});

describe("ฟอร์มวันนี้", () => {
  const ended = (id: string, ids: string[], winner: "A" | "B", at: number) => ({
    id, court: 1, playerIds: ids as [string, string, string, string], startedAt: at, endedAt: at + 1, shuttles: 1, winner,
  });

  it("ชนะติดกันฟอร์มขึ้น แพ้ติดกันฟอร์มลง แต่ไม่เกินครึ่งระดับ", async () => {
    const { formToday, FORM_CAP } = await import("../matchmaking");
    const ps = ["a", "b", "c", "d"].map((id) => p(id, 3));
    const games = Array.from({ length: 10 }, (_, i) => ended(`g${i}`, ["a", "b", "c", "d"], "A", i * 10));
    const f = formToday(dayWith(ps, games), ps);
    expect(f.get("a")).toBe(FORM_CAP);
    expect(f.get("c")).toBe(-FORM_CAP);
  });

  it("ชนะทีมที่อ่อนกว่าได้ฟอร์มน้อยกว่าชนะทีมที่เก่งกว่า", async () => {
    const { formToday } = await import("../matchmaking");
    const ps = [p("a", 3), p("b", 3), p("c", 5), p("d", 5), p("e", 1), p("f", 1)];
    const up = formToday(dayWith(ps, [ended("g1", ["a", "b", "c", "d"], "A", 0)]), ps).get("a")!;
    const down = formToday(dayWith(ps, [ended("g1", ["a", "b", "e", "f"], "A", 0)]), ps).get("a")!;
    expect(up).toBeGreaterThan(down);
    expect(down).toBeGreaterThan(0);
  });

  it("เสมอและเกมที่ยังไม่จบไม่นับ", async () => {
    const { formToday } = await import("../matchmaking");
    const ps = ["a", "b", "c", "d"].map((id) => p(id, 3));
    const d = dayWith(ps, [
      { ...ended("g1", ["a", "b", "c", "d"], "A", 0), draw: true, winner: undefined },
      { id: "g2", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 5, shuttles: 0 },
    ]);
    expect(formToday(d, ps).size).toBe(0);
  });

  it("คนระดับเท่ากัน คนที่ชนะมาทั้งวันไม่อยู่ทีมเดียวกัน", async () => {
    // a, b ชนะ 3 เกมรวด (ฟอร์มดี) c, d แพ้ทุกเกม ระดับมือเท่ากันหมด
    const ps = ["a", "b", "c", "d", "x", "y"].map((id) => p(id, 3));
    const games = [0, 1, 2].map((i) => ended(`g${i}`, i % 2 ? ["c", "x", "a", "y"] : ["a", "y", "c", "x"], i % 2 ? "B" : "A", i * 10));
    games.push(ended("g3", ["b", "x", "d", "y"], "A", 40), ended("g4", ["b", "y", "d", "x"], "A", 50), ended("g5", ["d", "x", "b", "y"], "B", 60));
    const d = dayWith(ps, games);
    const { teams } = splitTeams([ps[0], ps[1], ps[2], ps[3]], new Map(), [], (await import("../matchmaking")).formToday(d, ps));
    const teamOf = (id: string) => (teams.indexOf(id as never) < 2 ? "A" : "B");
    expect(teamOf("a")).not.toBe(teamOf("b"));
  });
});

describe("จัดคู่ไม่ให้ซ้ำกลุ่มเดิม / ไม่ให้มือใหม่ถูกแบก", () => {
  const g = (id: string, ids: string[], start: number, end?: number) => ({
    id, court: 1, playerIds: ids as [string, string, string, string], startedAt: start, endedAt: end, shuttles: 1,
  });

  it("เกมที่เพิ่งจบ คนในเกมเดียวกันไม่ถูกจับมาเล่นด้วยกันอีก ถ้ามีคนระดับใกล้กันให้สลับ", () => {
    const ps = [p("a", 5), p("b", 4), p("c", 5), p("d", 4), p("e", 5), p("f", 4), p("x", 5), p("y", 4)];
    // a,b,c,d เพิ่งจบ (รอใหม่) e,f,x,y รออยู่ก่อน แต่เช็คอินทีหลังสุดเลยอยู่ท้ายคิวถ้าจบเกมเร็วกว่า
    const d = dayWith(ps, [g("g1", ["a", "b", "c", "d"], 5, 10)]);
    d.checkIns = ps.map((pl, i) => ({ playerId: pl.id, at: i < 4 ? 0 : 11 + i }));
    const m = nextMatch(d, ps)!;
    // คนต้นคิวคือ a/b/c/d คนหนึ่ง (จบ 10) ก่อน e,f,x,y ที่เช็คอิน 15+ ... ต้องมีคนจากนอกกลุ่มเดิมอย่างน้อย 1 คน
    expect(m.filter((id) => ["a", "b", "c", "d"].includes(id)).length).toBeLessThan(4);
  });

  it("ห่างกันเกิน 1 ระดับไม่จัดลงด้วยกัน: มือใหม่ข้ามไปก่อน รอจนมีคนระดับใกล้ (New ไม่เจอ P)", () => {
    const ps = [p("n", 1), p("a", 5), p("b", 5), p("c", 4), p("d", 4), p("e", 5)];
    const first = nextMatch(dayWith(ps), ps)!;
    expect(first).not.toContain("n");
    // ไม่มีชุดไหนห่างเกิน 1 ระดับ แม้มือใหม่รอมานาน ก็ไม่ถูกบังคับให้ลง
    const more = [...ps, p("f", 5), p("g", 4)];
    const d2 = dayWith(more, [g("g1", [...first], 20)]);
    d2.checkIns = d2.checkIns.map((c) => (c.playerId === "n" ? { ...c, at: 0 } : { ...c, at: 1 }));
    expect(nextMatch(d2, more)).toBeNull();
    // พอมีคนระดับ New/BG มารอเพิ่มให้ครบ 4 ถึงจะลงได้
    const withBg = [...more, p("h", 1), p("i", 2), p("j", 2)];
    const d3 = dayWith(withBg, [g("g1", [...first], 20)]);
    const m = nextMatch(d3, withBg)!;
    expect(m).toContain("n");
    expect(m.every((id) => ["n", "h", "i", "j"].includes(id))).toBe(true);
  });

  it("รอจนคนที่มาทีหลังลงไป 2 เกม ผ่อนเพดานเป็น 2 ระดับ: New ได้ลงกับ N แต่ไม่ถึง S/P", () => {
    const ps = [p("n", 1), ...["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => p(id, 3)), p("s", 4), p("t", 4), p("u", 4), p("v", 5)];
    const base = dayWith(ps);
    base.checkIns = base.checkIns.map((c) => ({ ...c, at: c.playerId === "n" ? 0 : 1 }));
    // 0 เกม: New ยังไม่ได้ลง (ทุกชุดที่มี New ห่างเกิน 1)
    expect(nextMatch(base, ps)).not.toContain("n");
    // คนที่มาทีหลังได้ลงไปแล้ว 2 เกม
    const played = dayWith(ps, [g("g1", ["a", "b", "c", "d"], 20), g("g2", ["e", "f", "g", "h"], 30)]);
    played.checkIns = base.checkIns;
    played.games = played.games.map((x) => ({ ...x, endedAt: x.startedAt + 10 }));
    const m = nextMatch(played, ps)!;
    expect(m).toContain("n");
    const lv = m.map((id) => ps.find((x) => x.id === id)!.level);
    expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(2);
  });

  it("ทุกชุดที่จัดให้ห่างกันไม่เกิน 1 ระดับมือ (BG กับ N ได้ BG กับ S ไม่ได้)", () => {
    const ps = [p("a", 2), p("b", 3), p("c", 3), p("d", 4), p("e", 2), p("f", 3)];
    const m = nextMatch(dayWith(ps), ps)!;
    const lv = m.map((id) => ps.find((x) => x.id === id)!.level);
    expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
    expect(nextMatch(dayWith([p("a", 2), p("b", 4), p("c", 3), p("d", 3)]), [p("a", 2), p("b", 4), p("c", 3), p("d", 3)])).toBeNull();
  });
});

describe("วางแผนหลายสนามพร้อมกัน", () => {
  it("การข้ามมือใหม่ไม่ถูกนับจากคู่ชั่วคราวในแผนเดียวกัน", async () => {
    const { courtPlan } = await import("../matchmaking");
    const ps = [p("n", 1), p("a", 5), p("b", 5), p("c", 4), p("d", 4), p("e", 5), p("f", 5), p("g", 4), p("h", 4)];
    const plan = courtPlan(dayWith(ps), ps, 2);
    // ไม่มีสนามไหนจับมือใหม่ลงกับมือหนักเพียงเพราะสนามแรกข้ามไปแล้ว
    for (const m of plan.values()) expect(m.playerIds).not.toContain("n");
  });
});
