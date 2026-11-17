"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { pendingStart, queueBlockers, START_GRACE_MS } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { courtsOfDay } from "@/lib/types";

/** ตัวเลือกเวลาก่อนลงสนาม (วินาที) 0 = ลงทันที -1 = รอแอดมินกด */
export const START_DELAYS = [0, 15, 20, 30, 60, -1] as const;

export const delayLabel = (s: number) => (s === 0 ? t("ลงทันที") : s < 0 ? t("รอแอดมินกด") : t("{n} วินาที", { n: s }));

/**
 * คู่ที่แอดมินแตะ "แก้" หรือ "รอก่อน" ระหว่างเตรียมลงสนาม: หยุดนับถอยหลังในเครื่องนี้ ให้กดลงสนามเอง
 * (กันเกมเริ่มเองตอนกำลังแก้คนอยู่)
 */
const HOLD_KEY = "startHolds";
const readHolds = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(HOLD_KEY) ?? "[]");
  } catch {
    return [];
  }
};
// เก็บไว้ใน sessionStorage ด้วย โหลดหน้าใหม่แล้วคู่ที่แอดมินกดรอก่อน/แก้ไว้ยังไม่เริ่มเอง
const holds = new Set<string>(typeof sessionStorage === "undefined" ? [] : readHolds());
const listeners = new Set<() => void>();
let version = 0;
export function holdStart(queuedId: string) {
  if (holds.has(queuedId)) return;
  holds.add(queuedId);
  try {
    sessionStorage.setItem(HOLD_KEY, JSON.stringify([...holds].slice(-50)));
  } catch {}
  version++;
  listeners.forEach((l) => l());
}
export const isHeld = (queuedId: string) => holds.has(queuedId);
export function useHolds() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => 0,
  );
  return isHeld;
}

/** รอบสุดท้ายเปิดอยู่ในเครื่องนี้ไหม (สวิตช์ในหน้าสนาม เก็บแยกตามวัน) */
export function lastRoundOn(date: string) {
  try {
    return localStorage.getItem(`lastRound:${date}`) === "1";
  } catch {
    return false;
  }
}

/** นาฬิกาเดินทุกวินาที เฉพาะตอนที่ต้องนับถอยหลัง */
export function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [on]);
  return now;
}

/**
 * เริ่มเกมของคู่ที่เตรียมลงสนามเมื่อครบเวลา (เครื่องแอดมิน เปิดหน้าไหนอยู่ก็ทำงาน)
 * ไม่เริ่มเอง: รอแอดมินกด, แอดมินแตะแก้/รอก่อน, รอบสุดท้าย, มีคนในคู่ลงไม่ได้, หรือเลยเวลามานานแล้ว
 * แอดมินหลายเครื่อง: ฐานข้อมูลรับเกมเดียวต่อสนาม เครื่องที่ช้ากว่าแค่โหลดข้อมูลใหม่
 */
export function AutoStarter() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const delay = state.settings.startDelay ?? 0;
  const pending = delay > 0 ? courtsOfDay(state.settings, day).map((c) => pendingStart(day, c, state.settings)).filter((p) => p !== null) : [];
  const now = useTick(pending.length > 0);
  const fired = useRef(new Set<string>());
  useHolds();
  useEffect(() => {
    if (lastRoundOn(date)) return;
    for (const p of pending) {
      const q = p.queued;
      if (p.startAt === null || now < p.startAt || now > p.startAt + START_GRACE_MS) continue;
      // สนามนี้มีเกมแล้ว (อีกเครื่องเริ่มไปก่อน) หรือมีคนในคู่ลงไม่ได้ ไม่เริ่ม
      if (day.games.some((g) => !g.endedAt && g.court === q.court)) continue;
      if (fired.current.has(q.id) || isHeld(q.id) || queueBlockers(day, q).length) continue;
      fired.current.add(q.id);
      dispatch({ type: "startGame", date, court: q.court, playerIds: q.playerIds, queuedId: q.id });
    }
  });
  return null;
}

/** ตั้งเวลาก่อนลงสนาม: แถวบางในการ์ดหน้าสนาม หรือการ์ดในหน้าตั้งค่า */
export function StartDelayPicker({ row = false }: { row?: boolean }) {
  const { state, dispatch, auth } = useStore();
  // ออนไลน์: ใช้ได้หลังรัน SQL start_delay.sql (โหลดมาแล้วมีค่า) ออฟไลน์เก็บในเครื่องได้เลย
  const ready = !auth.online || state.settings.startDelay !== undefined;
  const value = state.settings.startDelay ?? 0;
  const set = (v: number) => ready && dispatch({ type: "updateSettings", settings: { ...state.settings, startDelay: v } });
  const hint = !ready
    ? t("ใช้ได้หลังรัน SQL start_delay.sql")
    : value === 0
      ? t("กดผลแล้วคู่ต่อไปลงสนามทันที")
      : value < 0
        ? t("คู่ต่อไปขึ้นเตรียมลงสนาม แอดมินแก้คนได้ แล้วกดลงสนามเอง")
        : t("คู่ต่อไปขึ้นเตรียมลงสนาม แอดมินแก้คนได้ ครบเวลาแล้วเริ่มเอง");
  const select = (
    <select
      aria-label={t("เวลาก่อนลงสนาม")}
      disabled={!ready}
      value={value}
      onChange={(e) => set(Number(e.target.value))}
      className="h-11 min-w-0 max-w-[9rem] shrink-0 rounded-full border border-zinc-300 bg-white px-3 text-base font-semibold text-ink disabled:opacity-40"
    >
      {[...new Set([...START_DELAYS, value])].map((s) => (
        <option key={s} value={s}>
          {delayLabel(s)}
        </option>
      ))}
    </select>
  );
  if (row)
    return (
      <div className="flex min-h-14 w-full items-center gap-3 border-t border-zinc-200 px-4 py-2 text-sm">
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${ready ? "text-ink" : "text-zinc-500"}`}>{t("เวลาก่อนลงสนาม")}</span>
          {!ready && <span className="block text-xs text-zinc-500">{hint}</span>}
        </span>
        {select}
      </div>
    );
  return (
    <div className={`flex min-h-14 w-full items-center gap-3 rounded-3xl border border-zinc-200 px-4 py-3 text-sm ${ready ? "bg-white text-ink" : "bg-zinc-50 text-zinc-500"}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold">{t("เวลาก่อนลงสนาม")}</span>
        <span className="block text-sm text-zinc-600">{hint}</span>
      </span>
      {select}
    </div>
  );
}
