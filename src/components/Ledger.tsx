"use client";

import { useState } from "react";
import { Auto } from "@/lib/autoTranslate";
import { locale, t } from "@/lib/i18n";
import { monthReport } from "@/lib/report";
import { today, useStore } from "@/lib/store";
import { EXPENSE_CATEGORIES, monthOf, type ExpenseCategory } from "@/lib/types";
import { TUBE } from "./Stock";
import { Button, Card, Icon, baht, inputClass } from "./ui";

/** บัญชีรายรับรายจ่ายของก๊วนรายเดือน รายรับมาจากเงินที่เก็บได้ รายจ่ายแอดมินลงเอง */
export function Ledger({ month }: { month: string }) {
  const { state, dispatch } = useStore();
  const r = monthReport(state, month);
  const tot = r.totals;
  const [adding, setAdding] = useState(false);
  const thisMonth = monthOf(today()) === month;
  const [date, setDate] = useState(thisMonth ? today() : `${month}-01`);
  const [category, setCategory] = useState<ExpenseCategory>("court");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [tubeCount, setTubeCount] = useState("");
  const tubesBought = category === "shuttle" ? Math.max(0, Math.floor(Number(tubeCount) || 0)) : 0;
  const value = Number(amount);
  const valid = value > 0 && Number.isInteger(value) && monthOf(date) === month;

  const save = () => {
    if (!valid) return;
    dispatch({
      type: "addExpense",
      expense: { date, category, amount: value, note: note.trim(), ...(tubesBought ? { shuttles: tubesBought * TUBE } : {}) },
    });
    setAmount("");
    setNote("");
    setTubeCount("");
    setAdding(false);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("บัญชีรายรับรายจ่ายก๊วน")}</h3>
        <span className="shrink-0 text-xs text-zinc-500">{t("เห็นเฉพาะแอดมิน")}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-50 px-2 py-2">
          <dt className="text-[11px] text-emerald-700">{t("รายรับ")}</dt>
          <dd className="font-display font-semibold text-emerald-700 tabular-nums">{baht(tot.income)}</dd>
        </div>
        <div className="rounded-2xl bg-red-50 px-2 py-2">
          <dt className="text-[11px] text-red-600">{t("รายจ่าย")}</dt>
          <dd className="font-display font-semibold text-red-600 tabular-nums">{baht(tot.expenses)}</dd>
        </div>
        <div className={`rounded-2xl px-2 py-2 ${tot.profit >= 0 ? "bg-lime" : "bg-amber-300"} text-ink`}>
          <dt className="text-[11px]">{tot.profit >= 0 ? t("กำไร") : t("ขาดทุน")}</dt>
          <dd className="font-display font-semibold tabular-nums">{baht(Math.abs(tot.profit))}</dd>
        </div>
      </dl>
      <p className="text-xs text-zinc-500">
        {t("รายรับ = เงินที่เก็บได้แล้ว (รายวันที่จ่ายแล้ว + ค่าสมาชิกรายเดือน) ยังไม่รวมยอดค้าง {amount}", { amount: baht(tot.unpaid) })}
      </p>

      {r.expenses.length > 0 && (
        <ul className="divide-y divide-zinc-100 text-sm">
          {r.expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <span className="w-12 shrink-0 text-xs text-zinc-500 tabular-nums">
                {new Date(e.date + "T00:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short" })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {t(EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? "อื่นๆ")}
                  {e.shuttles ? <span className="font-normal text-zinc-500"> · {t("{n} ลูก", { n: e.shuttles })}</span> : null}
                </span>
                {e.note && (
                  <span className="block truncate text-xs text-zinc-500">
                    <Auto text={e.note} />
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{baht(e.amount)}</span>
              <button
                className="shrink-0 p-1 text-zinc-400"
                aria-label={t("ลบรายจ่ายนี้")}
                onClick={() => confirm(t("ลบรายจ่ายนี้?")) && dispatch({ type: "removeExpense", id: e.id })}
              >
                <Icon.X width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                aria-pressed={category === c.value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === c.value ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className={inputClass}
              value={date}
              min={`${month}-01`}
              max={`${month}-31`}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t("วันที่")}
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={inputClass}
              placeholder={t("จำนวนเงิน")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {category === "shuttle" && (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputClass}
              placeholder={t("จำนวนหลอด (หลอดละ {n} ลูก) เพิ่มเข้าสต็อก", { n: TUBE })}
              value={tubeCount}
              onChange={(e) => setTubeCount(e.target.value)}
            />
          )}
          <input className={inputClass} placeholder={t("หมายเหตุ (ไม่ใส่ก็ได้)")} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setAdding(false)}>{t("ยกเลิก")}</Button>
            <Button variant="accent" disabled={!valid} onClick={save}>
              {t("บันทึก")}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="flex w-full items-center justify-center gap-1.5" onClick={() => setAdding(true)}>
          <Icon.Plus width={18} height={18} /> {t("ลงรายจ่าย")}
        </Button>
      )}
    </Card>
  );
}
