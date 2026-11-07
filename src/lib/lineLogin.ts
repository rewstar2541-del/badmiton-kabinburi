import type { SupabaseClient } from "@supabase/supabase-js";
import { lineLogin, takeHandoff, type LineLoginResult } from "./remote";
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

/** state ที่รอ LINE ส่งกลับ (เก็บใน localStorage เพราะ Safari อาจเปิดหน้าที่ LINE ส่งกลับในแท็บใหม่) */
interface PendingLogin {
  state: string;
  at: number;
  join?: boolean;
}
const PENDING_MS = 10 * 60 * 1000;

function readPending(): PendingLogin | null {
  try {
    const p = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null") as PendingLogin | null;
    if (p && typeof p.state === "string" && Date.now() - p.at < PENDING_MS) return p;
  } catch {
    // ไม่เป็นไร
  }
  return null;
}

function clearPending() {
  try {
    localStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    // ไม่เป็นไร
  }
}

export function startLineLogin(join = false) {
  const state = crypto.randomUUID();
  try {
    if (join === true) sessionStorage.setItem(JOIN_KEY, "1");
    localStorage.setItem(STATE_KEY, JSON.stringify({ state, at: Date.now(), join: join === true } satisfies PendingLogin));
  } catch {
    // โหมดส่วนตัวบางแบบเขียนไม่ได้ ไปต่อ (กลับมาแล้วจะให้ลองใหม่)
  }
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

/** เก็บผลที่ได้จาก LINE ไว้ในเครื่องนี้ คืนข้อความ หรือ null ถ้าเข้าสู่ระบบแล้ว (ต้องโหลดหน้าใหม่) */
async function applyResult(db: SupabaseClient, r: LineLoginResult): Promise<string | null> {
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
  return null;
}

/** เปิดจากไอคอนบนหน้าจอหลัก (Safari กับแอพบนหน้าจอหลักเก็บข้อมูลแยกกัน) */
function standalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/**
 * ถ้าเพิ่งกลับมาจาก LINE (มี ?code=) จัดการให้เสร็จแล้วโหลดหน้าใหม่แบบไม่มี code
 * คืนข้อความผิดพลาด, "redirect" เมื่อกำลังโหลดหน้าใหม่ หรือ null เมื่อไม่ได้มาจาก LINE
 */
export async function handleLineCallback(db: SupabaseClient): Promise<string | "redirect" | null> {
  const q = new URLSearchParams(window.location.search);
  const code = q.get("code");
  if (!code) {
    // LINE ไม่อนุญาต / ผู้ใช้กดยกเลิก
    if (q.get("error") && q.get("state")) {
      window.history.replaceState(null, "", redirectUri());
      if (q.get("state") === readPending()?.state) clearPending();
      return "ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว";
    }
    return null;
  }
  const state = q.get("state");
  const pending = readPending();
  // รุ่นก่อนเก็บไว้ใน sessionStorage (คนที่กดเข้าสู่ระบบค้างไว้ตอนอัปเดต)
  const legacy = sessionStorage.getItem(STATE_KEY);
  window.history.replaceState(null, "", redirectUri());
  if (!state) return "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง";
  if (state !== pending?.state && state !== legacy) {
    // หน้านี้ไม่ได้เป็นคนเริ่ม (เช่น เริ่มจากแอพบนหน้าจอหลัก แต่ LINE ส่งกลับมาเปิดใน Safari)
    // ส่งผลต่อให้หน้าที่เริ่มไว้ ไม่เข้าสู่ระบบที่นี่ (กันคนอื่นส่งลิงก์มาให้เข้าบัญชีเขา)
    const h = await lineLogin(db, code, redirectUri(), state);
    if (h.handoff) return "เข้าสู่ระบบด้วย LINE แล้ว กลับไปที่แอพแบดกบินทร์บนหน้าจอหลักได้เลย";
    return h.error ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
  clearPending();
  if (pending?.join) sessionStorage.setItem(JOIN_KEY, "1");
  const msg = await applyResult(db, await lineLogin(db, code, redirectUri()));
  if (msg) return msg;
  window.location.reload();
  return "redirect";
}

/**
 * แอพบนหน้าจอหลักที่ส่งไปเข้าสู่ระบบด้วย LINE แล้วผลไปตกที่ Safari: มารับผลต่อเมื่อผู้ใช้สลับกลับมา
 * คืนข้อความ, "redirect" เมื่อเข้าสู่ระบบแล้วกำลังโหลดหน้าใหม่ หรือ null เมื่อยังไม่มีผล
 */
export async function takeLineHandoff(db: SupabaseClient): Promise<string | "redirect" | null> {
  const pending = readPending();
  if (!pending) return null;
  const r = await takeHandoff(db, pending.state);
  if (r.none) return null;
  clearPending();
  if (pending.join) sessionStorage.setItem(JOIN_KEY, "1");
  const msg = await applyResult(db, r);
  if (msg) return msg;
  window.location.reload();
  return "redirect";
}

/** รอรับผลจาก Safari เฉพาะตอนเปิดจากหน้าจอหลักและกดเข้าสู่ระบบค้างไว้ */
export function waitsForLineHandoff(): boolean {
  return lineLoginEnabled && standalone() && readPending() !== null;
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
