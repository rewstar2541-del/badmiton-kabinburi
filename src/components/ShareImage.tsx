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
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black p-4" onClick={() => setPreview(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="max-h-[70vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
        <p className="max-w-xs text-center text-sm text-white">{t("กดค้างที่รูป > บันทึกรูปภาพ หรือส่งต่อในไลน์ (หรือแคปจอ)")}</p>
        <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white" onClick={() => setPreview(null)}>
          {t("ปิด")}
        </button>
      </div>,
      document.body,
    );

  return { share, busy, failed, overlay };
}
