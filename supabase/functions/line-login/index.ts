// เข้าสู่ระบบด้วย LINE (LINE Login) ทางเดียวของทุกคน ทั้งผู้เล่นและแอดมิน
// รับ code จาก LINE -> ตรวจกับ LINE -> ออก session ของ Supabase Auth (ตัวตนคือ <line user id>@line.kabinburi.app
// ใช้ตัดสินว่าเป็นแอดมินไหม) แล้ว
// - ถ้าผูกกับผู้เล่นแล้ว ออก session token ของผู้เล่นให้ด้วย
// - ถ้ายังไม่ผูก คืน ticket พร้อมชื่อและรูปจาก LINE ไว้ให้สมัคร (หรือขอผูกชื่อเดิม ให้แอดมินยืนยัน) ในแอพ
// ต้องตั้ง secrets: LINE_LOGIN_CHANNEL_ID, LINE_LOGIN_CHANNEL_SECRET
//
// ส่งต่อให้แอพบนหน้าจอหลัก (iPhone): แอพบนหน้าจอหลักกับ Safari เก็บข้อมูลแยกกัน ถ้า LINE ส่งกลับไปเปิดใน Safari
// หน้านั้นจะไม่มี state ที่แอพจำไว้ จึงส่ง { handoff_state } มา เราเก็บผลไว้ใต้ hash ของ state 10 นาที
// แล้วแอพ (ที่รู้ state) มารับด้วย { take_handoff } เมื่อผู้ใช้สลับกลับไป
import { createClient } from "npm:@supabase/supabase-js@2";

const CHANNEL_ID = Deno.env.get("LINE_LOGIN_CHANNEL_ID") ?? "";
const CHANNEL_SECRET = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** session ของ Supabase Auth สำหรับบัญชี LINE นี้ (สร้างผู้ใช้ครั้งแรกอัตโนมัติ) */
async function authSession(sub: string, name: string) {
  const email = `${sub.toLowerCase()}@line.kabinburi.app`;
  await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { line_name: name } }); // มีอยู่แล้วก็ไม่เป็นไร
  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties?.hashed_token) return null;
  const anon = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  return data.session ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token } : null;
}

type Result = { body: Record<string, unknown>; status?: number };
const fail = (status?: number): Result => ({ body: { error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" }, status });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!CHANNEL_ID || !CHANNEL_SECRET) return json({ error: "ยังไม่ได้ตั้งค่า LINE Login ใน Supabase" });
  const { code, redirect_uri, handoff_state, take_handoff } = (await req.json()) as {
    code?: string;
    redirect_uri?: string;
    handoff_state?: string;
    take_handoff?: string;
  };

  // แอพมารับผลที่ Safari ทำไว้ให้ (ใช้ได้ครั้งเดียว)
  if (take_handoff) {
    if (take_handoff.length < 20) return json({ error: "คำสั่งไม่ถูกต้อง" }, 400);
    const { data } = await db
      .from("line_handoffs")
      .delete()
      .eq("state_hash", await sha256(take_handoff))
      .gt("expires_at", new Date().toISOString())
      .select("result")
      .maybeSingle();
    return json(data?.result ?? { none: true });
  }

  if (!code || !redirect_uri) return json({ error: "คำสั่งไม่ถูกต้อง" }, 400);
  if (handoff_state !== undefined && handoff_state.length < 20) return json({ error: "คำสั่งไม่ถูกต้อง" }, 400);
  const r = await login(code, redirect_uri);
  if (!handoff_state || r.body.error) return json(r.body, r.status);
  await db.from("line_handoffs").delete().lt("expires_at", new Date().toISOString());
  const { error } = await db.from("line_handoffs").upsert({ state_hash: await sha256(handoff_state), result: r.body });
  if (error) return json({ error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" }, 500);
  return json({ handoff: true });
});

async function login(code: string, redirect_uri: string): Promise<Result> {

  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri, client_id: CHANNEL_ID, client_secret: CHANNEL_SECRET }),
  });
  if (!tokenRes.ok) return fail();
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return fail();

  // ตรวจ id_token กับ LINE (ลายเซ็น ผู้ออก และอายุ)
  const verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token, client_id: CHANNEL_ID }),
  });
  if (!verify.ok) return fail();
  const profile = (await verify.json()) as { sub: string; name?: string; picture?: string };
  // รูปโปรไฟล์ LINE (รับเฉพาะลิงก์รูปของ LINE)
  const picture = profile.picture?.startsWith("https://profile.line-scdn.net/") ? profile.picture : null;

  const session = await authSession(profile.sub, profile.name ?? "");
  if (!session) return fail();

  const { data: auth } = await db.from("player_auth").select("player_id").eq("line_user_id", profile.sub).maybeSingle();
  if (auth) {
    const { data: p } = await db.from("players").select("pending,photo").eq("id", auth.player_id).single();
    // ใช้รูปจาก LINE ถ้ายังไม่มีรูป หรือรูปเดิมมาจาก LINE (อัปเดตตามที่เปลี่ยนใน LINE)
    if (picture && (!p?.photo || (p.photo.startsWith("https://profile.line-scdn.net/") && p.photo !== picture)))
      await db.from("players").update({ photo: picture }).eq("id", auth.player_id);
    if (p?.pending) return { body: { session, pending: true, player_id: auth.player_id } };
    const { data: token, error } = await db.rpc("new_player_session", { p_player: auth.player_id });
    if (error) return { body: { error: error.message }, status: 500 };
    return { body: { session, token, player_id: auth.player_id } };
  }

  // ขอผูกกับชื่อเดิมไว้แล้ว รอแอดมินยืนยัน
  const { data: claim } = await db.from("line_claims").select("player_id").eq("line_user_id", profile.sub).eq("status", "pending").maybeSingle();
  if (claim) return { body: { session, pending: true, claim: true } };

  // ยังไม่ผูก: ออก ticket ให้ไปเลือกชื่อหรือสมัครในแอพ
  const ticket = crypto.randomUUID() + crypto.randomUUID();
  await db.from("line_link_tickets").insert({ ticket_hash: await sha256(ticket), line_user_id: profile.sub, line_name: profile.name ?? null, picture });
  return { body: { session, ticket, name: profile.name ?? "", picture } };
}
