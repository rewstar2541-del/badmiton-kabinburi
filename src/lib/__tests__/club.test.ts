import { describe, expect, it } from "vitest";
import { birthdays, monthRanking, yearSummary } from "../club";
import { EMPTY_STATE, type State } from "../state";
import { attendance } from "../stats";
import type { Day, Game, Player } from "../types";

const P = (id: string, level = 3, extra: Partial<Player> = {}): Player => ({ id, name: id, level, ...extra }) as Player;
const G = (ids: string[], winner: "A" | "B", at: number): Game => ({
  id: "g" + at,
  court: 1,
  playerIds: ids as Game["playerIds"],
  startedAt: at,
  endedAt: at + 600000,
  shuttles: 1,
  winner,
});
const D = (date: string, who: string[], games: Game[] = []): Day => ({ date, checkIns: who.map((p) => ({ playerId: p, at: 0 })), games, drinks: [] });

describe("monthly ranking", () => {
  const players = ["a", "b", "c", "d"].map((id) => P(id));
  it("winners gain what losers lose, sorted by this month's points", () => {
    const days = [D("2026-09-30", ["a", "b", "c", "d"], [G(["c", "d", "a", "b"], "A", 1)]), D("2026-10-01", ["a", "b", "c", "d"], [G(["a", "b", "c", "d"], "A", 2), G(["a", "c", "b", "d"], "A", 3)])];
    const rows = monthRanking({ players, days }, "2026-10");
    expect(rows[0].id).toBe("a");
    expect(rows[0].wins).toBe(2);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBeLessThanOrEqual(1);
    expect(rows.find((r) => r.id === "d")!.delta).toBeLessThan(0);
    // แต้มเดือนก่อนยังติดมา c ชนะเดือนก่อนจึงมีแต้มรวมสูงกว่าเริ่มต้น
    expect(monthRanking({ players, days }, "2026-09").find((r) => r.id === "c")!.delta).toBeGreaterThan(0);
  });
});

describe("attendance streak", () => {
  it("counts club days in a row and resets on a missed day", () => {
    const state: State = {
      ...EMPTY_STATE,
      days: [D("2026-10-01", ["a"]), D("2026-10-02", ["a", "b"]), D("2026-10-03", ["b"]), D("2026-10-04", ["a", "b"]), D("2026-10-05", ["b"])],
    };
    expect(attendance(state, "b", "2026-10-05")).toEqual({ current: 4, best: 4 });
    expect(attendance(state, "a", "2026-10-05")).toEqual({ current: 1, best: 2 });
  });
  it("does not break the streak before you arrive today", () => {
    const state: State = { ...EMPTY_STATE, days: [D("2026-10-04", ["a"]), D("2026-10-05", ["b"])] };
    expect(attendance(state, "a", "2026-10-05").current).toBe(1);
  });
});

describe("birthdays and year summary", () => {
  it("finds birthdays by month-day", () => {
    expect(birthdays([P("a", 3, { birthday: "10-05" }), P("b", 3, { birthday: "10-06" })], "2026-10-05").map((p) => p.id)).toEqual(["a"]);
  });
  it("summarises a year", () => {
    const players = ["a", "b", "c", "d"].map((id) => P(id));
    const games = [1, 2, 3].map((n) => G(["a", "b", "c", "d"], "A", n));
    const s = yearSummary({ players, days: [D("2026-03-01", ["a", "b", "c", "d"], games), D("2025-12-31", ["a"])] }, "2026");
    expect(s.sessions).toBe(1);
    expect(s.games).toBe(3);
    expect(s.bestDuo?.ids).toEqual(["a", "b"]);
    expect(s.topWinners[0]).toMatchObject({ n: 3, games: 3 });
  });
});
