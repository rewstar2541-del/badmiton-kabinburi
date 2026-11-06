import { activePairs } from "./social";
import { strength, type Day, type Player, type QueuedGame } from "./types";

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

/** คิวรอลงของสนามนี้ เรียงตามที่จัดไว้ก่อน */
export function courtQueue(day: Day, court: number): QueuedGame[] {
  return (day.queued ?? []).filter((q) => q.court === court).sort((a, b) => a.at - b.at);
}

/** ผู้เล่นคนนี้ถูกจัดคิวรอสนามไหน ลำดับที่เท่าไร (1 = ลงต่อจากเกมที่เล่นอยู่) */
export function queuedSpot(day: Day, playerId: string): { court: number; pos: number; game: QueuedGame } | null {
  for (const q of day.queued ?? [])
    if (q.playerIds.includes(playerId)) return { court: q.court, pos: courtQueue(day, q.court).indexOf(q) + 1, game: q };
  return null;
}

/**
 * คนในคู่ที่จัดไว้ที่ยังลงไม่ได้ตอนนี้ (ยังไม่เช็คอิน จ่ายแล้ว ขอพัก หรืออยู่บนสนามอื่น)
 * endingGameId: เกมที่กำลังจะจบ ไม่นับว่าคนในเกมนั้นยังอยู่บนสนาม
 */
export function queueBlockers(day: Day, q: Pick<QueuedGame, "playerIds">, endingGameId?: string): string[] {
  const onCourt = new Set(day.games.filter((g) => !g.endedAt && g.id !== endingGameId).flatMap((g) => g.playerIds));
  return q.playerIds.filter((id) => {
    const ci = day.checkIns.find((c) => c.playerId === id);
    return !ci || ci.paidAt || ci.resting || onCourt.has(id);
  });
}

/**
 * ผู้เล่นที่เช็คอินแล้วและรอลงสนาม เรียงตามสิทธิ์ลงก่อน
 * ไม่รวมคนที่อยู่บนสนาม คนที่จัดคิวสนามไว้แล้ว คนขอพัก และคนที่จ่ายเงินแล้ว (ถือว่ากลับบ้าน)
 */
export function waitingQueue(day: Day, players: Player[]): QueueEntry[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const onCourt = new Set([...day.games.filter((g) => !g.endedAt).flatMap((g) => g.playerIds), ...(day.queued ?? []).flatMap((q) => q.playerIds)]);

  const entries: QueueEntry[] = [];
  for (const ci of day.checkIns) {
    const player = byId.get(ci.playerId);
    if (!player || onCourt.has(player.id) || ci.paidAt || ci.resting) continue;
    // เกมที่ลงจากสนามแล้ว: เกมจบ หรือถูกเปลี่ยนตัวออก (เวลาลงจากสนาม = ตอนเปลี่ยนตัว)
    const left = day.games.flatMap((g) => {
      const out = g.subs?.filter((s) => s.out === player.id).at(-1);
      if (out && !g.playerIds.includes(player.id)) return [out.at];
      return g.endedAt && g.playerIds.includes(player.id) ? [g.endedAt] : [];
    });
    const lastEnd = Math.max(ci.at, ...left);
    entries.push({ player, gamesPlayed: left.length, waitingSince: lastEnd });
  }
  // เล่นน้อยได้ก่อน ถ้าเท่ากัน รอนานได้ก่อน
  return entries.sort((a, b) => a.gamesPlayed - b.gamesPlayed || a.waitingSince - b.waitingSince);
}

/** จำนวนครั้งที่ a กับ b เคยอยู่ทีมเดียวกันวันนี้ */
function partnerCounts(day: Day): Map<string, number> {
  const m = new Map<string, number>();
  const add = (x: string, y: string) => {
    const k = x < y ? `${x}|${y}` : `${y}|${x}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  // คู่ที่จัดคิวรอไว้ก็นับ จะได้ไม่จับคู่เดิมซ้ำในคิวถัดๆ ไป
  for (const g of [...day.games, ...(day.queued ?? [])]) {
    add(g.playerIds[0], g.playerIds[1]);
    add(g.playerIds[2], g.playerIds[3]);
  }
  return m;
}

function pairKey(x: string, y: string) {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

const wants = (a: Player, b: Player) => Boolean(a.prefer?.includes(b.id) || b.prefer?.includes(a.id));
const avoids = (a: Player, b: Player) => Boolean(a.avoid?.includes(b.id) || b.avoid?.includes(a.id));

/** มีคู่ใน 4 คนนี้ที่ไม่อยากเจอกันไหม */
export function hasAvoid(four: Player[]): boolean {
  return four.some((a, i) => four.slice(i + 1).some((b) => avoids(a, b)));
}

/** แบ่ง 4 คนเป็น 2 ทีมให้ฝีมือรวมใกล้กันที่สุด ไม่ซ้ำคู่เดิม และให้คนที่ขอคู่กันได้อยู่ทีมเดียวกัน */
export function splitTeams(
  four: Player[],
  partners: Map<string, number> = new Map(),
  pairs: [string, string][] = [],
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
    const liked = Number(wants(a1, a2)) + Number(wants(b1, b2));
    // ขอจับคู่กันไว้ (ตอบรับแล้ว) ต้องอยู่ทีมเดียวกัน
    const together = Number(paired(a1, a2)) + Number(paired(b1, b2));
    const cost = gap * 10 + repeat * 4 - liked * 6 - together * 200;
    if (cost < best.cost) best = { teams: [a1.id, a2.id, b1.id, b2.id], cost };
  }
  return best;
}

/** จำนวนครั้งที่ a กับ b เคยอยู่เกมเดียวกันวันนี้ (คู่หูหรือคู่แข่ง) รวมคิวที่จัดไว้ */
function metCounts(day: Day): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of [...day.games, ...(day.queued ?? [])])
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const k = pairKey(g.playerIds[i], g.playerIds[j]);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
  return m;
}

/**
 * เลือก 4 คนลงสนามถัดไป
 * คนแรกของคิวได้ลงแน่นอน อีก 3 คนเลือกจากคนต้นคิว (window) ให้ฝีมือใกล้กันและไม่เจอคนเดิมซ้ำ
 * shown: ชุดที่เคยแนะนำไปแล้ว (กด "แนะนำใหม่") จะได้คนชุดใหม่ ไม่วนกลับมาชุดเดิม
 */
export function nextMatch(
  day: Day,
  players: Player[],
  window = 8,
  shown: string[][] = [],
): [string, string, string, string] | null {
  const queue = waitingQueue(day, players);
  if (queue.length < 4) return null;

  const head = queue[0].player;
  const pairs = activePairs(day).map((r) => [r.from, r.to] as [string, string]);
  // คู่ที่ขอไว้ของคนต้นคิว ดึงเข้ามาพิจารณาด้วยแม้อยู่ท้ายคิว
  const mates = new Set(pairs.flatMap(([a, b]) => (a === head.id ? [b] : b === head.id ? [a] : [])));
  // กดแนะนำใหม่หลายครั้ง ขยายวงให้มีคนใหม่ให้เลือก
  const reach = Math.max(4, window + shown.length * 3);
  const pool = queue
    .slice(1)
    .map((e, i) => ({ p: e.player, rank: i + 1 }))
    .filter((x) => x.rank < reach || mates.has(x.p.id));
  const partners = partnerCounts(day);
  const met = metCounts(day);
  const shownSets = shown.map((ids) => new Set(ids));

  let best: { teams: [string, string, string, string]; score: number } | null = null;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const four = [head, pool[i].p, pool[j].p, pool[k].p];
        const levels = four.map((p) => strength(p.level));
        const spread = Math.max(...levels) - Math.min(...levels);
        const split = splitTeams(four, partners, pairs);
        // ได้ลงพร้อมคู่ที่ขอไว้ = ดีมาก
        const ids = new Set(four.map((p) => p.id));
        const pairBonus = pairs.filter(([a, b]) => ids.has(a) && ids.has(b)).length * 40;
        // ให้น้ำหนักกับลำดับคิว เพื่อไม่ให้คนรอนานถูกข้าม
        const waitPenalty = pool[i].rank + pool[j].rank + pool[k].rank;
        // เคยเจอกันในเกมวันนี้แล้ว (ทั้งคู่หูและคู่แข่ง) ยิ่งเจอบ่อยยิ่งเลี่ยง
        let seen = 0;
        for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) seen += met.get(pairKey(four[x].id, four[y].id)) ?? 0;
        // ชุดที่แนะนำไปแล้ว: ซ้ำคนเดิมมาก = ไม่เอา
        const again = shownSets.reduce((n, set) => n + Math.max(0, four.filter((p) => set.has(p.id)).length - 1) ** 2, 0);
        // คนที่ไม่อยากเจอกัน เลี่ยงให้มากที่สุด แต่ถ้าไม่มีทางเลือกก็ยังจัดได้
        const score = split.cost + spread * 3 + waitPenalty * 2 + seen * 5 + again * 15 + (hasAvoid(four) ? 1000 : 0) - pairBonus;
        if (!best || score < best.score) best = { teams: split.teams, score };
      }
  return best!.teams;
}

/** คู่ถัดไปของแต่ละสนาม: คู่ที่แอดมินจัดไว้ (queuedId) หรือคู่ที่ระบบจัดให้อัตโนมัติจากคิวรวม */
export interface CourtNext {
  court: number;
  playerIds: [string, string, string, string];
  /** มี = แอดมินจัด/แก้ไว้ (เก็บในฐานข้อมูล) ไม่มี = ระบบจัดอัตโนมัติ */
  queuedId?: string;
}

/**
 * แบ่งคิวรวมขึ้นรอแต่ละสนามอัตโนมัติ: คิว 1-4 ไปสนามที่น่าจะว่างก่อนสุด, 5-8 สนามถัดไป, ...
 * ลำดับสนาม = สนามว่างก่อน (เลขน้อยก่อน) แล้วสนามที่เริ่มเกมก่อน (น่าจะจบก่อน)
 * first: สนามที่กำลังจะจบเกม ให้ได้คู่แรก (คนที่รอนานสุดได้ลงก่อน ไม่ถูกแซง)
 * สนามที่แอดมินจัดคิวไว้เองใช้คู่นั้น ไม่เอาคนจากคิวรวม
 */
export function courtPlan(day: Day, players: Player[], courts: number | number[], first?: number): Map<number, CourtNext> {
  const started = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g.startedAt]));
  // courts = จำนวนสนาม (1..n) หรือเบอร์สนามที่ตั้งไว้ + สนามที่แอดมินจัดคิวค้างไว้ (เผื่อเปลี่ยนเบอร์ระหว่างวัน)
  const list = typeof courts === "number" ? Array.from({ length: courts }, (_, i) => i + 1) : courts;
  const order = [...new Set([...list, ...(day.queued ?? []).map((q) => q.court)])].sort(
    (a, b) => Number(b === first) - Number(a === first) || (started.get(a) ?? -Infinity) - (started.get(b) ?? -Infinity) || a - b,
  );
  const plan = new Map<number, CourtNext>();
  let d = day;
  for (const c of order) {
    const own = courtQueue(day, c)[0];
    if (own) {
      plan.set(c, { court: c, playerIds: own.playerIds, queuedId: own.id });
      continue;
    }
    const m = nextMatch(d, players);
    if (!m) continue;
    plan.set(c, { court: c, playerIds: m });
    // คนที่จัดให้สนามนี้แล้ว ไม่อยู่ในคิวรวมสำหรับสนามถัดไป
    d = { ...d, queued: [...(d.queued ?? []), { id: `plan-${c}`, court: c, playerIds: m, at: Infinity }] };
  }
  return plan;
}

/** ผู้เล่นคนนี้รอลงสนามไหน (แอดมินจัดไว้ หรือระบบจัดอัตโนมัติ) */
export function plannedCourt(plan: Map<number, CourtNext>, playerId: string): CourtNext | null {
  for (const n of plan.values()) if (n.playerIds.includes(playerId)) return n;
  return null;
}

/**
 * เรียงคิวรวมตามสนามที่ระบบจัดให้ (คิว 1-4 = สนามแรกที่จะว่าง, 5-8 = สนามถัดไป ...) คนที่ยังไม่ได้สนามต่อท้ายตามลำดับเดิม
 * ในแต่ละสนามเรียงตามทีม (ทีม A แล้วทีม B)
 */
export function queueByCourt(queue: QueueEntry[], plan: Map<number, CourtNext>): QueueEntry[] {
  const rank = new Map<string, number>();
  // ตามลำดับที่ระบบแจก (สนามที่น่าจะว่างก่อนอยู่บน)
  [...plan.values()].filter((n) => !n.queuedId).forEach((n, k) => n.playerIds.forEach((id, i) => rank.set(id, k * 10 + i)));
  const base = new Map(queue.map((e, i) => [e.player.id, i]));
  return [...queue].sort((a, b) => (rank.get(a.player.id) ?? 1e6 + base.get(a.player.id)!) - (rank.get(b.player.id) ?? 1e6 + base.get(b.player.id)!));
}
