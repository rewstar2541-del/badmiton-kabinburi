import { describe, expect, it } from "vitest";
import { nextMatch } from "../matchmaking";
import { activePairs, canSelfCheckIn, gameHistory, partnerStats, signupQueue, waitingPosition } from "../social";
import { EMPTY_STATE, type State } from "../state";
import type { Day, Player } from "../types";

const P = (id: string, level = 3): Player => ({ id, name: id, level }) as Player;

describe("pair requests", () => {
  const players = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => P(id));
  const base: Day = {
    date: "2026-10-05",
    checkIns: players.map((p, i) => ({ playerId: p.id, at: i })),
    games: [],
    drinks: [],
    pairs: [{ id: "r", from: "a", to: "j", status: "accepted", at: 100 }],
  };
  it("puts an accepted pair on the same team even from the back of the queue", () => {
    const t = nextMatch(base, players)!;
    const team = t.indexOf("a") < 2 ? t.slice(0, 2) : t.slice(2);
    expect(team.sort()).toEqual(["a", "j"]);
  });
  it("is done after they played together once", () => {
    const day = { ...base, games: [{ id: "g", court: 1, playerIds: ["a", "j", "b", "c"] as [string, string, string, string], startedAt: 200, shuttles: 1 }] };
    expect(activePairs(day)).toHaveLength(0);
    expect(activePairs(base)).toHaveLength(1);
  });
});

describe("partner stats", () => {
  it("counts wins with partners and losses against rivals", () => {
    const g = (ids: [string, string, string, string], winner: "A" | "B", i: number) => ({ id: "g" + i, court: 1, playerIds: ids, startedAt: i, shuttles: 1, winner });
    const state: State = {
      ...EMPTY_STATE,
      days: [{ date: "2026-10-05", checkIns: [], drinks: [], games: [
        g(["me", "b", "x", "y"], "A", 1),
        g(["me", "b", "x", "z"], "A", 2),
        g(["x", "me", "c", "y"], "B", 3),
      ] }],
    };
    const s = partnerStats(state, "me");
    expect(s.decided).toBe(3);
    expect(s.partners[0]).toEqual({ id: "b", games: 2, wins: 2 });
    // y: เจอ 2 แพ้ 1, c: เจอ 1 แพ้ 1 (แพ้เท่ากัน คนที่เจอบ่อยกว่าขึ้นก่อน)
    expect(s.rivals.slice(0, 2)).toEqual([{ id: "y", games: 2, wins: 1 }, { id: "c", games: 1, wins: 0 }]);
  });
});

describe("sign-up cap", () => {
  const day = (cap?: number, checked: string[] = []): Day => ({
    date: "2026-10-05",
    checkIns: checked.map((id) => ({ playerId: id, at: 0 })),
    games: [],
    drinks: [],
    announcementCap: cap,
    signups: ["a", "b", "c", "d"].map((id, i) => ({ playerId: id, at: i })),
  });
  it("puts sign-ups past the cap on a waiting list in order", () => {
    expect(signupQueue(day(2))).toMatchObject({ confirmed: ["a", "b"], waiting: ["c", "d"] });
    expect(waitingPosition(day(2), "d")).toBe(2);
    expect(signupQueue(day()).waiting).toEqual([]);
  });
  it("moves the first waiting player up when someone cancels", () => {
    const d = { ...day(2), signups: day(2).signups!.filter((s) => s.playerId !== "a") };
    expect(signupQueue(d)).toMatchObject({ confirmed: ["b", "c"], waiting: ["d"] });
  });
  it("lets waiting players check in only while there is room", () => {
    expect(canSelfCheckIn(day(2), "a")).toBe(true);
    expect(canSelfCheckIn(day(2), "c")).toBe(false);
    expect(canSelfCheckIn(day(3, ["a", "b"]), "d")).toBe(false);
    expect(canSelfCheckIn(day(4, ["a"]), "x")).toBe(false);
    expect(canSelfCheckIn(day(5, ["a"]), "x")).toBe(true);
  });
});

describe("game history", () => {
  const g = (id: string, ids: string[], startedAt: number, extra: object = {}) =>
    ({ id, court: 1, playerIds: ids as [string, string, string, string], startedAt, shuttles: 1, ...extra });
  const state: State = {
    ...EMPTY_STATE,
    days: [
      { date: "2026-10-01", checkIns: [], drinks: [], games: [g("1", ["me", "b", "c", "d"], 10, { endedAt: 20, winner: "A" })] },
      { date: "2026-10-02", checkIns: [], drinks: [], games: [
        g("2", ["c", "d", "b", "me"], 30, { endedAt: 40, winner: "A" }),
        g("3", ["me", "x", "c", "d"], 50, { endedAt: 60, draw: true }),
        g("4", ["me", "x", "c", "d"], 70, { endedAt: 80 }),
        g("5", ["y", "z", "me", "b"], 90),
        g("6", ["y", "z", "c", "b"], 95),
      ] },
    ],
  };
  it("lists my games newest first with mate, opponents and result", () => {
    const h = gameHistory(state, "me");
    expect(h.map((x) => x.result)).toEqual(["playing", "unknown", "draw", "loss", "win"]);
    expect(h[3]).toMatchObject({ date: "2026-10-02", mate: "b", opponents: ["c", "d"] });
    expect(h[4]).toMatchObject({ mate: "b", opponents: ["c", "d"] });
    expect(h[0]).toMatchObject({ mate: "b", opponents: ["y", "z"] });
  });
});
