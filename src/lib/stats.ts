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

export interface Badge {
  id: string;
  /** ชื่อป้าย (ข้อความไทย ใช้เป็นคีย์แปล) */
  name: string;
  /** วิธีได้ป้าย (ข้อความไทย ใช้เป็นคีย์แปล มี {n}) */
  how: string;
  target: number;
  progress: number;
  earned: boolean;
}

/** สถิติตลอดการเล่นที่ใช้คิดป้ายรางวัล */
export function lifetime(state: State, playerId: string) {
  let visits = 0;
  let games = 0;
  let bestDay = 0;
  let streak = 0;
  let bestStreak = 0;
  const days = [...state.days].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) {
    if (!d.checkIns.some((c) => c.playerId === playerId)) continue;
    visits++;
    let today = 0;
    for (const g of [...d.games].sort((a, b) => a.startedAt - b.startedAt)) {
      const i = g.playerIds.indexOf(playerId);
      if (i < 0 || !g.endedAt) continue;
      games++;
      today++;
      if (!g.winner) continue;
      streak = (g.winner === "A") === i < 2 ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
    }
    bestDay = Math.max(bestDay, today);
  }
  const monthlyMonths = Object.values(state.monthly).filter((m) => m[playerId]).length;
  return { visits, games, bestDay, bestStreak, monthlyMonths };
}

const BADGES: { id: string; name: string; how: string; target: number; stat: keyof ReturnType<typeof lifetime> }[] = [
  { id: "first", name: "มือใหม่หัดมา", how: "มาเล่นครั้งแรก", target: 1, stat: "visits" },
  { id: "regular", name: "ขาประจำ", how: "มาเล่นครบ {n} ครั้ง", target: 10, stat: "visits" },
  { id: "core", name: "ตัวจริงของก๊วน", how: "มาเล่นครบ {n} ครั้ง", target: 50, stat: "visits" },
  { id: "streak", name: "ไฟลุก", how: "ชนะติดกัน {n} เกม", target: 5, stat: "bestStreak" },
  { id: "marathon", name: "มาราธอน", how: "เล่น {n} เกมในวันเดียว", target: 10, stat: "bestDay" },
  { id: "hundred", name: "ร้อยเกม", how: "เล่นครบ {n} เกม", target: 100, stat: "games" },
  { id: "member", name: "สมาชิกขาจริง", how: "จ่ายรายเดือน {n} เดือน", target: 3, stat: "monthlyMonths" },
];

export function badgesFor(state: State, playerId: string): Badge[] {
  const s = lifetime(state, playerId);
  return BADGES.map((b) => {
    const progress = Math.min(s[b.stat], b.target);
    return { id: b.id, name: b.name, how: b.how, target: b.target, progress, earned: s[b.stat] >= b.target };
  });
}
