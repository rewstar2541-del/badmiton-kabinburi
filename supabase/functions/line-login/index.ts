// เข้าสู่ระบบด้วย LINE (LINE Login) ทางเดียวของทุกคน ทั้งผู้เล่นและแอดมิน
// รับ code จาก LINE -> ตรวจกับ LINE -> ออก session ของ Supabase Auth (ตัวตนคือ <line user id>@line.kabinburi.app
// ใช้ตัดสินว่าเป็นแอดมินไหม) แล้ว
// - ถ้าผูกกับผู้เล่นแล้ว ออก session token ของผู้เล่นให้ด้วย
// - ถ้ายังไม่ผูก คืน ticket ไว้ให้สมัคร (หรือผูกชื่อเดิม) ในแอพ
// ต้องตั้ง secrets: LINE_LOGIN_CHANNEL_ID, LINE_LOGIN_CHANNEL_SECRET
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!CHANNEL_ID || !CHANNEL_SECRET) return json({ error: "ยังไม่ได้ตั้งค่า LINE Login ใน Supabase" });
  const { code, redirect_uri } = (await req.json()) as { code?: string; redirect_uri?: string };
  if (!code || !redirect_uri) return json({ error: "คำสั่งไม่ถูกต้อง" }, 400);

  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri, client_id: CHANNEL_ID, client_secret: CHANNEL_SECRET }),
  });
  if (!tokenRes.ok) return json({ error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return json({ error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" });

  // ตรวจ id_token กับ LINE (ลายเซ็น ผู้ออก และอายุ)
  const verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token, client_id: CHANNEL_ID }),
  });
  if (!verify.ok) return json({ error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  const profile = (await verify.json()) as { sub: string; name?: string };

  const session = await authSession(profile.sub, profile.name ?? "");
  if (!session) return json({ error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" });

  const { data: auth } = await db.from("player_auth").select("player_id").eq("line_user_id", profile.sub).maybeSingle();
  if (auth) {
    const { data: p } = await db.from("players").select("pending").eq("id", auth.player_id).single();
    if (p?.pending) return json({ session, pending: true, player_id: auth.player_id });
    const { data: token, error } = await db.rpc("new_player_session", { p_player: auth.player_id });
    if (error) return json({ error: error.message }, 500);
    return json({ session, token, player_id: auth.player_id });
  }

  // ยังไม่ผูก: ออก ticket ให้ไปเลือกชื่อหรือสมัครในแอพ
  const ticket = crypto.randomUUID() + crypto.randomUUID();
  await db.from("line_link_tickets").insert({ ticket_hash: await sha256(ticket), line_user_id: profile.sub, line_name: profile.name ?? null });
  return json({ session, ticket, name: profile.name ?? "" });
});
