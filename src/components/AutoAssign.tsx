"use client";

import { t } from "@/lib/i18n";
import { useStore } from "@/lib/store";

/**
 * สวิตช์โหมดจัดคนลงสนามอัตโนมัติ (แอดมิน) ใช้ทั้งหน้าสนามและหน้าตั้งค่า
 * เปิด = ระบบแบ่งคิวรวมขึ้นรอทุกสนาม เกมจบแล้วลงคู่ต่อไปให้ทันที
 * ปิด = แอดมินจัดเอง ระบบไม่ดึงคนจากคิวรวมขึ้นสนามไหน คู่ที่แอดมินจัดคิวสนามไว้เองยังลงต่อให้
 */
export function AutoAssignSwitch({ compact = false }: { compact?: boolean }) {
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
  // ทั้งแถวกดได้ (ไม่ต้องเล็งตัวสวิตช์เล็กๆ) สีแบบเดียวกับสวิตช์ช่องทางรับเงิน: เขียว = เปิด เทา = ปิด/ยังใช้ไม่ได้
  const tone = !ready ? "bg-zinc-50 text-zinc-500" : on ? "bg-emerald-50 text-emerald-900" : "bg-zinc-100 text-zinc-800";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!ready}
      onClick={toggle}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm transition active:scale-[0.99] ${tone} ${
        compact ? "rounded-2xl" : "rounded-3xl border border-zinc-200"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${compact ? "" : "font-display text-base"}`}>{t("จัดคนลงสนามอัตโนมัติ")}</span>
        <span className="block text-xs">
          {!ready
            ? t("ใช้ได้หลังรัน SQL auto_assign.sql")
            : on
              ? t("เปิด: ระบบจัดคิวขึ้นรอทุกสนาม เกมจบแล้วลงคู่ต่อไปให้ทันที")
              : t("ปิด: แอดมินจัดคู่ลงเอง")}
        </span>
      </span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition ${!ready ? "opacity-40" : ""} ${on ? "bg-emerald-600" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
