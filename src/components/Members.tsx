"use client";

import { useState } from "react";
import { billFor } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { annualStatus, monthOf, type Player } from "@/lib/types";
import { AnnualPaySheet, RulesEditor, fmt } from "./Annual";
import { ExportReport } from "./ExportReport";
import { Ledger } from "./Ledger";
import { PayQr } from "./PayQr";
import { SlipReview } from "./Slips";
import { Avatar, Button, Card, SearchInput, Sheet, baht } from "./ui";

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
}

type Tone = "ok" | "warn" | "bad" | "plain";
interface Status {
  text: string;
  tone: Tone;
  /** ต้องให้แอดมินทำอะไรสักอย่าง (ค้างจ่าย / ใกล้หมด / หมดอายุ) */
  todo: boolean;
}

const TONE: Record<Tone, string> = {
  ok: "bg-lime/30 text-ink",
  warn: "bg-amber-100 text-amber-900",
  bad: "bg-red-50 text-red-700",
  plain: "bg-zinc-100 text-zinc-600",
};

/** สถานะสมาชิกของคนนี้ในเดือนที่เลือก รวมรายเดือนและรายปีไว้ที่เดียว */
function statusOf(p: Player, month: string, today: string, paid: Record<string, number>): Status {
  const annual = annualStatus(p, today);
  if (annual?.kind === "upcoming") return { text: t("รายปี เริ่ม {date}", { date: fmt(annual.from ?? annual.until) }), tone: "ok", todo: false };
  if (annual?.kind === "active") return { text: t("รายปี ถึง {date}", { date: fmt(annual.until) }), tone: "ok", todo: false };
  if (annual?.kind === "soon")
    return { text: t("รายปี ใกล้หมด {date} (อีก {n} วัน)", { date: fmt(annual.until), n: annual.daysLeft }), tone: "warn", todo: true };
  if (paid[p.id]) return { text: t("รายเดือน จ่ายแล้ว"), tone: "ok", todo: false };
  if (annual?.kind === "expired") return { text: t("รายปี หมดอายุ {date}", { date: fmt(annual.until) }), tone: "bad", todo: annual.daysLeft >= -60 };
  if (p.plan === "monthly" && month === monthOf(today)) return { text: t("รายเดือน ยังไม่จ่าย"), tone: "warn", todo: true };
  return { text: p.plan === "monthly" ? t("รายเดือน") : t("รายวัน"), tone: "plain", todo: false };
}

/** คิดเงิน > สมาชิก: รายเดือนและรายปีรวมในหน้าเดียว รายชื่อเดียว ปุ่มรับเงินเดียว */
export function MembersView() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [month, setMonth] = useState(monthOf(date));
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Player | null>(null);
  const [pay, setPay] = useState<{ kind: "month" | "year"; player: Player } | null>(null);
  const [more, setMore] = useState<"summary" | "rules" | null>(null);
  const paid = state.monthly[month] ?? {};

  const members = state.players.filter((p) => !p.guestOf && !p.pending);
  const rows = members
    .map((p) => ({ p, s: statusOf(p, month, date, paid) }))
    .sort((a, b) => Number(b.s.todo) - Number(a.s.todo) || a.p.name.localeCompare(b.p.name, "th"));
  const todo = rows.filter((r) => r.s.todo);
  const shown = q.trim() ? rows.filter((r) => r.p.name.toLowerCase().includes(q.trim().toLowerCase())) : rows;
  const monthlyCount = members.filter((p) => paid[p.id]).length;
  const annualCount = members.filter((p) => ["active", "soon"].includes(annualStatus(p, date)?.kind ?? "")).length;

  const row = ({ p, s }: { p: Player; s: Status }) => (
    <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
      <Avatar name={p.name} photo={p.photo} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{p.name}</span>
        <span className={`mt-0.5 inline-block rounded-2xl px-2.5 py-0.5 text-sm font-semibold leading-snug ${TONE[s.tone]}`}>{s.text}</span>
      </span>
      <button className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-700" onClick={() => setPicked(p)}>
        {t("รับเงิน")}
      </button>
    </li>
  );

  return (
    <>
      <div className="flex items-center justify-between rounded-3xl bg-ink px-3 py-3 text-white">
        <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("เดือนก่อน")}>
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
          <div className="text-sm text-white/70">
            {t("รายเดือนจ่ายแล้ว {a} คน · รายปี {b} คน", { a: monthlyCount, b: annualCount })}
          </div>
        </div>
        <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("เดือนถัดไป")}>
          ›
        </button>
      </div>

      {todo.length > 0 && !q.trim() && (
        <div className="space-y-2 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <h3 className="font-display font-semibold text-amber-950">{t("ที่ต้องทำ {n} คน", { n: todo.length })}</h3>
          <ul className="space-y-2">{todo.map(row)}</ul>
        </div>
      )}

      <SearchInput value={q} onChange={setQ} />
      <ul className="space-y-2">{shown.filter((r) => q.trim() || !r.s.todo).map(row)}</ul>
      {shown.length === 0 && <Card className="py-10 text-center text-sm text-zinc-500">{members.length ? t("ไม่พบชื่อที่ค้นหา") : t("ยังไม่มีผู้เล่น")}</Card>}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setMore(more === "summary" ? null : "summary")}>
          {t("สรุปเดือน")}
        </Button>
        <Button variant="ghost" onClick={() => setMore(more === "rules" ? null : "rules")}>
          {t("กติกาวันหมดอายุรายปี")}
        </Button>
      </div>
      {more === "summary" && (
        <>
          <Ledger key={month} month={month} />
          <ExportReport month={month} />
        </>
      )}
      {more === "rules" && <RulesEditor />}

      {picked && !pay && (
        <Sheet onClose={() => setPicked(null)} title={<h3 className="font-display text-lg font-semibold">{t("รับเงินจาก {name}", { name: picked.name })}</h3>}>
          <div className="grid gap-2">
            {/* ค่าเล่นรายวันที่ค้าง (คนส่วนใหญ่โอนค่านี้ ไม่ใช่ค่ารายเดือน) แยกให้ชัด */}
            {(() => {
              const owed = billFor(state.days, day, picked, state.settings, state.monthly, state.players).total;
              return (
                <button
                  className="rounded-3xl bg-sky-50 p-4 text-left active:scale-[0.98] disabled:opacity-60"
                  disabled={owed <= 0}
                  onClick={() => {
                    if (!confirm(t("ได้รับค่าเล่นที่ค้างของ {name} {amount}?", { name: picked.name, amount: baht(owed) }))) return;
                    dispatch({ type: "markPaid", date, playerId: picked.id });
                    setPicked(null);
                  }}
                >
                  <span className="block font-display font-semibold">{t("ค่าเล่นรายวัน (ค่าสนาม ค่าลูก ค่าน้ำ)")}</span>
                  <span className="block text-sm text-zinc-500">{owed > 0 ? t("ค้าง {amount}", { amount: baht(owed) }) : t("ไม่มียอดค้าง")}</span>
                </button>
              );
            })()}
            <button
              className="rounded-3xl bg-zinc-100 p-4 text-left active:scale-[0.98] disabled:opacity-60"
              disabled={!state.settings.monthlyFee && !paid[picked.id]}
              onClick={() => {
                setPay({ kind: "month", player: picked });
              }}
            >
              <span className="block font-display font-semibold">{t("ค่าสมาชิกรายเดือน")}</span>
              <span className="block text-sm text-zinc-500">
                {state.settings.monthlyFee || paid[picked.id]
                  ? `${monthLabel(month)} · ${baht(state.settings.monthlyFee)}${paid[picked.id] ? ` · ${t("จ่ายแล้ว")}` : ""}`
                  : t("ยังไม่ได้ตั้งค่ารายเดือน (ตั้งที่ ตั้งค่า)")}
              </span>
            </button>
            <button
              className="rounded-3xl bg-lime p-4 text-left text-ink active:scale-[0.98]"
              onClick={() => {
                setPay({ kind: "year", player: picked });
              }}
            >
              <span className="block font-display font-semibold">{t("ค่าสมาชิกรายปี")}</span>
              <span className="block text-sm">{picked.annualUntil ? t("ต่ออายุหรือแก้วันหมดอายุ") : t("เริ่มสมาชิกรายปี")}</span>
            </button>
          </div>
        </Sheet>
      )}
      {pay?.kind === "month" && (
        <MonthlyPaySheet
          player={pay.player}
          month={month}
          onClose={() => {
            setPay(null);
            setPicked(null);
          }}
        />
      )}
      {pay?.kind === "year" && (
        <AnnualPaySheet
          key={pay.player.id}
          player={pay.player}
          onClose={() => {
            setPay(null);
            setPicked(null);
          }}
        />
      )}
    </>
  );
}

function MonthlyPaySheet({ player, month, onClose }: { player: Player; month: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const fee = state.settings.monthlyFee;
  const at = state.monthly[month]?.[player.id];
  return (
    <Sheet
      onClose={onClose}
      title={
        <div>
          <h3 className="font-display text-lg font-semibold">{t("รายเดือน {name}", { name: player.name })}</h3>
          <p className="text-xs text-zinc-500">{monthLabel(month)}</p>
        </div>
      }
    >
      <SlipReview playerId={player.id} month={month} unsettled />
      {at ? (
        <div className="space-y-3">
          <p className="rounded-2xl bg-lime/30 px-4 py-3 text-sm font-semibold">
            {t("จ่ายเมื่อ {date}", { date: new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" }) })}
          </p>
          <Button
            variant="ghost"
            className="w-full text-red-600"
            onClick={() => {
              if (!confirm(t("ยกเลิกรายเดือน {month} ของ {name}? (กลับไปคิดรายวัน)", { month: monthLabel(month), name: player.name }))) return;
              dispatch({ type: "setMonthlyPaid", month, playerId: player.id, paid: false });
              onClose();
            }}
          >
            {t("ยกเลิกการจ่ายรายเดือน")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <PayQr promptPayId={state.settings.promptPayId} amount={fee} />
          <Button
            variant="accent"
            className="w-full"
            onClick={() => {
              dispatch({ type: "setMonthlyPaid", month, playerId: player.id, paid: true });
              onClose();
            }}
          >
            {t("ได้รับเงินแล้ว {amount}", { amount: baht(fee) })}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
