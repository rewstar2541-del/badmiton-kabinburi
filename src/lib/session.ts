import { isDemo } from "./demo";

/** ผู้เล่นที่ล็อกอินอยู่บนเครื่องนี้ (จำไว้ในเครื่อง) */
const ME_KEY = "badminton-kabinburi:me";
const TOKEN_KEY = "badminton-kabinburi:session";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, v: string | null) {
  try {
    if (v) localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  } catch {
    // ไม่จำก็ได้
  }
}

export interface PlayerSession {
  playerId: string;
  token: string;
}

export function readSession(): PlayerSession | null {
  const playerId = read(ME_KEY);
  const token = read(TOKEN_KEY);
  return playerId && token ? { playerId, token } : null;
}

export function writeSession(s: PlayerSession | null) {
  write(ME_KEY, s?.playerId ?? null);
  write(TOKEN_KEY, s?.token ?? null);
  remember({ playerId: s?.playerId ?? "", token: s?.token ?? "" });
}

/** สำรองไว้ในคุกกี้ฝั่งเซิร์ฟเวอร์ด้วย (ค่าว่าง = ลบ) */
export function remember(v: { playerId?: string; token?: string; refresh?: string }) {
  if (typeof fetch === "undefined" || isDemo()) return;
  fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json", "x-bk": "1" }, body: JSON.stringify(v) }).catch(() => {});
}

/**
 * ถ้าเครื่องลืมการเข้าสู่ระบบ (Safari ลบข้อมูลเว็บที่ไม่ได้เปิดนาน) ดึงคืนจากคุกกี้สำรอง
 * คืน refresh token ของ Supabase Auth ถ้ามี
 */
export async function restoreRemembered(): Promise<string | null> {
  if (isDemo()) return null;
  try {
    const r = await fetch("/api/session", { headers: { "x-bk": "1" }, cache: "no-store" });
    if (!r.ok) return null;
    const v = (await r.json()) as { playerId?: string; token?: string; refresh?: string };
    const local = readSession();
    if (v.playerId && v.token && !local) {
      write(ME_KEY, v.playerId);
      write(TOKEN_KEY, v.token);
    } else if (local && (local.playerId !== v.playerId || local.token !== v.token)) {
      // คนที่เข้าสู่ระบบไว้ก่อนมีคุกกี้สำรอง สำรองไว้ตอนนี้เลย
      remember(local);
    }
    return v.refresh ?? null;
  } catch {
    return null;
  }
}


export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
