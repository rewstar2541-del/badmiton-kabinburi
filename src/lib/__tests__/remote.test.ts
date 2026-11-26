import { drinkNote, maxQty } from "../../components/DrinkMenu";
import { describe, expect, it } from "vitest";
import { billFor } from "../billing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SHUTTLES_NOT_SAVED, mergePrivate, reportGame, rowsToState, type Rows } from "../remote";
import { prepare, reducer, EMPTY_STATE } from "../state";
import { DEFAULT_SETTINGS, DRINK_MENU_MAX, drinkMenuOf, lastRoundOf } from "../types";

describe("rowsToState", () => {
  const state = rowsToState({
    players: [
      { id: "a", name: "ต้น", photo: null, gender: "male", level: 3 },
      { id: "b", name: "ฝน", photo: "data:x", gender: "female", level: 1, frame: "songkran", frames: ["songkran"] },
    ],
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
    closed: [{ date: "2026-10-10", reason: "ปิดปรับปรุง" }],
    prices: [],
    slips: [{ id: "s1", date: "2026-10-04", player_id: "a", amount: 110, created_at: "2026-10-04T14:00:00Z" }],
    signups: [
      { date: "2026-10-05", player_id: "a", at: "2026-10-04T13:00:00Z" },
      { date: "2026-10-05", player_id: "b", at: "2026-10-04T12:00:00Z" },
    ],
  });

  it("แปลงแถวเป็นข้อมูลแอพ", () => {
    expect(state.players.find((p) => p.id === "a")).toMatchObject({ gender: "male" });
    expect(state.days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05"]);
    // เรียงตามเวลาเช็คอิน
    expect(state.days[0].checkIns.map((c) => c.playerId)).toEqual(["b", "a"]);
    expect(state.days[0].games[0]).toMatchObject({ shuttles: 2, endedAt: undefined, winner: undefined });
    expect(state.monthly["2026-10"].b).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.closed).toEqual({ "2026-10-10": "ปิดปรับปรุง" });
  });

  it("อ่านกรอบรูปที่เลือกและกรอบที่มี", () => {
    expect(state.players.find((p) => p.id === "b")).toMatchObject({ frame: "songkran", frames: ["songkran"] });
    expect(state.players.find((p) => p.id === "a")).not.toHaveProperty("frames");
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
    expect(s.days[0].signups ?? []).toEqual([]);
    expect(s.days[0].announcement).toBeUndefined();
  });

  it("ยกเลิกจัดก๊วน ล้างคนลงชื่อของวันนั้น แต่ไม่แตะวันอื่น", () => {
    let s = reducer(EMPTY_STATE, prepare({ type: "setAnnouncement", date: "2026-10-04", message: "มีก๊วน" }));
    s = reducer(s, prepare({ type: "setAnnouncement", date: "2026-10-05", message: "มีก๊วน" }));
    for (const date of ["2026-10-04", "2026-10-05"])
      for (const playerId of ["a", "b"]) s = reducer(s, prepare({ type: "signUp", date, playerId }, 1));
    s = reducer(s, prepare({ type: "setAnnouncement", date: "2026-10-04", message: null }));
    expect(s.days.find((d) => d.date === "2026-10-04")?.signups ?? []).toEqual([]);
    expect(s.days.find((d) => d.date === "2026-10-05")?.signups).toHaveLength(2);
    // ตั้งเป็นวันจัดก๊วนใหม่ ไม่มีคนลงชื่อค้างจากรอบก่อน
    s = reducer(s, prepare({ type: "setAnnouncement", date: "2026-10-04", message: "มีก๊วนอีกครั้ง" }));
    expect(s.days.find((d) => d.date === "2026-10-04")?.signups ?? []).toEqual([]);
  });
});

describe("mergePrivate", () => {
  it("รวมค่าน้ำ ค่ารายเดือน และสลิปของตัวเองเข้าไปโดยไม่ซ้ำ", () => {
    const base = { ...EMPTY_STATE, days: [{ date: "2026-10-04", checkIns: [], games: [], drinks: [] }] };
    const rows = {
      drinks: [{ id: "d1", date: "2026-10-04", player_id: "a", amount: 15, note: "น้ำ" }],
      monthly: [{ month: "2026-10", player_id: "a", paid_at: "2026-10-01T00:00:00Z" }],
      slips: [{ id: "s1", date: "2026-10-05", player_id: "a", amount: 70, created_at: "2026-10-05T12:00:00Z" }],
    };
    const s = mergePrivate(mergePrivate(base, rows), rows);
    expect(s.days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05"]);
    expect(s.days[0].drinks).toHaveLength(1);
    expect(s.days[1].slips).toHaveLength(1);
    expect(s.monthly["2026-10"].a).toBe(Date.parse("2026-10-01T00:00:00Z"));
  });
});

describe("รอบสุดท้ายเก็บในฐานข้อมูล", () => {
  const base = { court_count: 2, court_fee: 40, first_shuttle_fee: 30, next_shuttle_fee: 25, monthly_fee: 150, promptpay_id: "" };
  const load = (settings: Record<string, unknown>) => rowsToState({ players: [], checkins: [], games: [], drinks: [], monthly: [], announcements: [], closed: [], prices: [], slips: [], signups: [], settings: { ...base, ...settings } } as unknown as Rows).settings;
  it("อ่านวันที่เปิดรอบสุดท้าย ว่าง = ปิด ไม่มีคอลัมน์ = ยังไม่รัน SQL", () => {
    expect(load({ last_round_date: "2026-11-17" }).lastRoundDate).toBe("2026-11-17");
    expect(load({ last_round_date: null }).lastRoundDate).toBeNull();
    expect(load({}).lastRoundDate).toBeUndefined();
  });
  it("เปิด/ปิดสวิตช์ เก็บเฉพาะวันนั้น ข้ามวันถือว่าปิด", () => {
    const on = reducer(EMPTY_STATE, { type: "setLastRound", date: "2026-11-17", on: true });
    expect(lastRoundOf(on.settings, "2026-11-17")).toBe(true);
    expect(lastRoundOf(on.settings, "2026-11-18")).toBe(false);
    expect(reducer(on, { type: "setLastRound", date: "2026-11-17", on: false }).settings.lastRoundDate).toBeNull();
  });
});

describe("รายการน้ำตั้งราคาไว้", () => {
  const base = { court_count: 2, court_fee: 40, first_shuttle_fee: 30, next_shuttle_fee: 25, monthly_fee: 150, promptpay_id: "" };
  const load = (settings: Record<string, unknown>) => rowsToState({ players: [], checkins: [], games: [], drinks: [], monthly: [], announcements: [], closed: [], prices: [], slips: [], signups: [], settings: { ...base, ...settings } } as unknown as Rows).settings;
  it("อ่านรายการ ตัดชื่อว่างและราคาผิดออก ไม่มีคอลัมน์ = ยังไม่รัน SQL", () => {
    expect(load({ drink_menu: [{ name: " น้ำเปล่า ", price: 10 }, { name: "", price: 20 }, { name: "แพง", price: 999 }, { name: "เกลือแร่", price: "20" }] }).drinkMenu).toEqual([
      { name: "น้ำเปล่า", price: 10 },
      { name: "เกลือแร่", price: 20 },
    ]);
    expect(load({ drink_menu: null }).drinkMenu).toEqual([]);
    expect(load({}).drinkMenu).toBeUndefined();
    expect(drinkMenuOf(Array.from({ length: 20 }, (_, i) => ({ name: `น้ำ ${i}`, price: 10 })))).toHaveLength(DRINK_MENU_MAX);
  });
});

describe("ผู้เล่นกดผลพร้อมจำนวนลูก", () => {
  const fake = (fail: boolean) => {
    const calls: Record<string, unknown>[] = [];
    const db = {
      rpc: async (_: string, args: Record<string, unknown>) => {
        calls.push(args);
        return fail && "p_shuttles" in args ? { data: null, error: { code: "PGRST202", message: "not found" } } : { data: null, error: null };
      },
    } as unknown as SupabaseClient;
    return { db, calls };
  };
  it("ส่งจำนวนลูกไปกับผล", async () => {
    const { db, calls } = fake(false);
    expect(await reportGame(db, "a", "pin", "g", "win", undefined, 2)).toBeNull();
    expect(calls).toEqual([expect.objectContaining({ p_result: "win", p_shuttles: 2 })]);
  });
  it("ยังไม่รัน SQL report_shuttles.sql: บันทึกผลไปก่อนโดยไม่มีจำนวนลูก", async () => {
    const { db, calls } = fake(true);
    expect(await reportGame(db, "a", "pin", "g", "lose", undefined, 3)).toBe(SHUTTLES_NOT_SAVED);
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toHaveProperty("p_shuttles");
  });
});

describe("เลือกจำนวนน้ำ", () => {
  it("จำนวนสูงสุดไม่ให้ยอดเกิน 200 บาท และชื่อในบิลบอกจำนวน", () => {
    expect(maxQty(10)).toBe(10);
    expect(maxQty(25)).toBe(8);
    expect(maxQty(200)).toBe(1);
    expect(drinkNote("น้ำเปล่า", 1)).toBe("น้ำเปล่า");
    expect(drinkNote("น้ำเปล่า", 3)).toBe("น้ำเปล่า ×3");
  });
});
