import { beforeEach, describe, expect, it, vi } from "vitest";

// ฐานข้อมูลปลอม: ตารางละ array, query builder แบบง่ายพอสำหรับ notifyTurns
const tables: Record<string, Record<string, unknown>[]> = {};
const sent: { endpoint: string; payload: string }[] = [];

function builder(name: string) {
  const rows = () => tables[name] ?? [];
  const filters: ((r: Record<string, unknown>) => boolean)[] = [];
  let upsertRows: Record<string, unknown>[] | null = null;
  let del = false;
  const run = () => {
    if (upsertRows) {
      const t = (tables[name] ??= []);
      const added = upsertRows.filter((u) => !t.some((r) => r.date === u.date && r.player_id === u.player_id && r.key === u.key));
      t.push(...added);
      return { data: added, error: null };
    }
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (del) {
      tables[name] = rows().filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    return { data: hit, error: null };
  };
  const b = {
    select: () => b,
    order: () => b,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), b),
    upsert: (r: Record<string, unknown>[]) => ((upsertRows = r), b),
    delete: () => ((del = true), b),
    maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
  };
  return b;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (n: string) => builder(n) }) }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (s: { endpoint: string }, payload: string) => {
      if (s.endpoint.includes("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      sent.push({ endpoint: s.endpoint, payload });
    },
  },
}));

const date = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const at = new Date().toISOString();

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.SUPABASE_SECRET_KEY = "secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  sent.length = 0;
  for (const k of Object.keys(tables)) delete tables[k];
  Object.assign(tables, {
    push_settings: [{ id: 1, enabled: true }],
    players: "abcdefgh".split("").map((id) => ({ id, name: id, level: 3 })),
    checkins: "abcdefgh".split("").map((id, i) => ({ date, player_id: id, at: new Date(Date.now() + i).toISOString(), paid_at: null, resting: false })),
    games: [{ id: "g1", date, court: 5, player_ids: ["a", "b", "c", "d"], started_at: at, ended_at: null, shuttles: 1 }],
    court_queue: [{ id: "q1", date, court: 5, player_ids: ["e", "f", "g", "h"], at }],
    pair_requests: [],
    settings: [{ id: 1, court_count: 1, court_fee: 40, first_shuttle_fee: 30, next_shuttle_fee: 25, monthly_fee: 150, promptpay_id: "", court_numbers: [5] }],
    push_subscriptions: [
      { endpoint: "https://push/e1", player_id: "e", p256dh: "k", auth: "a" },
      { endpoint: "https://push/e2", player_id: "e", p256dh: "k", auth: "a" },
      { endpoint: "https://push/gone", player_id: "f", p256dh: "k", auth: "a" },
      { endpoint: "https://push/a", player_id: "a", p256dh: "k", auth: "a" },
    ],
    push_sent: [{ date: "2000-01-01", player_id: "x", key: "turn:0" }],
  });
});

describe("ส่งแจ้งเตือนอีก 1 เกมถึงคิว", () => {
  it("ส่งให้คู่ถัดไปของสนามที่เล่นอยู่ ทุกเครื่อง พร้อมเบอร์สนาม และไม่ส่งซ้ำ", async () => {
    const { notifyTurns } = await import("../pushServer");
    const r = await notifyTurns();
    expect(r.sent).toBe(2);
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push/e1", "https://push/e2"]);
    expect(JSON.parse(sent[0].payload).title).toBe("อีก 1 เกมถึงคิวคุณ ที่สนาม 5");
    // เครื่องที่ยกเลิกแล้วถูกลบ ประวัติวันเก่าถูกล้าง
    expect(tables.push_subscriptions.some((s) => s.endpoint === "https://push/gone")).toBe(false);
    expect(tables.push_sent.some((s) => s.date === "2000-01-01")).toBe(false);
    // เรียกซ้ำ: ไม่ส่งอีก
    expect((await notifyTurns()).sent).toBe(0);
  });

  it("แอดมินปิดไว้ หรือยังไม่ตั้งกุญแจ = ไม่ส่ง", async () => {
    const { notifyTurns } = await import("../pushServer");
    tables.push_settings[0].enabled = false;
    expect(await notifyTurns()).toEqual({ sent: 0, skipped: "off" });
    process.env.VAPID_PRIVATE_KEY = "";
    expect(await notifyTurns()).toEqual({ sent: 0, skipped: "not-configured" });
    expect(sent).toHaveLength(0);
  });
});
