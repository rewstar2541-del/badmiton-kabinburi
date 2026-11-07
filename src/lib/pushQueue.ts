import { courtPlan, presence } from "./matchmaking";
import { courtList, inGame, type Day, type Player, type Settings } from "./types";

/** ผู้เล่นที่อีก 1 เกมจะถึงคิว: อยู่ในคู่ถัดไปของสนามที่ยังมีเกมเล่นอยู่ */
export interface TurnSoon {
  playerId: string;
  court: number;
  /** กันส่งซ้ำ: 1 ครั้งต่อ 1 ตาที่รอลงต่อสนาม (ตาจากจำนวนเกมที่เล่นไปแล้ววันนี้ ถ้าคิวย้ายสนามจะส่งใหม่และทับอันเดิม) */
  key: string;
}

/**
 * ใช้ลำดับเดียวกับที่หน้าสนามและกระดิ่งแสดง (courtPlan): คู่แรกในคิวของสนาม หรือคู่ที่ระบบจัดให้รอสนามนั้น
 * แจ้งเฉพาะสนามที่ยังมีเกมเล่นอยู่ (= อีก 1 เกม) และเฉพาะคนที่กำลังรอ (ไม่พัก ไม่กลับบ้าน ไม่อยู่บนสนามอื่น)
 */
export function turnSoon(day: Day, players: Player[], settings: Pick<Settings, "courtCount" | "courtNumbers">): TurnSoon[] {
  const busy = new Set(day.games.filter((g) => !g.endedAt).map((g) => g.court));
  const out: TurnSoon[] = [];
  for (const next of courtPlan(day, players, courtList(settings)).values()) {
    if (!busy.has(next.court)) continue;
    for (const id of next.playerIds) {
      if (presence(day, id) !== "waiting") continue;
      const round = day.games.filter((g) => inGame(g, id)).length;
      out.push({ playerId: id, court: next.court, key: `turn:${round}:${next.court}` });
    }
  }
  return out;
}

/** วันนี้ตามเวลาไทย (YYYY-MM-DD) ใช้ฝั่งเซิร์ฟเวอร์ที่อยู่คนละเขตเวลา */
export function bangkokDate(now = Date.now()): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
