import { describe, expect, it } from "vitest";
import { billFor } from "../billing";
import { rowsToState } from "../remote";
import { prepare, reducer, EMPTY_STATE } from "../state";
import { DEFAULT_SETTINGS } from "../types";

describe("rowsToState", () => {
  const state = rowsToState({
    players: [
      { id: "a", name: "ต้น", photo: null, gender: "male", level: 3 },
      { id: "b", name: "ฝน", photo: "data:x", gender: "female", level: 1 },
    ],
    contacts: [{ player_id: "a", phone: "0812345678" }],
    checkins: [
      { date: "2026-10-04", player_id: "a", at: "2026-10-04T12:00:00Z", paid_at: null },
      { date: "2026-10-04", player_id: "b", at: "2026-10-04T11:00:00Z", paid_at: "2026-10-04T15:00:00Z" },
    ],
    games: [
      {
        id: "g1",
        date: "2026-10-04",
        court: 1,
        player_ids: ["a", "b", "c", "d"],
        started_at: "2026-10-04T12:10:00Z",
        ended_at: null,
        shuttles: 2,
        winner: null,
      },
    ],
    drinks: [{ id: "d1", date: "2026-10-04", player_id: "a", amount: 15, note: "น้ำ" }],
    monthly: [{ month: "2026-10", player_id: "b", paid_at: "2026-10-01T00:00:00Z" }],
    settings: null,
    announcements: [{ date: "2026-10-05", message: "พรุ่งนี้ 1 ทุ่ม" }],
    slips: [{ id: "s1", date: "2026-10-04", player_id: "a", amount: 110, created_at: "2026-10-04T14:00:00Z" }],
    signups: [
      { date: "2026-10-05", player_id: "a", at: "2026-10-04T13:00:00Z" },
      { date: "2026-10-05", player_id: "b", at: "2026-10-04T12:00:00Z" },
    ],
  });

  it("แปลงแถวเป็นข้อมูลแอพ", () => {
    expect(state.players.find((p) => p.id === "a")).toMatchObject({ phone: "0812345678", gender: "male" });
    expect(state.players.find((p) => p.id === "b")?.phone).toBeUndefined();
    expect(state.days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05"]);
    // เรียงตามเวลาเช็คอิน
    expect(state.days[0].checkIns.map((c) => c.playerId)).toEqual(["b", "a"]);
    expect(state.days[0].games[0]).toMatchObject({ shuttles: 2, endedAt: undefined, winner: undefined });
    expect(state.monthly["2026-10"].b).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("ประกาศและคนลงชื่อ เรียงตามเวลาที่ลงชื่อ", () => {
    const d = state.days[1];
    expect(d.announcement).toBe("พรุ่งนี้ 1 ทุ่ม");
    expect(d.signups?.map((x) => x.playerId)).toEqual(["b", "a"]);
    expect(state.days[0].announcement).toBeUndefined();
    expect(state.days[0].slips).toEqual([{ id: "s1", playerId: "a", amount: 110, at: Date.parse("2026-10-04T14:00:00Z") }]);
  });

  it("คิดเงินจากข้อมูลออนไลน์ได้ถูก", () => {
    const day = state.days[0];
    const [a, b] = state.players.sort((x) => (x.id === "a" ? -1 : 1));
    expect(billFor(state.days, day, a, state.settings, state.monthly).total).toBe(40 + 30 + 25 + 15);
    expect(billFor(state.days, day, b, state.settings, state.monthly)).toMatchObject({ courtFee: 0, paid: true });
  });
});

describe("prepare + reducer", () => {
  it("id และเวลามาจาก action ทำให้ผลเหมือนกันทุกครั้ง", () => {
    const a = prepare({ type: "addPlayer", player: { name: "เอ", level: 3 } }, 1000, () => "id-1");
    expect(reducer(EMPTY_STATE, a)).toEqual(reducer(EMPTY_STATE, a));
    expect(reducer(EMPTY_STATE, a).players[0].id).toBe("id-1");
  });

  it("ลงชื่อซ้ำไม่เพิ่ม และยกเลิกได้", () => {
    let s = reducer(EMPTY_STATE, prepare({ type: "setAnnouncement", date: "2026-10-04", message: "วันนี้มีก๊วน" }));
    s = reducer(s, prepare({ type: "signUp", date: "2026-10-04", playerId: "a" }, 1));
    s = reducer(s, prepare({ type: "signUp", date: "2026-10-04", playerId: "a" }, 2));
    expect(s.days[0]).toMatchObject({ announcement: "วันนี้มีก๊วน", signups: [{ playerId: "a", at: 1 }] });
    s = reducer(s, prepare({ type: "cancelSignUp", date: "2026-10-04", playerId: "a" }));
    s = reducer(s, prepare({ type: "setAnnouncement", date: "2026-10-04", message: null }));
    expect(s.days[0].signups).toEqual([]);
    expect(s.days[0].announcement).toBeUndefined();
  });
});
