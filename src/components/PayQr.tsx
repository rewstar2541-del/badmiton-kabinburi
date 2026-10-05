"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isValidPromptPayId, promptPayPayload } from "@/lib/promptpay";
import { t } from "@/lib/i18n";
import { Button } from "./ui";

export function PayQr({ promptPayId, amount }: { promptPayId: string; amount: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // แอพ LINE (และแอพอื่นที่เปิดเว็บข้างใน) ไม่ให้ดาวน์โหลดไฟล์ เปิดรูปเต็มจอให้กดค้างเพื่อบันทึกแทน
  const [preview, setPreview] = useState<string | null>(null);
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
    return <p className="text-sm text-amber-700">{t("ยังไม่ได้ตั้ง PromptPay (ไปที่ ตั้งค่า)")}</p>;
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
            const url = await saveQr(promptPayId, amount);
            if (url) setPreview(url);
          } finally {
            setSaving(false);
          }
        }}
      >
        {t("บันทึกรูป QR")}
      </Button>
      <p className="text-center text-xs text-zinc-500">{t("บันทึกรูป แล้วสแกนจากรูปในแอพธนาคาร")}</p>
      {preview &&
        createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="PromptPay QR" className="max-h-[70vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          <p className="max-w-xs text-center text-sm text-white">{t("กดค้างที่รูป > บันทึกรูปภาพ (หรือแคปจอ)")}</p>
          {/* LINE เปิดลิงก์ที่มี openExternalBrowser=1 ใน Chrome / Safari ซึ่งบันทึกไฟล์ได้ */}
          <a
            href={externalQrUrl(amount)}
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            {t("บันทึกไม่ได้? เปิดใน Chrome / Safari")}
          </a>
          <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white" onClick={() => setPreview(null)}>
            {t("ปิด")}
          </button>
        </div>,
          document.body,
        )}
    </div>
  );
}

/** หน้า QR อย่างเดียว (ไม่ต้องล็อกอิน) เปิดนอกแอพ LINE เพื่อให้ดาวน์โหลดรูปได้ */
export function externalQrUrl(amount: number) {
  return `${window.location.origin}/?payqr=${amount}&openExternalBrowser=1`;
}

/** หน้าเต็มสำหรับบันทึกรูป QR เปิดจากลิงก์ ?payqr=ยอดเงิน */
export function QrOnlyPage({ promptPayId }: { promptPayId: string }) {
  const amount = Number(new URLSearchParams(window.location.search).get("payqr")) || 0;
  const [src, setSrc] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!isValidPromptPayId(promptPayId)) return;
    qrImage(promptPayId, amount).then(blobToDataUrl).then(setSrc);
  }, [promptPayId, amount]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white p-6 text-ink">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="PromptPay QR" className="w-full max-w-xs rounded-xl border border-zinc-200" />
      ) : (
        <div className="size-72 animate-pulse rounded-xl bg-zinc-100" />
      )}
      <Button
        variant="primary"
        disabled={!src}
        onClick={async () => {
          await saveQr(promptPayId, amount, true);
          setDone(true);
        }}
      >
        {t("บันทึกรูป QR")}
      </Button>
      <p className="max-w-xs text-center text-sm text-zinc-500">
        {done
          ? t("บันทึกแล้ว สแกนจากรูปในแอพธนาคาร แล้วกลับมากด \"ฉันจ่ายแล้ว\"")
          : t("กดแล้วไม่ได้? กดค้างที่รูป > บันทึกรูปภาพ")}
      </p>
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

/** เว็บที่เปิดในแอพ LINE / Facebook / Instagram ดาวน์โหลดไฟล์ไม่ได้ */
function inAppBrowser() {
  return /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
}

/** บันทึกรูป QR: แชร์/ดาวน์โหลด หรือคืนรูป (data URL) ให้แสดงเต็มจอเมื่อบันทึกเองไม่ได้ */
async function saveQr(promptPayId: string, amount: number, forceDownload = false): Promise<string | null> {
  const blob = await qrImage(promptPayId, amount);
  if (inAppBrowser() && !forceDownload) return blobToDataUrl(blob);
  const file = new File([blob], `promptpay-${amount}.png`, { type: "image/png" });
  // มือถือ (โดยเฉพาะ iPhone) ใช้เมนูแชร์ แล้วกด "บันทึกรูปภาพ"
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return null;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
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
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
}
