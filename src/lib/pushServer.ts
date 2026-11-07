import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { rowsToState, type Rows } from "./remote";
import { bangkokDate, turnSoon } from "./pushQueue";

/**
 * ค่าที่ต้องตั้งใน Vercel (Settings > Environment Variables) ห้ามใส่ในโค้ด:
 * - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: กุญแจส่งแจ้งเตือน (สร้างด้วย `npx web-push generate-vapid-keys`)
 * - SUPABASE_SECRET_KEY: secret key ของ Supabase (อ่านรายการเครื่องที่รับแจ้งเตือน)
 * - VAPID_SUBJECT (ไม่บังคับ): อีเมลติดต่อ เช่น mailto:admin@example.com
 */
export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return { publicKey, privateKey, secret, url, ready: !!(publicKey && privateKey && secret && url) };
}

let admin: SupabaseClient | null = null;
function db() {
  const c = pushConfig();
  admin ??= createClient(c.url, c.secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** โหลดเฉพาะข้อมูลของวันนี้ที่ใช้จัดคิว (ไม่ต้องโหลดประวัติทั้งหมด) */
async function loadDay(d: SupabaseClient, date: string) {
  const [players, checkins, games, queued, pairs, settings] = await Promise.all([
    rows(d.from("players").select("id,name,gender,level,prefer,avoid,guest_of,pending")),
    rows(d.from("checkins").select("date,player_id,at,paid_at,resting,court_fee,shuttle_fee").eq("date", date)),
    rows(d.from("games").select("*").eq("date", date).order("id")),
    rows(d.from("court_queue").select("id,date,court,player_ids,at").eq("date", date).order("at")),
    rows(d.from("pair_requests").select("id,date,from_id,to_id,status,at").eq("date", date).order("at")),
    rows(d.from("settings").select("court_count,court_fee,first_shuttle_fee,next_shuttle_fee,monthly_fee,promptpay_id,bank_name,bank_account,bank_holder,court_numbers").eq("id", 1)),
  ]);
  const r = {
    players,
    checkins,
    games,
    queued,
    pairs,
    settings: settings[0] ?? null,
    drinks: [],
    monthly: [],
    annual: [],
    annualRules: [],
    announcements: [],
    signups: [],
    slips: [],
    packages: null,
    closed: [],
    expenses: [],
    polls: [],
    votes: [],
    notices: [],
    board: [],
    prices: [],
  } as unknown as Rows;
  const state = rowsToState(r);
  return { state, day: state.days.find((x) => x.date === date) };
}

export interface NotifyResult {
  sent: number;
  skipped?: string;
}

/**
 * หาคนที่อีก 1 เกมจะถึงคิว แล้วส่งแจ้งเตือนให้ทุกเครื่องที่เปิดรับไว้ คนละครั้งต่อตา
 * เรียกซ้ำได้ (กี่เครื่องเรียกพร้อมกันก็ไม่ส่งซ้ำ เพราะจองในตาราง push_sent ก่อนส่ง)
 */
let last = 0;
let pending: Promise<NotifyResult> | null = null;
const GAP = 5000;

/** กันคนยิงรัวๆ: ในเครื่องเซิร์ฟเวอร์เดียวกัน ทำงานไม่ถี่กว่าทุก 5 วินาที ครั้งที่มาระหว่างนั้นรวมเป็นรอบเดียว (ไม่ทิ้ง) */
export function notifyTurnsThrottled(): Promise<NotifyResult> {
  if (pending) return pending;
  const wait = Math.max(0, last + GAP - Date.now());
  pending = new Promise<void>((r) => setTimeout(r, wait))
    .then(() => {
      last = Date.now();
      return notifyTurns();
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function notifyTurns(): Promise<NotifyResult> {
  const c = pushConfig();
  if (!c.ready) return { sent: 0, skipped: "not-configured" };
  const d = db();
  const { data: ps, error: psError } = await d.from("push_settings").select("enabled").eq("id", 1).maybeSingle();
  // ยังไม่ได้รัน SQL web_push.sql
  if (psError || !ps) return { sent: 0, skipped: "no-sql" };
  if (ps.enabled === false) return { sent: 0, skipped: "off" };

  const date = bangkokDate();
  const { state, day } = await loadDay(d, date);
  if (!day) return { sent: 0 };
  const due = turnSoon(day, state.players, state.settings);
  if (!due.length) return { sent: 0 };

  const subs = await rows<{ endpoint: string; player_id: string; p256dh: string; auth: string }>(
    d.from("push_subscriptions").select("endpoint,player_id,p256dh,auth").in("player_id", due.map((x) => x.playerId)),
  );
  const withSub = due.filter((x) => subs.some((s) => s.player_id === x.playerId));
  if (!withSub.length) return { sent: 0 };

  // จองก่อนส่ง: แถวที่เพิ่มได้จริงเท่านั้นที่ส่ง
  const { data: claimed, error } = await d
    .from("push_sent")
    .upsert(withSub.map((x) => ({ date, player_id: x.playerId, key: x.key })), { onConflict: "date,player_id,key", ignoreDuplicates: true })
    .select("player_id");
  if (error) throw new Error(error.message);
  const mine = new Set((claimed ?? []).map((x) => x.player_id as string));

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@badmiton-kabinburi.vercel.app", c.publicKey, c.privateKey);
  let sent = 0;
  const gone: string[] = [];
  const reached = new Set<string>();
  await Promise.all(
    withSub
      .filter((x) => mine.has(x.playerId))
      .flatMap((x) =>
        subs
          .filter((s) => s.player_id === x.playerId)
          .map(async (s) => {
            const payload = JSON.stringify({
              title: `อีก 1 เกมถึงคิวคุณ ที่สนาม ${x.court}`,
              body: "เตรียมตัวได้เลย จบเกมนี้แล้วลงต่อ",
              tag: `turn-${date}`,
              url: "/",
            });
            try {
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 15 * 60, urgency: "high" });
              sent++;
              reached.add(x.playerId);
            } catch (e) {
              // เครื่องยกเลิกรับแล้ว (ลบแอพ/ปิดสิทธิ์) หรือสมัครด้วยกุญแจเก่า (403) ลบทิ้ง
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 403 || code === 404 || code === 410) gone.push(s.endpoint);
            }
          }),
      ),
  );
  if (gone.length) await d.from("push_subscriptions").delete().in("endpoint", gone);
  // ส่งไม่ถึงสักเครื่อง (เน็ตของบริการแจ้งเตือนล่ม) ปลดการจองไว้ ครั้งหน้าลองส่งใหม่
  for (const x of withSub)
    if (mine.has(x.playerId) && !reached.has(x.playerId)) await d.from("push_sent").delete().eq("date", date).eq("player_id", x.playerId).eq("key", x.key);
  // ล้างประวัติกันส่งซ้ำของวันก่อนๆ (ทำเฉพาะรอบที่มีการส่ง)
  if (mine.size) await d.from("push_sent").delete().lt("date", date);
  return { sent };
}
