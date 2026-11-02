"use client";

import { useMemo, useState } from "react";
import { owedBefore } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { monthOf } from "@/lib/types";
import { shiftMonth } from "./Members";
import { slipStatus } from "./SlipHistory";
import { Avatar, Icon, baht } from "./ui";

/** วันที่แบบสั้น เช่น 28 ต.ค. */
export function shortDate(date: string, withYear = false) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" as const } : {}) });
}

/** แอดมิน: ทุกคนที่ยังค้างจ่ายจากวันก่อน (ไม่รวมวันนี้ ยอดวันนี้อยู่ที่แท็บวันนี้) */
export function OwedList() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const rows = useMemo(() => owedBefore(state.days, date, state.players, state.settings, state.monthly), [state.days, date, state.players, state.settings, state.monthly]);
  // ส่งสลิปแล้ว (รอตรวจ) จะได้ไม่ทวงซ้ำ
  const withSlip = useMemo(() => {
    const m = monthOf(date);
    return new Set(
      [m, shiftMonth(m, -1)].flatMap((x) => {
        const { all, owedById } = slipStatus(state, x);
        return all.filter((sl) => sl.player && !sl.paid && (owedById.get(sl.id)?.length ?? 0) > 0).map((sl) => sl.playerId);
      }),
    );
  }, [state, date]);
  // รับเงินล่าสุด กดยกเลิกได้ถ้ากดผิด
  const [undo, setUndo] = useState<{ name: string; amount: number; playerId: string; date?: string } | null>(null);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const undoBar = undo && (
    <div className="flex items-center justify-between gap-2 rounded-3xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
      <span className="min-w-0">{t("รับเงิน {name} {amount} แล้ว", { name: undo.name, amount: baht(undo.amount) })}</span>
      {undo.date && (
        <button
          className="min-h-11 shrink-0 px-2 font-semibold underline underline-offset-2"
          onClick={() => {
            dispatch({ type: "unmarkPaid", date: undo.date!, playerId: undo.playerId });
            setUndo(null);
          }}
        >
          {t("ยกเลิก")}
        </button>
      )}
    </div>
  );

  if (!rows.length)
    return (
      <div className="space-y-3">
        {undoBar}
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-emerald-50 py-8 font-semibold text-emerald-700">
          <Icon.Check width={20} height={20} /> {t("ไม่มีใครค้างจ่ายจากวันก่อน")}
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      {undoBar}
      <div className="flex items-baseline justify-between rounded-3xl bg-red-50 px-4 py-3 text-red-700">
        <span className="text-sm font-semibold">{t("ค้างจากวันก่อน {n} คน", { n: rows.length })}</span>
        <span className="font-display text-xl font-semibold">{baht(total)}</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const last = r.dates[r.dates.length - 1];
          return (
            <li key={r.player.id} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
              <Avatar name={r.player.name} photo={r.player.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.player.name}</span>
                <span className="block text-sm leading-snug text-zinc-500">{r.dates.map((x) => shortDate(x, x.slice(0, 4) !== date.slice(0, 4))).join(" · ")}</span>
                {withSlip.has(r.player.id) && (
                  <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{t("ส่งสลิปแล้ว รอตรวจ")}</span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-display font-semibold text-red-600">{baht(r.amount)}</span>
                <button
                  className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-white active:scale-95"
                  onClick={() => {
                    if (!confirm(t("ได้รับเงินที่ค้างของ {name} {amount}?", { name: r.player.name, amount: baht(r.amount) }))) return;
                    // ปิดยอดถึงวันล่าสุดที่ค้าง (ไม่แตะยอดวันนี้)
                    dispatch({ type: "markPaid", date: last, playerId: r.player.id });
                    setUndo({ name: r.player.name, amount: r.amount, playerId: r.player.id, date: r.ownLast });
                  }}
                >
                  {t("รับเงิน")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-1 text-xs text-zinc-500">{t("ยอดของวันนี้ดูที่แท็บวันนี้ คนที่มาวันนี้จะเห็นยอดค้างรวมในบิลด้วย")}</p>
    </div>
  );
}
