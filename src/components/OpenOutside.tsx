"use client";

import { t } from "@/lib/i18n";
import { externalAppUrl, inLineApp } from "@/lib/download";

/** บอกวิธีเปิดใน Chrome / Safari เมื่อกดโหลดไฟล์ในแอพ LINE / Facebook (โหลดไฟล์ไม่ได้) */
export function OpenOutside({ menu }: { menu: string }) {
  const line = inLineApp();
  return (
    <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      <p>
        {line
          ? t("แอพ LINE โหลดไฟล์ไม่ได้ กดปุ่มด้านล่างเพื่อเปิดใน Chrome / Safari แล้วเข้าสู่ระบบด้วย LINE ไปที่เมนู {menu} แล้วกดอีกครั้ง", { menu })
          : t("แอพนี้โหลดไฟล์ไม่ได้ กดเมนู ⋯ มุมจอ เลือกเปิดในเบราว์เซอร์ แล้วเข้าสู่ระบบด้วย LINE ไปที่เมนู {menu} แล้วกดอีกครั้ง", { menu })}
      </p>
      {line && (
        <a href={externalAppUrl()} className="block min-h-11 w-full rounded-2xl bg-ink px-4 py-3 text-center font-semibold text-white">
          {t("เปิดใน Chrome / Safari")}
        </a>
      )}
    </div>
  );
}
