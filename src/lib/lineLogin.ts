import type { SupabaseClient } from "@supabase/supabase-js";
import { lineLogin } from "./remote";
import { writeSession } from "./session";

/** Channel ID ของ LINE Login (ตั้งใน Vercel: NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID) */
const CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID ?? "";
export const lineLoginEnabled = Boolean(CHANNEL_ID);

const STATE_KEY = "badminton-kabinburi:line-state";
const TICKET_KEY = "badminton-kabinburi:line-ticket";

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

/** ไปหน้าเข้าสู่ระบบของ LINE แล้วกลับมาที่หน้านี้ */
/** มาจาก QR สมัครแข่ง: กลับจาก LINE แล้วเปิดหน้างานแข่งต่อ */
export const JOIN_KEY = "badminton-kabinburi:join";

export function startLineLogin(join = false) {
  if (join === true) sessionStorage.setItem(JOIN_KEY, "1");
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const q = new URLSearchParams({
    response_type: "code",
    client_id: CHANNEL_ID,
    redirect_uri: redirectUri(),
    state,
    scope: "profile openid",
    // ชวนเพิ่มเพื่อนบัญชีก๊วน (ถ้าผูก Official Account ไว้) เพื่อรับแจ้งเตือน "ถึงคิวคุณ" ถ้าไม่ได้ผูก LINE จะไม่แสดง
    bot_prompt: "aggressive",
  });
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${q}`;
}

export interface LineTicket {
  ticket: string;
  name: string;
  /** รูปโปรไฟล์ LINE */
  picture?: string;
}

/** LINE ยืนยันตัวแล้วแต่ยังไม่ได้ผูกกับชื่อในก๊วน */
export function readLineTicket(): LineTicket | null {
  try {
    return JSON.parse(sessionStorage.getItem(TICKET_KEY) ?? "null") as LineTicket | null;
  } catch {
    return null;
  }
}

export function clearLineTicket() {
  try {
    sessionStorage.removeItem(TICKET_KEY);
  } catch {
    // ไม่เป็นไร
  }
}

/**
 * ถ้าเพิ่งกลับมาจาก LINE (มี ?code=) จัดการให้เสร็จแล้วโหลดหน้าใหม่แบบไม่มี code
 * คืนข้อความผิดพลาด, "redirect" เมื่อกำลังโหลดหน้าใหม่ หรือ null เมื่อไม่ได้มาจาก LINE
 */
export async function handleLineCallback(db: SupabaseClient): Promise<string | "redirect" | null> {
  const q = new URLSearchParams(window.location.search);
  const code = q.get("code");
  if (!code) return null;
  const state = q.get("state");
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  window.history.replaceState(null, "", redirectUri());
  if (!state || state !== expected) return "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง";
  const r = await lineLogin(db, code, redirectUri());
  // session ของ Supabase Auth ใช้ตัดสินว่าเป็นแอดมินไหม (ทุกคนเข้าด้วย LINE ทางเดียว)
  if (r.session) await db.auth.setSession(r.session);
  if (r.claim) return "ส่งแล้ว รอแอดมินยืนยัน";
  if (r.pending) return "รอแอดมินอนุมัติก่อน";
  if (r.token && r.player_id) {
    writeSession({ playerId: r.player_id, token: r.token });
    clearLineTicket();
  } else if (r.ticket) {
    sessionStorage.setItem(TICKET_KEY, JSON.stringify({ ticket: r.ticket, name: r.name ?? "", picture: r.picture ?? undefined }));
  } else return r.error ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง";
  window.location.reload();
  return "redirect";
}

const SYNC_KEY = "badminton-kabinburi:photo-sync";

/** รูปโปรไฟล์ที่มาจาก LINE (หรือยังไม่มีรูป) จึงดึงใหม่จาก LINE ได้ */
export function photoFromLine(photo?: string): boolean {
  return !photo || photo.startsWith("https://profile.line-scdn.net/");
}

/**
 * เปิดแอพในแอป LINE: ไปขอรูปโปรไฟล์ล่าสุดจาก LINE ครั้งหนึ่งต่อการเปิด (LINE ส่งกลับทันทีเพราะเคยอนุญาตแล้ว)
 * คืน true ถ้ากำลังเปลี่ยนหน้าไป LINE
 */
export function syncLinePhotoOnOpen(photo?: string): boolean {
  if (!lineLoginEnabled || !/\bLine\//i.test(navigator.userAgent) || !photoFromLine(photo)) return false;
  try {
    if (sessionStorage.getItem(SYNC_KEY)) return false;
    sessionStorage.setItem(SYNC_KEY, "1");
  } catch {
    return false;
  }
  startLineLogin();
  return true;
}
