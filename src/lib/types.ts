/** ระดับมือของก๊วน เรียงจากอ่อนไปเก่ง: 1 = New ... 5 = P */
/** ค่าที่เก็บในฐานข้อมูล: 1-5 = New BG N S P เพิ่ม 6 = NB ทีหลัง (ไม่เปลี่ยนเลขเดิมของผู้เล่นที่มีอยู่) */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

/** เรียงจากอ่อนไปเก่ง (strength ใช้ถ่วงฝีมือตอนจัดคู่) */
export const LEVELS: { value: Level; code: string; label: string; strength: number }[] = [
  { value: 1, code: "New", label: "มือใหม่", strength: 1 },
  { value: 2, code: "BG", label: "เริ่มตีได้", strength: 2 },
  { value: 6, code: "NB", label: "เกือบทั่วไป", strength: 2.5 },
  { value: 3, code: "N", label: "ทั่วไป", strength: 3 },
  { value: 4, code: "S", label: "ตีดี", strength: 4 },
  { value: 5, code: "P", label: "เก่ง", strength: 5 },
];

/** ฝีมือเป็นตัวเลขสำหรับเทียบ/รวม (NB อยู่ระหว่าง BG กับ N) */
export function strength(level: Level): number {
  return LEVELS.find((l) => l.value === level)?.strength ?? level;
}

export const DEFAULT_LEVEL: Level = 3;

export type Gender = "male" | "female" | "other";

export type Plan = "daily" | "monthly";

export interface Player {
  id: string;
  /** ชื่อเล่น */
  name: string;
  /** รูปโปรไฟล์ขนาดเล็ก (data URL หรือรูปโปรไฟล์ LINE) */
  photo?: string;
  gender?: Gender;
  /** ดู LEVELS */
  level: Level;
  /** คนที่อยากจับคู่ด้วย (id) */
  prefer?: string[];
  /** คนที่ไม่อยากเจอในเกมเดียวกัน (id) */
  avoid?: string[];
  /** แขกที่สมาชิกพามา: id ของคนพามา ค่าใช้จ่ายรวมไปที่บิลของคนนั้น */
  guestOf?: string;
  /** สมัครเองแล้ว รอแอดมินอนุมัติ ยังลงชื่อ/เช็คอินไม่ได้ */
  pending?: boolean;
  /** แนะนำตัวสั้นๆ ที่ผู้เล่นเขียนเอง */
  bio?: string;
  /** ผู้เล่นขอเปลี่ยนระดับมือ รอแอดมินอนุมัติ */
  levelRequest?: Level;
  /** สมาชิกรายวันหรือรายเดือน (ไม่มี = ยังไม่ได้เลือก) */
  plan?: Plan;
  /** วันเกิด MM-DD (ไม่เก็บปี) */
  birthday?: string;
  /** สมาชิกรายปี: ใช้ได้ตั้งแต่วันนี้ถึงวันนี้ (YYYY-MM-DD รวมทั้งสองวัน) ไม่คิดค่าสนามในช่วงนี้ */
  annualFrom?: string;
  annualUntil?: string;
}

/** การจ่ายค่าสมาชิกรายปี (แอดมินเท่านั้น) ใช้ดูประวัติและรวมเป็นรายรับของเดือนที่จ่าย */
export interface AnnualPayment {
  id: string;
  playerId: string;
  /** วันที่จ่าย YYYY-MM-DD */
  paidOn: string;
  from: string;
  until: string;
  amount: number;
}

/** เป็นสมาชิกรายปีอยู่ในวันนั้นไหม */
export function isAnnualMember(player: Pick<Player, "annualFrom" | "annualUntil"> | undefined, date: string): boolean {
  return Boolean(player?.annualUntil && date <= player.annualUntil && (!player.annualFrom || date >= player.annualFrom));
}

/** วันที่ + ปี (YYYY-MM-DD) เช่น จ่าย 2026-01-01 ใช้ได้ถึง 2027-01-01 (29 ก.พ. เลื่อนเป็น 28 ก.พ.) */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** วันที่ + วัน (YYYY-MM-DD) */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

/**
 * สมาชิกรายปีลงชื่อล่วงหน้าได้ก่อนคนอื่น (ตรงกับ sign_up_day ในฐานข้อมูล)
 * คืนวันที่คนทั่วไปเริ่มลงชื่อวันนั้นได้ ถ้าคนนี้ยังลงไม่ได้ ไม่งั้นคืน undefined
 */
export function signupOpensOn(
  settings: Pick<Settings, "openSignupDays">,
  player: Pick<Player, "annualFrom" | "annualUntil"> | undefined,
  date: string,
  today: string,
): string | undefined {
  const n = settings.openSignupDays;
  if (n == null || isAnnualMember(player, date)) return undefined;
  const opens = addDays(date, -n);
  return opens > today ? opens : undefined;
}

/** จำนวนวันจาก a ถึง b (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** ข่าวประกาศทั่วไป (ไม่ผูกกับวันเล่น) แสดงบนสุดจนถึงวันที่กำหนด */
export interface Notice {
  id: string;
  kind: "news" | "urgent";
  title: string;
  body?: string;
  /** แสดงถึงวันนี้ (รวม) ไม่มี = จนกว่าจะลบ */
  until?: string;
  at: number;
}

export type BoardKind = "lost" | "found" | "sell";
/** บอร์ดของหาย / ของเจอ / ฝากขาย (รูปโหลดแยกทีหลัง) */
export interface BoardPost {
  id: string;
  playerId: string;
  kind: BoardKind;
  title: string;
  detail?: string;
  price?: number;
  hasPhoto: boolean;
  /** รูปในโหมดทดลอง (ของจริงโหลดผ่าน boardPhoto) */
  photo?: string;
  at: number;
  closedAt?: number;
}

/** เดือน (YYYY-MM) -> ผู้เล่น -> เวลาที่จ่ายค่าสมาชิกรายเดือน */
export type MonthlyPayments = Record<string, Record<string, number>>;

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isMonthlyPaid(monthly: MonthlyPayments, date: string, playerId: string): boolean {
  return Boolean(monthly[monthOf(date)]?.[playerId]);
}

export interface Settings {
  courtCount: number;
  /** ค่าสนามต่อครั้ง สำหรับคนที่ไม่ใช่สมาชิกรายเดือน */
  courtFee: number;
  /** ค่าลูกแรกของวัน ต่อคน */
  firstShuttleFee: number;
  /** ค่าลูกถัดไป ต่อคน ต่อลูก */
  nextShuttleFee: number;
  monthlyFee: number;
  /** เบอร์มือถือ เลขบัตรประชาชน หรือเลขผู้เสียภาษี ที่ผูก PromptPay */
  promptPayId: string;
  /** บัญชีธนาคาร (ไม่บังคับ) แสดงใต้ QR สำหรับคนที่โอนเข้าบัญชีตรง */
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  /** สิทธิ์สมาชิกรายปี: คนทั่วไปลงชื่อล่วงหน้าได้ไม่เกินกี่วันก่อนวันเล่น ไม่มี = ทุกคนลงชื่อได้เท่ากัน */
  openSignupDays?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  courtCount: 4,
  courtFee: 40,
  firstShuttleFee: 30,
  nextShuttleFee: 25,
  monthlyFee: 150,
  promptPayId: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
};

export type Team = "A" | "B";

export interface Game {
  id: string;
  court: number;
  /** [ทีม A คนที่ 1, ทีม A คนที่ 2, ทีม B คนที่ 1, ทีม B คนที่ 2] */
  playerIds: [string, string, string, string];
  startedAt: number;
  endedAt?: number;
  shuttles: number;
  winner?: Team;
}

export interface CheckIn {
  playerId: string;
  at: number;
  /** จ่ายแล้ว ถือว่ากลับบ้าน ไม่อยู่ในคิว */
  paidAt?: number;
  /** ขอพัก ระบบข้ามคิวไปก่อน */
  resting?: boolean;
  /** แอดมินแก้ค่าสนามของคนนี้วันนี้เอง (ไม่มี = คิดตามราคาปกติ) */
  courtFee?: number;
  /** แอดมินแก้ค่าลูกรวมของคนนี้วันนี้เอง (ไม่มี = คิดตามจำนวนลูก) */
  shuttleFee?: number;
}

/** ราคาที่ใช้คิดเงินของวันหนึ่ง (เก็บไว้เมื่อแอดมินเปลี่ยนราคา บิลวันก่อนๆ จะได้ไม่เปลี่ยนตาม) */
export type DayPrices = Pick<Settings, "courtFee" | "firstShuttleFee" | "nextShuttleFee">;

export interface Drink {
  id: string;
  playerId: string;
  amount: number;
  note: string;
  /** จำนวนลูกที่ซื้อ (เฉพาะซื้อลูกแบด) เข้าสต็อก */
  shuttles?: number;
  /** เวลาที่ลง ใช้เทียบกับเวลานับสต็อก */
  at?: number;
}

export interface Day {
  /** YYYY-MM-DD */
  date: string;
  checkIns: CheckIn[];
  games: Game[];
  drinks: Drink[];
  /** ข้อความประกาศจัดก๊วนวันนี้ (ไม่มี = ไม่ได้ประกาศ) */
  announcement?: string;
  /** หัวข้อประกาศ (ไม่มี = จัดก๊วน) เช่น กินเลี้ยง ทำความสะอาดสนาม */
  announcementTitle?: string;
  /** ค่าใช้จ่ายต่อคนของอีเว้นพิเศษ (แจ้งให้รู้ล่วงหน้า) */
  announcementFee?: number;
  /** รับกี่คน (ลงชื่อเกินเข้ารายชื่อสำรอง) ไม่มี = ไม่จำกัด */
  announcementCap?: number;
  /** คนที่ลงชื่อว่าจะมา */
  signups?: SignUp[];
  /** คำขอจับคู่เกมถัดไปของวันนั้น */
  pairs?: PairRequest[];
  /** สลิปโอนเงินที่ผู้เล่นส่งมา (รูปโหลดแยกเฉพาะแอดมิน) */
  slips?: Slip[];
  /** ราคาของวันนั้น (ไม่มี = ใช้ราคาปัจจุบันในตั้งค่า) */
  prices?: DayPrices;
}

export type PairStatus = "pending" | "accepted" | "declined" | "cancelled";

/** ผู้เล่นขอคู่กับเพื่อนในเกมถัดไป เพื่อนต้องตอบรับก่อน */
export interface PairRequest {
  id: string;
  from: string;
  to: string;
  status: PairStatus;
  /** เวลาที่ขอ / ตอบรับ */
  at: number;
}

/** โหวตวันตีพิเศษ */
export interface Poll {
  id: string;
  question: string;
  dates: string[];
  createdAt: number;
  chosen?: string;
  closed: boolean;
  /** ผู้เล่น -> วันที่ว่าง */
  votes: Record<string, string[]>;
}

/** สต็อกลูกแบด: นับจริงล่าสุด (base ณ countedAt) แล้วบวกที่ซื้อ ลบที่ใช้ในเกมหลังจากนั้น */
export interface ShuttleStock {
  base: number;
  countedAt: number;
  /** เตือนเมื่อเหลือน้อยกว่านี้ */
  low: number;
}

export interface Slip {
  id: string;
  playerId: string;
  amount: number;
  at: number;
}

export interface SignUp {
  playerId: string;
  at: number;
}

export type ExpenseCategory = "court" | "shuttle" | "maintenance" | "cleaning" | "drinks" | "equipment" | "other";
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "court", label: "ค่าเช่าสนาม" },
  { value: "shuttle", label: "ค่าลูกแบด" },
  { value: "maintenance", label: "ค่าบำรุงรักษา" },
  { value: "cleaning", label: "ค่าทำความสะอาด" },
  { value: "drinks", label: "ค่าเครื่องดื่ม" },
  { value: "equipment", label: "ค่าอุปกรณ์สนาม" },
  { value: "other", label: "อื่นๆ" },
];

/** รายจ่ายของก๊วน (แอดมินลงเอง) */
export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  /** จำนวนลูกที่ซื้อ (เฉพาะซื้อลูกแบด) เข้าสต็อก */
  shuttles?: number;
  /** เวลาที่ลง ใช้เทียบกับเวลานับสต็อก */
  at?: number;
}

/** เตือนสมาชิกรายปีใกล้หมดอายุเมื่อเหลือไม่เกินกี่วัน */
export const ANNUAL_SOON_DAYS = 30;

export type AnnualStatus = { kind: "active" | "soon" | "expired" | "upcoming"; from?: string; until: string; daysLeft: number };

/** สถานะสมาชิกรายปี ณ วันนั้น (undefined = ไม่เคยเป็น) หมดอายุแล้วยังคืนค่า expired ให้แอดมินตามต่ออายุได้ */
export function annualStatus(player: Pick<Player, "annualFrom" | "annualUntil"> | undefined, date: string): AnnualStatus | undefined {
  if (!player?.annualUntil) return undefined;
  const daysLeft = daysBetween(date, player.annualUntil);
  if (daysLeft < 0) return { kind: "expired", until: player.annualUntil, daysLeft };
  if (player.annualFrom && date < player.annualFrom) return { kind: "upcoming", from: player.annualFrom, until: player.annualUntil, daysLeft };
  return { kind: daysLeft <= ANNUAL_SOON_DAYS ? "soon" : "active", until: player.annualUntil, daysLeft };
}

/** กติกาวันหมดอายุสมาชิกรายปีตามยอดที่จ่าย: จ่ายตั้งแต่ minAmount หมดอายุสิ้นเดือน endMonth ของอีก yearsAhead ปีข้างหน้า */
export interface AnnualRule {
  minAmount: number;
  /** 1-12 */
  endMonth: number;
  /** 0 = ปีเดียวกับวันเริ่ม, 1 = ปีหน้า */
  yearsAhead: number;
}

/** วันหมดอายุตามกติกา ใช้กติกาที่ minAmount สูงสุดที่ยอดจ่ายถึง ไม่มีกติกาที่ตรง = ครบ 1 ปีนับจากวันเริ่ม */
export function annualExpiryFor(rules: AnnualRule[], amount: number, from: string): string {
  const rule = [...rules].filter((r) => amount >= r.minAmount).sort((a, b) => b.minAmount - a.minAmount)[0];
  if (!rule) return addYears(from, 1);
  const y = Number(from.slice(0, 4)) + rule.yearsAhead;
  const last = new Date(Date.UTC(y, rule.endMonth, 0)).getUTCDate();
  return `${y}-${String(rule.endMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
