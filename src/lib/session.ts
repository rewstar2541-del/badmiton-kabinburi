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
}

export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
