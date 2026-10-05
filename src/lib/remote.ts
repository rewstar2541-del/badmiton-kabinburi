import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Action, SelfAction, State } from "./state";
import { DEFAULT_SETTINGS, type Day, type Expense, type Game, type PairStatus, type Poll, type BoardKind, type BoardPost, type Gender, type Level, type MonthlyPayments, type Plan, type Player, type Settings } from "./types";

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
    plan?: string | null;
    bio?: string | null;
    level_request?: number | null;
    birthday?: string | null;
  }[];
  checkins: {
    date: string;
    player_id: string;
    at: string;
    paid_at: string | null;
    resting?: boolean;
    court_fee?: number | null;
    shuttle_fee?: number | null;
  }[];
  prices: { date: string; court_fee: number; first_shuttle_fee: number; next_shuttle_fee: number }[];
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
  monthly: { month: string; player_id: string; paid_at: string; amount?: number | null }[];
  announcements: { date: string; message: string; title?: string | null; fee?: number | null }[];
  signups: { date: string; player_id: string; at: string }[];
  closed: { date: string; reason: string }[];
  slips: { id: string; date: string; player_id: string; amount: number; created_at: string }[];
  expenses?: { id: string; date: string; category: Expense["category"]; amount: number; note: string; shuttles?: number | null; created_at?: string }[];
  stock?: { base: number; counted_at: string; low: number } | null;
  pairs?: { id: string; date: string; from_id: string; to_id: string; status: PairStatus; at: string }[];
  polls?: { id: string; question: string; dates: string[]; created_at: string; chosen: string | null; closed: boolean }[];
  votes?: { poll_id: string; player_id: string; dates: string[] }[];
  board?: { id: string; player_id: string; kind: BoardKind; title: string; detail: string | null; price: number | null; has_photo: boolean; created_at: string; closed_at: string | null }[];
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
  const players: Player[] = r.players.map((p) => ({
    id: p.id,
    name: p.name,
    photo: p.photo ?? undefined,
    gender: (p.gender as Gender | null) ?? undefined,
    level: p.level as Level,
    ...(p.prefer?.length ? { prefer: p.prefer } : {}),
    ...(p.avoid?.length ? { avoid: p.avoid } : {}),
    ...(p.guest_of ? { guestOf: p.guest_of } : {}),
    ...(p.pending ? { pending: true } : {}),
    ...(p.plan === "daily" || p.plan === "monthly" ? { plan: p.plan } : {}),
    ...(p.bio ? { bio: p.bio } : {}),
    ...(p.level_request ? { levelRequest: p.level_request as Level } : {}),
    ...(p.birthday ? { birthday: p.birthday } : {}),
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
      ...(c.court_fee != null ? { courtFee: Number(c.court_fee) } : {}),
      ...(c.shuttle_fee != null ? { shuttleFee: Number(c.shuttle_fee) } : {}),
    });
  for (const x of r.prices ?? [])
    day(x.date).prices = {
      courtFee: Number(x.court_fee),
      firstShuttleFee: Number(x.first_shuttle_fee),
      nextShuttleFee: Number(x.next_shuttle_fee),
    };
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
  for (const x of r.pairs ?? [])
    (day(x.date).pairs ??= []).push({ id: x.id, from: x.from_id, to: x.to_id, status: x.status, at: Date.parse(x.at) });
  for (const a of r.announcements) {
    day(a.date).announcement = a.message;
    if (a.title) day(a.date).announcementTitle = a.title;
    if (a.fee != null) day(a.date).announcementFee = a.fee;
  }
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
  const monthlyAmounts: Record<string, Record<string, number>> = {};
  for (const m of r.monthly) {
    (monthly[m.month] ??= {})[m.player_id] = ms(m.paid_at);
    if (m.amount != null) (monthlyAmounts[m.month] ??= {})[m.player_id] = m.amount;
  }

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
    monthlyAmounts,
    expenses: (r.expenses ?? []).map((e) => ({
      id: e.id,
      date: e.date,
      category: e.category,
      amount: e.amount,
      note: e.note,
      ...(e.shuttles ? { shuttles: e.shuttles } : {}),
      ...(e.created_at ? { at: Date.parse(e.created_at) } : {}),
    })),
    stock: r.stock ? { base: r.stock.base, countedAt: Date.parse(r.stock.counted_at), low: r.stock.low } : undefined,
    polls: (r.polls ?? []).map(
      (p): Poll => ({
        id: p.id,
        question: p.question,
        dates: p.dates,
        createdAt: Date.parse(p.created_at),
        closed: p.closed,
        ...(p.chosen ? { chosen: p.chosen } : {}),
        votes: Object.fromEntries((r.votes ?? []).filter((v) => v.poll_id === p.id).map((v) => [v.player_id, v.dates])),
      }),
    ),
    board: (r.board ?? []).map(
      (b): BoardPost => ({
        id: b.id,
        playerId: b.player_id,
        kind: b.kind,
        title: b.title,
        ...(b.detail ? { detail: b.detail } : {}),
        ...(b.price != null ? { price: b.price } : {}),
        hasPhoto: b.has_photo,
        at: Date.parse(b.created_at),
        ...(b.closed_at ? { closedAt: Date.parse(b.closed_at) } : {}),
      }),
    ),
  };
}

/** ดึงทุกแถว ทีละ 1000 (Supabase คืนได้ครั้งละไม่เกิน 1000 แถว) */
async function all<T>(make: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
const PAGE = 1000;

/** ผู้เล่นทั่วไปโหลดย้อนหลังแค่ช่วงนี้ (แอดมินโหลดทั้งหมดเพื่อทำรายงาน) */
export const PLAYER_HISTORY_DAYS = 120;

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

/** ตารางที่แอพโหลด และ query ของแต่ละตาราง */
export type TableKey = Exclude<keyof Rows, "settings"> | "settings";

/** ชื่อตารางในฐานข้อมูล -> ส่วนของ Rows ที่ต้องโหลดใหม่เมื่อมีการเปลี่ยนแปลง */
export const TABLE_OF: Record<string, TableKey> = {
  players: "players",
  checkins: "checkins",
  games: "games",
  drinks: "drinks",
  monthly_payments: "monthly",
  settings: "settings",
  announcements: "announcements",
  signups: "signups",
  slips: "slips",
  closed_days: "closed",
  day_prices: "prices",
  expenses: "expenses",
  shuttle_stock: "stock",
  pair_requests: "pairs",
  polls: "polls",
  poll_votes: "votes",
  board_posts: "board",
};

export async function loadRows(db: SupabaseClient, isAdmin: boolean, keys?: Iterable<TableKey>, prev?: Rows): Promise<Rows> {
  let since = isAdmin ? "2000-01-01" : sinceDate(PLAYER_HISTORY_DAYS);
  if (!isAdmin) {
    // ยอดค้างที่เก่ากว่าช่วงที่โหลด ต้องโหลดย้อนไปถึงด้วย ไม่งั้นบิลจะไม่เห็นแต่กดจ่ายแล้วถูกปิดไป
    const { data } = await db.from("checkins").select("date").is("paid_at", null).lt("date", since).order("date").limit(1);
    if (data?.[0]?.date) since = data[0].date;
  }
  const fetchers: { [K in TableKey]: () => Promise<Rows[K]> } = {
    players: () => all(() => db.from("players").select("id,name,photo,gender,level,prefer,avoid,guest_of,pending,plan,bio,level_request,birthday").order("id")),
    checkins: () => all(() => db.from("checkins").select("date,player_id,at,paid_at,resting,court_fee,shuttle_fee").gte("date", since).order("date").order("player_id")),
    games: () => all(() => db.from("games").select("id,date,court,player_ids,started_at,ended_at,shuttles,winner").gte("date", since).order("id")),
    // ค่าน้ำ ค่ารายเดือน และสลิป ผู้เล่นทั่วไปอ่านไม่ได้ (โหลดของตัวเองแยกผ่าน my_private)
    drinks: async () => (isAdmin ? all(() => db.from("drinks").select("id,date,player_id,amount,note").order("id")) : []),
    monthly: async () => (isAdmin ? all(() => db.from("monthly_payments").select("month,player_id,paid_at,amount").order("month").order("player_id")) : []),
    settings: async () => {
      const r = await all(() =>
        db.from("settings").select("court_count,court_fee,first_shuttle_fee,next_shuttle_fee,monthly_fee,promptpay_id").eq("id", 1),
      );
      return (r[0] as Rows["settings"]) ?? null;
    },
    announcements: () => all(() => db.from("announcements").select("date,message,title,fee").gte("date", since).order("date")),
    signups: () => all(() => db.from("signups").select("date,player_id,at").gte("date", since).order("date").order("player_id")),
    slips: async () => (isAdmin ? all(() => db.from("slips").select("id,date,player_id,amount,created_at").is("removed_at", null).order("id")) : []),
    closed: () => all(() => db.from("closed_days").select("date,reason").order("date")),
    expenses: async () => (isAdmin ? all(() => db.from("expenses").select("id,date,category,amount,note,shuttles,created_at").order("date").order("id")) : []),
    stock: async () => (isAdmin ? ((await db.from("shuttle_stock").select("base,counted_at,low").eq("id", 1).maybeSingle()).data ?? null) : null),
    pairs: () => all(() => db.from("pair_requests").select("id,date,from_id,to_id,status,at").gte("date", sinceDate(1)).order("at")),
    polls: () => all(() => db.from("polls").select("id,question,dates,created_at,chosen,closed").gte("created_at", sinceDate(120)).order("created_at")),
    votes: () => all(() => db.from("poll_votes").select("poll_id,player_id,dates").gte("at", sinceDate(120)).order("poll_id")),
    // รูปโหลดแยกตอนเปิดดู (boardPhoto) โพสต์ที่ปิดแล้วเก็บไว้ดู 7 วัน
    board: () =>
      all(() =>
        db
          .from("board_posts")
          .select("id,player_id,kind,title,detail,price,has_photo,created_at,closed_at")
          .gte("created_at", sinceDate(90))
          .or(`closed_at.is.null,closed_at.gte.${sinceDate(7)}`)
          .order("created_at", { ascending: false }),
      ),
    prices: () => all(() => db.from("day_prices").select("date,court_fee,first_shuttle_fee,next_shuttle_fee").gte("date", since).order("date")),
  };
  const want = new Set<TableKey>(keys ?? (Object.keys(fetchers) as TableKey[]));
  const rows = { ...(prev ?? ({} as Rows)) } as Record<TableKey, unknown>;
  await Promise.all(
    (Object.keys(fetchers) as TableKey[])
      .filter((k) => want.has(k) || !prev)
      .map(async (k) => {
        rows[k] = await fetchers[k]();
      }),
  );
  return rows as unknown as Rows;
}

export async function loadRemote(db: SupabaseClient, isAdmin: boolean): Promise<State> {
  return rowsToState(await loadRows(db, isAdmin));
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
    plan: p.plan ?? null,
    bio: p.bio ?? null,
    level_request: p.levelRequest ?? null,
    birthday: p.birthday ?? null,
  };
}

/** บันทึกการเปลี่ยนแปลงหนึ่งครั้งลง Supabase (ต้องเป็นแอดมิน) */
/** players ใช้หาแขกของคนที่จ่ายเงิน เพื่อปิดยอดของแขกไปพร้อมกัน */
export async function persist(db: SupabaseClient, a: Action, players: Player[] = []): Promise<void> {
  const withGuests = (id: string) => [id, ...players.filter((p) => p.guestOf === id).map((p) => p.id)];
  switch (a.type) {
    case "addPlayer":
      check(await db.from("players").insert(playerRow({ ...a.player, id: a._id })));
      return;
    case "updatePlayer":
      return check(await db.from("players").update(playerRow(a.player)).eq("id", a.player.id));
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
    case "editDrink":
      return check(await db.from("drinks").update({ amount: a.amount, note: a.note }).eq("id", a.drinkId));
    case "setBillFees":
      return check(
        await db
          .from("checkins")
          .update({ court_fee: a.courtFee, shuttle_fee: a.shuttleFee })
          .eq("date", a.date)
          .eq("player_id", a.playerId),
      );
    case "removeSlip":
      return check(await db.from("slips").delete().eq("id", a.slipId));
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
    case "unmarkPaid": {
      // ย้อนเฉพาะแถวที่ปิดไปพร้อมกันตอนกดจ่าย (เวลาจ่ายเดียวกัน) ยอดค้างวันก่อนๆ จะกลับมาด้วย
      const { data, error } = await db
        .from("checkins")
        .select("paid_at")
        .eq("date", a.date)
        .eq("player_id", a.playerId)
        .maybeSingle();
      check({ error });
      if (!data?.paid_at) return;
      return check(
        await db
          .from("checkins")
          .update({ paid_at: null })
          .in("player_id", withGuests(a.playerId))
          .lte("date", a.date)
          .eq("paid_at", data.paid_at),
      );
    }
    case "setMonthlyPaid":
      return a.paid
        ? check(await db.from("monthly_payments").upsert({ month: a.month, player_id: a.playerId, paid_at: iso(a._at) }))
        : check(await db.from("monthly_payments").delete().eq("month", a.month).eq("player_id", a.playerId));
    case "updateSettings": {
      const s = a.settings;
      if (a.freeze?.dates.length) {
        const p = a.freeze.prices;
        check(
          await db.from("day_prices").upsert(
            a.freeze.dates.map((date) => ({
              date,
              court_fee: p.courtFee,
              first_shuttle_fee: p.firstShuttleFee,
              next_shuttle_fee: p.nextShuttleFee,
            })),
            { ignoreDuplicates: true },
          ),
        );
      }
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
        : check(
            await db
              .from("announcements")
              .upsert({
                date: a.date,
                message: a.message,
                ...(a.title === undefined ? {} : { title: a.title }),
                ...(a.fee === undefined ? {} : { fee: a.fee }),
              }),
          );
    case "signUp":
      return check(
        await db.from("signups").upsert({ date: a.date, player_id: a.playerId, at: iso(a._at) }, { ignoreDuplicates: true }),
      );
    case "cancelSignUp":
      return check(await db.from("signups").delete().eq("date", a.date).eq("player_id", a.playerId));
    case "addSlip":
      return; // ออนไลน์ใช้ submitSlip
    case "addExpense":
      return check(await db.from("expenses").insert({ id: a._id, ...a.expense, created_at: iso(a._at) }));
    case "setStock":
      return check(
        await db.from("shuttle_stock").upsert({
          id: 1,
          ...(a.base === undefined ? {} : { base: a.base, counted_at: iso(a._at) }),
          ...(a.low === undefined ? {} : { low: a.low }),
        }),
      );
    case "createPoll":
      return check(await db.from("polls").insert({ id: a._id, question: a.question, dates: a.dates, created_at: iso(a._at) }));
    case "closePoll":
      return check(await db.from("polls").update({ closed: true, chosen: a.chosen ?? null }).eq("id", a.id));
    case "removePoll":
      return check(await db.from("polls").delete().eq("id", a.id));
    case "closeBoardPost":
      return check(await db.from("board_posts").update({ closed_at: iso(a._at) }).eq("id", a.id));
    case "addBoardPost":
      // ออนไลน์ลงผ่าน board_post เท่านั้น
      return;
    case "setPairStatus":
      // แอดมินยกเลิกคำขอ (ผู้เล่นใช้ respond_pair / cancel_pair)
      return check(await db.from("pair_requests").update({ status: a.status }).eq("id", a.id));
    case "votePoll":
    case "requestPair":
      return; // ออนไลน์ผู้เล่นทำผ่านฟังก์ชันในฐานข้อมูล
    case "removeExpense":
      return check(await db.from("expenses").delete().eq("id", a.id));
    case "clearHistory": {
      // ลบตามลำดับ (เกมและค่าใช้จ่ายก่อนเช็คอิน แขกลบท้ายสุด)
      for (const table of ["games", "drinks", "slips", "signups", "checkins", "day_prices", "expenses"])
        check(await db.from(table).delete().gte("date", "1900-01-01"));
      check(await db.from("monthly_payments").delete().neq("month", ""));
      check(await db.from("announcements").delete().lte("date", a.today));
      return check(await db.from("players").delete().not("guest_of", "is", null));
    }
    case "replace":
      return importState(db, a.state);
  }
}

/** นำเข้าไฟล์สำรอง (เพิ่ม/ทับข้อมูลเดิม ไม่ลบของที่ไม่มีในไฟล์) */
async function importState(db: SupabaseClient, s: State) {
  check(await db.from("players").upsert(s.players.map(playerRow)));
  const days = s.days;
  const checkins = days.flatMap((d) =>
    d.checkIns.map((c) => ({ date: d.date, player_id: c.playerId, at: iso(c.at), paid_at: c.paidAt ? iso(c.paidAt) : null,
      resting: Boolean(c.resting),
      court_fee: c.courtFee ?? null,
      shuttle_fee: c.shuttleFee ?? null,
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
    Object.entries(m).map(([player_id, at]) => ({ month, player_id, paid_at: iso(at), amount: s.monthlyAmounts?.[month]?.[player_id] ?? null })),
  );
  if (checkins.length) check(await db.from("checkins").upsert(checkins));
  if (games.length) check(await db.from("games").upsert(games));
  if (drinks.length) check(await db.from("drinks").upsert(drinks));
  if (monthly.length) check(await db.from("monthly_payments").upsert(monthly));
  // สลิปไม่อยู่ในไฟล์สำรอง (รูปโหลดแยก) จึงไม่นำเข้า
  const prices = days.flatMap((d) =>
    d.prices
      ? [{ date: d.date, court_fee: d.prices.courtFee, first_shuttle_fee: d.prices.firstShuttleFee, next_shuttle_fee: d.prices.nextShuttleFee }]
      : [],
  );
  const announcements = days.flatMap((d) =>
    d.announcement != null ? [{ date: d.date, message: d.announcement, title: d.announcementTitle ?? null }] : [],
  );
  const signups = days.flatMap((d) => (d.signups ?? []).map((x) => ({ date: d.date, player_id: x.playerId, at: iso(x.at) })));
  if (prices.length) check(await db.from("day_prices").upsert(prices));
  if (announcements.length) check(await db.from("announcements").upsert(announcements));
  if (signups.length) check(await db.from("signups").upsert(signups));
  const closed = Object.entries(s.closed ?? {}).map(([date, reason]) => ({ date, reason }));
  if (closed.length) check(await db.from("closed_days").upsert(closed));
  if (s.expenses?.length) check(await db.from("expenses").upsert(s.expenses));
  await persist(db, { type: "updateSettings", settings: s.settings });
}

/** ผู้เล่นลงชื่อ/เช็คอินเอง ผ่านฟังก์ชันในฐานข้อมูลที่ตรวจ token จากการเข้าด้วย LINE คืนข้อความผิดพลาด หรือ null */
export async function selfService(db: SupabaseClient, action: SelfAction, playerId: string, pin: string) {
  if (action === "undoCheckIn" || action === "notComing") {
    const { data, error } = await db.rpc("undo_my_check_in", { p_player: playerId, p_pin: pin, p_cancel_signup: action === "notComing" });
    if (error) return error.code === "PGRST202" ? "ยังยกเลิกเช็คอินเองไม่ได้ ให้แอดมินช่วยก่อน" : error.message;
    return (data as string | null) ?? null;
  }
  const { data, error } = await db.rpc("self_service", { p_player: playerId, p_pin: pin, p_action: action });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** ผู้เล่นส่งรูปสลิปโอนเงินของวันนี้ คืนข้อความผิดพลาด หรือ null */
/** ลงชื่อ/ยกเลิกล่วงหน้าสำหรับวันจัดก๊วนที่แอดมินตั้งไว้ในปฏิทิน */
export async function signUpDay(db: SupabaseClient, playerId: string, pin: string, date: string, on: boolean) {
  const { data, error } = await db.rpc("sign_up_day", { p_player: playerId, p_pin: pin, p_date: date, p_on: on });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

export async function submitSlip(db: SupabaseClient, playerId: string, pin: string, amount: number, image: string) {
  const { data, error } = await db.rpc("submit_slip", { p_player: playerId, p_pin: pin, p_amount: amount, p_image: image });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** ผู้เล่นลบสลิปของตัวเองที่ส่งผิด (เฉพาะที่ส่งวันนี้) */
export async function removeMySlip(db: SupabaseClient, playerId: string, pin: string, slipId: string) {
  const { data, error } = await db.rpc("remove_my_slip", { p_player: playerId, p_pin: pin, p_slip: slipId });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** รูปสลิป (เฉพาะแอดมิน) */
export async function boardPhoto(db: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await db.from("board_posts").select("photo").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.photo as string | null) ?? null;
}

/** ประวัติเกมและการมาเล่นตั้งแต่วันที่ระบุ (ใช้ทำอันดับ / สรุปรายปี) ทุกคนอ่านได้ */
export async function loadHistory(db: SupabaseClient, from: string): Promise<State> {
  const [players, checkins, games, announcements] = await Promise.all([
    all(() => db.from("players").select("id,name,photo,gender,level,guest_of,pending").order("id")),
    all(() => db.from("checkins").select("date,player_id,at,paid_at").gte("date", from).order("date").order("player_id")),
    all(() => db.from("games").select("id,date,court,player_ids,started_at,ended_at,shuttles,winner").gte("date", from).order("id")),
    all(() => db.from("announcements").select("date,message,title").gte("date", from).order("date")),
  ]);
  return rowsToState({ players, checkins, games, announcements, prices: [], drinks: [], monthly: [], signups: [], closed: [], slips: [], settings: null } as unknown as Rows);
}

export async function slipImage(db: SupabaseClient, slipId: string): Promise<string | null> {
  const { data, error } = await db.rpc("slip_image", { p_id: slipId });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** ผู้เล่นตั้งคนที่อยากจับคู่/ไม่อยากเจอ คืนข้อความผิดพลาด หรือ null */

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

export type ProfileInput = Pick<Player, "name" | "photo" | "gender" | "bio"> & { level: Level };

/** ผู้เล่นแก้ข้อมูลตัวเอง (เปลี่ยนระดับมือจะเป็นคำขอให้แอดมินอนุมัติ) */
export async function updateMyProfile(db: SupabaseClient, playerId: string, pin: string, p: ProfileInput) {
  const { data, error } = await db.rpc("update_my_profile", {
    p_player: playerId,
    p_pin: pin,
    p_name: p.name,
    p_photo: p.photo ?? "",
    p_gender: p.gender ?? null,
    p_bio: p.bio ?? "",
    p_level: p.level,
  });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

/** ผู้เล่นเลือกเป็นสมาชิกรายวันหรือรายเดือน */
export async function setMyPlan(db: SupabaseClient, playerId: string, pin: string, plan: Plan) {
  const { data, error } = await db.rpc("set_my_plan", { p_player: playerId, p_pin: pin, p_plan: plan });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

// ---------- จัดการแอดมิน (เฉพาะแอดมิน) ----------

export async function listAdmins(db: SupabaseClient): Promise<string[]> {
  const rows = await all<{ email: string }>(() => db.from("admins").select("email").order("email"));
  return rows.map((r) => r.email);
}

export async function addAdmin(db: SupabaseClient, email: string) {
  check(await db.from("admins").upsert({ email: email.trim().toLowerCase() }, { ignoreDuplicates: true }));
}

export async function removeAdmin(db: SupabaseClient, email: string) {
  check(await db.from("admins").delete().eq("email", email));
}

/** แอดมินผูกบัญชี LINE ของตัวเองกับชื่อผู้เล่น (ไม่ต้องรออนุมัติ) คืน token ผู้เล่น */
export async function adminLinkMe(db: SupabaseClient, playerId: string): Promise<{ token?: string; error?: string }> {
  const { data, error } = await db.rpc("admin_link_me", { p_player: playerId });
  if (error) return { error: error.message };
  return data as { token?: string; error?: string };
}

/** อีเมลประจำบัญชี LINE ของผู้เล่นที่ผูก LINE แล้ว (แอดมินเท่านั้น) ใช้ตั้ง/ถอดแอดมิน */
export async function playerLineEmails(db: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await db.rpc("player_line_emails");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { player_id: string; email: string }[]).map((r) => [r.player_id, r.email]));
}

// ---------- แจ้งเตือน LINE ----------

export interface LineSettings {
  group_id: string | null;
  notify_signup: boolean;
  notify_turn: boolean;
  notify_turn_personal: boolean;
}

export async function getLineSettings(db: SupabaseClient): Promise<LineSettings | null> {
  const { data, error } = await db.from("line_settings").select("group_id,notify_signup,notify_turn,notify_turn_personal").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LineSettings | null;
}

export async function updateLineSettings(db: SupabaseClient, s: Partial<LineSettings>) {
  check(await db.from("line_settings").update(s).eq("id", 1));
}

/** รหัส 6 หลักสำหรับพิมพ์ในกลุ่ม LINE เพื่อเชื่อมกลุ่ม (ใช้ได้ครั้งเดียว 15 นาที) */
export async function newLineLinkCode(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.rpc("new_line_link_code");
  if (error) throw new Error(error.message);
  return data as string;
}

/** ส่งข้อความทดสอบเข้ากลุ่ม LINE คืนข้อความผิดพลาด หรือ null */
export async function testLine(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.functions.invoke("line", { body: { action: "test" } });
  if (error) return error.message;
  return (data as { error?: string })?.error ?? null;
}

// ---------- ล็อกอินผู้เล่น ----------

export type LoginResult = { token?: string; pending?: boolean; error?: string };

export async function playerLogout(db: SupabaseClient, token: string) {
  await db.rpc("player_logout", { p_token: token });
}

type PrivateRows = { error?: string; drinks: Rows["drinks"]; monthly: Rows["monthly"]; slips: Rows["slips"] };

/** ค่าน้ำ ค่ารายเดือน และสลิปของผู้เล่นที่ล็อกอิน (คนอื่นมองไม่เห็น) รวมเข้า state */
export async function loadPrivate(db: SupabaseClient, state: State, playerId: string, token: string): Promise<State | "expired"> {
  const { data, error } = await db.rpc("my_private", { p_player: playerId, p_token: token });
  if (error) throw new Error(error.message);
  const r = data as PrivateRows;
  if (r.error) return "expired";
  return mergePrivate(state, r);
}

export function mergePrivate(state: State, r: Omit<PrivateRows, "error">): State {
  const days = new Map(state.days.map((d) => [d.date, { ...d }]));
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, checkIns: [], games: [], drinks: [] }));
    return d;
  };
  for (const x of r.drinks) {
    const d = day(x.date);
    if (!d.drinks.some((y) => y.id === x.id)) d.drinks = [...d.drinks, { id: x.id, playerId: x.player_id, amount: x.amount, note: x.note }];
  }
  for (const x of r.slips) {
    const d = day(x.date);
    if (!d.slips?.some((y) => y.id === x.id))
      d.slips = [...(d.slips ?? []), { id: x.id, playerId: x.player_id, amount: x.amount, at: ms(x.created_at) }];
  }
  const monthly = { ...state.monthly };
  const monthlyAmounts = { ...state.monthlyAmounts };
  for (const m of r.monthly) {
    monthly[m.month] = { ...monthly[m.month], [m.player_id]: ms(m.paid_at) };
    if (m.amount != null) monthlyAmounts[m.month] = { ...monthlyAmounts[m.month], [m.player_id]: m.amount };
  }
  return { ...state, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), monthly, monthlyAmounts };
}

// ---------- เข้าสู่ระบบด้วย LINE ----------

export type LineLoginResult = {
  session?: { access_token: string; refresh_token: string };
  pending?: boolean;
  /** ขอผูกกับชื่อเดิมไว้ รอแอดมินยืนยัน */
  claim?: boolean;
  token?: string;
  player_id?: string;
  ticket?: string;
  name?: string;
  picture?: string | null;
  error?: string;
};

export async function lineLogin(db: SupabaseClient, code: string, redirectUri: string): Promise<LineLoginResult> {
  const { data, error } = await db.functions.invoke("line-login", { body: { code, redirect_uri: redirectUri } });
  if (error) return { error: error.message };
  return data as LineLoginResult;
}

/** ขอผูกบัญชี LINE กับชื่อที่แอดมินลงไว้แล้ว (แอดมินต้องกดยืนยัน) */
export async function claimPlayer(db: SupabaseClient, ticket: string, playerId: string): Promise<{ ok?: boolean; error?: string }> {
  const { data, error } = await db.rpc("claim_player", { p_ticket: ticket, p_player: playerId });
  if (error) return { error: error.message };
  return data as { ok?: boolean; error?: string };
}

export type LineClaim = { line_user_id: string; player_id: string; line_name: string | null; picture: string | null };

/** คำขอผูก LINE ที่รอแอดมินยืนยัน */
export async function listClaims(db: SupabaseClient): Promise<LineClaim[]> {
  const { data, error } = await db.from("line_claims").select("line_user_id,player_id,line_name,picture").eq("status", "pending").order("created_at");
  if (error) throw new Error(error.message);
  return data as LineClaim[];
}

/** แอดมินยืนยัน (ok) หรือปฏิเสธคำขอ คืนข้อความผิดพลาด หรือ null */
export async function resolveClaim(db: SupabaseClient, lineUserId: string, ok: boolean): Promise<string | null> {
  const { data, error } = await db.rpc("resolve_claim", { p_line_user: lineUserId, p_ok: ok });
  if (error) return error.message;
  return (data as string | null) ?? null;
}

export async function registerPlayerLine(db: SupabaseClient, ticket: string, p: Omit<Player, "id">): Promise<{ id?: string; error?: string }> {
  const { data, error } = await db.rpc("register_player_line", {
    p_ticket: ticket,
    p_name: p.name,
    p_gender: p.gender ?? "other",
    p_level: p.level,
    p_photo: p.photo ?? "",
  });
  if (error) return { error: error.message };
  return data as { id?: string; error?: string };
}

/** สิ่งที่ผู้เล่นทำเองเกี่ยวกับเพื่อน: ขอจับคู่ ตอบรับ ยกเลิก และโหวตวัน */
export type SocialRequest =
  | { kind: "requestPair"; to: string }
  | { kind: "respondPair"; id: string; accept: boolean }
  | { kind: "cancelPair"; id: string }
  | { kind: "vote"; poll: string; dates: string[] }
  | { kind: "birthday"; bday: string | null }
  | { kind: "boardPost"; post: { kind: BoardKind; title: string; detail: string; price: number | null; photo: string } }
  | { kind: "boardClose"; id: string };

export async function socialRpc(db: SupabaseClient, req: SocialRequest, playerId: string, pin: string): Promise<string | null> {
  const base = { p_player: playerId, p_pin: pin };
  const { data, error } =
    req.kind === "requestPair"
      ? await db.rpc("request_pair", { ...base, p_to: req.to })
      : req.kind === "respondPair"
        ? await db.rpc("respond_pair", { ...base, p_id: req.id, p_accept: req.accept })
        : req.kind === "cancelPair"
          ? await db.rpc("cancel_pair", { ...base, p_id: req.id })
          : req.kind === "birthday"
            ? await db.rpc("set_my_birthday", { ...base, p_bday: req.bday })
            : req.kind === "boardPost"
              ? await db.rpc("board_post", {
                  ...base,
                  p_kind: req.post.kind,
                  p_title: req.post.title,
                  p_detail: req.post.detail,
                  p_price: req.post.price,
                  p_photo: req.post.photo,
                })
              : req.kind === "boardClose"
                ? await db.rpc("board_close", { ...base, p_id: req.id })
                : await db.rpc("vote_poll", { ...base, p_poll: req.poll, p_dates: req.dates });
  if (error) return error.message;
  return (data as string | null) ?? null;
}
