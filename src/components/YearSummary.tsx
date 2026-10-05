"use client";

import { useMemo, useState } from "react";
import { appName } from "@/lib/brand";
import { yearSummary } from "@/lib/club";
import { locale, t } from "@/lib/i18n";
import { today } from "@/lib/store";
import { useHistory, yearLabel } from "./Ranking";
import { Avatar, Button } from "./ui";

const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { day: "numeric", month: "long" });

/** สรุปก๊วนรายปี แชร์เป็นลิงก์ ?summary=YYYY ได้ (ไม่ต้องเข้าสู่ระบบ) */
export function YearSummaryView({ year: initial, onClose }: { year?: string; onClose?: () => void }) {
  const thisYear = today().slice(0, 4);
  const [year, setYear] = useState(initial && /^\d{4}$/.test(initial) ? initial : thisYear);
  const { data, failed } = useHistory(`${year}-01-01`);
  const s = useMemo(() => (data ? yearSummary(data, year) : null), [data, year]);
  const byId = new Map((data?.players ?? []).map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const [copied, setCopied] = useState(false);
  const [title, sub] = appName();

  const share = async () => {
    const url = `${location.origin}/?summary=${year}`;
    const text = t("สรุปก๊วนปี {year}", { year: yearLabel(year) });
    try {
      if (navigator.share) return await navigator.share({ title: text, url });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      prompt(t("คัดลอกลิงก์นี้"), url);
    }
  };

  const stat = (label: string, value: number | string) => (
    <div className="rounded-2xl bg-white/10 px-3 py-3">
      <div className="font-display text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-white/70">{label}</div>
    </div>
  );
  const people = (title: string, list: { id: string; n: number }[], unit: string) =>
    list.length ? (
      <section className="space-y-2">
        <h3 className="font-display font-semibold">{title}</h3>
        <ol className="space-y-1.5">
          {list.map((x, i) => (
            <li key={x.id} className="flex items-center gap-2.5">
              <span className="w-5 text-center font-display font-semibold text-amber-600">{i + 1}</span>
              <Avatar name={name(x.id)} photo={byId.get(x.id)?.photo} size={30} />
              <span className="min-w-0 flex-1 truncate font-medium">{name(x.id)}</span>
              <span className="shrink-0 text-sm text-zinc-500 tabular-nums">{t(unit, { n: x.n })}</span>
            </li>
          ))}
        </ol>
      </section>
    ) : null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="space-y-4 rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm text-lime">
              {title} {sub}
            </div>
            <h2 className="font-display text-2xl font-semibold">{t("สรุปก๊วนปี {year}", { year: yearLabel(year) })}</h2>
          </div>
          <select
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm"
            value={year}
            aria-label={t("ปี")}
            onChange={(e) => setYear(e.target.value)}
          >
            {[0, 1, 2].map((n) => {
              const y = String(Number(thisYear) - n);
              return (
                <option key={y} value={y} className="text-ink">
                  {yearLabel(y)}
                </option>
              );
            })}
          </select>
        </div>
        {s ? (
          <div className="grid grid-cols-2 gap-2">
            {stat(t("วันที่เปิดก๊วน"), s.sessions)}
            {stat(t("เกมที่เล่น"), s.games)}
            {stat(t("คนที่มาเล่น"), s.players)}
            {stat(t("ลูกแบดที่ใช้"), s.shuttles)}
          </div>
        ) : (
          <p className="text-sm text-white/70">{failed ? t("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง") : t("กำลังโหลด...")}</p>
        )}
      </div>

      {s && s.sessions === 0 && <p className="px-1 text-sm text-zinc-500">{t("ปีนี้ยังไม่มีข้อมูล")}</p>}
      {s && s.sessions > 0 && (
        <div className="space-y-5 rounded-3xl bg-white p-5 text-ink shadow-sm">
          {people(t("มาบ่อยที่สุด"), s.topVisitors, "{n} ครั้ง")}
          {people(t("เล่นมากที่สุด"), s.topGames, "{n} เกม")}
          {people(t("ชนะมากที่สุด"), s.topWinners, "ชนะ {n} เกม")}
          {s.bestDuo && (
            <section className="space-y-2">
              <h3 className="font-display font-semibold">{t("คู่หูยอดเยี่ยม")}</h3>
              <div className="flex items-center gap-2.5 rounded-2xl bg-lime/30 p-3">
                <Avatar name={name(s.bestDuo.ids[0])} photo={byId.get(s.bestDuo.ids[0])?.photo} size={34} />
                <Avatar name={name(s.bestDuo.ids[1])} photo={byId.get(s.bestDuo.ids[1])?.photo} size={34} />
                <span className="min-w-0 flex-1 font-semibold">
                  {name(s.bestDuo.ids[0])} + {name(s.bestDuo.ids[1])}
                </span>
                <span className="shrink-0 text-sm text-zinc-600">{t("ชนะ {w} จาก {g} เกม", { w: s.bestDuo.wins, g: s.bestDuo.games })}</span>
              </div>
            </section>
          )}
          <section className="space-y-1 text-sm text-zinc-600">
            {s.busiestDay && <p>{t("วันที่คนมามากที่สุด: {day} ({n} คน)", { day: dayLabel(s.busiestDay.date), n: s.busiestDay.players })}</p>}
            {s.longestGame && <p>{t("เกมที่ยาวที่สุด: {n} นาที ({day})", { n: s.longestGame.minutes, day: dayLabel(s.longestGame.date) })}</p>}
            <p>{t("มาเล่นรวมทั้งปี {n} ครั้ง", { n: s.visits })}</p>
          </section>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {onClose ? <Button onClick={onClose}>{t("ปิด")}</Button> : <Button onClick={() => (location.href = "/")}>{t("เปิดแอพ")}</Button>}
        <Button variant="accent" onClick={share}>
          {copied ? t("คัดลอกลิงก์แล้ว") : t("แชร์")}
        </Button>
      </div>
    </div>
  );
}
