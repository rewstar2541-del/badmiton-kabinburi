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
        className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-black px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]"
        onClick={() => setPreview(null)}
      >
        {/* คำแนะนำและปุ่มปิดติดหัวจอ รูปยาวเลื่อนลงไปก็ยังเห็น แตะพื้นดำนอกรูปก็ปิดได้ */}
        <div
          className="sticky top-0 z-10 mx-auto flex max-w-md items-center gap-3 bg-black pt-[calc(env(safe-area-inset-top)+12px)] pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="min-w-0 flex-1 text-sm text-white">{t("กดนิ้วค้างที่รูป แล้วเลือก “บันทึกรูปภาพ” หรือส่งต่อในไลน์")}</p>
          <button className="min-h-11 shrink-0 rounded-full bg-white/15 px-6 py-3 text-base font-semibold text-white" onClick={() => setPreview(null)}>
            {t("ปิด")}
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="mx-auto block w-full max-w-md rounded-xl" onClick={(e) => e.stopPropagation()} />
      </div>,
      document.body,
    );

  return { share, busy, failed, overlay };
}
