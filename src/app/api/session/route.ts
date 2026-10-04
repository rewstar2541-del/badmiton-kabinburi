import { NextResponse, type NextRequest } from "next/server";

// สำรองการเข้าสู่ระบบไว้ในคุกกี้ที่เซิร์ฟเวอร์ตั้ง (HttpOnly)
// Safari ลบ localStorage ของเว็บที่ไม่ได้เปิดเกิน 7 วัน แต่ไม่ลบคุกกี้แบบนี้ เปิดครั้งหน้าจึงไม่ต้องเข้า LINE ใหม่
export const dynamic = "force-dynamic";

const NAME = "bk_session";
const MAX_AGE = 180 * 24 * 60 * 60; // เท่ากับอายุ token ผู้เล่นในฐานข้อมูล

export interface Remembered {
  playerId?: string;
  token?: string;
  /** refresh token ของ Supabase Auth (ใช้ตัดสินว่าเป็นแอดมิน) */
  refresh?: string;
}

function read(req: NextRequest): Remembered {
  try {
    return JSON.parse(req.cookies.get(NAME)?.value ?? "{}") as Remembered;
  } catch {
    return {};
  }
}

// ต้องมี header นี้ ฟอร์มจากเว็บอื่นส่งมาไม่ได้ และ fetch ข้ามเว็บจะถูกบล็อก
const fromApp = (req: NextRequest) => req.headers.get("x-bk") === "1";

export function GET(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  return NextResponse.json(read(req), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Remembered;
  const next: Remembered = { ...read(req) };
  for (const k of ["playerId", "token", "refresh"] as const) {
    if (k in body) {
      const v = body[k];
      if (typeof v === "string" && v && v.length < 2000) next[k] = v;
      else delete next[k];
    }
  }
  const res = NextResponse.json({ ok: true });
  const empty = !next.playerId && !next.token && !next.refresh;
  res.cookies.set(NAME, empty ? "" : JSON.stringify(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/session",
    maxAge: empty ? 0 : MAX_AGE,
  });
  return res;
}
