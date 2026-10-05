import { guestsOf, markPaid } from "./billing";
import { DEFAULT_SETTINGS, type Day, type DayPrices, type Expense, type Game, type PairStatus, type Poll, type ShuttleStock, type BoardPost, type Level, type MonthlyPayments, type Player, type Settings, type Team } from "./types";

export interface State {
  players: Player[];
  settings: Settings;
  days: Day[];
  monthly: MonthlyPayments;
  /** วันงดเล่น (YYYY-MM-DD) -> เหตุผล */
  closed: Record<string, string>;
  /** ค่ารายเดือนที่จ่ายจริง เดือน -> ผู้เล่น -> บาท (ไม่มี = ราคาปัจจุบัน) */
  monthlyAmounts?: Record<string, Record<string, number>>;
  /** รายจ่ายของก๊วน (แอดมินเท่านั้น) */
  expenses?: Expense[];
  /** สต็อกลูกแบด (แอดมินเท่านั้น) */
  stock?: ShuttleStock;
  /** โหวตวันตีพิเศษ */
  polls?: Poll[];
  /** บอร์ดของหาย / ฝากขาย (เฉพาะที่ยังเปิดอยู่และเพิ่งปิด) */
  board?: BoardPost[];
}

/** ค่ารายเดือนที่คนนี้จ่ายในเดือนนั้น ใช้ราคาตอนจ่าย ไม่ใช่ราคาปัจจุบัน */
export function monthlyAmount(state: State, month: string, playerId: string): number {
  return state.monthlyAmounts?.[month]?.[playerId] ?? state.settings.monthlyFee;
}

/**
 * การกระทำที่เปลี่ยนข้อมูล `_id` และ `_at` ถูกเติมโดย `prepare` ก่อนเข้า reducer
 * เพื่อให้ reducer เป็นฟังก์ชันบริสุทธิ์ และค่าที่บันทึกลงฐานข้อมูลตรงกับบนหน้าจอ
 */
export type Action =
  | { type: "addPlayer"; player: Omit<Player, "id">; _id: string }
  | { type: "updatePlayer"; player: Player }
  | { type: "removePlayer"; playerId: string }
  /** เพิ่มแขก (ผู้เล่นที่มี guestOf) แล้วเช็คอินวันนั้นให้ในทีเดียว */
  | { type: "addGuest"; date: string; hostId: string; name: string; level: Level; _id: string; _at: number }
  | { type: "checkIn"; date: string; playerId: string; _at: number }
  | { type: "undoCheckIn"; date: string; playerId: string }
  | { type: "setResting"; date: string; playerId: string; resting: boolean }
  | { type: "startGame"; date: string; court: number; playerIds: Game["playerIds"]; _id: string; _at: number }
  | { type: "setShuttles"; date: string; gameId: string; shuttles: number }
  | { type: "endGame"; date: string; gameId: string; winner?: Team; _at: number }
  | { type: "cancelGame"; date: string; gameId: string }
  | { type: "addDrink"; date: string; playerId: string; amount: number; note: string; _id: string }
  | { type: "removeDrink"; date: string; drinkId: string }
  | { type: "editDrink"; date: string; drinkId: string; amount: number; note: string }
  /** แอดมินแก้ค่าสนาม / ค่าลูกของคนนี้วันนั้น (null = กลับไปคิดตามราคาปกติ) */
  | { type: "setBillFees"; date: string; playerId: string; courtFee: number | null; shuttleFee: number | null }
  | { type: "removeSlip"; date: string; slipId: string }
  | { type: "markPaid"; date: string; playerId: string; _at: number }
  | { type: "unmarkPaid"; date: string; playerId: string }
  | { type: "setMonthlyPaid"; month: string; playerId: string; paid: boolean; _at: number }
  /** freeze: เก็บราคาเดิมไว้กับวันก่อนๆ ตอนเปลี่ยนราคา บิลเก่าจะได้ไม่เปลี่ยนตาม */
  | { type: "updateSettings"; settings: Settings; freeze?: { dates: string[]; prices: DayPrices } }
  /** title: undefined = คงหัวข้อเดิม, null = จัดก๊วน (ค่าเริ่มต้น) */
  | { type: "setAnnouncement"; date: string; message: string | null; title?: string | null; fee?: number | null; cap?: number | null }
  | { type: "setClosed"; date: string; reason: string | null }
  | { type: "signUp"; date: string; playerId: string; _at: number }
  | { type: "cancelSignUp"; date: string; playerId: string }
  /** ใช้ในโหมดเก็บในเครื่องเท่านั้น ออนไลน์ส่งผ่าน submit_slip */
  | { type: "addSlip"; date: string; playerId: string; amount: number; _id: string; _at: number }
  /** ล้างประวัติทั้งหมด (ช่วงทดลองใช้) เก็บผู้เล่น ตั้งค่า วันงดเล่น และวันจัดก๊วนหลังวันนี้ไว้ */
  | { type: "clearHistory"; today: string }
  | { type: "addExpense"; expense: Omit<Expense, "id" | "at">; _id: string; _at: number }
  /** นับลูกจริงแล้ว ตั้งยอดใหม่ ณ ตอนนี้ / เปลี่ยนจุดเตือน */
  | { type: "setStock"; base?: number; low?: number; _at: number }
  | { type: "createPoll"; question: string; dates: string[]; _id: string; _at: number }
  /** chosen: วันที่เลือก (เปิดประกาศวันนั้นแยกต่างหาก) */
  | { type: "closePoll"; id: string; chosen?: string }
  | { type: "removePoll"; id: string }
  /** โหมดทดลองเท่านั้น ออนไลน์ผ่าน vote_poll */
  | { type: "votePoll"; id: string; playerId: string; dates: string[] }
  /** โหมดทดลองเท่านั้น ออนไลน์ผ่าน request_pair */
  | { type: "requestPair"; date: string; from: string; to: string; _id: string; _at: number }
  | { type: "setPairStatus"; date: string; id: string; status: PairStatus; _at: number }
  | { type: "removeExpense"; id: string }
  | { type: "addBoardPost"; post: Omit<BoardPost, "id" | "at" | "hasPhoto">; _id: string; _at: number }
  | { type: "closeBoardPost"; id: string; _at: number }
  | { type: "replace"; state: State };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** สิ่งที่หน้าจอส่งเข้ามา (ยังไม่มี id และเวลา) */
export type Intent = DistributiveOmit<Action, "_id" | "_at">;

export const EMPTY_STATE: State = { players: [], settings: DEFAULT_SETTINGS, days: [], monthly: {}, closed: {} };

/** ไฟล์สำรองรุ่นเก่าอาจไม่มีบางช่อง เติมค่าเริ่มต้นให้ครบก่อนนำเข้า */
export function normalizeBackup(raw: unknown): State {
  const data = raw as Partial<State> | null;
  if (!data || !Array.isArray(data.players) || !Array.isArray(data.days)) throw new Error("invalid backup");
  return {
    players: data.players.filter((p) => p && p.id && p.name).map((p) => ({ ...p, level: p.level ?? 3 })),
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    days: data.days
      .filter((d) => d && typeof d.date === "string")
      .map((d) => ({ ...d, checkIns: d.checkIns ?? [], games: d.games ?? [], drinks: d.drinks ?? [] })),
    monthly: data.monthly ?? {},
    closed: data.closed ?? {},
    monthlyAmounts: data.monthlyAmounts ?? {},
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    stock: data.stock,
    polls: Array.isArray(data.polls) ? data.polls : [],
    board: Array.isArray(data.board) ? data.board : [],
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** สิ่งที่ผู้เล่นทำเองได้โดยไม่ต้องเป็นแอดมิน */
export type SelfAction =
  | "signUp"
  | "cancelSignUp"
  | "checkIn"
  /** ยกเลิกเช็คอิน (กดผิด) ยังลงชื่ออยู่ */
  | "undoCheckIn"
  /** ยกเลิกเช็คอินและยกเลิกลงชื่อ (ไม่มาแล้ว) */
  | "notComing"
  | "rest"
  | "unrest"
  | "pay"
  | "payMonth";

/** พาแขกได้ไม่เกินกี่คนต่อวัน */
export const MAX_GUESTS = 3;

/** ตรวจก่อนเพิ่มแขกแบบผู้เล่นทำเอง (กติกาเดียวกับ add_guest ในฐานข้อมูล) คืนข้อความผิดพลาด หรือ null */
export function guestCheck(state: State, date: string, hostId: string, name: string): string | null {
  const host = state.players.find((p) => p.id === hostId);
  if (!host || host.guestOf) return "คำสั่งไม่ถูกต้อง";
  const day = state.days.find((d) => d.date === date);
  if (!day?.announcement) return "วันนี้ยังไม่มีประกาศจัดก๊วน";
  if (!name.trim()) return "กรุณาใส่ชื่อเล่น";
  const guests = new Set(guestsOf(state.players, hostId).map((g) => g.id));
  if (day.checkIns.filter((c) => guests.has(c.playerId)).length >= MAX_GUESTS) return "พาแขกได้ไม่เกิน 3 คนต่อวัน";
  return null;
}

/** ผู้เล่นและแขกที่ผู้เล่นพามา */
export function withGuests(state: State, playerId: string): string[] {
  return [playerId, ...guestsOf(state.players, playerId).map((g) => g.id)];
}

export function prepare(i: Intent, now = Date.now(), id = newId): Action {
  return { ...i, _id: id(), _at: now } as Action;
}

function withDay(state: State, date: string, fn: (d: Day) => Day): State {
  const exists = state.days.some((d) => d.date === date);
  const days = exists
    ? state.days.map((d) => (d.date === date ? fn(d) : d))
    : [...state.days, fn({ date, checkIns: [], games: [], drinks: [] })].sort((a, b) => a.date.localeCompare(b.date));
  return { ...state, days };
}

function updateGame(state: State, date: string, gameId: string, fn: (g: Game) => Game): State {
  return withDay(state, date, (d) => ({
    ...d,
    games: d.games.map((g) => (g.id === gameId ? fn(g) : g)),
  }));
}

export function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "addPlayer":
      return { ...state, players: [...state.players, { ...a.player, id: a._id }] };
    case "updatePlayer":
      return { ...state, players: state.players.map((p) => (p.id === a.player.id ? a.player : p)) };
    case "removePlayer":
      return { ...state, players: state.players.filter((p) => p.id !== a.playerId) };
    case "checkIn":
      return withDay(state, a.date, (d) =>
        d.checkIns.some((c) => c.playerId === a.playerId)
          ? d
          : { ...d, checkIns: [...d.checkIns, { playerId: a.playerId, at: a._at }] },
      );
    case "setResting":
      return withDay(state, a.date, (d) => ({
        ...d,
        checkIns: d.checkIns.map((c) => (c.playerId === a.playerId ? { ...c, resting: a.resting || undefined } : c)),
      }));
    case "undoCheckIn":
      return withDay(state, a.date, (d) => ({ ...d, checkIns: d.checkIns.filter((c) => c.playerId !== a.playerId) }));
    case "startGame":
      return withDay(state, a.date, (d) => ({
        ...d,
        games: [...d.games, { id: a._id, court: a.court, playerIds: a.playerIds, startedAt: a._at, shuttles: 1 }],
      }));
    case "setShuttles":
      return updateGame(state, a.date, a.gameId, (g) => ({ ...g, shuttles: Math.max(0, a.shuttles) }));
    case "endGame":
      return updateGame(state, a.date, a.gameId, (g) => ({ ...g, endedAt: a._at, winner: a.winner }));
    case "cancelGame":
      return withDay(state, a.date, (d) => ({ ...d, games: d.games.filter((g) => g.id !== a.gameId) }));
    case "addDrink":
      return withDay(state, a.date, (d) => ({
        ...d,
        drinks: [...d.drinks, { id: a._id, playerId: a.playerId, amount: a.amount, note: a.note }],
      }));
    case "removeDrink":
      return withDay(state, a.date, (d) => ({ ...d, drinks: d.drinks.filter((x) => x.id !== a.drinkId) }));
    case "addGuest": {
      const s = { ...state, players: [...state.players, { id: a._id, name: a.name, level: a.level, guestOf: a.hostId }] };
      return withDay(s, a.date, (d) => ({ ...d, checkIns: [...d.checkIns, { playerId: a._id, at: a._at }] }));
    }
    case "markPaid":
      // จ่ายรวมของแขกที่พามาด้วย
      return { ...state, days: markPaid(state.days, a.date, withGuests(state, a.playerId), a._at) };
    case "unmarkPaid": {
      // ย้อนเฉพาะที่ปิดไปพร้อมกันตอนกดจ่าย (วันนี้และยอดค้างวันก่อนๆ มีเวลาจ่ายเดียวกัน)
      const ids = new Set(withGuests(state, a.playerId));
      const stamp = state.days.find((d) => d.date === a.date)?.checkIns.find((c) => c.playerId === a.playerId)?.paidAt;
      if (!stamp) return state;
      return {
        ...state,
        days: state.days.map((d) =>
          d.date > a.date
            ? d
            : { ...d, checkIns: d.checkIns.map((c) => (ids.has(c.playerId) && c.paidAt === stamp ? { ...c, paidAt: undefined } : c)) },
        ),
      };
    }
    case "setMonthlyPaid": {
      const month = { ...state.monthly[a.month] };
      const amounts = { ...state.monthlyAmounts?.[a.month] };
      if (a.paid) {
        if (!month[a.playerId]) amounts[a.playerId] = state.settings.monthlyFee;
        month[a.playerId] = a._at;
      } else {
        delete month[a.playerId];
        delete amounts[a.playerId];
      }
      return {
        ...state,
        monthly: { ...state.monthly, [a.month]: month },
        monthlyAmounts: { ...state.monthlyAmounts, [a.month]: amounts },
      };
    }
    case "updateSettings": {
      const f = a.freeze;
      const dates = new Set(f?.dates ?? []);
      const days = f ? state.days.map((d) => (dates.has(d.date) && !d.prices ? { ...d, prices: f.prices } : d)) : state.days;
      return { ...state, settings: a.settings, days };
    }
    case "editDrink":
      return withDay(state, a.date, (d) => ({
        ...d,
        drinks: d.drinks.map((x) => (x.id === a.drinkId ? { ...x, amount: a.amount, note: a.note } : x)),
      }));
    case "setBillFees":
      return withDay(state, a.date, (d) => ({
        ...d,
        checkIns: d.checkIns.map((c) =>
          c.playerId === a.playerId ? { ...c, courtFee: a.courtFee ?? undefined, shuttleFee: a.shuttleFee ?? undefined } : c,
        ),
      }));
    case "removeSlip":
      return withDay(state, a.date, (d) => ({ ...d, slips: d.slips?.filter((x) => x.id !== a.slipId) }));
    case "setClosed": {
      const closed = { ...state.closed };
      if (a.reason === null) delete closed[a.date];
      else closed[a.date] = a.reason;
      return { ...state, closed };
    }
    case "setAnnouncement":
      return withDay(state, a.date, (d) => ({
        ...d,
        announcement: a.message ?? undefined,
        announcementTitle: a.message === null ? undefined : a.title === undefined ? d.announcementTitle : (a.title ?? undefined),
        announcementFee: a.message === null ? undefined : a.fee === undefined ? d.announcementFee : (a.fee ?? undefined),
        announcementCap: a.message === null ? undefined : a.cap === undefined ? d.announcementCap : (a.cap ?? undefined),
      }));
    case "signUp":
      return withDay(state, a.date, (d) =>
        d.signups?.some((x) => x.playerId === a.playerId)
          ? d
          : { ...d, signups: [...(d.signups ?? []), { playerId: a.playerId, at: a._at }] },
      );
    case "addSlip":
      return withDay(state, a.date, (d) => ({
        ...d,
        slips: [...(d.slips ?? []), { id: a._id, playerId: a.playerId, amount: a.amount, at: a._at }],
      }));
    case "cancelSignUp":
      return withDay(state, a.date, (d) => ({ ...d, signups: d.signups?.filter((x) => x.playerId !== a.playerId) }));
    case "clearHistory":
      return {
        ...state,
        players: state.players.filter((p) => !p.guestOf),
        monthly: {},
        expenses: [],
        polls: [],
        board: [],
        days: state.days
          .filter((d) => d.date > a.today && d.announcement !== undefined)
          .map((d) => ({ date: d.date, checkIns: [], games: [], drinks: [], announcement: d.announcement })),
      };
    case "addExpense":
      return { ...state, expenses: [...(state.expenses ?? []), { ...a.expense, id: a._id, at: a._at }] };
    case "setStock": {
      const cur = state.stock ?? { base: 0, countedAt: a._at, low: 12 };
      return {
        ...state,
        stock: { low: a.low ?? cur.low, base: a.base ?? cur.base, countedAt: a.base === undefined ? cur.countedAt : a._at },
      };
    }
    case "createPoll":
      return { ...state, polls: [...(state.polls ?? []), { id: a._id, question: a.question, dates: a.dates, createdAt: a._at, closed: false, votes: {} }] };
    case "closePoll":
      return { ...state, polls: (state.polls ?? []).map((p) => (p.id === a.id ? { ...p, closed: true, chosen: a.chosen } : p)) };
    case "addBoardPost":
      return { ...state, board: [{ ...a.post, id: a._id, at: a._at, hasPhoto: !!a.post.photo }, ...(state.board ?? [])] };
    case "closeBoardPost":
      return { ...state, board: (state.board ?? []).map((b) => (b.id === a.id ? { ...b, closedAt: a._at } : b)) };
    case "removePoll":
      return { ...state, polls: (state.polls ?? []).filter((p) => p.id !== a.id) };
    case "votePoll":
      return {
        ...state,
        polls: (state.polls ?? []).map((p) =>
          p.id === a.id && !p.closed ? { ...p, votes: { ...p.votes, [a.playerId]: a.dates.filter((d) => p.dates.includes(d)) } } : p,
        ),
      };
    case "requestPair":
      return withDay(state, a.date, (d) => ({
        ...d,
        pairs: [
          ...(d.pairs ?? []).map((x) => (x.from === a.from && (x.status === "pending" || x.status === "accepted") ? { ...x, status: "cancelled" as const } : x)),
          { id: a._id, from: a.from, to: a.to, status: "pending", at: a._at },
        ],
      }));
    case "setPairStatus":
      return withDay(state, a.date, (d) => {
        const r = d.pairs?.find((x) => x.id === a.id);
        if (!r) return d;
        const people = [r.from, r.to];
        return {
          ...d,
          pairs: (d.pairs ?? []).map((x) =>
            x.id === a.id
              ? { ...x, status: a.status, at: a.status === "accepted" ? a._at : x.at }
              : // ตอบรับแล้ว คำขออื่นของสองคนนี้ถูกยกเลิก
                a.status === "accepted" && (x.status === "pending" || x.status === "accepted") && (people.includes(x.from) || people.includes(x.to))
                ? { ...x, status: "cancelled" as const }
                : x,
          ),
        };
      });
    case "removeExpense":
      return { ...state, expenses: (state.expenses ?? []).filter((e) => e.id !== a.id) };
    case "replace":
      return a.state;
  }
}
