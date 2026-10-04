"use client";

import { useState } from "react";
import type { State } from "@/lib/state";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid, monthOf, type Plan, type Player } from "@/lib/types";
import { t } from "@/lib/i18n";
import { PayQr } from "./PayQr";
import { savedPin } from "./PickMe";
import { SelfPay } from "./SelfPay";
import { SlipUpload } from "./Slips";
import { Card, Icon, baht } from "./ui";

/** แจ้งเตือนรอบจ่ายรายเดือนตั้งแต่วันที่นี้ของเดือน */
export const MONTHLY_DUE_DAY = 5;

/** สมาชิกรายเดือนที่ยังไม่จ่ายของเดือนนี้ */
export function monthlyDue(state: State, player: Player | undefined, date: string): boolean {
  return Boolean(player && !player.guestOf && player.plan === "monthly" && !isMonthlyPaid(state.monthly, date, player.id));
}

/** ถึงรอบจ่ายแล้ว (ตั้งแต่วันที่ 5) ใช้แจ้งเตือนในหน้าวันนี้ */
export function monthlyReminder(state: State, player: Player | undefined, date: string): boolean {
  return monthlyDue(state, player, date) && Number(date.slice(8, 10)) >= MONTHLY_DUE_DAY;
}

/** สลับไปแท็บอื่น (App ฟังอยู่) */
export function goToTab(tab: string) {
  window.dispatchEvent(new CustomEvent("goto-tab", { detail: tab }));
}

function usePlan(player: Player) {
  const { setPlan } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = async (plan: Plan) => {
    setBusy(true);
    const err = await setPlan(player.id, savedPin.get(), plan);
    setBusy(false);
    setError(err ? t(err) : "");
    return !err;
  };
  return { busy, error, choose };
}

/** เข้าครั้งแรก: เลือกเป็นสมาชิกรายวันหรือรายเดือน */
export function PlanChoice({ player }: { player: Player }) {
  const { state } = useStore();
  const { busy, error, choose } = usePlan(player);
  if (player.plan || player.guestOf) return null;
  const s = state.settings;
  return (
    <Card className="space-y-3 ring-2 ring-lime">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("เลือกแบบสมาชิก")}</h2>
        <p className="text-sm text-zinc-500">{t("เปลี่ยนทีหลังได้ที่หน้ายอดของฉัน")}</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          className="rounded-3xl bg-zinc-100 p-4 text-left active:scale-[0.98]"
          onClick={() => choose("daily")}
        >
          <span className="block font-display font-semibold">{t("รายวัน")}</span>
          <span className="block text-xs text-zinc-500">{t("จ่ายค่าสนาม {amount} ทุกครั้งที่มา", { amount: baht(s.courtFee) })}</span>
        </button>
        <button
          disabled={busy}
          className="rounded-3xl bg-lime p-4 text-left text-ink active:scale-[0.98]"
          onClick={async () => {
            if (await choose("monthly")) goToTab("mybill");
          }}
        >
          <span className="block font-display font-semibold">{t("รายเดือน")}</span>
          <span className="block text-xs">{t("{amount} ต่อเดือน ไม่ต้องจ่ายค่าสนามรายวัน", { amount: baht(s.monthlyFee) })}</span>
        </button>
      </div>
    </Card>
  );
}

/** แจ้งเตือนในหน้าวันนี้: ถึงรอบจ่ายรายเดือน */
export function MonthlyReminder({ player }: { player: Player }) {
  const { state } = useStore();
  const { date } = useToday();
  if (!monthlyReminder(state, player, date)) return null;
  return (
    <button
      className="flex w-full items-center gap-3 rounded-3xl bg-amber-300 p-4 text-left text-ink shadow-lg shadow-amber-300/30"
      onClick={() => goToTab("mybill")}
    >
      <Icon.Wallet className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold">{t("ถึงรอบจ่ายค่าสมาชิกรายเดือนแล้ว")}</span>
        <span className="block text-sm">
          {t("เดือน {month} {amount} กดเพื่อไปจ่ายที่หน้ายอดของฉัน", { month: monthOf(date), amount: baht(state.settings.monthlyFee) })}
        </span>
      </span>
      <span className="shrink-0 text-lg">›</span>
    </button>
  );
}

/** หน้ายอดของฉัน: ค่ารายเดือนที่ยังไม่จ่าย ไฮไลท์ให้เด่น จ่ายแล้วจะหายไป */
export function MonthlyDueCard({ player }: { player: Player }) {
  const { state } = useStore();
  const { date } = useToday();
  if (!monthlyDue(state, player, date)) return null;
  const fee = state.settings.monthlyFee;
  return (
    <div className="space-y-3 rounded-3xl bg-amber-50 p-4 ring-2 ring-amber-400">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-400 text-ink">
          <Icon.Wallet width={20} height={20} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold text-amber-950">
            {t("ค่าสมาชิกรายเดือน {month}", { month: monthOf(date) })}
          </div>
          <div className="text-sm text-amber-900">{t("ยอด {amount} ยังไม่ได้จ่าย", { amount: baht(fee) })}</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3">
        <PayQr promptPayId={state.settings.promptPayId} amount={fee} />
        <SlipUpload playerId={player.id} amount={fee} />
        <SelfPay playerId={player.id} amount={fee} action="payMonth" />
      </div>
    </div>
  );
}

/** เปลี่ยนแบบสมาชิก */
export function PlanSwitch({ player }: { player: Player }) {
  const { busy, error, choose } = usePlan(player);
  if (player.guestOf || !player.plan) return null;
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-semibold">{t("แบบสมาชิก")}</span>
        <div className="flex shrink-0 rounded-full bg-zinc-100 p-0.5">
          {(["daily", "monthly"] as const).map((p) => (
            <button
              key={p}
              disabled={busy}
              onClick={() => player.plan !== p && choose(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${player.plan === p ? "bg-ink text-white" : "text-zinc-500"}`}
            >
              {p === "daily" ? t("รายวัน") : t("รายเดือน")}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

