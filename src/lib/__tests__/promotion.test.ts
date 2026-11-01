import { describe, expect, it } from "vitest";
import { attendees, levelCounts, clubMembers, monthRecord, nextLevel, prevQuarter, promotionCandidates, quarterMonths, quarterOf, PROMOTION_RULE } from "../promotion";
import type { Day, Game, Player } from "../types";

const P = (id: string, level: Player["level"] = 1, extra: Partial<Player> = {}): Player => ({ id, name: id, level, ...extra }) as Player;
let n = 0;
const G = (ids: string[], winner?: "A" | "B", ended = true): Game => ({
  id: "g" + ++n,
  court: 1,
  playerIds: ids as Game["playerIds"],
  startedAt: n,
  ...(ended ? { endedAt: n + 1 } : {}),
  shuttles: 1,
  ...(winner ? { winner } : {}),
});
const D = (date: string, games: Game[], extra: Partial<Day> = {}): Day => ({ date, checkIns: [], games, drinks: [], ...extra });

describe("nextLevel", () => {
  it("follows the club order New < BG < NB < N < S < P", () => {
    expect(nextLevel(1)).toBe(2);
    expect(nextLevel(2)).toBe(6);
    expect(nextLevel(6)).toBe(3);
    expect(nextLevel(4)).toBe(5);
    expect(nextLevel(5)).toBeNull();
  });
});

describe("monthRecord", () => {
  it("counts only finished games of that month, wins out of games with a result", () => {
    const days = [
      D("2026-10-31", [G(["a", "b", "c", "d"], "A")]),
      D("2026-11-02", [G(["a", "b", "c", "d"], "A"), G(["c", "a", "b", "d"], "B"), G(["a", "b", "c", "d"]), G(["a", "b", "c", "d"], "A", false)]),
    ];
    expect(monthRecord(days, "2026-11").get("a")).toEqual({ games: 3, decided: 2, wins: 1 });
    expect(monthRecord(days, "2026-11").get("d")).toEqual({ games: 3, decided: 2, wins: 1 });
  });
});

describe("quarters", () => {
  it("maps months to quarters and back", () => {
    expect(quarterOf("2026-11")).toBe("2026-Q4");
    expect(quarterOf("2027-01")).toBe("2027-Q1");
    expect(quarterMonths("2026-Q4")).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(prevQuarter("2027-Q1")).toBe("2026-Q4");
    expect(prevQuarter("2026-Q4")).toBe("2026-Q3");
  });
});

describe("promotionCandidates", () => {
  const games = (k: number, lose: number) => [
    ...Array.from({ length: k }, () => G(["a", "x", "b", "y"], "A")),
    ...Array.from({ length: lose }, () => G(["a", "x", "b", "y"], "B")),
  ];
  it("needs 30 wins and 60% win rate over the 3 months of a quarter", () => {
    expect(PROMOTION_RULE).toEqual({ wins: 30, rate: 60 });
    const players = [P("a", 1), P("x", 2), P("b", 1), P("y", 5)];
    // ชนะ 30 แพ้ 20 = 60% แบ่งไว้ 3 เดือน ผ่าน; อีกฝั่งชนะ 20 แพ้ 30 ไม่ผ่าน
    const days = [D("2026-10-05", games(10, 7)), D("2026-11-05", games(10, 7)), D("2026-12-05", games(10, 6)), D("2027-01-02", games(5, 0))];
    const list = promotionCandidates({ players, days }, "2026-Q4");
    expect(list.map((c) => [c.id, c.from, c.to, c.wins, c.rate])).toEqual([
      ["a", 1, 2, 30, 60],
      ["x", 2, 6, 30, 60],
    ]);
    // เกมนอกไตรมาสไม่นับ
    expect(promotionCandidates({ players, days: days.slice(0, 2) }, "2026-Q4")).toEqual([]);
  });
  it("skips low win rate, too few wins, top level, guests and pending players", () => {
    const players = [P("a", 1), P("x", 5), P("b", 1, { guestOf: "a" }), P("y", 1, { pending: true })];
    expect(promotionCandidates({ players, days: [D("2026-11-05", games(30, 21))] }, "2026-Q4").map((c) => c.id)).toEqual([]);
    expect(promotionCandidates({ players, days: [D("2026-11-05", games(29, 0))] }, "2026-Q4").map((c) => c.id)).toEqual([]);
    expect(promotionCandidates({ players, days: [D("2026-11-05", games(40, 0))] }, "2026-Q4").map((c) => c.id)).toEqual(["a"]);
  });
});

describe("attendees", () => {
  it("groups people who arrived, who signed up and are not here yet, and the reserve list", () => {
    const day = D("2026-11-01", [], {
      announcement: "",
      announcementCap: 2,
      checkIns: [{ playerId: "walkin", at: 5 }, { playerId: "b", at: 6 }],
      signups: [
        { playerId: "a", at: 1 },
        { playerId: "b", at: 2 },
        { playerId: "c", at: 3 },
      ],
    });
    expect(attendees(day)).toEqual({ here: ["walkin", "b"], coming: ["a"], waiting: ["c"], total: 3 });
  });
  it("ignores leftover sign-ups on a day that is not announced", () => {
    const day = D("2026-11-01", [], { signups: [{ playerId: "a", at: 1 }] });
    expect(attendees(day)).toEqual({ here: [], coming: [], waiting: [], total: 0 });
  });
});

describe("club members", () => {
  const players = [P("a", 1), P("b", 1), P("c", 3), P("g", 1, { guestOf: "a" }), P("p", 2, { pending: true })];
  it("lists members without guests or pending sign-ups", () => {
    expect(clubMembers(players).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("counts members per level in club order", () => {
    expect(levelCounts(clubMembers(players)).map((x) => [x.code, x.n])).toEqual([
      ["New", 2],
      ["BG", 0],
      ["NB", 0],
      ["N", 1],
      ["S", 0],
      ["P", 0],
    ]);
  });
});
