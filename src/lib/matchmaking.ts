import { activePairs } from "./social";
import { strength, type Day, type Player } from "./types";

export interface QueueEntry {
  player: Player;
  gamesPlayed: number;
  /** เวลาที่เริ่มรอ (จบเกมล่าสุด หรือเวลาเช็คอิน) */
  waitingSince: number;
}

/** สถานะคนที่เช็คอินแล้ววันนี้ */
export function presence(day: Day, playerId: string): "playing" | "resting" | "home" | "waiting" | "absent" {
  const ci = day.checkIns.find((c) => c.playerId === playerId);
  if (!ci) return "absent";
  if (day.games.some((g) => !g.endedAt && g.playerIds.includes(playerId))) return "playing";
  if (ci.paidAt) return "home";
  if (ci.resting) return "resting";
  return "waiting";
}

/**
 * ผู้เล่นที่เช็คอินแล้วและรอลงสนาม เรียงตามสิทธิ์ลงก่อน
 * ไม่รวมคนที่อยู่บนสนาม คนขอพัก และคนที่จ่ายเงินแล้ว (ถือว่ากลับบ้าน)
 */
export function waitingQueue(day: Day, players: Player[]): QueueEntry[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const onCourt = new Set(day.games.filter((g) => !g.endedAt).flatMap((g) => g.playerIds));

  const entries: QueueEntry[] = [];
  for (const ci of day.checkIns) {
    const player = byId.get(ci.playerId);
    if (!player || onCourt.has(player.id) || ci.paidAt || ci.resting) continue;
    const played = day.games.filter((g) => g.endedAt && g.playerIds.includes(player.id));
    const lastEnd = Math.max(ci.at, ...played.map((g) => g.endedAt!));
    entries.push({ player, gamesPlayed: played.length, waitingSince: lastEnd });
  }
  // เล่นน้อยได้ก่อน ถ้าเท่ากัน รอนานได้ก่อน
  return entries.sort((a, b) => a.gamesPlayed - b.gamesPlayed || a.waitingSince - b.waitingSince);
}

/** ดูย้อนหลังกี่วัน และน้ำหนักลดลงครึ่งหนึ่งทุกกี่วัน */
const HISTORY_DAYS = 60;
const HALF_LIFE_DAYS = 14;

export interface PairHistory {
  /** เคยอยู่ทีมเดียวกันกี่ครั้ง (ถ่วงน้ำหนัก) */
  partners: Map<string, number>;
  /** เคยอยู่คนละฝั่งกี่ครั้ง (ถ่วงน้ำหนัก) */
  opponents: Map<string, number>;
}

function pairKey(x: string, y: string) {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/**
 * สถิติคู่จากเกมที่บันทึกไว้: วันนี้นับเต็ม 1 ต่อเกม
 * วันก่อน ๆ นับน้อยลงตามระยะเวลา (เมื่อวาน ~0.5 สองสัปดาห์ก่อน 0.25) เกิน 60 วันไม่นับ
 */
export function pairHistory(day: Day, past: Day[] = []): PairHistory {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const add = (m: Map<string, number>, x: string, y: string, w: number) => m.set(pairKey(x, y), (m.get(pairKey(x, y)) ?? 0) + w);
  const count = (games: Day["games"], w: number) => {
    for (const [a1, a2, b1, b2] of games.map((g) => g.playerIds)) {
      add(partners, a1, a2, w);
      add(partners, b1, b2, w);
      for (const a of [a1, a2]) for (const b of [b1, b2]) add(opponents, a, b, w);
    }
  };
  count(day.games, 1);
  const now = Date.parse(day.date);
  for (const d of past) {
    const ago = (now - Date.parse(d.date)) / 86_400_000;
    if (!(ago >= 1 && ago <= HISTORY_DAYS)) continue;
    count(d.games, 0.5 ** (1 + ago / HALF_LIFE_DAYS));
  }
  return { partners, opponents };
}

const wants = (a: Player, b: Player) => Boolean(a.prefer?.includes(b.id) || b.prefer?.includes(a.id));
const avoids = (a: Player, b: Player) => Boolean(a.avoid?.includes(b.id) || b.avoid?.includes(a.id));

/** มีคู่ใน 4 คนนี้ที่ไม่อยากเจอกันไหม */
export function hasAvoid(four: Player[]): boolean {
  return four.some((a, i) => four.slice(i + 1).some((b) => avoids(a, b)));
}

/** แบ่ง 4 คนเป็น 2 ทีมให้ฝีมือรวมใกล้กันที่สุด ไม่ซ้ำคู่และคู่แข่งเดิม และให้คนที่ขอคู่กันได้อยู่ทีมเดียวกัน */
export function splitTeams(
  four: Player[],
  partners: Map<string, number> = new Map(),
  pairs: [string, string][] = [],
  opponents: Map<string, number> = new Map(),
): { teams: [string, string, string, string]; cost: number } {
  const paired = (a: Player, b: Player) => pairs.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id));
  const [p0, p1, p2, p3] = four;
  const options: [Player, Player, Player, Player][] = [
    [p0, p1, p2, p3],
    [p0, p2, p1, p3],
    [p0, p3, p1, p2],
  ];
  let best = { teams: options[0].map((p) => p.id) as [string, string, string, string], cost: Infinity };
  for (const [a1, a2, b1, b2] of options) {
    const gap = Math.abs(strength(a1.level) + strength(a2.level) - (strength(b1.level) + strength(b2.level)));
    const repeat =
      (partners.get(pairKey(a1.id, a2.id)) ?? 0) + (partners.get(pairKey(b1.id, b2.id)) ?? 0);
    const faced = [a1, a2].reduce((n, a) => n + [b1, b2].reduce((m, b) => m + (opponents.get(pairKey(a.id, b.id)) ?? 0), 0), 0);
    const liked = Number(wants(a1, a2)) + Number(wants(b1, b2));
    // ขอจับคู่กันไว้ (ตอบรับแล้ว) ต้องอยู่ทีมเดียวกัน
    const together = Number(paired(a1, a2)) + Number(paired(b1, b2));
    const cost = gap * 10 + repeat * 4 + faced * 2 - liked * 6 - together * 200;
    if (cost < best.cost) best = { teams: [a1.id, a2.id, b1.id, b2.id], cost };
  }
  return best;
}

/**
 * เลือก 4 คนลงสนามถัดไป
 * คนแรกของคิวได้ลงแน่นอน อีก 3 คนเลือกจากคนต้นคิว (window) ให้ฝีมือใกล้กันและไม่ซ้ำคู่
 * past = วันก่อน ๆ (state.days) ใช้ถ่วงน้ำหนักไม่ให้เจอคนเดิมบ่อยเกินไป
 */
export function nextMatch(
  day: Day,
  players: Player[],
  window = 8,
  past: Day[] = [],
): [string, string, string, string] | null {
  const queue = waitingQueue(day, players);
  if (queue.length < 4) return null;

  const head = queue[0].player;
  const pairs = activePairs(day).map((r) => [r.from, r.to] as [string, string]);
  // คู่ที่ขอไว้ของคนต้นคิว ดึงเข้ามาพิจารณาด้วยแม้อยู่ท้ายคิว
  const mates = new Set(pairs.flatMap(([a, b]) => (a === head.id ? [b] : b === head.id ? [a] : [])));
  const pool = queue
    .slice(1)
    .map((e, i) => ({ p: e.player, rank: i + 1 }))
    .filter((x) => x.rank < Math.max(4, window) || mates.has(x.p.id));
  const { partners, opponents } = pairHistory(day, past);

  let best: { teams: [string, string, string, string]; score: number } | null = null;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const four = [head, pool[i].p, pool[j].p, pool[k].p];
        const levels = four.map((p) => strength(p.level));
        const spread = Math.max(...levels) - Math.min(...levels);
        const split = splitTeams(four, partners, pairs, opponents);
        // ได้ลงพร้อมคู่ที่ขอไว้ = ดีมาก
        const ids = new Set(four.map((p) => p.id));
        const pairBonus = pairs.filter(([a, b]) => ids.has(a) && ids.has(b)).length * 40;
        // ให้น้ำหนักกับลำดับคิว เพื่อไม่ให้คนรอนานถูกข้าม
        const waitPenalty = pool[i].rank + pool[j].rank + pool[k].rank;
        // คนที่ไม่อยากเจอกัน เลี่ยงให้มากที่สุด แต่ถ้าไม่มีทางเลือกก็ยังจัดได้
        const score = split.cost + spread * 3 + waitPenalty * 2 + (hasAvoid(four) ? 1000 : 0) - pairBonus;
        if (!best || score < best.score) best = { teams: split.teams, score };
      }
  return best!.teams;
}
