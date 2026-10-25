"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { appName } from "@/lib/brand";
import { downloadBlob, externalAppUrl, inAppBrowser, inLineApp } from "@/lib/download";
import { locale, t } from "@/lib/i18n";
import { drawReceipt } from "@/lib/receipt";
import { Button, Icon, baht } from "./ui";

/** ปุ่มบันทึกใบเสร็จเป็นรูป หลังจ่ายเงินแล้ว ผู้เล่นเก็บไว้เป็นหลักฐานได้ */
export function ReceiptButton({
  name,
  date,
  paidAt,
  lines,
  total,
}: {
  name: string;
  /** YYYY-MM-DD */
  date: string;
  paidAt?: number;
  lines: (readonly [string, number])[];
  total: number;
}) {
  const [busy, setBusy] = useState(false);
  // แอพ LINE ไม่ให้ดาวน์โหลดไฟล์ เปิดรูปเต็มจอให้กดค้างเพื่อบันทึกแทน
  const [preview, setPreview] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      const [y, m, d] = date.split("-").map(Number);
      const day = new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const paid = paidAt ? new Date(paidAt).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      const { blob, url } = await drawReceipt(
        {
          club: appName(),
          title: t("ใบเสร็จรับเงิน"),
          name,
          dateLine: t("วันที่เล่น {date}", { date: day }),
          paidLine: paid ? t("จ่ายเมื่อ {time}", { time: paid }) : "",
          lines: lines.filter(([, v]) => v > 0).map(([label, v]) => ({ label, amount: baht(v) })),
          totalLabel: t("รวม"),
          total: baht(total),
          stamp: t("จ่ายแล้ว"),
          footer: t("ขอบคุณที่มาเล่นด้วยกัน"),
        },
        getComputedStyle(document.body).fontFamily,
      );
      if (inAppBrowser()) setPreview(url);
      else downloadBlob(blob, `receipt-${date}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button className="flex items-center justify-center gap-1.5" disabled={busy} onClick={save}>
        <Icon.Receipt width={18} height={18} />
        {busy ? t("กำลังสร้างไฟล์...") : t("บันทึกใบเสร็จเป็นรูป")}
      </Button>
      {preview &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black p-4" onClick={() => setPreview(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={t("ใบเสร็จรับเงิน")} className="max-h-[70vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
            <p className="max-w-xs text-center text-sm text-white">{t("กดค้างที่รูป > บันทึกรูปภาพ (หรือแคปจอ)")}</p>
            {inLineApp() && (
              <a href={externalAppUrl()} className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink" onClick={(e) => e.stopPropagation()}>
                {t("บันทึกไม่ได้? เปิดใน Chrome / Safari")}
              </a>
            )}
            <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white" onClick={() => setPreview(null)}>
              {t("ปิด")}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
