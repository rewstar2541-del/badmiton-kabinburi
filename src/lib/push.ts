"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { inAppBrowser } from "./download";

/** แจ้งเตือนเด้งในมือถือ (Web Push) ฝั่งเครื่องผู้เล่น */

const HDR = { "x-bk": "1" };

/**
 * เครื่องนี้รับแจ้งเตือนได้ไหม
 * - ok: ได้
 * - ios-install: iPhone/iPad ต้องเพิ่มแอพลงหน้าจอโฮมก่อน (iOS 16.4 ขึ้นไป)
 * - ios-old: iPhone/iPad ที่ติดตั้งแล้วแต่ iOS เก่ากว่า 16.4
 * - in-app: เปิดในแอพ LINE/Facebook ต้องเปิดใน Safari/Chrome
 * - unsupported: เบราว์เซอร์นี้ไม่รองรับ
 */
export type PushSupport = "ok" | "ios-install" | "ios-old" | "in-app" | "unsupported";

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (inAppBrowser()) return "in-app";
  const has = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos()) {
    if (!isStandalone()) return "ios-install";
    return has ? "ok" : "ios-old";
  }
  return has ? "ok" : "unsupported";
}

/** ลงทะเบียน service worker (ครั้งเดียวตอนเปิดแอพ) และรับคำสั่งเปิดหน้าสนามเมื่อแตะแจ้งเตือน */
export function registerPushWorker(goTo: (tab: string) => void) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => {
    const d = e.data as { type?: string; tab?: string } | null;
    if (d?.type === "goto-tab" && d.tab) goTo(d.tab);
  });
  // เปิดแอพใหม่จากการแตะแจ้งเตือน (?go=courts)
  const go = new URLSearchParams(location.search).get("go");
  if (go) {
    setTimeout(() => goTo(go), 300);
    const url = new URL(location.href);
    url.searchParams.delete("go");
    history.replaceState(null, "", url);
  }
}

let info: Promise<{ ready: boolean; publicKey: string | null }> | null = null;
/** เซิร์ฟเวอร์ตั้งค่ากุญแจครบหรือยัง (ยังไม่ตั้ง = ซ่อนปุ่ม) */
export function pushServerInfo() {
  info ??= fetch("/api/push", { headers: HDR })
    .then((r) => (r.ok ? r.json() : { ready: false, publicKey: null }))
    .catch(() => {
      info = null;
      return { ready: false, publicKey: null };
    });
  return info;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(() => navigator.serviceWorker.ready);
}

/** เครื่องนี้เปิดรับอยู่ไหม */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** เปิดรับแจ้งเตือน (ต้องเรียกจากการกดปุ่ม) คืนข้อความผิดพลาด หรือ null */
export async function enablePush(db: SupabaseClient, playerId: string, pin: string): Promise<string | null> {
  if (pushSupport() !== "ok") return "เครื่องนี้ยังรับแจ้งเตือนไม่ได้";
  // ขอสิทธิ์ก่อนอย่างอื่น: iPhone ยอมให้ขอได้เฉพาะตอนที่เพิ่งกดปุ่ม
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "ยังไม่ได้อนุญาตการแจ้งเตือน";
  const { ready, publicKey } = await pushServerInfo();
  if (!ready || !publicKey) return "ระบบแจ้งเตือนยังไม่พร้อม ลองใหม่ภายหลัง";
  try {
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    const j = sub.toJSON();
    const { data, error } = await db.rpc("push_subscribe", { p_player: playerId, p_pin: pin, p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
    if (error) return "เชื่อมต่อไม่ได้ ลองใหม่";
    return (data as string | null) ?? null;
  } catch {
    return "เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่";
  }
}

/** ปิดแจ้งเตือนบนเครื่องนี้ */
export async function disablePush(db: SupabaseClient | null) {
  const sub = await currentSubscription();
  if (!sub) return;
  if (db) await db.rpc("push_unsubscribe", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** คิวขยับ (เริ่ม/จบเกม จัดคิว พัก) ให้เซิร์ฟเวอร์เช็คว่าต้องแจ้งใคร รวบหลายครั้งติดกันเป็นครั้งเดียว */
export function pokePush() {
  if (typeof window === "undefined") return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    fetch("/api/push", { method: "POST", headers: HDR, keepalive: true }).catch(() => {});
  }, 1500);
}

/** สวิตช์แอดมิน (null = ยังไม่ได้รัน SQL web_push.sql) */
export async function getPushEnabled(db: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await db.from("push_settings").select("enabled").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return data.enabled !== false;
}

export async function setPushEnabled(db: SupabaseClient, on: boolean): Promise<string | null> {
  const { error } = await db.from("push_settings").update({ enabled: on }).eq("id", 1);
  return error ? error.message : null;
}

/** จำนวนผู้เล่นที่เปิดรับแจ้งเตือนอยู่ (แอดมิน) */
export async function pushCount(db: SupabaseClient): Promise<number | null> {
  const { data, error } = await db.rpc("push_count");
  return error ? null : ((data as number | null) ?? null);
}
