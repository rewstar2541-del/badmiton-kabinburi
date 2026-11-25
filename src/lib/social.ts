import type { State } from "./state";
import type { Day, Game, PairRequest } from "./types";

/** สองคนนี้อยู่ทีมเดียวกันในเกมนี้ไหม */
export function sameTeam(g: Game, a: string, b: string): boolean {
  const [a1, a2, b1, b2] = g.playerIds;
  return (a1 === a && a2 === b) || (a1 === b && a2 === a) || (b1 === a && b2 === b) || (b1 === b && b2 === a);
}

/** คำขอจับคู่ที่ตอบรับแล้วและยังไม่ได้ลงเล่นคู่กัน (ได้คู่กันหนึ่งเกมแล้วถือว่าครบ) */
export function activePairs(day: Day): PairRequest[] {
  return (day.pairs ?? []).filter(
    (r) => r.status === "accepted" && !day.games.some((g) => g.startedAt >= r.at && sameTeam(g, r.from, r.to)),
  );
}

/** คำขอที่เกี่ยวกับคนนี้ที่ยังค้างอยู่ (รอตอบ หรือตอบรับแล้วยังไม่ได้เล่น) */
export function myPair(day: Day, playerId: string): PairRequest | undefined {
  const active = new Set(activePairs(day).map((r) => r.id));
  return (day.pairs ?? [])
    .filter((r) => (r.from === playerId || r.to === playerId) && (r.status === "pending" || active.has(r.id)))
    .sort((a, b) => b.at - a.at)[0];
}

export interface MateStat {
  id: string;
  games: number;
  wins: number;
}

/** สถิติคู่หูจากเกมที่บันทึกผลแพ้ชนะ: ตีคู่กับใครชนะบ่อย และเจอใครแพ้บ่อย */
export function partnerStats(state: State, playerId: string): { partners: MateStat[]; rivals: MateStat[]; decided: number } {
  const partners = new Map<string, MateStat>();
  const rivals = new Map<string, MateStat>();
  let decided = 0;
  const add = (m: Map<string, MateStat>, id: string, win: boolean) => {
    const x = m.get(id) ?? { id, games: 0, wins: 0 };
    x.games++;
    if (win) x.wins++;
    m.set(id, x);
  };
  for (const d of state.days)
    for (const g of d.games) {
      const i = g.playerIds.indexOf(playerId);
      if (i < 0 || !g.winner) continue;
      decided++;
      const teamA = i < 2;
      const win = (g.winner === "A") === teamA;
      const mate = g.playerIds[teamA ? 1 - i : 5 - i];
      add(partners, mate, win);
      for (const o of teamA ? g.playerIds.slice(2) : g.playerIds.slice(0, 2)) add(rivals, o, win);
    }
  const byWins = (a: MateStat, b: MateStat) => b.wins - a.wins || b.games - a.games;
  // คู่แข่ง: เรียงตามจำนวนครั้งที่เราแพ้
  const byLosses = (a: MateStat, b: MateStat) => b.games - b.wins - (a.games - a.wins) || b.games - a.games;
  return { partners: [...partners.values()].sort(byWins), rivals: [...rivals.values()].sort(byLosses), decided };
}

export interface Record3 {
  games: number;
  wins: number;
  losses: number;
}

export interface HeadToHead {
  id: string;
  /** ตีคู่กัน (ทีมเดียวกัน) */
  with: Record3;
  /** เจอกัน (อยู่คนละทีม) */
  vs: Record3;
}

/**
 * สถิติเจอกัน: คนนี้เคยตีคู่กับใคร/เจอใครกี่เกม ชนะแพ้เท่าไร
 * นับเฉพาะเกมที่จบแล้ว (เกมที่ไม่ได้กดผล/เสมอ นับเป็นเกม แต่ไม่นับชนะแพ้)
 * เรียงคนที่เล่นด้วยกันบ่อยสุดก่อน
 */
export function headToHead(state: State, playerId: string): HeadToHead[] {
  const m = new Map<string, HeadToHead>();
  const rec = (id: string) => {
    let x = m.get(id);
    if (!x) m.set(id, (x = { id, with: { games: 0, wins: 0, losses: 0 }, vs: { games: 0, wins: 0, losses: 0 } }));
    return x;
  };
  const tally = (r: Record3, result: "win" | "loss" | null) => {
    r.games++;
    if (result === "win") r.wins++;
    else if (result === "loss") r.losses++;
  };
  for (const d of state.days)
    for (const g of d.games) {
      const i = g.playerIds.indexOf(playerId);
      if (i < 0 || !g.endedAt) continue;
      const teamA = i < 2;
      const result = g.winner ? ((g.winner === "A") === teamA ? "win" : "loss") : null;
      const mate = g.playerIds[teamA ? 1 - i : 5 - i];
      if (mate && mate !== playerId) tally(rec(mate).with, result);
      for (const o of teamA ? g.playerIds.slice(2) : g.playerIds.slice(0, 2)) if (o && o !== playerId) tally(rec(o).vs, result);
    }
  const total = (x: HeadToHead) => x.with.games + x.vs.games;
  return [...m.values()].sort((a, b) => total(b) - total(a) || b.vs.games - a.vs.games || a.id.localeCompare(b.id));
}

export type GameResult = "win" | "loss" | "draw" | "playing" | "unknown";

export interface HistoryGame {
  date: string;
  game: Game;
  mate: string;
  opponents: [string, string];
  result: GameResult;
}

/** ประวัติการเล่นของคนนี้ ใหม่สุดก่อน: คู่กับใคร เจอใคร ผลเป็นอย่างไร */
export function gameHistory(state: State, playerId: string): HistoryGame[] {
  const out: HistoryGame[] = [];
  for (const d of state.days)
    for (const g of d.games) {
      const i = g.playerIds.indexOf(playerId);
      if (i < 0) continue;
      const teamA = i < 2;
      const result: GameResult = !g.endedAt
        ? "playing"
        : g.winner
          ? (g.winner === "A") === teamA
            ? "win"
            : "loss"
          : g.draw
            ? "draw"
            : "unknown";
      const opp = teamA ? g.playerIds.slice(2) : g.playerIds.slice(0, 2);
      out.push({ date: d.date, game: g, mate: g.playerIds[teamA ? 1 - i : 5 - i], opponents: [opp[0], opp[1]], result });
    }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.game.startedAt - a.game.startedAt);
}

/**
 * จำกัดจำนวนคนลงชื่อ: คนที่ลงชื่อก่อนตามจำนวนที่รับได้ที่ ที่เหลือเป็นรายชื่อสำรอง
 * มีคนยกเลิก คนสำรองลำดับแรกเลื่อนขึ้นเอง (คำนวณจากลำดับการลงชื่อ ไม่ต้องเก็บสถานะ)
 */
export function signupQueue(day: Day) {
  const list = [...(day.signups ?? [])].sort((a, b) => a.at - b.at || (a.playerId < b.playerId ? -1 : 1)).map((s) => s.playerId);
  const cap = day.announcementCap;
  if (!cap) return { cap: undefined, confirmed: list, waiting: [] as string[] };
  return { cap, confirmed: list.slice(0, cap), waiting: list.slice(cap) };
}

/** ลำดับสำรอง (1 = คนแรก) หรือ 0 ถ้าได้ที่แล้ว/ไม่ได้ลงชื่อ */
export function waitingPosition(day: Day, playerId: string) {
  return signupQueue(day).waiting.indexOf(playerId) + 1;
}

/** ผู้เล่นเช็คอินเองได้ไหม (ตรงกับ signup_cap_guard ในฐานข้อมูล) */
export function canSelfCheckIn(day: Day, playerId: string) {
  const q = signupQueue(day);
  if (!q.cap || q.confirmed.includes(playerId)) return true;
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const taken = checked.size + q.confirmed.filter((id) => !checked.has(id)).length;
  return taken < q.cap;
}
