import { describe, expect, it } from "vitest";
import { courtPlan } from "../matchmaking";
import { rowsToState } from "../remote";
import { courtList, courtsOfDay, type Day, type Player } from "../types";

const players: Player[] = "abcdefghijkl".split("").map((id) => ({ id, name: id, level: 3 }));
const day = (extra: Partial<Day> = {}): Day => ({ date: "2026-11-01", checkIns: players.map((p, i) => ({ playerId: p.id, at: i })), games: [], drinks: [], ...extra });

describe("เบอร์สนาม", () => {
  it("ไม่ได้ตั้งเบอร์ = 1..จำนวนสนาม, ตั้งแล้ว = เรียงตามเบอร์", () => {
    expect(courtList({ courtCount: 3 })).toEqual([1, 2, 3]);
    expect(courtList({ courtCount: 3, courtNumbers: [] })).toEqual([1, 2, 3]);
    expect(courtList({ courtCount: 3, courtNumbers: [7, 3, 5] })).toEqual([3, 5, 7]);
  });

  it("สนามที่ยังมีเกม/คิวค้างแต่ถูกเอาออก ยังโชว์จนจบ", () => {
    const d = day({ games: [{ id: "g", court: 1, playerIds: ["a", "b", "c", "d"], startedAt: 1, shuttles: 1 }] });
    expect(courtsOfDay({ courtCount: 2, courtNumbers: [5, 3] }, d)).toEqual([1, 3, 5]);
    d.games[0].endedAt = 2;
    expect(courtsOfDay({ courtCount: 2, courtNumbers: [5, 3] }, d)).toEqual([3, 5]);
  });

  it("ระบบแบ่งคิวขึ้นสนามตามเบอร์ที่ตั้ง ไม่ใช้เบอร์ที่ไม่มี", () => {
    const plan = courtPlan(day(), players, [3, 5, 7]);
    expect([...plan.keys()].sort()).toEqual([3, 5, 7]);
    expect(plan.get(3)!.playerIds).toContain("a");
    // สนาม 1 เดิมที่จบเกม ไม่ได้คู่ต่อ
    expect(courtPlan(day(), players, [3, 5, 7], 1).get(1)).toBeUndefined();
  });

  it("โหลด/ไม่มีคอลัมน์ court_numbers", () => {
    const base = { court_count: 3, court_fee: 40, first_shuttle_fee: 30, next_shuttle_fee: 25, monthly_fee: 150, promptpay_id: "" };
    const load = (settings: object) => rowsToState({ players: [], checkins: [], games: [], drinks: [], monthly: [], announcements: [], signups: [], closed: [], slips: [], settings } as never).settings;
    expect(load(base).courtNumbers).toBeUndefined();
    expect(load({ ...base, court_numbers: null }).courtNumbers).toEqual([]);
    expect(load({ ...base, court_numbers: [3, 5, 7] }).courtNumbers).toEqual([3, 5, 7]);
  });
});
