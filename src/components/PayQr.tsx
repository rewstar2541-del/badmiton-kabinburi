"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { isValidPromptPayId, promptPayPayload } from "@/lib/promptpay";
import { t } from "@/lib/i18n";
import { Button } from "./ui";

export function PayQr({ promptPayId, amount }: { promptPayId: string; amount: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = isValidPromptPayId(promptPayId);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    QRCode.toDataURL(promptPayPayload(promptPayId, amount), { width: 280, margin: 1 }).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [promptPayId, amount, valid]);

  if (!valid)
    return <p className="text-sm text-amber-700">{t("ยังไม่ได้ตั้งเบอร์ PromptPay ไปที่แท็บ \"ตั้งค่า\"")}</p>;
  if (!src) return <div className="size-[280px] animate-pulse rounded-xl bg-zinc-100" />;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="PromptPay QR" width={280} height={280} className="rounded-xl bg-white p-2" />
      <Button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await saveQr(promptPayId, amount);
          } finally {
            setSaving(false);
          }
        }}
      >
        {t("บันทึกรูป QR")}
      </Button>
      <p className="text-center text-xs text-zinc-500">{t("บันทึกลงเครื่อง แล้วเปิดแอพธนาคาร เลือกสแกนจากรูปในเครื่อง")}</p>
    </div>
  );
}

/** รูป QR พร้อมยอดเงิน สำหรับบันทึกลงเครื่องแล้วสแกนจากแอพธนาคาร */
async function qrImage(promptPayId: string, amount: number): Promise<Blob> {
  const W = 600;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, promptPayPayload(promptPayId, amount), { width: 520, margin: 2 });
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 720;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, c.height);
  g.fillStyle = "#0b1220";
  g.textAlign = "center";
  g.font = "bold 34px sans-serif";
  g.fillText("PromptPay", W / 2, 60);
  g.drawImage(qr, (W - 520) / 2, 90, 520, 520);
  g.font = "bold 44px sans-serif";
  g.fillText(`฿${amount.toLocaleString("th-TH")}`, W / 2, 670);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));
}

async function saveQr(promptPayId: string, amount: number) {
  const blob = await qrImage(promptPayId, amount);
  const file = new File([blob], `promptpay-${amount}.png`, { type: "image/png" });
  // มือถือ (โดยเฉพาะ iPhone) ใช้เมนูแชร์ แล้วกด "บันทึกรูปภาพ"
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
