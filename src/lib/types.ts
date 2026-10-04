export type Level = 1 | 2 | 3 | 4 | 5;

export type Gender = "male" | "female" | "other";

export interface Player {
  id: string;
  /** ชื่อเล่น */
  name: string;
  /** รูปโปรไฟล์ขนาดเล็ก (data URL) */
  photo?: string;
  phone?: string;
  gender?: Gender;
  /** 1 = มือใหม่, 5 = เก่งสุด */
  level: Level;
  /** สมาชิกรายเดือน ไม่ต้องจ่ายค่าสนามรายวัน */
  isMonthly: boolean;
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
  paidAt?: number;
}

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
}
