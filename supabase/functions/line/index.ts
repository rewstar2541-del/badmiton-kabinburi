// ส่งข้อความเข้ากลุ่ม LINE ของก๊วน ผ่าน LINE Messaging API
// เรียกได้ 3 แบบ:
//  1. จากฐานข้อมูล (มีคนลงชื่อ / เริ่มเกม) ส่ง x-hook-secret มาด้วย
//  2. webhook จาก LINE (มี x-line-signature) ใช้จำ id กลุ่มเมื่อบอทถูกเชิญเข้ากลุ่ม
//  3. แอดมินกดทดสอบจากแอพ (ส่ง token ของแอดมินมา)
// ต้องตั้ง secrets: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function settings() {
  const { data } = await db.from("line_settings").select("group_id,hook_secret").eq("id", 1).single();
  return data as { group_id: string | null; hook_secret: string } | null;
}

async function push(to: string, text: string) {
  if (!TOKEN) return "ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN";
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  return r.ok ? null : `LINE ตอบกลับ ${r.status}: ${await r.text()}`;
}

async function reply(replyToken: string, text: string) {
  if (!TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

async function validSignature(body: string, signature: string) {
  if (!SECRET) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac))) === signature;
}

type LineEvent = { type: string; replyToken?: string; source?: { type: string; groupId?: string }; message?: { type: string; text?: string } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const body = await req.text();

  // 2. webhook จาก LINE
  const signature = req.headers.get("x-line-signature");
  if (signature) {
    if (!(await validSignature(body, signature))) return json({ error: "bad signature" }, 401);
    const events = (JSON.parse(body).events ?? []) as LineEvent[];
    for (const e of events) {
      const groupId = e.source?.type === "group" ? e.source.groupId : undefined;
      const linkCmd = e.type === "message" && e.message?.text?.trim() === "เชื่อมแอพก๊วน";
      if (groupId && (e.type === "join" || linkCmd)) {
        await db.from("line_settings").update({ group_id: groupId }).eq("id", 1);
        if (e.replyToken) await reply(e.replyToken, "เชื่อมกลุ่มนี้กับแอพก๊วนแบดแล้ว 🏸 จะแจ้งเตือนเมื่อมีคนลงชื่อและเมื่อถึงคิวลงสนาม");
      }
    }
    return json({ ok: true });
  }

  const s = await settings();
  if (!s) return json({ error: "no settings" }, 500);

  // 1. จากฐานข้อมูล
  const hook = req.headers.get("x-hook-secret");
  if (hook) {
    if (hook !== s.hook_secret) return json({ error: "forbidden" }, 403);
    const b = JSON.parse(body) as { text?: string; messages?: { to: string; text: string }[] };
    // ข้อความส่วนตัวหลายคน (ถึงคิว) หรือข้อความเดียวเข้ากลุ่ม
    const list = b.messages ?? (s.group_id && b.text ? [{ to: s.group_id, text: b.text }] : []);
    const errs = (await Promise.all(list.slice(0, 10).map((m) => push(m.to, m.text)))).filter(Boolean);
    return errs.length ? json({ error: errs }, 502) : json({ ok: true, sent: list.length });
  }

  // 3. แอดมินกดทดสอบ
  const auth = req.headers.get("authorization") ?? "";
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: isAdmin } = await user.rpc("is_admin");
  if (!isAdmin) return json({ error: "ต้องเป็นแอดมิน" }, 403);
  if (!TOKEN || !SECRET) return json({ error: "ยังไม่ได้ตั้งค่า LINE ใน Supabase" });
  if (!s.group_id) return json({ error: "ยังไม่ได้เชิญบอทเข้ากลุ่ม LINE" });
  const err = await push(s.group_id, "ทดสอบแจ้งเตือนจากแอพก๊วนแบด ✅");
  return json(err ? { error: err } : { ok: true });
});
