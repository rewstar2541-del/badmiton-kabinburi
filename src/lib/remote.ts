import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Action, State } from "./state";
import { DEFAULT_SETTINGS, type Day, type Game, type Gender, type Level, type MonthlyPayments, type Player, type Settings } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null = ไม่ได้ตั้งค่า Supabase ใช้ข้อมูลในเครื่องแทน */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

// ---------- แถวในฐานข้อมูล ----------

export interface Rows {
  players: { id: string; name: string; photo: string | null; gender: string | null; level: number }[];
  contacts: { player_id: string; phone: string }[];
  checkins: { date: string; player_id: string; at: string; paid_at: string | null }[];
  games: {
    id: string;
    date: string;
    court: number;
    player_ids: string[];
    started_at: string;
    ended_at: string | null;
    shuttles: number;
    winner: string | null;
  }[];
  drinks: { id: string; date: string; player_id: string; amount: number; note: string }[];
  monthly: { month: string; player_id: string; paid_at: string }[];
  settings:
    | {
        court_count: number;
        court_fee: number;
        first_shuttle_fee: number;
        next_shuttle_fee: number;
        monthly_fee: number;
        promptpay_id: string;
      }
    | null;
}

const ms = (t: string) => new Date(t).getTime();
const iso = (n: number) => new Date(n).toISOString();

export function rowsToState(r: Rows): State {
  const phones = new Map(r.contacts.map((c) => [c.player_id, c.phone]));
  const players: Player[] = r.players.map((p) => ({
    id: p.id,
    name: p.name,
    photo: p.photo ?? undefined,
    gender: (p.gender as Gender | null) ?? undefined,
    level: p.level as Level,
    phone: phones.get(p.id),
  }));

  const days = new Map<string, Day>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, checkIns: [], games: [], drinks: [] }));
    return d;
  };
  for (const c of r.checkins)
    day(c.date).checkIns.push({ playerId: c.player_id, at: ms(c.at), paidAt: c.paid_at ? ms(c.paid_at) : undefined });
  for (const g of r.games)
    day(g.date).games.push({
      id: g.id,
      court: g.court,
      playerIds: g.player_ids as Game["playerIds"],
      startedAt: ms(g.started_at),
      endedAt: g.ended_at ? ms(g.ended_at) : undefined,
      shuttles: g.shuttles,
      winner: (g.winner as Game["winner"]) ?? undefined,
    });
  for (const x of r.drinks) day(x.date).drinks.push({ id: x.id, playerId: x.player_id, amount: x.amount, note: x.note });
  for (const d of days.values()) {
    d.checkIns.sort((a, b) => a.at - b.at);
    d.games.sort((a, b) => a.startedAt - b.startedAt);
  }

  const monthly: MonthlyPayments = {};
  for (const m of r.monthly) (monthly[m.month] ??= {})[m.player_id] = ms(m.paid_at);

  const s = r.settings;
  const settings: Settings = s
    ? {
        courtCount: s.court_count,
        courtFee: s.court_fee,
        firstShuttleFee: s.first_shuttle_fee,
        nextShuttleFee: s.next_shuttle_fee,
        monthlyFee: s.monthly_fee,
        promptPayId: s.promptpay_id,
      }
    : DEFAULT_SETTINGS;

  return {
    players,
    settings,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    monthly,
  };
}

async function all<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadRemote(db: SupabaseClient, isAdmin: boolean): Promise<State> {
  const [players, contacts, checkins, games, drinks, monthly, settings] = await Promise.all([
    all<Rows["players"][number]>(db.from("players").select("id,name,photo,gender,level").order("name")),
    // เบอร์โทรเห็นเฉพาะแอดมิน
    isAdmin ? all<Rows["contacts"][number]>(db.from("player_contacts").select("player_id,phone")) : Promise.resolve([]),
    all<Rows["checkins"][number]>(db.from("checkins").select("date,player_id,at,paid_at")),
    all<Rows["games"][number]>(db.from("games").select("id,date,court,player_ids,started_at,ended_at,shuttles,winner")),
    all<Rows["drinks"][number]>(db.from("drinks").select("id,date,player_id,amount,note")),
    all<Rows["monthly"][number]>(db.from("monthly_payments").select("month,player_id,paid_at")),
    all<NonNullable<Rows["settings"]>>(
      db.from("settings").select("court_count,court_fee,first_shuttle_fee,next_shuttle_fee,monthly_fee,promptpay_id").eq("id", 1),
    ),
  ]);
  return rowsToState({ players, contacts, checkins, games, drinks, monthly, settings: settings[0] ?? null });
}

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

function playerRow(p: Omit<Player, "id"> & { id: string }) {
  return { id: p.id, name: p.name, photo: p.photo ?? null, gender: p.gender ?? null, level: p.level };
}

async function saveContact(db: SupabaseClient, playerId: string, phone?: string) {
  if (phone) check(await db.from("player_contacts").upsert({ player_id: playerId, phone }));
  else check(await db.from("player_contacts").delete().eq("player_id", playerId));
}

/** บันทึกการเปลี่ยนแปลงหนึ่งครั้งลง Supabase (ต้องเป็นแอดมิน) */
export async function persist(db: SupabaseClient, a: Action): Promise<void> {
  switch (a.type) {
    case "addPlayer":
      check(await db.from("players").insert(playerRow({ ...a.player, id: a._id })));
      if (a.player.phone) await saveContact(db, a._id, a.player.phone);
      return;
    case "updatePlayer":
      check(await db.from("players").update(playerRow(a.player)).eq("id", a.player.id));
      await saveContact(db, a.player.id, a.player.phone);
      return;
    case "removePlayer":
      return check(await db.from("players").delete().eq("id", a.playerId));
    case "checkIn":
      return check(
        await db.from("checkins").upsert({ date: a.date, player_id: a.playerId, at: iso(a._at) }, { ignoreDuplicates: true }),
      );
    case "undoCheckIn":
      return check(await db.from("checkins").delete().eq("date", a.date).eq("player_id", a.playerId));
    case "startGame":
      return check(
        await db
          .from("games")
          .insert({ id: a._id, date: a.date, court: a.court, player_ids: a.playerIds, started_at: iso(a._at), shuttles: 1 }),
      );
    case "setShuttles":
      return check(await db.from("games").update({ shuttles: Math.max(0, a.shuttles) }).eq("id", a.gameId));
    case "endGame":
      return check(await db.from("games").update({ ended_at: iso(a._at), winner: a.winner ?? null }).eq("id", a.gameId));
    case "cancelGame":
      return check(await db.from("games").delete().eq("id", a.gameId));
    case "addDrink":
      return check(
        await db.from("drinks").insert({ id: a._id, date: a.date, player_id: a.playerId, amount: a.amount, note: a.note }),
      );
    case "removeDrink":
      return check(await db.from("drinks").delete().eq("id", a.drinkId));
    case "markPaid":
      // ปิดยอดวันนี้และยอดค้างทั้งหมดก่อนหน้า
      return check(
        await db
          .from("checkins")
          .update({ paid_at: iso(a._at) })
          .eq("player_id", a.playerId)
          .lte("date", a.date)
          .is("paid_at", null),
      );
    case "unmarkPaid":
      return check(await db.from("checkins").update({ paid_at: null }).eq("date", a.date).eq("player_id", a.playerId));
    case "setMonthlyPaid":
      return a.paid
        ? check(await db.from("monthly_payments").upsert({ month: a.month, player_id: a.playerId, paid_at: iso(a._at) }))
        : check(await db.from("monthly_payments").delete().eq("month", a.month).eq("player_id", a.playerId));
    case "updateSettings": {
      const s = a.settings;
      return check(
        await db.from("settings").upsert({
          id: 1,
          court_count: s.courtCount,
          court_fee: s.courtFee,
          first_shuttle_fee: s.firstShuttleFee,
          next_shuttle_fee: s.nextShuttleFee,
          monthly_fee: s.monthlyFee,
          promptpay_id: s.promptPayId,
        }),
      );
    }
    case "replace":
      return importState(db, a.state);
  }
}

/** นำเข้าไฟล์สำรอง (เพิ่ม/ทับข้อมูลเดิม ไม่ลบของที่ไม่มีในไฟล์) */
async function importState(db: SupabaseClient, s: State) {
  check(await db.from("players").upsert(s.players.map(playerRow)));
  const contacts = s.players.filter((p) => p.phone).map((p) => ({ player_id: p.id, phone: p.phone! }));
  if (contacts.length) check(await db.from("player_contacts").upsert(contacts));
  const days = s.days;
  const checkins = days.flatMap((d) =>
    d.checkIns.map((c) => ({ date: d.date, player_id: c.playerId, at: iso(c.at), paid_at: c.paidAt ? iso(c.paidAt) : null })),
  );
  const games = days.flatMap((d) =>
    d.games.map((g) => ({
      id: g.id,
      date: d.date,
      court: g.court,
      player_ids: g.playerIds,
      started_at: iso(g.startedAt),
      ended_at: g.endedAt ? iso(g.endedAt) : null,
      shuttles: g.shuttles,
      winner: g.winner ?? null,
    })),
  );
  const drinks = days.flatMap((d) =>
    d.drinks.map((x) => ({ id: x.id, date: d.date, player_id: x.playerId, amount: x.amount, note: x.note })),
  );
  const monthly = Object.entries(s.monthly).flatMap(([month, m]) =>
    Object.entries(m).map(([player_id, at]) => ({ month, player_id, paid_at: iso(at) })),
  );
  if (checkins.length) check(await db.from("checkins").upsert(checkins));
  if (games.length) check(await db.from("games").upsert(games));
  if (drinks.length) check(await db.from("drinks").upsert(drinks));
  if (monthly.length) check(await db.from("monthly_payments").upsert(monthly));
  await persist(db, { type: "updateSettings", settings: s.settings });
}

// ---------- จัดการแอดมิน (เฉพาะแอดมิน) ----------

export async function listAdmins(db: SupabaseClient): Promise<string[]> {
  const rows = await all<{ email: string }>(db.from("admins").select("email").order("email"));
  return rows.map((r) => r.email);
}

export async function addAdmin(db: SupabaseClient, email: string) {
  check(await db.from("admins").upsert({ email: email.trim().toLowerCase() }, { ignoreDuplicates: true }));
}

export async function removeAdmin(db: SupabaseClient, email: string) {
  check(await db.from("admins").delete().eq("email", email));
}
