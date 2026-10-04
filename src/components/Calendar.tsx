"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import { Button, Card, Icon, SectionTitle, inputClass } from "./ui";
import { Auto, useAuto } from "@/lib/autoTranslate";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** ปฏิทินก๊วน: วันงดเล่น และวันที่มีประกาศจัดก๊วน แอดมินแตะวันเพื่อตั้งวันงดเล่น */
export function ClubCalendar() {
  const { state, dispatch, auth } = useStore();
  const now = today();
  const [view, setView] = useState(() => {
    const [y, m] = now.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const closedReason = useAuto((picked && state.closed[picked]) || "");

  const first = new Date(view.y, view.m, 1);
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const sessions = new Set(state.days.filter((d) => d.announcement !== undefined).map((d) => d.date));
  // ชื่อวันในสัปดาห์ เริ่มวันอาทิตย์ (2026-10-04 เป็นวันอาทิตย์)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 9, 4 + i).toLocaleDateString(locale(), { weekday: "narrow" }),
  );
  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(null);
  };
  const upcoming = Object.entries(state.closed)
    .filter(([d]) => d >= now)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3);

  return (
    <>
      <SectionTitle>{t("ปฏิทินก๊วน")}</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <button className="grid size-9 place-items-center rounded-full bg-zinc-100" onClick={() => shift(-1)} aria-label={t("เดือนก่อน")}>
            ‹
          </button>
          <span className="font-display font-semibold">
            {first.toLocaleDateString(locale(), { month: "long", year: "numeric" })}
          </span>
          <button className="grid size-9 place-items-center rounded-full bg-zinc-100" onClick={() => shift(1)} aria-label={t("เดือนถัดไป")}>
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-400">
          {weekdays.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />;
            const date = ymd(view.y, view.m, d);
            const closed = date in state.closed;
            const session = sessions.has(date);
            return (
              <button
                key={i}
                onClick={() => {
                  setPicked(picked === date ? null : date);
                  setReason(state.closed[date] ?? "");
                }}
                className={`relative grid aspect-square place-items-center rounded-xl text-sm tabular-nums ${
                  closed ? "bg-red-50 font-semibold text-red-600 line-through" : session ? "bg-lime/40 font-semibold" : "bg-zinc-50"
                } ${date === now ? "ring-2 ring-ink" : ""} ${picked === date ? "outline-2 outline-offset-1 outline-sky-400" : ""}`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="size-3 rounded bg-lime/40" /> {t("มีจัดก๊วน")}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded bg-red-50 ring-1 ring-red-200" /> {t("งดเล่น")}
          </span>
        </div>

        {picked && (
          <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
            <div className="text-sm font-semibold">
              {new Date(picked + "T00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {auth.isAdmin ? (
              <>
                <input
                  className={inputClass}
                  placeholder={t("เหตุผล เช่น สนามปิด, วันหยุดยาว")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      dispatch({ type: "setClosed", date: picked, reason: reason.trim() });
                      setPicked(null);
                    }}
                  >
                    {picked in state.closed ? t("บันทึกวันงดเล่น") : t("ตั้งเป็นวันงดเล่น")}
                  </Button>
                  {picked in state.closed && (
                    <Button
                      onClick={() => {
                        dispatch({ type: "setClosed", date: picked, reason: null });
                        setPicked(null);
                      }}
                    >
                      {t("เปิดเล่นตามปกติ")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-600">
                {picked in state.closed
                  ? t("งดเล่น") + (closedReason ? `: ${closedReason}` : "")
                  : sessions.has(picked)
                    ? t("มีจัดก๊วน")
                    : t("ยังไม่มีประกาศ")}
              </p>
            )}
          </div>
        )}

        {upcoming.length > 0 && (
          <ul className="space-y-1 text-sm">
            {upcoming.map(([d, r]) => (
              <li key={d} className="flex items-center gap-2 text-red-600">
                <Icon.X width={14} height={14} />
                <span className="font-semibold">
                  {new Date(d + "T00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="min-w-0 truncate text-zinc-500">{r || t("งดเล่น")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** แถบแจ้งว่าวันนี้งดเล่น */
export function ClosedBanner({ reason }: { reason: string }) {
  return (
    <div className="flex gap-3 rounded-3xl bg-red-50 p-4 text-red-700">
      <Icon.X className="shrink-0" />
      <div>
        <div className="font-display font-semibold">{t("วันนี้งดเล่น")}</div>
        {reason && <p className="text-sm"><Auto text={reason} /></p>}
      </div>
    </div>
  );
}
