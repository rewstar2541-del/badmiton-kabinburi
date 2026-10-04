"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { Button, Card } from "./ui";

const HIDE_KEY = "badminton-kabinburi:install-hidden";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  // Chrome บน Android ส่งเหตุการณ์นี้มาเมื่อติดตั้งได้ เก็บไว้ให้ปุ่ม "ติดตั้ง" เรียกใช้
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((f) => f());
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function platform() {
  const ua = navigator.userAgent;
  return {
    line: / Line\//i.test(ua),
    ios: /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
    installed:
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

/**
 * ชวนติดตั้งแอพไว้ที่หน้าจอหลัก เปิดได้โดยไม่ต้องผ่าน LINE (LINE บล็อกการบันทึกรูป)
 * compact: แสดงเป็นปุ่มเล็กกดแล้วค่อยกางวิธีติดตั้ง ใช้ในหน้าที่เปิดดูทีหลังได้
 */
export function InstallApp({ compact }: { compact?: boolean }) {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(!compact);
  useEffect(() => {
    const f = () => rerender((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);

  const p = platform();
  if (p.installed || (!compact && hidden)) return null;

  if (!open)
    return (
      <button className="w-full text-center text-sm font-semibold text-zinc-600 underline" onClick={() => setOpen(true)}>
        {t("ติดตั้งแอพไว้ที่หน้าจอมือถือ")}
      </button>
    );

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    deferred = null;
    rerender((n) => n + 1);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{t("ติดตั้งแอพไว้ที่หน้าจอมือถือ")}</h3>
          <p className="text-sm text-zinc-500">{t("กดเปิดได้เลยเหมือนแอพทั่วไป ไม่ต้องเข้าผ่าน LINE และบันทึกรูป QR ได้")}</p>
        </div>
      </div>
      {p.line ? (
        <>
          <p className="text-sm">{t("ตอนนี้เปิดอยู่ใน LINE ซึ่งติดตั้งไม่ได้ กดปุ่มด้านล่างเพื่อเปิดใน Chrome หรือ Safari ก่อน แล้วทำตามวิธีที่ขึ้น")}</p>
          <a
            href="/?openExternalBrowser=1"
            className="block rounded-2xl bg-lime px-4 py-3 text-center text-sm font-semibold text-ink shadow-sm shadow-lime-dark/40"
          >
            {t("เปิดใน Chrome / Safari")}
          </a>
        </>
      ) : deferred ? (
        <Button variant="accent" className="w-full" onClick={install}>
          {t("ติดตั้งแอพ")}
        </Button>
      ) : p.ios ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{t("เปิดหน้านี้ใน Safari")}</li>
          <li>{t("กดปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างจอ")}</li>
          <li>{t("เลื่อนลงแล้วกด \"เพิ่มไปยังหน้าจอโฮม\"")}</li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{t("เปิดหน้านี้ใน Chrome")}</li>
          <li>{t("กดปุ่มเมนู ⋮ มุมขวาบน")}</li>
          <li>{t("กด \"ติดตั้งแอป\" หรือ \"เพิ่มลงในหน้าจอหลัก\"")}</li>
        </ol>
      )}
      <p className="text-xs text-zinc-500">{t("เปิดแอพที่ติดตั้งครั้งแรก ต้องเข้าสู่ระบบด้วย LINE อีกครั้ง")}</p>
      {!compact && (
        <button
          className="text-xs font-semibold text-zinc-500 underline"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {}
            setHidden(true);
          }}
        >
          {t("ไว้ทีหลัง (ดูได้อีกที่ล่างสุดของหน้า ยอดของฉัน / ตั้งค่า)")}
        </button>
      )}
    </Card>
  );
}
