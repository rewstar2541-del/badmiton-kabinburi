"use client";

import { t } from "@/lib/i18n";
import { externalAppUrl } from "@/lib/download";

/** บอกให้เปิดใน Chrome / Safari เมื่อกดโหลดไฟล์ในแอพ LINE (LINE โหลดไฟล์ไม่ได้) */
export function OpenOutside() {
  return (
    <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      <p>{t("แอพ LINE โหลดไฟล์ไม่ได้ เปิดหน้านี้ใน Chrome / Safari แล้วกดอีกครั้ง")}</p>
      <a href={externalAppUrl()} className="inline-block rounded-full bg-ink px-4 py-2 font-semibold text-white">
        {t("เปิดใน Chrome / Safari")}
      </a>
    </div>
  );
}
