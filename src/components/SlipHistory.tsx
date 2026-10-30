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
  // เปิดดูได้ทีละใบ ไม่เก็บรูปค้างไว้หลายใบ (มือถือเครื่องเล็กจะหน่วง)
  const [open, setOpen] = useState<{ id: string; img: string | null } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const isCurrent = month >= monthOf(date);

  // ปิดยอดแล้ว = วันที่ส่งถูกกดจ่ายแล้ว หรือกดจ่ายวันไหนก็ได้หลังส่งสลิป (โอนยอดค้างวันที่ไม่ได้มา)
  // หรือจ่ายรายเดือนของเดือนที่ส่ง / เดือนก่อนสำหรับคนรายเดือน (โอนค่าเดือนที่แล้วช่วงต้นเดือน)
  const paidAfter = (playerId: string, at: number) =>
    state.days.some((d) => d.checkIns.some((c) => c.playerId === playerId && c.paidAt && c.paidAt >= at));
  const all = state.days
    .filter((d) => d.date.startsWith(month))
    .flatMap((d) =>
      (d.slips ?? []).map((s) => ({
        ...s,
        player: byId.get(s.playerId),
        paid: Boolean(
          d.checkIns.find((c) => c.playerId === s.playerId)?.paidAt ||
            state.monthly[month]?.[s.playerId] ||
            (byId.get(s.playerId)?.plan === "monthly" && state.monthly[shiftMonth(month, -1)]?.[s.playerId]) ||
            paidAfter(s.playerId, s.at),
        ),
      })),
    )
    .sort((a, b) => b.at - a.at);
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((s) => (s.player?.name ?? "").toLowerCase().includes(needle)) : all;
  const waiting = all.filter((s) => !s.paid).length;

  const show = async (id: string) => {
    setError(null);
    if (open?.id === id) return setOpen(null);
    setLoading(id);
    try {
      const img = await Promise.race([
        slipImage(id),
        new Promise<never>((_, fail) => setTimeout(() => fail(new Error("timeout")), 20000)),
      ]);
      setOpen({ id, img });
    } catch {
      setError({ id, text: t("โหลดสลิปไม่สำเร็จ ลองใหม่") });
    } finally {
      setLoading((cur) => (cur === id ? null : cur));
    }
  };
  const go = (delta: number) => {
    setMonth(shiftMonth(month, delta));
    setOpen(null);
    setError(null);
  };

  const when = (at: number) =>
    new Date(at).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="flex items-center justify-between rounded-3xl bg-ink px-3 py-3 text-white">
        <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => go(-1)} aria-label={t("เดือนก่อน")}>
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
          <div className="text-sm text-white/70">
            <span className="whitespace-nowrap">{t("สลิป {n} รูป", { n: all.length })}</span>
            {waiting > 0 && <span className="whitespace-nowrap"> · {t("รอตรวจ {n}", { n: waiting })}</span>}
          </div>
        </div>
        <button
          className="grid size-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"
          onClick={() => go(1)}
          disabled={isCurrent}
          aria-label={t("เดือนถัดไป")}
        >
          ›
        </button>
      </div>

      <p className="text-sm text-zinc-500">{t("หน้านี้ไว้ดูย้อนหลัง กดรับเงินหรือลบสลิปที่หน้าวันนี้หรือสมาชิก")}</p>
      {all.length > 0 && <SearchInput value={q} onChange={setQ} />}

      <ul className="space-y-2">
        {shown.map((s) => (
          <li key={s.id} className="space-y-2 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
            <div className="flex items-center gap-3">
              <Avatar name={s.player?.name ?? "?"} photo={s.player?.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.player?.name ?? t("ผู้เล่นที่ถูกลบ")}</span>
                <span className="block text-sm text-zinc-600">{when(s.at)}</span>
                <span className="block text-sm font-semibold">{t("ยอดตอนส่ง {amount}", { amount: baht(s.amount) })}</span>
              </span>
              {s.paid ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{t("รอตรวจ")}</span>
              )}
            </div>
            <button className="min-h-11 w-full rounded-2xl bg-sky-50 text-sm font-semibold text-sky-700" disabled={loading === s.id} onClick={() => show(s.id)}>
              {loading === s.id ? t("กำลังโหลด...") : open?.id === s.id ? t("ซ่อนสลิป") : t("ดูสลิป")}
            </button>
            {error?.id === s.id && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error.text}</p>}
            {open?.id === s.id &&
              (open.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.img} alt={t("สลิปโอนเงิน")} className="max-h-[70vh] w-full rounded-xl object-contain" />
              ) : (
                <p className="text-sm text-zinc-500">{t("ไม่พบรูป")}</p>
              ))}
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">{all.length ? t("ไม่พบชื่อที่ค้นหา") : t("เดือนนี้ยังไม่มีใครส่งสลิป")}</Card>
      )}
    </>
  );
}
