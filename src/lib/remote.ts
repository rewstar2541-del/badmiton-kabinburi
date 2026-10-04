import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Action, SelfAction, State } from "./state";
import { DEFAULT_SETTINGS, type Day, type Game, type Gender, type Level, type MonthlyPayments, type Player, type Settings } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null = ไม่ได้ตั้งค่า Supabase ใช้ข้อมูลในเครื่องแทน */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

// ---------- แถวในฐานข้อมูล ----------

export interface Rows {
  players: {
    id: string;
    name: string;
    photo: string | null;
    gender: string | null;
    level: number;
    prefer?: string[] | null;
    avoid?: string[] | null;
    guest_of?: string | null;
    pending?: boolean | null;
  }[];
  contacts: { player_id: string; phone: string }[];
  checkins: { date: string; player_id: string; at: string; paid_at: string | null; resting?: boolean }[];
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
  announcements: { date: string; message: string }[];
  signups: { date: string; player_id: string; at: string }[];
  closed: { date: string; reason: string }[];
  slips: { id: string; date: string; player_id: string; amount: number; created_at: string }[];
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
    ...(p.prefer?.length ? { prefer: p.prefer } : {}),
    ...(p.avoid?.length ? { avoid: p.avoid } : {}),
    ...(p.guest_of ? { guestOf: p.guest_of } : {}),
    ...(p.pending ? { pending: true } : {}),
  }));

  const days = new Map<string, Day>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, checkIns: [], games: [], drinks: [] }));
    return d;
  };
  for (const c of r.checkins)
    day(c.date).checkIns.push({
      playerId: c.player_id,
      at: ms(c.at),
      paidAt: c.paid_at ? ms(c.paid_at) : undefined,
      ...(c.resting ? { resting: true } : {}),
    });
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
  for (const a of r.announcements) day(a.date).announcement = a.message;
  for (const s of r.signups) (day(s.date).signups ??= []).push({ playerId: s.player_id, at: ms(s.at) });
  for (const x of r.slips)
    (day(x.date).slips ??= []).push({ id: x.id, playerId: x.player_id, amount: Number(x.amount), at: ms(x.created_at) });
  for (const d of days.values()) {
    d.slips?.sort((a, b) => a.at - b.at);
    d.signups?.sort((a, b) => a.at - b.at);
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

  const closed: Record<string, string> = {};
  for (const c of r.closed) closed[c.date] = c.reason;

  return {
    players,
    settings,
    closed,
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
  const [players, contacts, checkins, games, drinks, monthly, settings, announcements, signups, slips, closed] = await Promise.all([
    all<Rows["players"][number]>(db.from("players").select("id,name,photo,gender,level,prefer,avoid,guest_of,pending").order("name")),
    // เบอร์โทรเห็นเฉพาะแอดมิน
    isAdmin ? all<Rows["contacts"][number]>(db.from("player_contacts").select("player_id,phone")) : Promise.resolve([]),
    all<Rows["checkins"][number]>(db.from("checkins").select("date,player_id,at,paid_at,resting")),
    all<Rows["games"][number]>(db.from("games").select("id,date,court,player_ids,started_at,ended_at,shuttles,winner")),
    all<Rows["drinks"][number]>(db.from("drinks").select("id,date,player_id,amount,note")),
    all<Rows["monthly"][number]>(db.from("monthly_payments").select("month,player_id,paid_at")),
    all<NonNullable<Rows["settings"]>>(
      db.from("settings").select("court_count,court_fee,first_shuttle_fee,next_shuttle_fee,monthly_fee,promptpay_id").eq("id", 1),
    ),
    all<Rows["announcements"][number]>(db.from("announcements").select("date,message")),
    all<Rows["signups"][number]>(db.from("signups").select("date,player_id,at")),
    all<Rows["slips"][number]>(db.from("slips").select("id,date,player_id,amount,created_at")),
    all<Rows["closed"][number]>(db.from("closed_days").select("date,reason")),
  ]);
  return rowsToState({
    players,
    contacts,
    checkins,
    games,
    drinks,
    monthly,
    settings: settings[0] ?? null,
    announcements,
    signups,
    slips,
    closed,
  });
}

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

function playerRow(p: Omit<Player, "id"> & { id: string }) {
  return {
    id: p.id,
    name: p.name,
    photo: p.photo ?? null,
    gender: p.gender ?? null,
    level: p.level,
    prefer: p.prefer ?? [],
    avoid: p.avoid ?? [],
    guest_of: p.guestOf ?? null,
    pending: p.pending ?? false,
  };
}

async function saveContact(db: SupabaseClient, playerId: string, phone?: string) {
  if (phone) check(await db.from("player_contacts").upsert({ player_id: playerId, phone }));
  else check(await db.from("player_contacts").delete().eq("player_id", playerId));
}

/** บันทึกการเปลี่ยนแปลงหนึ่งครั้งลง Supabase (ต้องเป็นแอดมิน) */
/** players ใช้หาแขกของคนที่จ่ายเงิน เพื่อปิดยอดของแขกไปพร้อมกัน */
export async function persist(db: SupabaseClient, a: Action, players: Player[] = []): Promise<void> {
  const withGuests = (id: string) => [id, ...players.filter((p) => p.guestOf === id).map((p) => p.id)];
  switch (a.type) {
    case "addPlayer":
      check(await db.from("players").insert(playerRow({ ...a.player, id: a._id })));
      if (a.player.phone) await saveContact(db, a._id, a.player.phone);
      return;
    case "updatePlayer":
      check(await db.from("players").update(playerRow(a.player)).eq("id", a.player.id));
      await saveContact(db, a.player.id, a.player.phone);
      return;
    case "addGuest":
      check(await db.from("players").insert({ id: a._id, name: a.name, level: a.level, guest_of: a.hostId }));
      return check(await db.from("checkins").insert({ date: a.date, player_id: a._id, at: iso(a._at) }));
    case "removePlayer":
      return check(await db.from("players").delete().eq("id", a.playerId));
    case "checkIn":
      return check(
        await db.from("checkins").upsert({ date: a.date, player_id: a.playerId, at: iso(a._at) }, { ignoreDuplicates: true }),
      );
    case "setResting":
      return check(
        await db.from("checkins").update({ resting: a.resting }).eq("date", a.date).eq("player_id", a.playerId),
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
          .in("player_id", withGuests(a.playerId))
          .lte("date", a.date)
          .is("paid_at", null),
      );
    case "unmarkPaid":
      return check(await db.from("checkins").update({ paid_at: null }).eq("date", a.date).in("player_id", withGuests(a.playerId)));
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
    case "setClosed":
      return a.reason === null
        ? check(await db.from("closed_days").delete().eq("date", a.date))
        : check(await db.from("closed_days").upsert({ date: a.date, reason: a.reason }));
    case "setAnnouncement":
      return a.message === null
        ? check(await db.from("announcements").delete().eq("date", a.date))
        : check(await db.from("announcements").upsert({ date: a.date, message: a.message }));
    case "signUp":
      return check(
        await db.from("signups").upsert({ date: a.date, player_id: a.playerId, at: iso(a._at) }, { ignoreDuplicates: true }),
      );
    case "cancelSignUp":
      return check(await db.from("signups").delete().eq("date", a.date).eq("player_id", a.playerId));
    case "addSlip":
      return; // ออนไลน์ใช้ submitSlip
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
    d.checkIns.map((c) => ({ date: d.date, player_id: c.playerId, at: iso(c.at), paid_at: c.paidAt ? iso(c.paidAt) : null,
      resting: Boolean(c.resting),
    })),
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
  const closed = Object.entries(s.closed ?? {}).map(([date, reason]) => ({ date, reason }));
  if (closed.length) check(await db.from("closed_days").upsert(closed));
  await persist(db, { type: "updateSettings", settings: s.settings });
}

/** ผู้เล่นลงชื่อ/เช็คอินเอง ผ่านฟังก์ชันในฐานข้อมูลที่ตรวจเลข 4 ตัวท้ายเบอร์โทร คืนข้อความผิดพลาด หรือ null */
export async function selfService(db: SupabaseClient, action: SelfAction, playerId: string, pin: string) {
  const { data, error } = await db.rpc("self_service", { p_player: playerId, p_pin: pin, p_action: action });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** ผู้เล่นส่งรูปสลิปโอนเงินของวันนี้ คืนข้อความผิดพลาด หรือ null */
export async function submitSlip(db: SupabaseClient, playerId: string, pin: string, amount: number, image: string) {
  const { data, error } = await db.rpc("submit_slip", { p_player: playerId, p_pin: pin, p_amount: amount, p_image: image });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** รูปสลิป (เฉพาะแอดมิน) */
export async function slipImage(db: SupabaseClient, slipId: string): Promise<string | null> {
  const { data, error } = await db.rpc("slip_image", { p_id: slipId });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** ผู้เล่นตั้งคนที่อยากจับคู่/ไม่อยากเจอ คืนข้อความผิดพลาด หรือ null */
/** ผู้เล่นสมัครเองครั้งแรก (รอแอดมินอนุมัติ) คืน id หรือข้อความผิดพลาด */
export async function registerPlayer(db: SupabaseClient, p: Omit<Player, "id">): Promise<{ id?: string; error?: string }> {
  const { data, error } = await db.rpc("register_player", {
    p_name: p.name,
    p_phone: p.phone ?? "",
    p_gender: p.gender ?? "other",
    p_level: p.level,
    p_photo: p.photo ?? "",
  });
  if (error) return { error: error.message };
  return data as { id?: string; error?: string };
}

/** สมาชิกพาเพื่อนมา: สร้างแขกและเช็คอินวันนี้ให้ คืนข้อความผิดพลาด หรือ null */
export async function addGuest(db: SupabaseClient, hostId: string, pin: string, name: string, level: number) {
  const { data, error } = await db.rpc("add_guest", { p_host: hostId, p_pin: pin, p_name: name, p_level: level });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

export async function setPartnerPrefs(db: SupabaseClient, playerId: string, pin: string, prefer: string[], avoid: string[]) {
  const { data, error } = await db.rpc("set_partner_prefs", { p_player: playerId, p_pin: pin, p_prefer: prefer, p_avoid: avoid });
  if (error) return error.message;
  return (data as string | null) ?? null;
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
