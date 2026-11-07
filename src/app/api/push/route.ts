import { NextResponse, type NextRequest } from "next/server";
import { notifyTurns, pushConfig } from "@/lib/pushServer";

// แจ้งเตือนเด้งในมือถือ (Web Push)
// GET: กุญแจสาธารณะสำหรับให้เครื่องผู้เล่นสมัครรับ และบอกว่าตั้งค่าครบแล้วหรือยัง
// POST: เช็คคิววันนี้ ส่งแจ้งเตือน "อีก 1 เกมถึงคิว" ให้คนที่ยังไม่ได้รับ (แอพเรียกหลังเริ่ม/จบเกม หรือจัดคิว)
export const dynamic = "force-dynamic";

const fromApp = (req: NextRequest) => req.headers.get("x-bk") === "1";

export function GET(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  const c = pushConfig();
  return NextResponse.json({ ready: c.ready, publicKey: c.ready ? c.publicKey : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!fromApp(req)) return NextResponse.json({}, { status: 403 });
  try {
    return NextResponse.json(await notifyTurns());
  } catch (e) {
    console.error("push notify", e);
    return NextResponse.json({ sent: 0, error: "failed" }, { status: 500 });
  }
}
