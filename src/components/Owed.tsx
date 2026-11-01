"use client";

import { owedBefore } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { Avatar, Icon, baht } from "./ui";

/** วันที่แบบสั้น เช่น 28 ต.ค. */
export function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

/** แอดมิน: ทุกคนที่ยังค้างจ่ายจากวันก่อน (ไม่รวมวันนี้ ยอดวันนี้อยู่ที่แท็บวันนี้) */
export function OwedList() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const rows = owedBefore(state.days, date, state.players, state.settings, state.monthly);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  if (!rows.length)
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-emerald-50 py-8 font-semibold text-emerald-700">
        <Icon.Check width={20} height={20} /> {t("ไม่มีใครค้างจ่ายจากวันก่อน")}
      </div>
    );

  return (
    <div className="space-y-3">
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
                <span className="block text-sm leading-snug text-zinc-500">{r.dates.map(shortDate).join(" · ")}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-display font-semibold text-red-600">{baht(r.amount)}</span>
                <button
                  className="min-h-9 rounded-full bg-ink px-3 text-xs font-semibold text-white active:scale-95"
                  onClick={() => {
                    if (!confirm(t("ได้รับเงินที่ค้างของ {name} {amount}?", { name: r.player.name, amount: baht(r.amount) }))) return;
                    // ปิดยอดถึงวันล่าสุดที่ค้าง (ไม่แตะยอดวันนี้)
                    dispatch({ type: "markPaid", date: last, playerId: r.player.id });
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
