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
  /** สมาชิกรายวันหรือรายเดือน (ไม่มี = ยังไม่ได้เลือก) */
  plan?: Plan;
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
}

export const DEFAULT_SETTINGS: Settings = {
  courtCount: 4,
  courtFee: 40,
  firstShuttleFee: 30,
  nextShuttleFee: 25,
  monthlyFee: 150,
  promptPayId: "",
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
}

export interface Day {
  /** YYYY-MM-DD */
  date: string;
  checkIns: CheckIn[];
  games: Game[];
  drinks: Drink[];
  /** ข้อความประกาศจัดก๊วนวันนี้ (ไม่มี = ไม่ได้ประกาศ) */
  announcement?: string;
  /** คนที่ลงชื่อว่าจะมา */
  signups?: SignUp[];
  /** สลิปโอนเงินที่ผู้เล่นส่งมา (รูปโหลดแยกเฉพาะแอดมิน) */
  slips?: Slip[];
  /** ราคาของวันนั้น (ไม่มี = ใช้ราคาปัจจุบันในตั้งค่า) */
  prices?: DayPrices;
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
