"use client";

import { useState } from "react";
import { appName } from "@/lib/brand";
import { locale, t } from "@/lib/i18n";
import { monthReport } from "@/lib/report";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { useStore } from "@/lib/store";
import { inAppBrowser } from "@/lib/download";
import { OpenOutside } from "./OpenOutside";
import { Button, Icon } from "./ui";

const bold = (value: string) => ({ value, fontWeight: "bold" as const });
const money = (value: number) => ({ value, type: Number, format: "#,##0" });

/** ดาวน์โหลดรายงานรายเดือนเป็นไฟล์ Excel (.xlsx) */
export function ExportReport({ month }: { month: string }) {
  const { state } = useStore();
  const [busy, setBusy] = useState(false);
  const [inLine, setInLine] = useState(false);

  const download = async () => {
    if (inAppBrowser()) return setInLine(true);
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const r = monthReport(state, month);
      const [y, m] = month.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
      const tot = r.totals;

      const summary = [
        [bold(`${appName().join("-")} · ${label}`)],
        [],
        [bold(t("รายรับที่เก็บได้แล้ว")), money(tot.income)],
        [bold(t("รายจ่าย")), money(tot.expenses)],
        [bold(tot.profit >= 0 ? t("กำไร") : t("ขาดทุน")), money(Math.abs(tot.profit))],
        [],
        [t("ค่าสมาชิกรายเดือน"), money(tot.monthlyFees)],
        [t("ค่าสนามรายวัน"), money(tot.courtFee)],
        [t("ค่าลูก"), money(tot.shuttleFee)],
        [t("ค่าน้ำ"), money(tot.drinks)],
        [t("ยอดรายวันที่รับแล้ว"), money(tot.received)],
        [t("ยอดค้างจ่าย"), money(tot.unpaid)],
        [],
        [t("วันที่จัดก๊วน"), r.days.length],
        [t("จำนวนครั้งที่มาเล่น"), tot.players],
        [t("เกม"), tot.games],
        [t("ลูกที่ใช้"), tot.shuttles],
      ];

      const dayHead = [t("วันที่"), t("คน"), t("เกม"), t("ลูก"), t("ค่าสนาม"), t("ค่าลูก"), t("ค่าน้ำ"), t("รวม"), t("รับแล้ว"), t("ค้าง")].map(bold);
      const dayRows = r.days.map((d) => [
        d.date,
        d.players,
        d.games,
        d.shuttles,
        money(d.courtFee),
        money(d.shuttleFee),
        money(d.drinks),
        money(d.total),
        money(d.received),
        money(d.unpaid),
      ]);
      const dayTotal = [bold(t("รวม")), tot.players, tot.games, tot.shuttles, money(tot.courtFee), money(tot.shuttleFee), money(tot.drinks), money(tot.total), money(tot.received), money(tot.unpaid)];

      const playerHead = [t("ชื่อ"), t("มากี่ครั้ง"), t("รายเดือน"), t("ค่าสนาม"), t("ค่าลูก"), t("ค่าน้ำ"), t("รวม"), t("รับแล้ว"), t("ค้าง")].map(bold);
      const playerRows = r.players.map((p) => [
        p.name,
        p.visits,
        p.monthly ? t("ใช่") : "",
        money(p.courtFee),
        money(p.shuttleFee),
        money(p.drinks),
        money(p.total),
        money(p.received),
        money(p.unpaid),
      ]);

      const monthlyHead = [t("ชื่อ"), t("วันที่จ่าย"), t("จำนวนเงิน")].map(bold);
      const monthlyRows = r.monthlyFees.map((f) => [f.name, new Date(f.paidAt).toLocaleDateString(locale()), money(f.amount)]);

      const catLabel = (c: string) => t(EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? "อื่นๆ");
      const expenseHead = [t("วันที่"), t("ประเภท"), t("หมายเหตุ"), t("จำนวนเงิน")].map(bold);
      const expenseRows = r.expenses.map((e) => [e.date, catLabel(e.category), e.note, money(e.amount)]);
      const expenseByRows = EXPENSE_CATEGORIES.map((c) => ["", bold(t(c.label)), "", money(r.expenseBy[c.value])]);
      const expenseTotal = [bold(t("รวม")), "", "", money(tot.expenses)];

      await writeXlsxFile(
        [
          { sheet: t("สรุป"), data: summary, columns: [{ width: 28 }, { width: 14 }] },
          { sheet: t("รายวัน"), data: [dayHead, ...dayRows, dayTotal], columns: Array(10).fill({ width: 11 }), stickyRowsCount: 1 },
          { sheet: t("รายคน"), data: [playerHead, ...playerRows], columns: [{ width: 16 }, ...Array(8).fill({ width: 11 })], stickyRowsCount: 1 },
          { sheet: t("ค่ารายเดือน"), data: [monthlyHead, ...monthlyRows], columns: [{ width: 16 }, { width: 14 }, { width: 12 }] },
          {
            sheet: t("รายจ่าย"),
            data: [expenseHead, ...expenseRows, expenseTotal, [], ...expenseByRows],
            columns: [{ width: 12 }, { width: 16 }, { width: 28 }, { width: 12 }],
            stickyRowsCount: 1,
          },
        ],
        {},
      ).toFile(`badminton-${month}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" className="flex w-full items-center justify-center gap-1.5" disabled={busy} onClick={download}>
        <Icon.Wallet width={18} height={18} />
        {busy ? t("กำลังสร้างไฟล์...") : t("โหลด Excel เดือนนี้")}
      </Button>
      {inLine && <OpenOutside />}
    </>
  );
}
