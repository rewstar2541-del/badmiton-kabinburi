import { NextResponse, type NextRequest } from "next/server";
import { notifyTurnsThrottled, pushConfig, sendTest } from "@/lib/pushServer";

// แจ้งเตือนเด้งในมือถือ (Web Push)
// GET: กุญแจสาธารณะสำหรับให้เครื่องผู้เล่นสมัครรับ และบอกว่าตั้งค่าครบแล้วหรือยัง
// POST: เช็คคิววันนี้ ส่งแจ้งเตือน "อีก 1 เกมถึงคิว" ให้คนที่ยังไม่ได้รับ (แอพเรียกหลังเริ่ม/จบเกม หรือจัดคิว)
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const fromApp = (req: NextRequest) => req.headers.get("x-bk") === "1";

export function GET(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  const c = pushConfig();
  return NextResponse.json({ ready: c.ready, publicKey: c.ready ? c.publicKey : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  try {
    const body = (await req.json().catch(() => ({}))) as { test?: unknown };
    // ทดสอบส่งหาเครื่องตัวเอง (หน้าโปรไฟล์ > ส่งแจ้งเตือนทดสอบ)
    if (typeof body.test === "string" && body.test.startsWith("https://") && body.test.length < 1000) return NextResponse.json(await sendTest(body.test));
    return NextResponse.json(await notifyTurnsThrottled());
  } catch (e) {
    console.error("push notify", e);
    return NextResponse.json({ sent: 0, error: "failed" }, { status: 500 });
  }
}
