import type { State } from "./state";
import { monthOf, type Day, type Loyalty, type Player, type RewardKind, type Settings } from "./types";

/** กติกาคะแนนสะสมที่เปิดใช้อยู่ (undefined = ปิด) */
export function loyaltyOn(s: Settings): Loyalty | undefined {
  return s.loyalty?.enabled ? s.loyalty : undefined;
}

/** id ของแต้มที่ได้จากเดือนนั้น (คนละเดือนได้ครั้งเดียว กดแจกซ้ำก็ไม่เพิ่ม) */
export function earnId(month: string, playerId: string): string {
  return `earn-${month}-${playerId}`;
}

/** มาเล่นกี่วันในเดือนนั้น (นับวันที่เช็คอิน) */
export function daysCame(days: Day[], month: string, playerId: string): number {
  return days.filter((d) => monthOf(d.date) === month && d.checkIns.some((c) => c.playerId === playerId)).length;
}

export function pointsEarnedTotal(state: State, playerId: string): number {
  return (state.pointsEarned ?? []).filter((e) => e.playerId === playerId).reduce((n, e) => n + e.points, 0);
}

export function pointsUsedTotal(state: State, playerId: string): number {
  return state.days.reduce((n, d) => n + (d.rewards ?? []).filter((r) => r.playerId === playerId).reduce((m, r) => m + r.points, 0), 0);
}

/** แต้มคงเหลือ */
export function pointsBalance(state: State, playerId: string): number {
  return Math.max(0, pointsEarnedTotal(state, playerId) - pointsUsedTotal(state, playerId));
}

/** สมาชิกที่มาเล่นครบเดือนนั้น (ไม่รวมแขกและคนรออนุมัติ) และได้แต้มไปแล้วหรือยัง */
export function monthQualifiers(state: State, month: string, rule: Loyalty): { player: Player; days: number; awarded: boolean }[] {
  const awarded = new Set((state.pointsEarned ?? []).filter((e) => e.month === month).map((e) => e.playerId));
  return state.players
    .filter((p) => !p.guestOf && !p.pending)
    .map((p) => ({ player: p, days: daysCame(state.days, month, p.id), awarded: awarded.has(p.id) }))
    .filter((x) => x.days >= rule.days || x.awarded)
    .sort((a, b) => b.days - a.days || a.player.name.localeCompare(b.player.name, "th"));
}

/** ส่วนลดจากแต้มของคนนี้วันนั้น ลดได้ไม่เกินค่าลูก / ค่าน้ำของวันนั้น */
export function rewardDiscount(day: Day, playerId: string, shuttleFee: number, drinkFee: number): Record<RewardKind, number> {
  const sum = (kind: RewardKind) => (day.rewards ?? []).filter((r) => r.playerId === playerId && r.kind === kind).reduce((n, r) => n + r.amount, 0);
  return { shuttle: Math.min(sum("shuttle"), shuttleFee), drink: Math.min(sum("drink"), drinkFee) };
}

/** เดือนก่อนหน้า (YYYY-MM) */
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
