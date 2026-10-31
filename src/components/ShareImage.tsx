"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { shareImage } from "@/lib/shareImage";

/** ปุ่มแชร์เป็นรูป: สร้างรูป แล้วแชร์/ดาวน์โหลด หรือแสดงเต็มจอให้กดค้างบันทึก (เว็บในแอพ LINE) */
export function useShareImage() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const share = async (make: () => Promise<Blob>, name: string) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const url = await shareImage(await make(), name);
      if (url) setPreview(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const overlay =
    preview &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center gap-4 overflow-y-auto overscroll-contain bg-black px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
      >
        {/* รูปยาวให้เลื่อนดูได้ กว้างเต็มจอจะได้อ่านออก */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="w-full max-w-md rounded-xl" />
        <p className="max-w-xs text-center text-sm text-white">{t("กดนิ้วค้างที่รูป แล้วเลือก “บันทึกรูปภาพ” หรือส่งต่อในไลน์")}</p>
        <button className="min-h-11 rounded-full bg-white/15 px-6 py-3 text-base font-semibold text-white" onClick={() => setPreview(null)}>
          {t("ปิด")}
        </button>
      </div>,
      document.body,
    );

  return { share, busy, failed, overlay };
}
