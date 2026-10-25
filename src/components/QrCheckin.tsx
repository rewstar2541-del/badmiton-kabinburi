"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getCheckinCode, qrCheckIn, setCheckinCode, supabase } from "@/lib/remote";
import { readSession } from "@/lib/session";
import { canSelfCheckIn } from "@/lib/social";
import { randomToken } from "@/lib/session";
import { useStore, useToday } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button, Card } from "./ui";

const KEY = "badminton-kabinburi:ci";

/** แอดมิน: เปิด/ปิดการเช็คอินด้วย QR ที่สนามของวันนี้ (วันที่เปิด ผู้เล่นต้องสแกน QR ถึงเช็คอินเองได้) */
export function QrCheckInCard() {
  const { auth } = useStore();
  const { date } = useToday();
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<{ code: string; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const db = auth.online ? supabase : null;

  useEffect(() => {
    if (!db) return;
    getCheckinCode(db, date).then(setCode, () => {});
  }, [db, date]);
  useEffect(() => {
    if (!code) return;
    let alive = true;
    QRCode.toDataURL(`${location.origin}/?ci=${code}`, { width: 480, margin: 2 }).then((u) => alive && setQr({ code, src: u }));
    return () => {
      alive = false;
    };
  }, [code]);

  const src = qr && qr.code === code ? qr.src : null;
  if (!db) return null;
  const toggle = async (on: boolean) => {
    setBusy(true);
    setError("");
    try {
      const next = on ? randomToken().slice(0, 16) : null;
      await setCheckinCode(db, date, next);
      setCode(next);
    } catch {
      setError(t("ยังเปิดไม่ได้ ให้ตรวจว่าตั้งค่าฐานข้อมูลสำหรับ QR แล้ว"));
    }
    setBusy(false);
  };
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("เช็คอินด้วย QR ที่สนาม")}</h3>
        <p className="text-sm text-zinc-500">
          {code ? t("เปิดอยู่: ผู้เล่นต้องสแกน QR นี้ที่สนามถึงเช็คอินเองได้ แอดมินเช็คอินให้ได้ตามปกติ") : t("ปิดอยู่: ผู้เล่นกดเช็คอินเองจากที่ไหนก็ได้")}
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {code && (
        <div className="grid place-items-center gap-2 rounded-3xl bg-white p-3 ring-1 ring-zinc-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={t("QR เช็คอิน")} width={260} height={260} /> : <div className="size-64 animate-pulse rounded-xl bg-zinc-100" />}
          <p className="text-center text-xs text-zinc-500">{t("แสดง QR นี้ที่สนาม รหัสใช้ได้เฉพาะวันนี้")}</p>
        </div>
      )}
      <Button variant={code ? "ghost" : "accent"} className="w-full" disabled={busy} onClick={() => toggle(!code)}>
        {code ? t("ปิดการเช็คอินด้วย QR") : t("เปิด QR เช็คอินวันนี้")}
      </Button>
    </Card>
  );
}

/** ผู้เล่นสแกน QR (ลิงก์ ?ci=รหัส) แล้วเช็คอินให้เอง ถ้ายังไม่ได้เข้าสู่ระบบ เก็บรหัสไว้ทำต่อหลังเข้า */
export function QrCheckInHandler() {
  const { state, auth, ready } = useStore();
  const { date } = useToday();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      const ci = new URLSearchParams(location.search).get("ci");
      if (!ci) return;
      sessionStorage.setItem(KEY, ci);
      const u = new URL(location.href);
      u.searchParams.delete("ci");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {
      // ไม่เป็นไร
    }
  }, []);

  const session = readSession();
  useEffect(() => {
    if (!ready || !supabase || !auth.online || !session?.playerId) return;
    let code: string | null = null;
    try {
      code = sessionStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!code) return;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ไม่เป็นไร
    }
    const day = state.days.find((d) => d.date === date);
    if (day && !canSelfCheckIn(day, session.playerId)) {
      Promise.resolve().then(() => setMsg({ ok: false, text: t("วันนี้เต็มแล้ว คุณอยู่ในรายชื่อสำรอง ให้แอดมินเช็คอินให้") }));
      return;
    }
    qrCheckIn(supabase, session.playerId, session.token, code).then((err) =>
      setMsg(err ? { ok: false, text: t(err) } : { ok: true, text: t("เช็คอินแล้ว ขอให้สนุกครับ") }),
    );
  }, [ready, auth.online, session?.playerId, session?.token, state.days, date]);

  if (!msg) return null;
  return (
    <div
      role="status"
      className={`fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${msg.ok ? "bg-lime text-ink" : "bg-red-50 text-red-700"}`}
    >
      <span className="min-w-0 flex-1">{msg.text}</span>
      <button className="min-h-11 min-w-11 shrink-0 underline" onClick={() => setMsg(null)}>
        {t("ปิด")}
      </button>
    </div>
  );
}
