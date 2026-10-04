import { guestsOf, markPaid } from "./billing";
import { DEFAULT_SETTINGS, type Day, type DayPrices, type Game, type Level, type MonthlyPayments, type Player, type Settings, type Team } from "./types";

export interface State {
  players: Player[];
  settings: Settings;
  days: Day[];
  monthly: MonthlyPayments;
  /** วันงดเล่น (YYYY-MM-DD) -> เหตุผล */
  closed: Record<string, string>;
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
  | { type: "setAnnouncement"; date: string; message: string | null }
  | { type: "setClosed"; date: string; reason: string | null }
  | { type: "signUp"; date: string; playerId: string; _at: number }
  | { type: "cancelSignUp"; date: string; playerId: string }
  /** ใช้ในโหมดเก็บในเครื่องเท่านั้น ออนไลน์ส่งผ่าน submit_slip */
  | { type: "addSlip"; date: string; playerId: string; amount: number; _id: string; _at: number }
  /** ล้างประวัติทั้งหมด (ช่วงทดลองใช้) เก็บผู้เล่น ตั้งค่า วันงดเล่น และวันจัดก๊วนหลังวันนี้ไว้ */
  | { type: "clearHistory"; today: string }
  | { type: "replace"; state: State };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** สิ่งที่หน้าจอส่งเข้ามา (ยังไม่มี id และเวลา) */
export type Intent = DistributiveOmit<Action, "_id" | "_at">;

export const EMPTY_STATE: State = { players: [], settings: DEFAULT_SETTINGS, days: [], monthly: {}, closed: {} };

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
      const ids = new Set(withGuests(state, a.playerId));
      return withDay(state, a.date, (d) => ({
        ...d,
        checkIns: d.checkIns.map((c) => (ids.has(c.playerId) ? { ...c, paidAt: undefined } : c)),
      }));
    }
    case "setMonthlyPaid": {
      const month = { ...state.monthly[a.month] };
      if (a.paid) month[a.playerId] = a._at;
      else delete month[a.playerId];
      return { ...state, monthly: { ...state.monthly, [a.month]: month } };
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
      return withDay(state, a.date, (d) => ({ ...d, announcement: a.message ?? undefined }));
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
        days: state.days
          .filter((d) => d.date > a.today && d.announcement !== undefined)
          .map((d) => ({ date: d.date, checkIns: [], games: [], drinks: [], announcement: d.announcement })),
      };
    case "replace":
      return a.state;
  }
}
