"use client";

import { useSyncExternalStore } from "react";
import { isDemo } from "./demo";
import { JOIN_KEY } from "./lineLogin";
import { supabase } from "./remote";
import { readSession } from "./session";
import { today } from "./state";
import { fillCourts, sampleTourney, setResult, submitResult, type TTeam, type Tourney } from "./tourney";

/**
 * งานแข่ง
 * - โหมดทดลอง: เก็บในเครื่อง (localStorage)
 * - แอพจริง: ตาราง tourneys ใน Supabase 1 แถวต่องาน อัพเดทสดผ่าน realtime
 *   แอดมิน/กรรมการบันทึกทั้งงาน (tourney_save กันเขียนทับด้วย version)
 *   ผู้เล่นทำได้แค่เรื่องทีมตัวเอง (tourney_player)
 */
const KEY = "badminton-kabinburi:tourney";
const MODE_KEY = "badminton-kabinburi:tourney-mode";

type Snap = { t: Tourney | null; mode: boolean; version: number };
let snap: Snap | null = null;
/** ผู้เล่นแตะประกาศรับสมัคร: เปิดดูหน้างานแข่งเฉพาะเครื่องนี้ */
let peek = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export type PlayerAction =
  | { action: "signup"; team: TTeam }
  | { action: "here" }
  | { action: "slip"; image: string }
  | { action: "submit"; matchId: string; games: [number, number][] }
  | { action: "confirm"; matchId: string; ok: boolean };

/** ลิงก์ ?join หรือเพิ่งกลับจาก LINE เพื่อสมัครแข่ง */
function joining() {
  try {
    return new URLSearchParams(location.search).has("join") || sessionStorage.getItem(JOIN_KEY) === "1";
  } catch {
    return false;
  }
}

const real = () => !!supabase && !isDemo();

function loadDemo(): Snap {
  if (!isDemo()) return { t: null, mode: false, version: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? (JSON.parse(raw) as Tourney) : sampleTourney(today());
    // ลิงก์ ?join (QR สมัครแข่ง) เปิดหน้างานแข่งเลย
    const join = joining();
    return { t, mode: join || localStorage.getItem(MODE_KEY) === "1", version: 0 };
  } catch {
    return { t: sampleTourney(today()), mode: false, version: 0 };
  }
}

/* ---------- ฐานข้อมูลจริง ---------- */

let started = false;
async function fetchRow() {
  if (!supabase) return;
  const { data } = await supabase.from("tourneys").select("data, mode, version").eq("active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const join = joining();
  // คำตอบที่มาช้ากว่าข้อมูลที่ถืออยู่ ไม่เอา
  if (data && snap?.t?.id === (data.data as Tourney).id && data.version < snap.version) return;
  snap = data ? { t: data.data as Tourney, mode: data.mode || join, version: data.version } : { t: null, mode: false, version: 0 };
  notify();
}

function startReal() {
  if (started || !supabase) return;
  started = true;
  void fetchRow();
  supabase
    .channel("tourneys")
    .on("postgres_changes", { event: "*", schema: "public", table: "tourneys" }, () => void fetchRow())
    .subscribe();
  // กลับมาที่แอพ (เช่น สลับแอพบนมือถือ) ดึงล่าสุดอีกครั้ง
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void fetchRow());
}

function get(): Snap {
  if (real()) {
    startReal();
    return (snap ??= { t: null, mode: false, version: 0 });
  }
  return (snap ??= loadDemo());
}

function emitDemo(next: Snap) {
  snap = next;
  try {
    if (next.t) localStorage.setItem(KEY, JSON.stringify(next.t));
    else localStorage.removeItem(KEY);
    localStorage.setItem(MODE_KEY, next.mode ? "1" : "0");
  } catch {
    /* เก็บไม่ได้ก็ใช้ในหน้านี้ต่อ */
  }
  notify();
}

/** แอดมิน/กรรมการ: แก้ทั้งงาน ถ้ามีคนอื่นบันทึกก่อน ดึงใหม่แล้วทำซ้ำ */
async function saveReal(fn: (t: Tourney) => Tourney): Promise<string | null> {
  if (!supabase) return null;
  const s = readSession();
  for (let i = 0; i < 4; i++) {
    const cur = get();
    if (!cur.t) return "ไม่พบงานแข่ง";
    const next = fn(cur.t);
    snap = { ...cur, t: next };
    notify();
    const { data, error } = await supabase.rpc("tourney_save", { p_id: next.id, p_version: cur.version, p_data: next, p_player: s?.playerId ?? null, p_pin: s?.token ?? null });
    if (error) {
      await fetchRow();
      return error.message;
    }
    if (typeof data === "number" && data > 0) {
      snap = { ...get(), version: data };
      return null;
    }
    await fetchRow();
  }
  return "มีคนแก้พร้อมกัน ลองใหม่อีกครั้ง";
}

/** โหมดทดลอง: ทำแบบเดียวกับฐานข้อมูล */
function actDemo(t: Tourney, me: string, a: PlayerAction): Tourney {
  const mine = t.teams.find((x) => x.playerIds.includes(me));
  const setTeam = (fn: (x: TTeam) => TTeam) => ({ ...t, teams: t.teams.map((x) => (x === mine ? fn(x) : x)) });
  switch (a.action) {
    case "signup":
      return { ...t, teams: [...t.teams, a.team] };
    case "here":
      return mine ? setTeam((x) => ({ ...x, here: (x.playerIds[0] === me ? [true, x.here[1]] : [x.here[0], true]) as [boolean, boolean] })) : t;
    case "slip":
      return mine ? setTeam((x) => ({ ...x, pay: x.pay === "yes" ? "yes" : "slip", slip: a.image })) : t;
    case "submit":
      return mine ? submitResult(t, a.matchId, mine.id, a.games) : t;
    case "confirm": {
      if (!a.ok) return { ...t, matches: t.matches.map((m) => (m.id === a.matchId ? { ...m, disputed: true } : m)) };
      const m = t.matches.find((x) => x.id === a.matchId);
      return m ? fillCourts(setResult(t, m.id, m.games)) : t;
    }
  }
}

const SERVER: Snap = { t: null, mode: false, version: 0 };

export function useTourney() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      // แท็บอื่นในเครื่องเดียวกัน (โหมดทดลอง) อัพเดทตามกัน
      const onStorage = (e: StorageEvent) => {
        if (!real() && (e.key === KEY || e.key === MODE_KEY)) {
          snap = loadDemo();
          notify();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        subs.delete(f);
        window.removeEventListener("storage", onStorage);
      };
    },
    get,
    () => SERVER,
  );
  return {
    t: s.t,
    /** วันนี้เป็นวันแข่ง: แท็บแรกเปลี่ยนเป็น "งานแข่ง" */
    mode: (s.mode || peek) && !!s.t,
    peeking: peek && !s.mode,
    setPeek: (on: boolean) => {
      peek = on;
      snap = { ...get() };
      notify();
    },
    real: real(),
    /** แอดมิน/กรรมการ */
    update: (fn: (t: Tourney) => Tourney) => {
      if (real()) {
        void saveReal(fn).then((err) => err && alert(err));
        return;
      }
      const cur = get();
      if (cur.t) emitDemo({ ...cur, t: fn(cur.t) });
    },
    /** ผู้เล่น: เรื่องของทีมตัวเอง คืนข้อความผิดพลาด หรือ null */
    act: async (a: PlayerAction, me: string | null): Promise<string | null> => {
      const cur = get();
      if (!cur.t) return "ไม่พบงานแข่ง";
      if (!real()) {
        if (me) emitDemo({ ...cur, t: actDemo(cur.t, me, a) });
        return null;
      }
      const s = readSession();
      if (!s) return "กรุณาเข้าสู่ระบบด้วย LINE ก่อน";
      const { action, ...rest } = a;
      const arg = a.action === "signup" ? a.team : rest;
      const { data, error } = await supabase!.rpc("tourney_player", { p_player: s.playerId, p_pin: s.token, p_id: cur.t.id, p_action: action, p_arg: arg });
      await fetchRow();
      return error ? error.message : ((data as string | null) ?? null);
    },
    setMode: async (mode: boolean) => {
      peek = false;
      const cur = get();
      if (!real()) return emitDemo({ ...cur, mode });
      if (!cur.t) return;
      const { error } = await supabase!.from("tourneys").update({ mode }).eq("id", cur.t.id);
      if (error) alert(error.message);
      await fetchRow();
    },
    /** แอดมิน: สร้างงานใหม่ */
    create: async (t: Tourney): Promise<string | null> => {
      if (!real()) {
        emitDemo({ t, mode: false, version: 0 });
        return null;
      }
      const { error } = await supabase!.from("tourneys").insert({ id: t.id, data: t });
      await fetchRow();
      return error?.message ?? null;
    },
    /** แอดมิน: จบงาน (เก็บไว้ ไม่ลบ) */
    end: async () => {
      const cur = get();
      if (!cur.t) return;
      if (!real()) return emitDemo({ t: null, mode: false, version: 0 });
      const { error } = await supabase!.from("tourneys").update({ active: false, mode: false }).eq("id", cur.t.id);
      if (error) alert(error.message);
      await fetchRow();
    },
    reset: () => emitDemo({ ...get(), t: sampleTourney(today()) }),
  };
}

/** แอดมินดูสลิป (เก็บแยกในฐานข้อมูล) */
export async function tourneySlip(teamId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("tourney_slips").select("image").eq("team_id", teamId).maybeSingle();
  return (data?.image as string | undefined) ?? null;
}
