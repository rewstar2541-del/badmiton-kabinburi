"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { appName } from "@/lib/brand";
import { downloadBlob, externalAppUrl, inAppBrowser, inLineApp } from "@/lib/download";
import { locale, t } from "@/lib/i18n";
import { drawReceipt } from "@/lib/receipt";
import { Button, Icon, baht } from "./ui";

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));

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
  const [error, setError] = useState(false);
  // เปิดรูปเต็มจอเสมอ: กดค้างเพื่อบันทึกลงรูปภาพได้ทั้งใน LINE และ iPhone (ดาวน์โหลดบน iPhone ไปอยู่ในแอพไฟล์)
  const [preview, setPreview] = useState<{ url: string; canvas: HTMLCanvasElement } | null>(null);
  const file = `receipt-${date}.png`;

  const open = async () => {
    setBusy(true);
    setError(false);
    try {
      const [y, m, d] = date.split("-").map(Number);
      const day = new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const paid = paidAt ? new Date(paidAt).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      const canvas = await drawReceipt(
        {
          club: appName(),
          title: t("ใบเสร็จรับเงิน"),
          name,
          dateLine: t("วันที่เล่น {date}", { date: day }),
          paidLine: paid ? t("จ่ายเมื่อ {time}", { time: paid }) : "",
          lines: lines.map(([label, v]) => ({ label, amount: baht(v) })),
          totalLabel: t("รวม"),
          total: baht(total),
          stamp: t("จ่ายแล้ว"),
          footer: t("ขอบคุณที่มาเล่นด้วยกัน"),
        },
        getComputedStyle(document.body).fontFamily,
      );
      setPreview({ url: canvas.toDataURL("image/png"), canvas });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const share = async (canvas: HTMLCanvasElement) => {
    try {
      const f = new File([await toBlob(canvas)], file, { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
      else downloadBlob(f, file);
    } catch {
      // ผู้ใช้กดยกเลิกการแชร์
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button className="flex w-full items-center justify-center gap-1.5" disabled={busy} onClick={open}>
        <Icon.Receipt width={18} height={18} />
        {busy ? t("กำลังสร้างไฟล์...") : t("บันทึกใบเสร็จเป็นรูป")}
      </Button>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-normal text-red-600">{t("สร้างรูปไม่สำเร็จ ลองแคปหน้าจอแทน")}</p>}
      {preview &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col items-center gap-4 overflow-y-auto bg-black px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt={t("ใบเสร็จรับเงิน")} className="my-auto max-h-[65vh] max-w-full rounded-xl" />
            <p className="max-w-xs text-center text-base text-white">{t("กดค้างที่รูป > บันทึกรูปภาพ (หรือแคปจอ)")}</p>
            <div className="flex w-full max-w-xs flex-col gap-3">
              {!inAppBrowser() && (
                <button className="min-h-11 rounded-full bg-lime px-4 py-3 text-sm font-semibold text-ink" onClick={() => void share(preview.canvas)}>
                  {t("แชร์ / บันทึกรูป")}
                </button>
              )}
              {inLineApp() && (
                <a href={externalAppUrl()} className="min-h-11 rounded-full bg-lime px-4 py-3 text-center text-sm font-semibold text-ink">
                  {t("บันทึกไม่ได้? เปิดใน Chrome / Safari")}
                </a>
              )}
              <button className="min-h-11 rounded-full bg-white/15 px-4 py-3 text-sm font-semibold text-white" onClick={() => setPreview(null)}>
                {t("ปิด")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
