"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { isValidPromptPayId, promptPayPayload } from "@/lib/promptpay";
import { t } from "@/lib/i18n";

export function PayQr({ promptPayId, amount }: { promptPayId: string; amount: number }) {
  const [src, setSrc] = useState<string | null>(null);
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="PromptPay QR" width={280} height={280} className="rounded-xl bg-white p-2" />;
}
