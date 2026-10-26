import type { Day, Game } from "./types";

/** ดาวที่ให้ได้ 1-5 */
export function clampStars(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** เกมล่าสุดวันนี้ที่คนนี้เล่นจบแล้ว (ใช้ถามคะแนนหลังเล่น) */
export function lastFinishedGame(day: Day, playerId: string): Game | undefined {
  return day.games
    .filter((g) => g.endedAt && g.playerIds.includes(playerId))
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
}

export interface RatedGame {
  game: Game;
  avg: number;
  count: number;
}

/** เกมที่ได้คะแนนเฉลี่ยไม่เกินนี้ ถือว่าคู่ไม่เหมาะ แสดงให้แอดมินดู */
export const LOW_RATING = 2.5;

/** สรุปคะแนนของวัน: เฉลี่ยทั้งวัน จำนวนครั้งที่ให้ เกมที่มีคะแนน/เกมที่จบแล้ว และเกมที่ได้คะแนนต่ำ (ต่ำสุดก่อน) */
export function daySummary(day: Day): { avg: number; count: number; games: number; finished: number; low: RatedGame[] } {
  const rated: RatedGame[] = [];
  let sum = 0;
  let count = 0;
  for (const game of day.games) {
    const stars = Object.values(game.ratings ?? {});
    if (!stars.length) continue;
    const total = stars.reduce((a, b) => a + b, 0);
    sum += total;
    count += stars.length;
    rated.push({ game, avg: total / stars.length, count: stars.length });
  }
  return {
    avg: count ? sum / count : 0,
    count,
    games: rated.length,
    finished: day.games.filter((g) => g.endedAt).length,
    low: rated.filter((r) => r.avg <= LOW_RATING).sort((a, b) => a.avg - b.avg || a.game.startedAt - b.game.startedAt),
  };
}
