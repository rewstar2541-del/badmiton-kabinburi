import { describe, expect, it } from "vitest";
import { courtQueue, nextMatch, queueBlockers, queuedSpot, waitingQueue } from "../matchmaking";
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
