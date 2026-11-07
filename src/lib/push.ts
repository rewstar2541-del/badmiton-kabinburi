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
let registered = false;
export function registerPushWorker(goTo: (tab: string) => void) {
  if (registered || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;
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
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .catch(() => {
      // เน็ตหลุด/เซิร์ฟเวอร์ล่ม: ไม่จำค่า ลองใหม่ครั้งหน้า
      info = null;
      return { ready: false, publicKey: null };
    });
  return info;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(() => navigator.serviceWorker.ready);
}

/** เครื่องนี้เปิดรับอยู่ไหม */
export async function currentSubscription(publicKey?: string | null): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = (await reg?.pushManager.getSubscription()) ?? null;
    // สมัครไว้ด้วยกุญแจเก่า (แอดมินเปลี่ยนกุญแจ): สมัครใหม่เงียบๆ เพราะเคยอนุญาตแล้ว
    if (sub && reg && publicKey && sub.options.applicationServerKey) {
      const old = new Uint8Array(sub.options.applicationServerKey);
      const now = keyBytes(publicKey);
      if (old.length !== now.length || old.some((b, i) => b !== now[i])) {
        await sub.unsubscribe().catch(() => false);
        return Notification.permission === "granted" ? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: now }) : null;
      }
    }
    return sub;
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
    const err = await savePushOwner(db, sub, playerId, pin);
    // บันทึกบนเซิร์ฟเวอร์ไม่ได้: ยกเลิกในเครื่องด้วย สวิตช์จะได้ไม่ขึ้นว่าเปิดอยู่ทั้งที่ไม่มีแจ้งเตือนมา
    if (err) await sub.unsubscribe().catch(() => false);
    return err;
  } catch {
    return "เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่";
  }
}

const OPT_OUT = "badminton-kabinburi:push-optout";
/** ผู้เล่นปิดแจ้งเตือนเองบนเครื่องนี้ = ไม่ขอสิทธิ์/ไม่เปิดให้เองอีก */
export function pushOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT) === "1";
  } catch {
    return false;
  }
}
export function setPushOptOut(v: boolean) {
  try {
    if (v) localStorage.setItem(OPT_OUT, "1");
    else localStorage.removeItem(OPT_OUT);
  } catch {}
}

/** ส่งแจ้งเตือนทดสอบหาเครื่องนี้ (เซิร์ฟเวอร์รอ 6 วินาทีก่อนส่ง ให้สลับออกจากแอพทัน) คืนข้อความผลลัพธ์ */
export async function sendTestPush(): Promise<{ ok: boolean; text: string }> {
  const sub = await currentSubscription();
  if (!sub) return { ok: false, text: "เครื่องนี้ยังไม่ได้เปิดแจ้งเตือน" };
  try {
    const r = await fetch("/api/push", { method: "POST", headers: { ...HDR, "Content-Type": "application/json" }, body: JSON.stringify({ test: sub.endpoint }) });
    const j = (await r.json()) as { ok?: boolean; code?: number; host?: string; error?: string; detail?: string };
    if (j.ok) return { ok: true, text: `ส่งถึงบริการแจ้งเตือนแล้ว (${j.host ?? ""} รหัส ${j.code ?? ""}) ถ้าไม่เห็นแจ้งเตือนบนมือถือ ดูการตั้งค่าแจ้งเตือนของมือถือ` };
    if (j.error === "too-fast") return { ok: false, text: "รอสักครู่แล้วกดใหม่" };
    if (j.error === "not-subscribed") return { ok: false, text: "เซิร์ฟเวอร์ไม่พบเครื่องนี้ ลองปิดแล้วเปิดแจ้งเตือนใหม่" };
    return { ok: false, text: `ส่งไม่สำเร็จ (${j.host ?? ""} รหัส ${j.code ?? j.error ?? "?"} ${j.detail ?? ""})` };
  } catch {
    return { ok: false, text: "เชื่อมต่อไม่ได้ ลองใหม่" };
  }
}

const OWNER = "badminton-kabinburi:push-owner";
/** ผู้เล่นที่เครื่องนี้รับแจ้งเตือนแทนอยู่ (เผื่อเปลี่ยนคนบนเครื่องเดียวกัน) */
export function pushOwner(): string | null {
  try {
    return localStorage.getItem(OWNER);
  } catch {
    return null;
  }
}

/** ผูกเครื่องนี้กับผู้เล่น (เครื่องเดิมย้ายไปเป็นของคนใหม่ได้) คืนข้อความผิดพลาด หรือ null */
export async function savePushOwner(db: SupabaseClient, sub: PushSubscription, playerId: string, pin: string): Promise<string | null> {
  const j = sub.toJSON();
  const { data, error } = await db.rpc("push_subscribe", { p_player: playerId, p_pin: pin, p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
  if (error) return "เชื่อมต่อไม่ได้ ลองใหม่";
  if (data) return data as string;
  try {
    localStorage.setItem(OWNER, playerId);
  } catch {}
  return null;
}

/** ปิดแจ้งเตือนบนเครื่องนี้ */
export async function disablePush(db: SupabaseClient | null) {
  try {
    localStorage.removeItem(OWNER);
  } catch {}
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
  timer = setTimeout(async () => {
    // ยังไม่ได้ตั้งกุญแจบนเซิร์ฟเวอร์ = ไม่ต้องเรียก
    if (!(await pushServerInfo()).ready) return;
    fetch("/api/push", { method: "POST", headers: HDR, keepalive: true }).catch(() => {});
  }, 1500);
}

/** สวิตช์แอดมิน (null = ยังไม่ได้รัน SQL web_push.sql) */
export async function getPushEnabled(db: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await db.from("push_settings").select("enabled").eq("id", 1).maybeSingle();
  // ไม่มีตาราง = ยังไม่รัน SQL (null) ส่วนเน็ตหลุดให้ถือว่าเปิดอยู่ไปก่อน
  if (error) return /push_settings|42P01|PGRST205/.test(`${error.code} ${error.message}`) ? null : true;
  if (!data) return null;
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
