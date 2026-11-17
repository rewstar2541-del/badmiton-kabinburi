"use client";

import { t } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { DEFAULT_STRONG_GROUP, LEVELS, strength, type Level, type Settings } from "@/lib/types";
import { SwitchKnob } from "./AutoAssign";

const GAMES = [1, 2, 3, 4] as const;
const WAITS = [5, 10, 15, 20, 30] as const;

/**
 * มือตึงล้วน (แอดมิน): กติกาจัดคู่หลังบ้าน ไม่แจ้งผู้เล่น
 * ระดับที่เลือกขึ้นไป ตั้งแต่เกมที่เลือก ลงกับมือตึงด้วยกัน รอเกินเวลาที่ตั้ง ลงกับระดับต่ำลงมาได้
 */
export function StrongGroupCard() {
  const { state, dispatch, auth } = useStore();
  // ออนไลน์: ตั้งค่าได้หลังรัน SQL strong_group.sql (ก่อนรันใช้ค่าเริ่มต้น) ออฟไลน์เก็บในเครื่องได้เลย
  const ready = !auth.online || state.settings.strongGroup !== undefined;
  const g = state.settings.strongGroup ?? DEFAULT_STRONG_GROUP;
  const set = (patch: Partial<NonNullable<Settings["strongGroup"]>>) =>
    ready && dispatch({ type: "updateSettings", settings: { ...state.settings, strongGroup: { ...g, ...patch } } });
  const sel = "h-11 min-w-0 rounded-full border border-zinc-300 bg-white px-3 text-base font-semibold text-ink disabled:opacity-40";
  const strong = LEVELS.filter((l) => strength(l.value) >= 3);
  return (
    <div className={`w-full rounded-3xl border border-zinc-200 text-sm ${ready ? "bg-white text-ink" : "bg-zinc-50 text-zinc-500"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={g.on}
        disabled={!ready}
        onClick={() => set({ on: !g.on })}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition active:opacity-70"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold">{t("จับกลุ่มมือตึงล้วน")}</span>
          <span className="block text-xs text-zinc-500">
            {!ready ? t("ใช้ได้หลังรัน SQL strong_group.sql") : g.on ? t("จัดหลังบ้าน ผู้เล่นไม่เห็นข้อความ") : t("ปิด: จัดคู่ตามระดับใกล้กันตามปกติ")}
          </span>
        </span>
        <SwitchKnob on={g.on} dim={!ready} />
      </button>
      {g.on && (
        <div className="grid gap-2 border-t border-zinc-200 px-4 py-3">
          <label className="flex items-center gap-3">
            <span className="min-w-0 flex-1">{t("มือตึง = ระดับนี้ขึ้นไป")}</span>
            <select aria-label={t("มือตึง = ระดับนี้ขึ้นไป")} disabled={!ready} value={g.level} onChange={(e) => set({ level: Number(e.target.value) as Level })} className={sel}>
              {strong.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="min-w-0 flex-1">{t("ลงด้วยกันตั้งแต่เกมที่")}</span>
            <select aria-label={t("ลงด้วยกันตั้งแต่เกมที่")} disabled={!ready} value={g.fromGame} onChange={(e) => set({ fromGame: Number(e.target.value) })} className={sel}>
              {[...new Set([...GAMES, g.fromGame])].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="min-w-0 flex-1">{t("รอเกินนี้ ลงกับระดับต่ำลงมาได้")}</span>
            <select aria-label={t("รอเกินนี้ ลงกับระดับต่ำลงมาได้")} disabled={!ready} value={g.waitMin} onChange={(e) => set({ waitMin: Number(e.target.value) })} className={sel}>
              {[...new Set([...WAITS, g.waitMin])].map((n) => (
                <option key={n} value={n}>
                  {t("{n} นาที", { n })}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
