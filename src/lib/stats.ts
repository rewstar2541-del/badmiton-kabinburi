import { dayAmount } from "./billing";
import type { State } from "./state";
import { monthOf, type Player } from "./types";

export interface MonthSummary {
  month: string;
  /** จำนวนวันที่มาเล่น */
  days: number;
  games: number;
  /** เกมที่บันทึกผลแพ้ชนะ */
  decided: number;
  wins: number;
  /** % ชนะจากเกมที่บันทึกผล (null = ยังไม่มีเกมที่บันทึกผล) */
  winRate: number | null;
  shuttles: number;
  /** ค่าใช้จ่ายทั้งเดือน รวมค่าสมาชิกรายเดือนถ้าจ่าย */
  spent: number;
  /** คนที่เล่นด้วยบ่อยที่สุด (ทีมเดียวกัน) */
  topPartner?: { id: string; games: number };
}

export function monthSummary(state: State, player: Player, month: string): MonthSummary {
  const days = state.days.filter((d) => monthOf(d.date) === month && d.checkIns.some((c) => c.playerId === player.id));
  let games = 0;
  let decided = 0;
  let wins = 0;
  let shuttles = 0;
  let spent = 0;
  const partners = new Map<string, number>();
  for (const d of days) {
    const amt = dayAmount(d, player, state.settings, state.monthly);
    spent += amt.amount;
    shuttles += amt.shuttleCount;
    for (const g of d.games) {
      const i = g.playerIds.indexOf(player.id);
      if (i < 0 || !g.endedAt) continue;
      games++;
      const partner = g.playerIds[i < 2 ? 1 - i : 5 - i];
      partners.set(partner, (partners.get(partner) ?? 0) + 1);
      if (g.winner) {
        decided++;
        if ((g.winner === "A") === i < 2) wins++;
      }
    }
  }
  if (state.monthly[month]?.[player.id]) spent += state.settings.monthlyFee;
  const top = [...partners].sort((a, b) => b[1] - a[1])[0];
  return {
    month,
    days: days.length,
    games,
    decided,
    wins,
    winRate: decided ? Math.round((wins / decided) * 100) : null,
    shuttles,
    spent,
    topPartner: top ? { id: top[0], games: top[1] } : undefined,
  };
}
