import type { Day, Player } from "./types";

/** ก๊วนเล็กกว่านี้แสดงรายชื่อทั้งหมดได้เลย ถ้าเกินให้แสดงเฉพาะคนที่เกี่ยวข้อง ที่เหลือค้นหาเอา */
export const SHOW_ALL_MAX = 12;

export function nameMatch(p: Player, q: string): boolean {
  return p.name.toLowerCase().includes(q.trim().toLowerCase());
}

/** คนที่มาเล่น (เช็คอิน) ตั้งแต่วันที่ from เป็นต้นไป (YYYY-MM-DD) */
export function cameSince(days: Day[], from: string): Set<string> {
  const ids = new Set<string>();
  for (const d of days) if (d.date >= from) for (const c of d.checkIns) ids.add(c.playerId);
  return ids;
}

/** วันที่ย้อนหลัง n วันจาก date (YYYY-MM-DD) */
export function daysBefore(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * รายชื่อที่จะแสดง: ถ้าพิมพ์ค้นหา แสดงทุกคนที่ชื่อตรง ไม่งั้นแสดงเฉพาะคนที่ keep บอกว่าเกี่ยวข้อง
 * (ก๊วนเล็ก ไม่เกิน SHOW_ALL_MAX คน แสดงทั้งหมด)
 */
export function visibleRoster(players: Player[], q: string, keep: (p: Player) => boolean): Player[] {
  if (q.trim()) return players.filter((p) => nameMatch(p, q));
  if (players.length <= SHOW_ALL_MAX) return players;
  return players.filter(keep);
}
