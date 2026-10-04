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
