import type { State } from "./state";
import { strength, type Day, type Game, type Player } from "./types";

const K = 32;

/** แต้มเริ่มต้นตามระดับมือ (มือใหม่ 950 ถึงเก่ง 1150) */
export const startRating = (p?: Player) => Math.round(900 + strength(p?.level ?? 3) * 50);

const decided = (days: Day[]) =>
  days
    .flatMap((d) => d.games.filter((g) => g.endedAt && g.winner).map((g) => ({ g, date: d.date })))
    .sort((a, b) => (a.g.endedAt ?? 0) - (b.g.endedAt ?? 0));

export interface RankRow {
  id: string;
  /** แต้มรวมตอนจบช่วงที่ดู */
  rating: number;
  /** แต้มที่ขึ้น/ลงในเดือนที่ดู */
  delta: number;
  games: number;
  wins: number;
}

/**
 * อันดับรายเดือนแบบ Elo: ชนะได้แต้ม แพ้เสียแต้ม ชนะทีมที่เก่งกว่าได้มากกว่า
 * แต้มสะสมต่อเนื่องทุกเดือน อันดับของเดือนเรียงจากแต้มที่ได้ในเดือนนั้น
 */
export function monthRanking(state: Pick<State, "days" | "players">, month: string): RankRow[] {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const rating = new Map<string, number>();
  const r = (id: string) => rating.get(id) ?? startRating(byId.get(id));
  const rows = new Map<string, RankRow>();
  for (const { g, date } of decided(state.days)) {
    if (date.slice(0, 7) > month) break;
    const [a1, a2, b1, b2] = g.playerIds;
    const ra = (r(a1) + r(a2)) / 2;
    const rb = (r(b1) + r(b2)) / 2;
    const expectA = 1 / (1 + 10 ** ((rb - ra) / 400));
    const scoreA = g.winner === "A" ? 1 : 0;
    const change = K * (scoreA - expectA);
    g.playerIds.forEach((id, i) => {
      const d = i < 2 ? change : -change;
      rating.set(id, r(id) + d);
      if (date.slice(0, 7) !== month) return;
      const row = rows.get(id) ?? { id, rating: 0, delta: 0, games: 0, wins: 0 };
      row.delta += d;
      row.games++;
      if ((g.winner === "A") === i < 2) row.wins++;
      rows.set(id, row);
    });
  }
  return [...rows.values()]
    .filter((x) => byId.has(x.id) && !byId.get(x.id)!.guestOf)
    .map((x) => ({ ...x, rating: Math.round(r(x.id)), delta: Math.round(x.delta) }))
    .sort((a, b) => b.delta - a.delta || b.wins - a.wins || b.rating - a.rating);
}

/** คนที่วันเกิดตรงกับวันที่ (YYYY-MM-DD) */
export function birthdays(players: Player[], date: string): Player[] {
  const md = date.slice(5);
  return players.filter((p) => p.birthday === md && !p.guestOf && !p.pending);
}

export interface YearSummary {
  year: string;
  sessions: number;
  games: number;
  shuttles: number;
  players: number;
  visits: number;
  topVisitors: { id: string; n: number }[];
  topGames: { id: string; n: number }[];
  topWinners: { id: string; n: number; games: number }[];
  bestDuo?: { ids: [string, string]; wins: number; games: number };
  busiestDay?: { date: string; players: number };
  longestGame?: { game: Game; date: string; minutes: number };
}

const top = (m: Map<string, number>, n = 5) =>
  [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, v]) => ({ id, n: v }));

/** สรุปก๊วนรายปี ปี ค.ศ. (YYYY) */
export function yearSummary(state: Pick<State, "days" | "players">, year: string): YearSummary {
  const guests = new Set(state.players.filter((p) => p.guestOf).map((p) => p.id));
  const days = state.days.filter((d) => d.date.startsWith(year) && d.checkIns.length);
  const visits = new Map<string, number>();
  const games = new Map<string, number>();
  const wins = new Map<string, number>();
  const decidedGames = new Map<string, number>();
  const duo = new Map<string, { wins: number; games: number }>();
  let gameCount = 0;
  let shuttles = 0;
  let visitCount = 0;
  let busiest: YearSummary["busiestDay"];
  let longest: YearSummary["longestGame"];
  for (const d of days) {
    const members = d.checkIns.filter((c) => !guests.has(c.playerId));
    visitCount += members.length;
    for (const c of members) visits.set(c.playerId, (visits.get(c.playerId) ?? 0) + 1);
    if (!busiest || members.length > busiest.players) busiest = { date: d.date, players: members.length };
    for (const g of d.games) {
      if (!g.endedAt) continue;
      gameCount++;
      shuttles += g.shuttles;
      const minutes = Math.round((g.endedAt - g.startedAt) / 60000);
      if (minutes < 90 && (!longest || minutes > longest.minutes)) longest = { game: g, date: d.date, minutes };
      g.playerIds.forEach((id, i) => {
        if (guests.has(id)) return;
        games.set(id, (games.get(id) ?? 0) + 1);
        if (!g.winner) return;
        decidedGames.set(id, (decidedGames.get(id) ?? 0) + 1);
        if ((g.winner === "A") === i < 2) wins.set(id, (wins.get(id) ?? 0) + 1);
      });
      if (!g.winner) continue;
      for (const [x, y, team] of [[g.playerIds[0], g.playerIds[1], "A"], [g.playerIds[2], g.playerIds[3], "B"]] as const) {
        if (guests.has(x) || guests.has(y)) continue;
        const key = [x, y].sort().join("|");
        const v = duo.get(key) ?? { wins: 0, games: 0 };
        v.games++;
        if (g.winner === team) v.wins++;
        duo.set(key, v);
      }
    }
  }
  const bestDuo = [...duo]
    .filter(([, v]) => v.games >= 3)
    .sort((a, b) => b[1].wins - a[1].wins || b[1].wins / b[1].games - a[1].wins / a[1].games)[0];
  return {
    year,
    sessions: days.length,
    games: gameCount,
    shuttles,
    players: visits.size,
    visits: visitCount,
    topVisitors: top(visits),
    topGames: top(games, 3),
    topWinners: top(wins, 3).map((x) => ({ ...x, games: decidedGames.get(x.id) ?? 0 })),
    bestDuo: bestDuo ? { ids: bestDuo[0].split("|") as [string, string], ...bestDuo[1] } : undefined,
    busiestDay: busiest,
    longestGame: longest,
  };
}
