"use client";

import { useState } from "react";
import { billFor } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { annualStatus, monthOf, type Player } from "@/lib/types";
import { monthLabel, shiftMonth } from "./Members";
import { Avatar, Button, Card, SearchInput, baht } from "./ui";

/** คิดเงิน > ประวัติโอน: สลิปทุกใบที่ผู้เล่นส่งมาในเดือนที่เลือก ใหม่สุดก่อน (แอดมิน) */
export function SlipHistory() {
  const { state, slipImage, dispatch } = useStore();
  const { date } = useToday();
  const [month, setMonth] = useState(monthOf(date));
  const [q, setQ] = useState("");
  // เปิดดูได้ทีละใบ ไม่เก็บรูปค้างไว้หลายใบ (มือถือเครื่องเล็กจะหน่วง)
  const [open, setOpen] = useState<{ id: string; img: string | null } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  // สลิปที่กดยืนยันรับเงินไว้ รอกดยืนยันซ้ำ (กันกดพลาด)
  const [confirming, setConfirming] = useState<string | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const isCurrent = month >= monthOf(date);

  // ปิดยอดแล้ว = วันที่ส่งถูกกดจ่ายแล้ว หรือกดจ่ายวันไหนก็ได้หลังส่งสลิป (โอนยอดค้างวันที่ไม่ได้มา)
  // หรือจ่ายรายเดือนของเดือนที่ส่ง / เดือนก่อนสำหรับคนรายเดือน (โอนค่าเดือนที่แล้วช่วงต้นเดือน)
  const paidAfter = (playerId: string, at: number) =>
    state.days.some((d) => d.checkIns.some((c) => c.playerId === playerId && c.paidAt && c.paidAt >= at));
  const all = state.days
    .filter((d) => d.date.startsWith(month))
    .flatMap((d) =>
      (d.slips ?? []).map((s) => {
        // แขกจ่ายรวมในบิลคนพามา ดูการจ่ายของคนพามาด้วย
        const pid = byId.get(s.playerId)?.guestOf ?? s.playerId;
        return {
          ...s,
          day: d,
          player: byId.get(s.playerId),
          paid: Boolean(
            d.checkIns.find((c) => c.playerId === s.playerId)?.paidAt ||
              state.monthly[month]?.[pid] ||
              (byId.get(pid)?.plan === "monthly" && state.monthly[shiftMonth(month, -1)]?.[pid]) ||
              paidAfter(pid, s.at),
          ),
        };
      }),
    )
    .sort((a, b) => b.at - a.at);
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((s) => (s.player?.name ?? "").toLowerCase().includes(needle)) : all;

  // ยังไม่ปิดยอด: ทางเลือกที่แอดมินกดรับได้ คนรายเดือนที่ยังไม่จ่ายเดือนนั้นขึ้นค่ารายเดือนก่อน
  // (ต้นเดือนมีเดือนก่อนด้วยถ้ายังค้าง เพราะมักโอนค่าเดือนที่แล้ว) แล้วค่อยยอดรายวันที่ค้างถึงวันที่ส่งสลิป
  type Owed = { kind: "day"; amount: number; payer: Player } | { kind: "month"; month: string; amount: number; payer: Player };
  const owedOf = (s: (typeof all)[number]): Owed[] => {
    // แขกจ่ายรวมในบิลคนพามา ปิดยอดที่คนพามา (ปิดยอดแขกไปด้วย)
    const p = s.player?.guestOf ? byId.get(s.player.guestOf) : s.player;
    if (s.paid || !p) return [];
    const out: Owed[] = [];
    if (p.plan === "monthly" && !["active", "soon"].includes(annualStatus(p, s.day.date)?.kind ?? ""))
      // เดือนที่เลือกขึ้นก่อน เดือนก่อนเฉพาะสลิปช่วงต้นเดือน (วันที่ 1-10)
      for (const m of Number(s.day.date.slice(8)) <= 10 ? [month, shiftMonth(month, -1)] : [month])
        if (!state.monthly[m]?.[p.id]) out.push({ kind: "month", month: m, amount: state.settings.monthlyFee, payer: p });
    const total = billFor(state.days, s.day, p, state.settings, state.monthly, state.players).total;
    if (total > 0) out.push({ kind: "day", amount: total, payer: p });
    return out;
  };
  // ไม่มียอดค้างแล้ว (เช่นจ่ายสดไปก่อนส่งสลิป) ไม่นับเป็นรอตรวจ
  const waiting = all.filter((s) => !s.paid && (owedOf(s).length || !s.player)).length;
  const receive = (s: (typeof all)[number], owed: Owed) => {
    if (owed.kind === "day") dispatch({ type: "markPaid", date: s.day.date, playerId: owed.payer.id });
    else dispatch({ type: "setMonthlyPaid", month: owed.month, playerId: owed.payer.id, paid: true });
    setConfirming(null);
  };

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

      <p className="text-sm text-zinc-500">{t("ดูสลิปแล้วยอดตรง กดยืนยันรับเงินที่สลิปนั้นได้เลย")}</p>
      {all.length > 0 && <SearchInput value={q} onChange={setQ} />}

      <ul className="space-y-2">
        {shown.map((s) => {
          const owed = owedOf(s);
          const payer = owed[0]?.payer;
          return (
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
              ) : !owed.length && s.player ? (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{t("ไม่มียอดค้าง")}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{t("รอตรวจ")}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="min-h-11 flex-1 rounded-2xl bg-sky-50 text-sm font-semibold text-sky-700" disabled={loading === s.id} onClick={() => show(s.id)}>
                {loading === s.id ? t("กำลังโหลด...") : open?.id === s.id ? t("ซ่อนสลิป") : t("ดูสลิป")}
              </button>
              {payer && confirming !== s.id && (
                <Button variant="accent" className="min-h-11 flex-1 !px-2" onClick={() => setConfirming(s.id)}>
                  {t("ยืนยันรับเงิน")}
                </Button>
              )}
            </div>
            {error?.id === s.id && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error.text}</p>}
            {open?.id === s.id &&
              (open.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.img} alt={t("สลิปโอนเงิน")} className="max-h-[70vh] w-full rounded-xl object-contain" />
              ) : (
                <p className="text-sm text-zinc-500">{t("ไม่พบรูป")}</p>
              ))}
            {payer && confirming === s.id && (
              <div className="space-y-2 rounded-2xl bg-lime/20 p-3">
                <p className="text-sm">{t("ยอดตอนส่ง {amount}", { amount: baht(s.amount) })} · {t("เลือกว่ารับเงินค่าอะไรของ {name}", { name: payer.name })}</p>
                {!owed.some((o) => o.amount === s.amount) && (
                  <p className="text-sm font-semibold text-amber-800">{t("ยอดไม่ตรงกับสลิป ดูสลิปให้แน่ใจก่อน")}</p>
                )}
                {owed.map((o) => (
                  <Button key={o.kind === "day" ? "day" : o.month} variant="accent" className="w-full" onClick={() => receive(s, o)}>
                    {o.kind === "day"
                      ? t("รับยอดค้างรายวัน {amount}", { amount: baht(o.amount) })
                      : t("รับค่ารายเดือน {month} {amount}", { month: monthLabel(o.month), amount: baht(o.amount) })}
                  </Button>
                ))}
                <Button className="w-full" onClick={() => setConfirming(null)}>
                  {t("ยกเลิก")}
                </Button>
              </div>
            )}
          </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">{all.length ? t("ไม่พบชื่อที่ค้นหา") : t("เดือนนี้ยังไม่มีใครส่งสลิป")}</Card>
      )}
    </>
  );
}
