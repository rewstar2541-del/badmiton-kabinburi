import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { rowsToState, type Rows } from "./remote";
import { bangkokDate, turnSoon } from "./pushQueue";
import { LEVELS } from "./types";

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
let waiting: Promise<NotifyResult> | null = null;
const GAP = 5000;

/**
 * กันคนยิงรัวๆ: ในเครื่องเซิร์ฟเวอร์เดียวกัน ทำงานไม่ถี่กว่าทุก 5 วินาที
 * คำขอที่มาระหว่างรอ รวมเป็นรอบถัดไปรอบเดียว (ไม่ทิ้ง: รอบนั้นโหลดข้อมูลหลังคำขอทุกอัน)
 */
export function notifyTurnsThrottled(): Promise<NotifyResult> {
  if (waiting) return waiting;
  const wait = Math.max(0, last + GAP - Date.now());
  waiting = new Promise<void>((r) => setTimeout(r, wait)).then(() => {
    // เริ่มโหลดแล้ว: คำขอใหม่หลังจากนี้ต้องได้รอบใหม่
    waiting = null;
    last = Date.now();
    return notifyTurns();
  });
  return waiting;
}

interface Msg {
  playerId: string;
  /** กันส่งซ้ำ: 1 เรื่องต่อคนต่อวัน */
  key: string;
  title: string;
  body: string;
  tag: string;
  /** ถึงคิว (play) / อีก 1 เกมถึงคิว (soon): ให้มือถือสั่นและมีเสียง (ถ้าผู้เล่นเปิดไว้) */
  alert?: "play" | "soon";
  /** แตะแจ้งเตือนแล้วเปิดหน้าไหน (ไม่ใส่ = หน้าสนาม) */
  tab?: string;
}

/**
 * ผู้เล่นที่เป็นแอดมิน: แอดมินเข้าระบบด้วย LINE ได้อีเมล u<line id>@line.kabinburi.app
 * จับคู่กับผู้เล่นที่ผูก LINE เดียวกันไว้ (แอดมินที่เข้าด้วยอีเมลอื่นจะไม่ได้แจ้งเตือนนี้)
 */
async function adminPlayerIds(d: SupabaseClient): Promise<string[]> {
  const [admins, auth] = await Promise.all([
    rows<{ email: string }>(d.from("admins").select("email")),
    rows<{ player_id: string; line_user_id: string | null }>(d.from("player_auth").select("player_id,line_user_id")),
  ]);
  const emails = new Set(admins.map((a) => a.email.toLowerCase()));
  return auth.filter((a) => a.line_user_id && emails.has(`${a.line_user_id.toLowerCase()}@line.kabinburi.app`)).map((a) => a.player_id);
}

/** ผู้เล่นขอเปลี่ยนระดับมือ: แจ้งแอดมินให้เข้าไปอนุมัติ (คำขอเดิมที่ยังค้าง เตือนซ้ำได้วันละครั้ง) */
async function levelRequests(d: SupabaseClient, subscribers: string[]): Promise<Msg[]> {
  const reqs = (await rows<{ id: string; name: string; level: number; level_request: number | null }>(d.from("players").select("id,name,level,level_request"))).filter(
    (p) => p.level_request && p.level_request !== p.level,
  );
  if (!reqs.length) return [];
  const admins = (await adminPlayerIds(d)).filter((id) => subscribers.includes(id));
  const code = (l: number) => LEVELS.find((x) => x.value === l)?.code ?? String(l);
  return reqs.flatMap((p) =>
    admins
      .filter((a) => a !== p.id)
      .map((a) => ({
        playerId: a,
        key: `level:${p.id}:${p.level_request}`,
        title: "🎚️ ขอเปลี่ยนระดับมือ",
        body: `${p.name} ขอเปลี่ยนจาก ${code(p.level)} เป็น ${code(p.level_request!)} รอแอดมินอนุมัติ`,
        tag: `level-${p.id}`,
        tab: "players",
      })),
  );
}

function setVapid() {
  const c = pushConfig();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@badmiton-kabinburi.vercel.app", c.publicKey, c.privateKey);
}

/** รวมเรื่องที่ต้องแจ้งตอนนี้: อีก 1 เกมถึงคิว, ถึงคิวลงสนามแล้ว, เปิดลงชื่อ/อีเว้นใหม่, คำขอเปลี่ยนระดับมือ (แอดมิน) */
async function collect(d: SupabaseClient, date: string, subscribers: string[]): Promise<Msg[]> {
  const out: Msg[] = [];
  const { state, day } = await loadDay(d, date);
  const now = Date.now();
  if (day) {
    for (const x of turnSoon(day, state.players, state.settings))
      out.push({ playerId: x.playerId, key: x.key, title: `อีก 1 เกมถึงคิวคุณ ที่สนาม ${x.court}`, body: "เตรียมตัวได้เลย จบเกมนี้แล้วลงต่อ", tag: `turn-${date}`, alert: "soon" });
    // เกมที่เพิ่งเริ่ม (ไม่เกิน 3 นาที) แจ้งคนที่ได้ลงสนามว่าถึงคิวแล้ว
    for (const g of day.games)
      if (!g.endedAt && now - g.startedAt < 3 * 60 * 1000)
        for (const id of g.playerIds) out.push({ playerId: id, key: `play:${g.id}`, title: `ถึงคิวคุณแล้ว ลงสนาม ${g.court}`, body: "ไปที่สนามได้เลย", tag: `play-${date}`, alert: "play" });
  }
  // ประกาศเปิดลงชื่อ / อีเว้นที่เพิ่งสร้าง (ไม่เกิน 36 ชม.) แจ้งทุกคนที่เปิดรับแจ้งเตือน
  const anns = await rows<{ date: string; message: string; title: string | null; created_at: string }>(
    d.from("announcements").select("date,message,title,created_at").gte("date", date).gte("created_at", new Date(now - 36 * 3600 * 1000).toISOString()),
  );
  const wd = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  for (const a of anns) {
    const dt = new Date(a.date + "T00:00:00Z");
    const label = `${wd[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
    const text = a.title ? `⭐ ${a.title}` : "🏸 เปิดลงชื่อก๊วน";
    for (const id of subscribers)
      out.push({ playerId: id, key: `announce:${a.date}:${Date.parse(a.created_at)}`, title: `${text} ${label}`, body: a.message?.trim() ? a.message.trim().slice(0, 120) : "ลงชื่อได้ในแอพ", tag: `announce-${a.date}` });
  }
  out.push(...(await levelRequests(d, subscribers)));
  // คนเดียวกัน เรื่องเดียวกันซ้ำ (เช่นอยู่ทั้งในเกมและคิว) เอาอันแรก
  const seen = new Set<string>();
  return out.filter((m) => !seen.has(m.playerId + "|" + m.key) && seen.add(m.playerId + "|" + m.key));
}

/**
 * หาเรื่องที่ต้องแจ้ง แล้วส่งให้ทุกเครื่องที่เปิดรับไว้ คนละครั้งต่อเรื่อง
 * เรียกซ้ำได้ (กี่เครื่องเรียกพร้อมกันก็ไม่ส่งซ้ำ เพราะจองในตาราง push_sent ก่อนส่ง)
 */
export async function notifyTurns(): Promise<NotifyResult> {
  const c = pushConfig();
  if (!c.ready) return { sent: 0, skipped: "not-configured" };
  const d = db();
  const { data: ps, error: psError } = await d.from("push_settings").select("enabled").eq("id", 1).maybeSingle();
  // ยังไม่ได้รัน SQL web_push.sql
  if (psError || !ps) return { sent: 0, skipped: "no-sql" };
  if (ps.enabled === false) return { sent: 0, skipped: "off" };

  const date = bangkokDate();
  const allSubs = await rows<{ endpoint: string; player_id: string; p256dh: string; auth: string }>(d.from("push_subscriptions").select("endpoint,player_id,p256dh,auth"));
  if (!allSubs.length) return { sent: 0 };
  const subscribers = [...new Set(allSubs.map((s) => s.player_id))];
  const due = (await collect(d, date, subscribers)).filter((m) => subscribers.includes(m.playerId));
  if (!due.length) return { sent: 0 };

  // จองก่อนส่ง: แถวที่เพิ่มได้จริงเท่านั้นที่ส่ง
  const { data: claimed, error } = await d
    .from("push_sent")
    .upsert(due.map((x) => ({ date, player_id: x.playerId, key: x.key })), { onConflict: "date,player_id,key", ignoreDuplicates: true })
    .select("player_id,key");
  if (error) throw new Error(error.message);
  const mine = new Set((claimed ?? []).map((x) => `${x.player_id}|${x.key}`));
  const todo = due.filter((m) => mine.has(`${m.playerId}|${m.key}`));

  setVapid();
  let sent = 0;
  const gone: string[] = [];
  const reached = new Set<string>();
  await Promise.all(
    todo.flatMap((m) =>
      allSubs
        .filter((s) => s.player_id === m.playerId)
        .map(async (s) => {
          const r = await deliver(s, { title: m.title, body: m.body, tag: m.tag, url: "/", alert: m.alert, tab: m.tab });
          if (r.ok) {
            sent++;
            reached.add(`${m.playerId}|${m.key}`);
          } else if (r.code === 403 || r.code === 404 || r.code === 410) gone.push(s.endpoint);
        }),
    ),
  );
  if (gone.length) await d.from("push_subscriptions").delete().in("endpoint", gone);
  // ส่งไม่ถึงสักเครื่อง (เน็ตของบริการแจ้งเตือนล่ม) ปลดการจองไว้ ครั้งหน้าลองส่งใหม่
  for (const m of todo)
    if (!reached.has(`${m.playerId}|${m.key}`)) await d.from("push_sent").delete().eq("date", date).eq("player_id", m.playerId).eq("key", m.key);
  // ล้างประวัติกันส่งซ้ำของวันก่อนๆ (ทำเฉพาะรอบที่มีการส่ง)
  if (mine.size) await d.from("push_sent").delete().lt("date", date);
  return { sent };
}

interface DeliverResult {
  ok: boolean;
  /** รหัสที่บริการแจ้งเตือนของมือถือตอบกลับ (201 = รับไปส่งต่อแล้ว) */
  code?: number;
  host?: string;
  detail?: string;
}

async function deliver(s: { endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; tag: string; url: string; alert?: "play" | "soon"; tab?: string }): Promise<DeliverResult> {
  const host = new URL(s.endpoint).host;
  try {
    const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 15 * 60, urgency: "high" });
    return { ok: true, code: r?.statusCode, host };
  } catch (e) {
    const x = e as { statusCode?: number; body?: string; message?: string };
    console.error("push send failed", host, x.statusCode, x.body ?? x.message);
    return { ok: false, code: x.statusCode, host, detail: String(x.body ?? x.message ?? "").slice(0, 120) };
  }
}

const lastTest = new Map<string, number>();

/**
 * ส่งแจ้งเตือนทดสอบหาเครื่องนี้เครื่องเดียว (รู้ endpoint ของเครื่องตัวเองเท่านั้นถึงสั่งได้)
 * รอ 6 วินาทีก่อนส่ง ให้ผู้ทดสอบสลับออกจากแอพทัน และคืนรหัสที่บริการแจ้งเตือนตอบกลับ ไว้ดูว่าขาดตรงไหน
 */
export async function sendTest(endpoint: string): Promise<DeliverResult & { error?: string }> {
  const c = pushConfig();
  if (!c.ready) return { ok: false, error: "not-configured" };
  const now = Date.now();
  if (now - (lastTest.get(endpoint) ?? 0) < 20000) return { ok: false, error: "too-fast" };
  lastTest.set(endpoint, now);
  const { data } = await db().from("push_subscriptions").select("endpoint,p256dh,auth").eq("endpoint", endpoint).maybeSingle();
  if (!data) return { ok: false, error: "not-subscribed" };
  setVapid();
  await new Promise((r) => setTimeout(r, 6000));
  return deliver(data, { title: "ทดสอบแจ้งเตือน ✓", body: "เห็นข้อความนี้ แปลว่าแจ้งเตือนใช้ได้ ตอนใกล้ถึงคิวจะเด้งแบบนี้", tag: "test", url: "/", alert: "soon" });
}
