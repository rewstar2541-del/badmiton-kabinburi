// แปลข้อความที่แอดมินพิมพ์เอง (ประกาศ เหตุผลวันงดเล่น โน้ตค่าน้ำ) เป็นอังกฤษ/จีน
// ใช้บริการแปลฟรี (MyMemory, สำรองด้วย Google) แปลครั้งเดียวแล้วเก็บแคชในตาราง translations
// แปลเฉพาะข้อความที่มีอยู่จริงในฐานข้อมูล กันคนอื่นใช้เป็นบริการแปลฟรี
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TARGET = { en: "en", zh: "zh-CN" } as const;
type Lang = keyof typeof TARGET;
const THAI = /[฀-๿]/;

async function exists(text: string) {
  for (const [table, col] of [["announcements", "message"], ["announcements", "title"], ["closed_days", "reason"], ["drinks", "note"]]) {
    const { count } = await db.from(table).select(col, { count: "exact", head: true }).eq(col, text);
    if (count) return true;
  }
  return false;
}

async function viaMyMemory(text: string, lang: Lang) {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=th|${TARGET[lang]}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const j = await r.json();
  const out = j?.responseData?.translatedText as string | undefined;
  return j?.responseStatus == 200 && out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out) ? out : null;
}

async function viaGoogle(text: string, lang: Lang) {
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=${TARGET[lang]}&dt=t&q=${encodeURIComponent(text)}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const j = await r.json();
  const out = (j?.[0] ?? []).map((s: unknown[]) => s?.[0] ?? "").join("");
  return out || null;
}

async function translate(text: string, lang: Lang) {
  const { data } = await db.from("translations").select("out").eq("src", text).eq("lang", lang).maybeSingle();
  if (data) return data.out as string;
  if (!(await exists(text))) return text;
  let out: string | null = null;
  try {
    out = await viaGoogle(text, lang);
  } catch {
    // ลองอีกที่
  }
  if (!out) {
    try {
      out = await viaMyMemory(text, lang);
    } catch {
      // แปลไม่ได้ ใช้ต้นฉบับ
    }
  }
  if (!out) return text;
  await db.from("translations").upsert({ src: text, lang, out });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { texts, lang } = (await req.json()) as { texts?: unknown; lang?: unknown };
    if (!Array.isArray(texts) || !(lang === "en" || lang === "zh")) return json({ error: "bad request" }, 400);
    const list = texts.slice(0, 20).map((s) => String(s ?? "").slice(0, 500));
    const out = await Promise.all(list.map((s) => (s.trim() && THAI.test(s) ? translate(s, lang) : s)));
    return json({ translations: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
