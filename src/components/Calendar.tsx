"use client";

import { eventStyle } from "@/lib/eventKinds";
import { waitingPosition } from "@/lib/social";
import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import { Button, Card, Icon, SectionTitle, baht, inputClass } from "./ui";
import { Auto, useAuto } from "@/lib/autoTranslate";
import { savedPin, useMe } from "./PickMe";
import { EventForm } from "./AnnounceCard";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * ปฏิทินก๊วน: วันจัดก๊วน และวันงดเล่น
 * แอดมินแตะวันเพื่อตั้งเป็นวันจัดก๊วน (ตั้งล่วงหน้าได้ เปิดให้ลงชื่อ) หรือวันงดเล่น
 * ผู้เล่นแตะวันจัดก๊วนที่ยังไม่ถึง เพื่อลงชื่อล่วงหน้า
 */
export function ClubCalendar({ bare }: { bare?: boolean } = {}) {
  const { state, dispatch, auth, self } = useStore();
  const [me] = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = today();
  const [view, setView] = useState(() => {
    const [y, m] = now.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [picked, setPicked] = useState<string | null>(null);
  // แอดมินเลือกหลายวันพร้อมกัน
  const [multi, setMulti] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const closedReason = useAuto((picked && state.closed[picked]) || "");
  const pickedDay = picked ? state.days.find((d) => d.date === picked) : undefined;

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
  const nextSessions = [...sessions].filter((d) => d >= now && !(d in state.closed)).sort().slice(0, 3);
  const dayLabel = (d: string) => new Date(d + "T00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
  const signups = pickedDay?.signups ?? [];
  const mine = Boolean(me && signups.some((x) => x.playerId === me));
  const setSession = (date: string, message: null) => {
    dispatch({ type: "setAnnouncement", date, message });
    setPicked(null);
  };
  const signUp = async (date: string, on: boolean) => {
    if (!me) return;
    setBusy(true);
    const err = await self(on ? "signUp" : "cancelSignUp", me, savedPin.get(), date);
    setBusy(false);
    setError(err ? t(err) : "");
  };

  return (
    <>
      {!bare && <SectionTitle>{t("ปฏิทินก๊วน")}</SectionTitle>}
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
        {auth.isAdmin && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 text-sm font-semibold">
            {[false, true].map((m) => (
              <button
                key={String(m)}
                aria-pressed={multi === m}
                onClick={() => {
                  setMulti(m);
                  setSel([]);
                  setPicked(null);
                }}
                className={`rounded-xl py-2 ${multi === m ? "bg-white text-ink shadow-sm" : "text-zinc-500"}`}
              >
                {m ? t("เลือกหลายวัน") : t("ทีละวัน")}
              </button>
            ))}
          </div>
        )}
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
            const evTitle = session ? state.days.find((x) => x.date === date)?.announcementTitle : undefined;
            return (
              <button
                key={i}
                onClick={() => {
                  if (multi) {
                    setSel(sel.includes(date) ? sel.filter((x) => x !== date) : [...sel, date].sort());
                    return;
                  }
                  setPicked(picked === date ? null : date);
                  setReason(state.closed[date] ?? "");
                  setError("");
                }}
                className={`relative grid aspect-square place-items-center rounded-xl text-sm tabular-nums ${
                  closed ? "bg-red-50 font-semibold text-red-600 line-through" : session ? `${eventStyle(evTitle).cell} font-semibold` : "bg-zinc-50"
                } ${date === now ? "ring-2 ring-ink" : ""} ${picked === date ? "outline-2 outline-offset-1 outline-sky-400" : ""} ${
                  multi && sel.includes(date) ? "!bg-sky-500 !text-white !no-underline" : ""
                }`}
              >
                {d}
                {evTitle && (
                  <span className="absolute -top-1 -right-1 text-[11px] leading-none" aria-hidden>
                    {eventStyle(evTitle).emoji}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {[null, "กินเลี้ยง", "ทำความสะอาดสนาม", "แข่งขันในก๊วน", "อื่นๆ"].map((k) => (
            <span key={k ?? "s"} className="flex items-center gap-1">
              <span className={`size-3 rounded ${eventStyle(k).cell}`} /> {eventStyle(k).emoji} {k === null ? t("จัดก๊วน") : k === "อื่นๆ" ? t("อีเว้นพิเศษ") : t(k)}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="size-3 rounded bg-red-50 ring-1 ring-red-200" /> {t("งดเล่น")}
          </span>
        </div>
        {auth.isAdmin && !picked && !multi && <p className="text-xs text-zinc-500">{t("แตะวันที่เพื่อสร้างอีเว้น หรือตั้งวันงดเล่น")}</p>}
        {auth.isAdmin && multi && <MultiPanel sel={sel} setSel={setSel} view={view} />}

        {picked && (
          <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
            <div className="text-sm font-semibold">
              {new Date(picked + "T00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {auth.isAdmin ? (
              <>
                <EventForm key={picked} date={picked} onDone={() => setPicked(null)} />
                {sessions.has(picked) && (
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                    <span>{t("ลงชื่อแล้ว {n} คน", { n: signups.length })}</span>
                    <button
                      className="font-semibold text-red-500"
                      onClick={() => {
                        if (confirm(t("ยกเลิกวันจัดก๊วนนี้?"))) setSession(picked, null);
                      }}
                    >
                      {t("ยกเลิกอีเว้นนี้")}
                    </button>
                  </div>
                )}
                <div className="space-y-2 border-t border-zinc-200 pt-2">
                  <input
                    className={inputClass}
                    placeholder={t("เหตุผล เช่น สนามปิด")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => {
                        if (sessions.has(picked)) dispatch({ type: "setAnnouncement", date: picked, message: null });
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
                </div>
              </>
            ) : picked in state.closed ? (
              <p className="text-sm text-zinc-600">{t("งดเล่น") + (closedReason ? `: ${closedReason}` : "")}</p>
            ) : sessions.has(picked) ? (
              <>
                <p className="text-sm text-zinc-600">
                  {pickedDay?.announcementTitle ? <><span className="font-semibold text-amber-700">{eventStyle(pickedDay.announcementTitle).emoji} {t("อีเว้นพิเศษ")}</span> · <Auto text={pickedDay.announcementTitle} /></> : t("มีจัดก๊วน")}
                  {pickedDay?.announcementFee ? <> · {t("คนละ {amount}", { amount: baht(pickedDay.announcementFee) })}</> : null}
                  {pickedDay?.announcement ? <> · <Auto text={pickedDay.announcement} /></> : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {pickedDay?.announcementCap
                    ? t("ลงชื่อแล้ว {n}/{cap} คน", { n: Math.min(signups.length, pickedDay.announcementCap), cap: pickedDay.announcementCap }) +
                      (signups.length > pickedDay.announcementCap ? ` · ${t("สำรอง {n} คน", { n: signups.length - pickedDay.announcementCap })}` : "")
                    : t("ลงชื่อแล้ว {n} คน", { n: signups.length })}
                </p>
                {me && pickedDay && waitingPosition(pickedDay, me) > 0 && (
                  <p className="text-xs font-semibold text-amber-700">{t("คุณอยู่รายชื่อสำรองลำดับที่ {n}", { n: waitingPosition(pickedDay, me) })}</p>
                )}
                {me && picked >= now && (
                  <Button variant={mine ? "ghost" : "primary"} className="w-full" disabled={busy} onClick={() => signUp(picked, !mine)}>
                    {mine
                      ? t("ยกเลิกลงชื่อ")
                      : pickedDay?.announcementCap && signups.length >= pickedDay.announcementCap
                        ? t("เต็มแล้ว ลงชื่อสำรอง")
                        : pickedDay?.announcementTitle
                          ? t("ลงชื่อไปร่วม")
                          : t("ลงชื่อว่าจะมา")}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-600">{t("ยังไม่มีประกาศ")}</p>
            )}
          </div>
        )}

        {nextSessions.length > 0 && (
          <ul className="space-y-1 text-sm">
            {nextSessions.map((d) => {
              const signed = me && state.days.find((x) => x.date === d)?.signups?.some((x) => x.playerId === me);
              return (
                <li key={d}>
                  <button
                    className="flex w-full items-center gap-2 text-left text-emerald-700"
                    onClick={() => {
                      setPicked(d);
                      setReason("");
                      setError("");
                    }}
                  >
                    <Icon.Check width={14} height={14} />
                    <span className="font-semibold">{d === now ? t("วันนี้") : dayLabel(d)}</span>
                    <span className="min-w-0 truncate text-zinc-500">
                      {eventStyle(state.days.find((x) => x.date === d)?.announcementTitle).emoji}{" "}
                      {state.days.find((x) => x.date === d)?.announcementTitle ? <Auto text={state.days.find((x) => x.date === d)!.announcementTitle!} /> : t("มีจัดก๊วน")}
                    </span>
                    {signed && <span className="ml-auto shrink-0 text-xs font-semibold">{t("ลงชื่อแล้ว")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
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

/** แอดมิน: เลือกหลายวัน (แตะในปฏิทิน หรือทำซ้ำทุกสัปดาห์) แล้วสร้างอีเว้น / วันงดเล่นทีเดียว */
function MultiPanel({ sel, setSel, view }: { sel: string[]; setSel: (v: string[]) => void; view: { y: number; m: number } }) {
  const { state, dispatch } = useStore();
  const now = today();
  const monthEnd = ymd(view.y, view.m, new Date(view.y, view.m + 1, 0).getDate());
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [from, setFrom] = useState(() => (ymd(view.y, view.m, 1) < now ? now : ymd(view.y, view.m, 1)));
  const [to, setTo] = useState(monthEnd);
  const [reason, setReason] = useState("");
  const names = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 4 + i).toLocaleDateString(locale(), { weekday: "short" }));
  const short = (d: string) => new Date(d + "T00:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });
  const withEvent = sel.filter((d) => state.days.some((x) => x.date === d && x.announcement !== undefined));

  const addWeekly = () => {
    const out = new Set(sel);
    const end = new Date(to + "T00:00");
    for (let d = new Date(from + "T00:00"); d <= end && out.size < 120; d.setDate(d.getDate() + 1)) {
      if (weekdays.includes(d.getDay())) out.add(ymd(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    setSel([...out].sort());
  };

  return (
    <div className="space-y-3 rounded-2xl bg-zinc-50 p-3">
      <div className="space-y-2">
        <div className="text-sm font-semibold">{t("ทำซ้ำทุกสัปดาห์")}</div>
        <div className="grid grid-cols-7 gap-1">
          {names.map((n, i) => (
            <button
              key={i}
              aria-pressed={weekdays.includes(i)}
              onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}
              className={`rounded-xl py-2 text-xs font-semibold ${weekdays.includes(i) ? "bg-ink text-white" : "bg-white text-zinc-600"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-500">
            {t("ตั้งแต่")}
            <input type="date" className={`${inputClass} mt-1`} value={from} min={now} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-zinc-500">
            {t("ถึง")}
            <input type="date" className={`${inputClass} mt-1`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <Button className="w-full" disabled={!weekdays.length || !from || !to || to < from} onClick={addWeekly}>
          {t("เลือกวันตามนี้")}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-3 text-sm">
        <span className="font-semibold">{t("เลือกแล้ว {n} วัน", { n: sel.length })}</span>
        {sel.length > 0 && (
          <button className="text-xs font-semibold text-zinc-500 underline" onClick={() => setSel([])}>
            {t("ล้างที่เลือก")}
          </button>
        )}
      </div>
      {sel.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("แตะวันในปฏิทินเพื่อเลือก หรือใช้ ทำซ้ำทุกสัปดาห์")}</p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">{sel.map(short).join(", ")}</p>
          <EventForm key={sel.join()} dates={sel} onDone={() => setSel([])} />
          <div className="space-y-2 border-t border-zinc-200 pt-3">
            <input className={inputClass} placeholder={t("เหตุผล เช่น สนามปิด")} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                for (const d of sel) {
                  if (state.days.some((x) => x.date === d && x.announcement !== undefined)) dispatch({ type: "setAnnouncement", date: d, message: null });
                  dispatch({ type: "setClosed", date: d, reason: reason.trim() });
                }
                setSel([]);
              }}
            >
              {t("ตั้งเป็นวันงดเล่น {n} วัน", { n: sel.length })}
            </Button>
            {withEvent.length > 0 && (
              <Button
                className="w-full"
                onClick={() => {
                  if (!confirm(t("ยกเลิกอีเว้น {n} วัน?", { n: withEvent.length }))) return;
                  for (const d of withEvent) dispatch({ type: "setAnnouncement", date: d, message: null });
                  setSel([]);
                }}
              >
                {t("ยกเลิกอีเว้นในวันที่เลือก ({n})", { n: withEvent.length })}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
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
