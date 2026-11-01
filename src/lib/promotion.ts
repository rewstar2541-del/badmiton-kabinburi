import { signupQueue } from "./social";
import { LEVELS, type Day, type Level, type Player } from "./types";

/** เกณฑ์เลื่อนขั้นรายเดือน: ชนะอย่างน้อย {wins} เกม และชนะ {rate}% ขึ้นไปของเกมที่บันทึกผล */
export const PROMOTION_RULE = { wins: 15, rate: 60 };

/** ระดับมือถัดไป (ตามลำดับ LEVELS) หรือ null ถ้าสูงสุดแล้ว */
export function nextLevel(level: Level): Level | null {
  const i = LEVELS.findIndex((l) => l.value === level);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].value : null;
}

export interface MonthRecord {
  /** เกมที่เล่นจบแล้ว */
  games: number;
  /** เกมที่บันทึกผลแพ้ชนะ */
  decided: number;
  wins: number;
}

/** สถิติแพ้ชนะของทุกคนในเดือน (YYYY-MM) */
export function monthRecord(days: Day[], month: string): Map<string, MonthRecord> {
  const out = new Map<string, MonthRecord>();
  for (const d of days) {
    if (d.date.slice(0, 7) !== month) continue;
    for (const g of d.games) {
      if (!g.endedAt) continue;
      g.playerIds.forEach((id, i) => {
        const r = out.get(id) ?? { games: 0, decided: 0, wins: 0 };
        r.games++;
        if (g.winner) {
          r.decided++;
          if ((g.winner === "A") === i < 2) r.wins++;
        }
        out.set(id, r);
      });
    }
  }
  return out;
}

/** % ชนะ (ปัดลง) จากเกมที่บันทึกผล */
export const winRate = (r: MonthRecord) => (r.decided ? Math.floor((r.wins / r.decided) * 100) : 0);

export const meetsRule = (r: MonthRecord, rule = PROMOTION_RULE) => r.wins >= rule.wins && winRate(r) >= rule.rate;

export interface Candidate {
  id: string;
  from: Level;
  to: Level;
  wins: number;
  decided: number;
  rate: number;
}

/** คนที่เข้าเกณฑ์เลื่อนขั้นในเดือนนั้น (ไม่รวมแขก คนรออนุมัติ และคนที่ระดับสูงสุดแล้ว) เรียงตามจำนวนชนะ */
export function promotionCandidates(state: { players: Player[]; days: Day[] }, month: string, rule = PROMOTION_RULE): Candidate[] {
  const rec = monthRecord(state.days, month);
  const out: Candidate[] = [];
  for (const p of clubMembers(state.players)) {
    const r = rec.get(p.id);
    const to = nextLevel(p.level);
    if (!r || to === null || !meetsRule(r, rule)) continue;
    out.push({ id: p.id, from: p.level, to, wins: r.wins, decided: r.decided, rate: winRate(r) });
  }
  return out.sort((a, b) => b.wins - a.wins || b.rate - a.rate);
}

/** ใครมาแล้ว ใครลงชื่อแต่ยังไม่มา ใครเป็นสำรอง (วันที่ไม่ได้ประกาศ ไม่นับชื่อที่ค้าง) */
export function attendees(day: Day) {
  const here = day.checkIns.map((c) => c.playerId);
  const checked = new Set(here);
  const announced = day.announcement !== undefined;
  const q = announced ? signupQueue(day) : { confirmed: [] as string[], waiting: [] as string[] };
  const coming = q.confirmed.filter((id) => !checked.has(id));
  const waiting = q.waiting.filter((id) => !checked.has(id));
  return { here, coming, waiting, total: here.length + coming.length };
}

/** สมาชิกก๊วน: ไม่นับแขกที่พามา และคนที่สมัครแล้วรออนุมัติ */
export function clubMembers(players: Player[]): Player[] {
  return players.filter((p) => !p.guestOf && !p.pending);
}

/** จำนวนสมาชิกแต่ละระดับมือ เรียงจากอ่อนไปเก่ง */
export function levelCounts(players: Player[]) {
  return LEVELS.map((l) => ({ value: l.value, code: l.code, label: l.label, n: players.filter((p) => p.level === l.value).length }));
}
