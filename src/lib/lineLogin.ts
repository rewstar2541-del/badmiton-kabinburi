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
export function startLineLogin() {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const q = new URLSearchParams({
    response_type: "code",
    client_id: CHANNEL_ID,
    redirect_uri: redirectUri(),
    state,
    scope: "profile openid",
    // ถ้าเปิดแจ้งเตือน LINE อีกครั้ง ใส่ bot_prompt: "aggressive" เพื่อชวนเพิ่มเพื่อนบัญชีก๊วน
  });
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${q}`;
}

export interface LineTicket {
  ticket: string;
  name: string;
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
  if (r.token && r.player_id) {
    writeSession({ playerId: r.player_id, token: r.token });
    clearLineTicket();
  } else if (r.ticket) {
    sessionStorage.setItem(TICKET_KEY, JSON.stringify({ ticket: r.ticket, name: r.name ?? "" }));
  } else return r.error ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง";
  window.location.reload();
  return "redirect";
}
