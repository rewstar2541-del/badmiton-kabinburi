"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import type { Poll } from "@/lib/types";
import { savedPin, useMe } from "./PickMe";
import { Auto } from "@/lib/autoTranslate";
import { Button, Card, inputClass } from "./ui";

const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });

/** โหวตที่ยังเปิดอยู่และวันให้เลือกยังไม่ผ่านไปหมด */
function openPolls(polls: Poll[] | undefined) {
  const d = today();
  return (polls ?? []).filter((p) => !p.closed && p.dates.some((x) => x >= d));
}

const count = (p: Poll, date: string) => Object.values(p.votes).filter((v) => v.includes(date)).length;

/** ผู้เล่นโหวตวันที่ว่าง (เลือกได้หลายวัน) */
export function PollVote() {
  const { state, social } = useStore();
  const [me] = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const polls = openPolls(state.polls);
  if (!me || !polls.length) return null;

  const toggle = async (p: Poll, date: string) => {
    const mine = p.votes[me] ?? [];
    const next = mine.includes(date) ? mine.filter((x) => x !== date) : [...mine, date];
    setBusy(true);
    const err = await social({ kind: "vote", poll: p.id, dates: next }, me, savedPin.get());
    setBusy(false);
    setError(err ? t(err) : "");
  };

  return (
    <>
      {polls.map((p) => (
        <Card key={p.id} className="space-y-3 ring-2 ring-sky-300">
          <div>
            <h3 className="font-display font-semibold">
              <Auto text={p.question} />
            </h3>
            <p className="text-sm text-zinc-500">{t("แตะวันที่คุณว่าง เลือกได้หลายวัน")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.dates.map((d) => {
              const on = (p.votes[me] ?? []).includes(d);
              return (
                <button
                  key={d}
                  disabled={busy}
                  aria-pressed={on}
                  onClick={() => toggle(p, d)}
                  className={`rounded-2xl px-3 py-2 text-left text-sm font-semibold ${on ? "bg-ink text-white" : "bg-zinc-100 text-ink"}`}
                >
                  {on && "✓ "}
                  {dayLabel(d)}
                  <span className={`block text-[11px] font-medium ${on ? "text-white/70" : "text-zinc-500"}`}>{t("{n} คนว่าง", { n: count(p, d) })}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </Card>
      ))}
    </>
  );
}

/** แอดมิน: สร้างโหวต ดูผล แล้วเลือกวัน (เปิดประกาศวันนั้นให้เลย) compact = แสดงเฉพาะโหวตที่เปิดอยู่ */
export function PollAdmin({ compact }: { compact?: boolean }) {
  const { state, dispatch, auth } = useStore();
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [dates, setDates] = useState<string[]>(["", ""]);
  const [show, setShow] = useState<string | null>(null);
  if (!auth.isAdmin) return null;
  const polls = openPolls(state.polls);
  if (compact && !polls.length) return null;
  const byId = new Map(state.players.map((p) => [p.id, p.name]));
  const picked = [...new Set(dates.filter((d) => d && d >= today()))].sort();
  const valid = picked.length >= 2;

  const create = () => {
    if (!valid) return;
    dispatch({ type: "createPoll", question: question.trim() || "ตีเพิ่มวันไหนดี", dates: picked });
    setCreating(false);
    setQuestion("");
    setDates(["", ""]);
  };
  const choose = (p: Poll, date: string) => {
    if (!confirm(t("เลือก {day} แล้วเปิดลงชื่อ?", { day: dayLabel(date) }))) return;
    dispatch({ type: "closePoll", id: p.id, chosen: date });
    const day = state.days.find((d) => d.date === date);
    if (day?.announcement === undefined) dispatch({ type: "setAnnouncement", date, message: "ตีเพิ่มตามผลโหวต", title: null });
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("โหวตวันตีพิเศษ")}</h3>
        {!compact && !creating && (
          <button className="shrink-0 text-sm font-semibold text-zinc-600 underline" onClick={() => setCreating(true)}>
            {t("+ สร้างโหวต")}
          </button>
        )}
      </div>
      {creating && (
        <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <input className={inputClass} placeholder={t("ตีเพิ่มวันไหนดี")} maxLength={80} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <p className="text-xs text-zinc-500">{t("ใส่วันให้เลือก 2-4 วัน")}</p>
          <div className="grid grid-cols-2 gap-2">
            {dates.map((d, i) => (
              <input
                key={i}
                type="date"
                min={today()}
                className={inputClass}
                value={d}
                aria-label={t("วันที่")}
                onChange={(e) => setDates(dates.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
          {dates.length < 4 && (
            <button className="text-sm font-semibold text-zinc-600 underline" onClick={() => setDates([...dates, ""])}>
              {t("+ เพิ่มวัน")}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setCreating(false)}>{t("ยกเลิก")}</Button>
            <Button variant="accent" disabled={!valid} onClick={create}>
              {t("เปิดโหวต")}
            </Button>
          </div>
        </div>
      )}
      {polls.length === 0 && !creating && <p className="text-sm text-zinc-500">{t("ยังไม่มีโหวต สร้างเพื่อถามว่าวันไหนคนว่าง")}</p>}
      {polls.map((p) => {
        const voters = Object.keys(p.votes).filter((id) => p.votes[id].length).length;
        const best = Math.max(0, ...p.dates.map((d) => count(p, d)));
        return (
          <div key={p.id} className="space-y-2 rounded-2xl bg-zinc-50 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 font-semibold">
                <Auto text={p.question} />
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{t("โหวตแล้ว {n} คน", { n: voters })}</span>
            </div>
            <ul className="space-y-1.5">
              {p.dates.map((d) => {
                const n = count(p, d);
                const names = Object.entries(p.votes)
                  .filter(([, v]) => v.includes(d))
                  .map(([id]) => byId.get(id) ?? "?");
                return (
                  <li key={d} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button className="min-w-0 flex-1 text-left text-sm" onClick={() => setShow(show === p.id + d ? null : p.id + d)}>
                        <span className={`font-semibold ${n === best && n > 0 ? "text-emerald-700" : ""}`}>{dayLabel(d)}</span>
                        <span className="ml-2 text-zinc-500">{t("{n} คนว่าง", { n })}</span>
                      </button>
                      <button className="shrink-0 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink" onClick={() => choose(p, d)}>
                        {t("เลือกวันนี้")}
                      </button>
                    </div>
                    {show === p.id + d && names.length > 0 && <p className="text-xs text-zinc-500">{names.join(", ")}</p>}
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-3 text-xs font-semibold text-zinc-500">
              <button className="underline" onClick={() => dispatch({ type: "closePoll", id: p.id })}>
                {t("ปิดโหวต")}
              </button>
              <button className="underline" onClick={() => confirm(t("ลบโหวตนี้?")) && dispatch({ type: "removePoll", id: p.id })}>
                {t("ลบ")}
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
