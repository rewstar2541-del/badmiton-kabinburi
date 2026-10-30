"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { monthOf } from "@/lib/types";
import { monthLabel, shiftMonth } from "./Members";
import { Avatar, Card, SearchInput, baht } from "./ui";

/** คิดเงิน > ประวัติโอน: สลิปทุกใบที่ผู้เล่นส่งมาในเดือนที่เลือก ใหม่สุดก่อน (แอดมิน) */
export function SlipHistory() {
  const { state, slipImage } = useStore();
  const { date } = useToday();
  const [month, setMonth] = useState(monthOf(date));
  const [q, setQ] = useState("");
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const paidMonth = state.monthly[month] ?? {};

  const all = state.days
    .filter((d) => d.date.startsWith(month))
    .flatMap((d) =>
      (d.slips ?? []).map((s) => ({
        ...s,
        date: d.date,
        player: byId.get(s.playerId),
        // ปิดยอดแล้ว = แอดมินกดจ่ายแล้วของวันนั้น หรือจ่ายรายเดือนของเดือนนั้นแล้ว
        paid: Boolean(d.checkIns.find((c) => c.playerId === s.playerId)?.paidAt || paidMonth[s.playerId]),
      })),
    )
    .sort((a, b) => b.at - a.at);
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((s) => (s.player?.name ?? "").toLowerCase().includes(needle)) : all;
  const total = all.reduce((n, s) => n + s.amount, 0);
  const waiting = all.filter((s) => !s.paid).length;

  const show = async (id: string) => {
    if (id in images)
      return setImages((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    setLoading(id);
    try {
      const img = await slipImage(id);
      setImages((m) => ({ ...m, [id]: img }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const when = (at: number) =>
    new Date(at).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="flex items-center justify-between rounded-3xl bg-ink px-3 py-3 text-white">
        <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("เดือนก่อน")}>
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
          <div className="text-sm text-white/70">
            {t("สลิป {n} รูป · รวม {amount}", { n: all.length, amount: baht(total) })}
            {waiting > 0 && ` · ${t("รอตรวจ {n}", { n: waiting })}`}
          </div>
        </div>
        <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("เดือนถัดไป")}>
          ›
        </button>
      </div>

      {all.length > 0 && <SearchInput value={q} onChange={setQ} />}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {shown.map((s) => (
          <li key={s.id} className="space-y-2 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
            <div className="flex items-center gap-3">
              <Avatar name={s.player?.name ?? "?"} photo={s.player?.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.player?.name ?? t("ผู้เล่นที่ถูกลบ")}</span>
                <span className="block text-xs text-zinc-500">
                  {when(s.at)} · {t("ยอดตอนส่ง {amount}", { amount: baht(s.amount) })}
                </span>
              </span>
              {s.paid ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{t("รอตรวจ")}</span>
              )}
            </div>
            <button className="min-h-11 w-full rounded-2xl bg-sky-50 text-sm font-semibold text-sky-700" disabled={loading === s.id} onClick={() => show(s.id)}>
              {loading === s.id ? t("กำลังโหลด...") : s.id in images ? t("ซ่อนสลิป") : t("ดูสลิป")}
            </button>
            {images[s.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[s.id]!} alt={t("สลิปโอนเงิน")} className="w-full rounded-xl" />
            )}
            {s.id in images && !images[s.id] && <p className="text-xs text-zinc-500">{t("ไม่พบรูป")}</p>}
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">{all.length ? t("ไม่พบชื่อที่ค้นหา") : t("เดือนนี้ยังไม่มีใครส่งสลิป")}</Card>
      )}
      <p className="text-xs text-zinc-500">{t("หน้านี้ไว้ดูย้อนหลัง กดรับเงินหรือลบสลิปที่หน้าวันนี้หรือสมาชิก")}</p>
    </>
  );
}
