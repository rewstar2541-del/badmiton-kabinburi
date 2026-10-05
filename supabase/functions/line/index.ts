// แจ้งเตือนผ่าน LINE Official Account (Messaging API)
// เรียกได้หลายแบบ:
//  1. จากฐานข้อมูล (ถึงคิว / เปิดประกาศ) ส่ง x-hook-secret มาด้วย
//  2. webhook จาก LINE (มี x-line-signature) ใช้จำ id กลุ่มเมื่อบอทถูกเชิญเข้ากลุ่ม
//  3. แอดมิน: ดูสถานะ/โควตา หรือกดทดสอบ (ส่ง token ของแอดมินมา)
//  4. ผู้เล่น: เช็คว่าเพิ่มเพื่อน LINE ของก๊วนแล้วหรือยัง
// ต้องตั้ง secrets: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
// โควตาฟรีของ LINE OA ไทย 300 ข้อความ/เดือน นับตามจำนวนคนที่ได้รับ ถ้าครบแล้ว LINE จะไม่ส่งต่อ (แพ็กเกจฟรีไม่เก็บเงิน)
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const API = "https://api.line.me/v2/bot";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Settings = { group_id: string | null; hook_secret: string; monthly_limit: number; turn_reserve: number; oa_basic_id: string | null };

async function settings() {
  const { data } = await db.from("line_settings").select("group_id,hook_secret,monthly_limit,turn_reserve,oa_basic_id").eq("id", 1).single();
  return data as Settings | null;
}

const month = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

async function lineGet(path: string) {
  if (!TOKEN) return null;
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return r.ok ? await r.json() : null;
}

async function linePost(path: string, body: unknown) {
  if (!TOKEN) return "ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Supabase";
  const r = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok ? null : `LINE ตอบกลับ ${r.status}: ${(await r.text()).slice(0, 300)}`;
}

async function usage() {
  const m = month();
  const { data } = await db.from("line_usage").select("sent,turn,announce,skipped").eq("month", m).maybeSingle();
  return { month: m, sent: 0, turn: 0, announce: 0, skipped: 0, ...(data ?? {}) };
}

async function addUsage(kind: "turn" | "announce" | "skipped", n: number) {
  if (!n) return;
  const u = await usage();
  const row = { month: u.month, sent: u.sent, turn: u.turn, announce: u.announce, skipped: u.skipped };
  if (kind === "skipped") row.skipped += n;
  else {
    row.sent += n;
    row[kind] += n;
  }
  await db.from("line_usage").upsert(row);
}

async function logError(err: string | null) {
  await db.from("line_settings").update({ last_error: err, last_error_at: err ? new Date().toISOString() : null }).eq("id", 1);
}

/** ส่งไปแล้วเดือนนี้: ใช้ตัวเลขจาก LINE ถ้าได้ ไม่งั้นใช้ที่แอพนับเอง */
async function used() {
  const [u, c] = await Promise.all([usage(), lineGet("/message/quota/consumption")]);
  return Math.max(u.sent, Number(c?.totalUsage ?? 0));
}

async function reply(replyToken: string, text: string) {
  await linePost("/message/reply", { replyToken, messages: [{ type: "text", text }] });
}

async function validSignature(body: string, signature: string) {
  if (!SECRET) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac))) === signature;
}

type LineEvent = { type: string; replyToken?: string; source?: { type: string; groupId?: string }; message?: { type: string; text?: string } };
type Msg = { to?: string; to_many?: string[]; text: string };

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
      if (!groupId || !e.replyToken) continue;
      if (e.type === "join") {
        await reply(e.replyToken, "สวัสดีครับ 🏸 ให้แอดมินกดขอรหัสในแอพ (ตั้งค่า > แจ้งเตือน LINE) แล้วพิมพ์ \"เชื่อมแอพก๊วน รหัส\" ในกลุ่มนี้");
        continue;
      }
      // เชื่อมกลุ่มได้เฉพาะเมื่อพิมพ์รหัสที่แอดมินขอจากแอพ (ใช้ได้ครั้งเดียว 15 นาที)
      const m = e.type === "message" ? e.message?.text?.trim().match(/^เชื่อมแอพก๊วน\s*(\d{6})$/) : null;
      if (!m) continue;
      const { data } = await db
        .from("line_settings")
        .update({ group_id: groupId, link_code: null, link_code_expires: null })
        .eq("id", 1)
        .eq("link_code", m[1])
        .gt("link_code_expires", new Date().toISOString())
        .select("id");
      await reply(e.replyToken, data?.length ? "เชื่อมกลุ่มนี้กับแอพก๊วนแบดแล้ว 🏸" : "รหัสไม่ถูกต้องหรือหมดอายุ ให้แอดมินกดขอรหัสใหม่ในแอพ");
    }
    return json({ ok: true });
  }

  const s = await settings();
  if (!s) return json({ error: "no settings" }, 500);

  // 1. จากฐานข้อมูล: ถึงคิว (ส่งก่อนเสมอจนโควตาหมด) / เปิดประกาศ (ต้องเหลือโควตาสำรองไว้ให้ถึงคิว)
  const hook = req.headers.get("x-hook-secret");
  if (hook) {
    if (hook !== s.hook_secret) return json({ error: "forbidden" }, 403);
    const b = JSON.parse(body) as { kind?: "turn" | "announce"; messages?: Msg[] };
    const kind = b.kind === "announce" ? "announce" : "turn";
    const list = (b.messages ?? []).slice(0, 10);
    let left = s.monthly_limit - (await used());
    let sent = 0;
    let skipped = 0;
    const errs: string[] = [];
    for (const m of list) {
      const to = m.to_many ? [...new Set(m.to_many)].slice(0, 500) : m.to ? [m.to] : [];
      if (!to.length) continue;
      const keep = kind === "announce" ? s.turn_reserve : 0;
      if (left - to.length < keep) {
        skipped += to.length;
        continue;
      }
      const msg = [{ type: "text", text: m.text.slice(0, 4900) }];
      const err = to.length === 1 ? await linePost("/message/push", { to: to[0], messages: msg }) : await linePost("/message/multicast", { to, messages: msg });
      if (err) errs.push(err);
      else {
        sent += to.length;
        left -= to.length;
      }
    }
    await addUsage(kind, sent);
    await addUsage("skipped", skipped);
    if (errs.length) await logError(errs[0]);
    else if (skipped) await logError(kind === "announce" ? "ไม่ได้ส่งแจ้งประกาศ เพราะโควตาเหลือน้อย (เก็บไว้แจ้งถึงคิว)" : "โควตาเดือนนี้หมดแล้ว");
    return errs.length ? json({ error: errs }, 502) : json({ ok: true, sent, skipped });
  }

  const req2 = body ? (JSON.parse(body) as { action?: string; player?: string; token?: string }) : {};

  // 4. ผู้เล่นเช็คว่าเพิ่มเพื่อนแล้วหรือยัง
  if (req2.action === "friend") {
    const { data: err } = await db.rpc("check_player_pin", { p_player: req2.player ?? "", p_pin: req2.token ?? "" });
    if (err) return json({ error: err });
    const { data: a } = await db.from("player_auth").select("line_user_id").eq("player_id", req2.player!).maybeSingle();
    if (!a?.line_user_id || !TOKEN) return json({ friend: null });
    const r = await fetch(`${API}/profile/${a.line_user_id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    return json({ friend: r.ok });
  }

  // 3. แอดมิน
  const auth = req.headers.get("authorization") ?? "";
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: isAdmin } = await user.rpc("is_admin");
  if (!isAdmin) return json({ error: "ต้องเป็นแอดมิน" }, 403);

  if (req2.action === "status") {
    const [info, quota, consumption, u] = await Promise.all([lineGet("/info"), lineGet("/message/quota"), lineGet("/message/quota/consumption"), usage()]);
    const basicId = info?.basicId ?? null;
    if (basicId && basicId !== s.oa_basic_id) await db.from("line_settings").update({ oa_basic_id: basicId }).eq("id", 1);
    return json({
      token: !!TOKEN,
      secret: !!SECRET,
      tokenOk: !!info,
      name: info?.displayName ?? null,
      basicId,
      lineLimit: quota?.type === "limited" ? quota.value : null,
      lineUsed: consumption?.totalUsage ?? null,
      usage: u,
    });
  }

  // ทดสอบ: ส่งหาแอดมินคนที่กด (ถ้าผูก LINE แล้ว) ไม่งั้นเข้ากลุ่ม
  if (!TOKEN) return json({ error: "ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Supabase" });
  const { data: me } = await user.rpc("my_admin_line");
  const to = (me as string | null) ?? s.group_id;
  if (!to) return json({ error: "ยังไม่ได้ผูก LINE กับชื่อของคุณ" });
  const err = await linePost("/message/push", { to, messages: [{ type: "text", text: "ทดสอบแจ้งเตือนจากแอพก๊วนแบด ✅" }] });
  if (!err) await addUsage("turn", 1);
  await logError(err);
  return json(err ? { error: err } : { ok: true });
});
