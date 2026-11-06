import { describe, expect, it } from "vitest";
import { shuttleCountFor } from "../billing";
import { waitingQueue } from "../matchmaking";
import { reducer, EMPTY_STATE } from "../state";
import { inGame, lineupWith, minShuttles, shuttlesInGame, startLineup, undoLastSub, withSub, type Day, type Game, type Player } from "../types";

const g0: Game = { id: "g", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 0, shuttles: 2 };

describe("เปลี่ยนตัวระหว่างเกม", () => {
  it("คนเข้ายืนตำแหน่งเดิม คนออกจ่ายลูกถึงตอนเปลี่ยน คนเข้าเริ่มจากลูกถัดไป", () => {
    const g: Game = { ...g0, ...withSub(g0, "b", "e", 100), shuttles: 5 };
    expect(g.playerIds).toEqual(["a", "e", "c", "d"]);
    expect(startLineup(g)).toEqual(["a", "b", "c", "d"]);
    expect(shuttlesInGame(g, "a")).toBe(5);
    expect(shuttlesInGame(g, "b")).toBe(2);
    expect(shuttlesInGame(g, "e")).toBe(3);
    expect(shuttlesInGame(g, "z")).toBe(0);
    expect(inGame(g, "b")).toBe(true);
    expect(inGame(g, "z")).toBe(false);
    // คนออกยังเห็นคู่/คู่แข่งตอนที่ตัวเองเล่น
    expect(lineupWith(g, "b")).toEqual(["a", "b", "c", "d"]);
  });

  it("เปลี่ยนสองต่อ: คนที่ลงแทนแล้วออกอีก จ่ายเฉพาะช่วงของตัวเอง", () => {
    const g1: Game = { ...g0, ...withSub(g0, "b", "e", 100), shuttles: 4 };
    const g2: Game = { ...g1, ...withSub(g1, "e", "f", 200), shuttles: 6 };
    expect(g2.playerIds).toEqual(["a", "f", "c", "d"]);
    expect(shuttlesInGame(g2, "b")).toBe(2);
    expect(shuttlesInGame(g2, "e")).toBe(2);
    expect(shuttlesInGame(g2, "f")).toBe(2);
    expect(shuttlesInGame(g2, "a")).toBe(6);
    expect(lineupWith(g2, "e")).toEqual(["a", "e", "c", "d"]);
  });

  it("บิล: นับลูกตามช่วงที่อยู่ในสนาม", () => {
    const day: Day = { date: "2026-11-02", checkIns: [], drinks: [], games: [{ ...g0, ...withSub(g0, "b", "e", 100), shuttles: 3, endedAt: 300, winner: "A" }] };
    expect(shuttleCountFor(day, "b")).toBe(2);
    expect(shuttleCountFor(day, "e")).toBe(1);
  });

  it("reducer เก็บ 4 คนใหม่และรายการเปลี่ยนตัว", () => {
    let s = reducer(EMPTY_STATE, { type: "startGame", date: "2026-11-02", court: 1, playerIds: ["a", "b", "c", "d"], _id: "g", _at: 0 });
    const g = s.days[0].games[0];
    s = reducer(s, { type: "subPlayer", date: "2026-11-02", gameId: "g", ...withSub(g, "c", "e", 50) });
    expect(s.days[0].games[0].playerIds).toEqual(["a", "b", "e", "d"]);
    expect(s.days[0].games[0].subs).toEqual([{ out: "c", in: "e", at: 50, shuttles: 1 }]);
  });

  it("คนที่ถูกเปลี่ยนออกกลับเข้าคิว เริ่มรอตั้งแต่ตอนออก และนับว่าเล่นแล้ว 1 เกม", () => {
    const players: Player[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, level: 3 }));
    const day: Day = {
      date: "2026-11-02",
      checkIns: players.map((p) => ({ playerId: p.id, at: 0 })),
      drinks: [],
      games: [{ ...g0, ...withSub(g0, "b", "e", 500) }],
    };
    const q = waitingQueue(day, players);
    expect(q.map((e) => e.player.id)).toEqual(["b"]);
    expect(q[0].gamesPlayed).toBe(1);
    expect(q[0].waitingSince).toBe(500);
  });

  it("ลดลูกต่ำกว่าตอนเปลี่ยนตัว: คนออกไม่จ่ายเกินลูกจริง และเลิกทำได้", () => {
    const g: Game = { ...g0, ...withSub(g0, "b", "e", 100) };
    expect(minShuttles(g)).toBe(2);
    expect(shuttlesInGame({ ...g, shuttles: 1 }, "b")).toBe(1);
    expect(shuttlesInGame({ ...g, shuttles: 1 }, "e")).toBe(0);
    const u = undoLastSub(g)!;
    expect(u.playerIds).toEqual(["a", "b", "c", "d"]);
    expect(u.subs).toEqual([]);
  });

  it("reducer ตั้งพัก/เลิกพักไปพร้อมการเปลี่ยนตัว", () => {
    let s = reducer(EMPTY_STATE, { type: "checkIn", date: "2026-11-02", playerId: "b", _at: 0 });
    s = reducer(s, { type: "startGame", date: "2026-11-02", court: 1, playerIds: ["a", "b", "c", "d"], _id: "g", _at: 0 });
    s = reducer(s, { type: "subPlayer", date: "2026-11-02", gameId: "g", ...withSub(s.days[0].games[0], "b", "e", 5), rest: [{ playerId: "b", resting: true }] });
    expect(s.days[0].checkIns.find((c) => c.playerId === "b")?.resting).toBe(true);
  });
});
