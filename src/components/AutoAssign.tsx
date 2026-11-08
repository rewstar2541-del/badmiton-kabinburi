"use client";

import { t } from "@/lib/i18n";
import { useStore } from "@/lib/store";

/**
 * สวิตช์โหมดจัดคนลงสนามอัตโนมัติ (แอดมิน) ใช้ทั้งหน้าสนามและหน้าตั้งค่า
 * เปิด = ระบบแบ่งคิวรวมขึ้นรอทุกสนาม เกมจบแล้วลงคู่ต่อไปให้ทันที
 * ปิด = แอดมินจัดเอง ระบบไม่ดึงคนจากคิวรวมขึ้นสนามไหน คู่ที่แอดมินจัดคิวสนามไว้เองยังลงต่อให้
 */
/** หน้าตาสวิตช์ (ตัวเลื่อน) ใช้ร่วมกับแถวสวิตช์อื่นในหน้าสนาม */
export function SwitchKnob({ on, tone = "emerald", dim = false }: { on: boolean; tone?: "emerald" | "amber"; dim?: boolean }) {
  const bg = on ? (tone === "amber" ? "bg-amber-500" : "bg-emerald-600") : "bg-zinc-300";
  return (
    <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition ${dim ? "opacity-40" : ""} ${bg}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
    </span>
  );
}

export function AutoAssignSwitch({ row = false }: { row?: boolean }) {
  const { state, dispatch, auth } = useStore();
  const on = state.settings.autoAssign !== false;
  // ออนไลน์: ใช้ได้หลังรัน SQL auto_assign.sql (โหลดมาแล้วมีค่า) ออฟไลน์เก็บในเครื่องได้เลย
  const ready = !auth.online || state.settings.autoAssign !== undefined;
  const toggle = () => {
    if (!ready) return;
    if (on && !confirm(t("ปิดจัดคนลงอัตโนมัติ? ระบบจะไม่ดึงคนจากคิวขึ้นสนาม แอดมินกดจัดคู่ลงเองทุกสนาม")))
      return;
    dispatch({ type: "updateSettings", settings: { ...state.settings, autoAssign: !on } });
  };
  // แบบแถวบาง (หน้าสนาม): ชื่อ + สวิตช์ คำอธิบายสั้นขึ้นเฉพาะตอนปิด/ยังใช้ไม่ได้ (ตอนเปิดเป็นค่าปกติ ไม่ต้องอธิบาย)
  if (row)
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!ready}
        onClick={toggle}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm transition active:opacity-70"
      >
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${ready ? "text-ink" : "text-zinc-500"}`}>{t("จัดคนลงอัตโนมัติ")}</span>
          {(!ready || !on) && (
            <span className="block text-xs text-zinc-500">
              {!ready ? t("ใช้ได้หลังรัน SQL auto_assign.sql") : t("ปิดอยู่: แอดมินจัดคู่ลงเอง")}
            </span>
          )}
        </span>
        <SwitchKnob on={on} dim={!ready} />
      </button>
    );
  // ทั้งแถวกดได้ (ไม่ต้องเล็งตัวสวิตช์เล็กๆ) สีแบบเดียวกับสวิตช์ช่องทางรับเงิน: เขียว = เปิด เทา = ปิด/ยังใช้ไม่ได้
  const tone = !ready ? "bg-zinc-50 text-zinc-500" : on ? "bg-emerald-50 text-emerald-900" : "bg-zinc-100 text-zinc-800";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!ready}
      onClick={toggle}
      className={`flex min-h-14 w-full items-center gap-3 rounded-3xl border border-zinc-200 px-4 py-3 text-left text-sm transition active:scale-[0.99] ${tone}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold">{t("จัดคนลงสนามอัตโนมัติ")}</span>
        <span className="block text-xs">
          {!ready
            ? t("ใช้ได้หลังรัน SQL auto_assign.sql")
            : on
              ? t("เปิด: ระบบจัดคิวขึ้นรอทุกสนาม เกมจบแล้วลงคู่ต่อไปให้ทันที")
              : t("ปิด: แอดมินจัดคู่ลงเอง")}
        </span>
      </span>
      <SwitchKnob on={on} dim={!ready} />
    </button>
  );
}
