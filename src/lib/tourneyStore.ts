"use client";

import { useSyncExternalStore } from "react";
import { isDemo } from "./demo";
import { today } from "./state";
import { sampleTourney, type Tourney } from "./tourney";

/**
 * งานแข่งเก็บในเครื่อง (โหมดทดลองเท่านั้นในตอนนี้)
 * ต่อฐานข้อมูลจริงทีหลัง: เปลี่ยนแค่ไฟล์นี้ หน้าจอใช้ useTourney เหมือนเดิม
 */
const KEY = "badminton-kabinburi:tourney";
const MODE_KEY = "badminton-kabinburi:tourney-mode";

type Snap = { t: Tourney | null; mode: boolean };
let snap: Snap | null = null;
const subs = new Set<() => void>();

function load(): Snap {
  if (!isDemo()) return { t: null, mode: false };
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? (JSON.parse(raw) as Tourney) : sampleTourney(today());
    // ลิงก์ ?join (QR สมัครแข่ง) เปิดหน้างานแข่งเลย
    const join = new URLSearchParams(location.search).has("join");
    return { t, mode: join || localStorage.getItem(MODE_KEY) === "1" };
  } catch {
    return { t: sampleTourney(today()), mode: false };
  }
}

function get(): Snap {
  return (snap ??= load());
}

function emit(next: Snap) {
  snap = next;
  try {
    if (next.t) localStorage.setItem(KEY, JSON.stringify(next.t));
    localStorage.setItem(MODE_KEY, next.mode ? "1" : "0");
  } catch {
    /* เก็บไม่ได้ก็ใช้ในหน้านี้ต่อ */
  }
  subs.forEach((f) => f());
}

const SERVER: Snap = { t: null, mode: false };

export function useTourney() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    get,
    () => SERVER,
  );
  return {
    t: s.t,
    /** วันนี้เป็นวันแข่ง: แท็บแรกเปลี่ยนเป็น "งานแข่ง" */
    mode: s.mode && !!s.t,
    update: (fn: (t: Tourney) => Tourney) => {
      const cur = get();
      if (cur.t) emit({ ...cur, t: fn(cur.t) });
    },
    setMode: (mode: boolean) => emit({ ...get(), mode }),
    reset: () => emit({ ...get(), t: sampleTourney(today()) }),
  };
}
