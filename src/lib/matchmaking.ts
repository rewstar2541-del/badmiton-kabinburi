import { activePairs } from "./social";
import { DEFAULT_LEVEL, courtList, strength, type Day, type Player, type QueuedGame, type Settings } from "./types";

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

/** ฟอร์มวันนี้ปรับฝีมือได้มากสุดเท่านี้ (ครึ่งระดับมือ) ระดับมือที่แอดมินตั้งยังเป็นหลัก */
export const FORM_CAP = 0.5;
/** ฟอร์มถึงเท่านี้ขึ้นเครื่องหมาย ▲▼ ในหน้าจัดคู่ */
export const FORM_MARK = 0.25;

/**
 * ฟอร์มวันนี้ของแต่ละคน (-0.5 ถึง +0.5 ระดับ) จากผลแพ้ชนะของเกมที่จบแล้ววันนี้
 * ชนะทีมที่เก่งกว่า = ขึ้นมาก ชนะทีมที่อ่อนกว่า = ขึ้นนิดเดียว (แพ้ก็กลับกัน) เสมอ/ไม่กดผลไม่นับ
 * ใช้ให้คนที่ชนะติดๆ กันได้เจอทีมที่แข็งขึ้น เกมจะได้สูสีทั้งสองฝั่ง
 */
export function formToday(day: Day, players: Player[]): Map<string, number> {
  const byId = new Map(players.map((p) => [p.id, p]));
  const lv = (id: string) => strength(byId.get(id)?.level ?? DEFAULT_LEVEL);
  const delta = new Map<string, number>();
  for (const g of day.games) {
    if (!g.endedAt || !g.winner || g.draw) continue;
    const [a1, a2, b1, b2] = g.playerIds;
    // โอกาสที่ทีม A ชนะ ตามระดับมือรวม (ห่าง 2 ระดับ ≈ 76%)
    const expA = 1 / (1 + 10 ** ((lv(b1) + lv(b2) - lv(a1) - lv(a2)) / 4));
    const scoreA = g.winner === "A" ? 1 : 0;
    for (const [id, d] of [[a1, scoreA - expA], [a2, scoreA - expA], [b1, expA - scoreA], [b2, expA - scoreA]] as [string, number][])
      delta.set(id, (delta.get(id) ?? 0) + d);
  }
  const form = new Map<string, number>();
  for (const [id, d] of delta) form.set(id, Math.max(-FORM_CAP, Math.min(FORM_CAP, d * 0.25)));
  return form;
}

/** ฝีมือที่ใช้จัดคู่ = ระดับมือ + ฟอร์มวันนี้ */
export function skillOf(p: Player, form?: Map<string, number>): number {
  return strength(p.level) + (form?.get(p.id) ?? 0);
}

/** แบ่ง 4 คนเป็น 2 ทีมให้ฝีมือรวมใกล้กันที่สุด ไม่ซ้ำคู่เดิม และให้คนที่ขอคู่กันได้อยู่ทีมเดียวกัน */
export function splitTeams(
  four: Player[],
  partners: Map<string, number> = new Map(),
  pairs: [string, string][] = [],
  form?: Map<string, number>,
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
    const sk = (p: Player) => skillOf(p, form);
    const gap = Math.abs(sk(a1) + sk(a2) - (sk(b1) + sk(b2)));
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

/** เวลาที่คนนี้เริ่มรอ ณ เวลา t (จบเกมล่าสุดก่อน t หรือเวลาเช็คอิน) */
function waitStartAt(day: Day, id: string, t: number): number {
  const at = day.checkIns.find((c) => c.playerId === id)?.at ?? 0;
  return Math.max(at, ...day.games.filter((g) => g.endedAt && g.endedAt <= t && g.playerIds.includes(id)).map((g) => g.endedAt!));
}

/** กี่เกม/คิวที่ลงไปแล้วโดยมีคนที่เริ่มรอทีหลังคนต้นคิว (= คนต้นคิวถูกข้ามมาแล้วกี่ครั้ง) */
function bypassCount(day: Day, head: QueueEntry): number {
  const later = (ids: string[], t: number) => ids.some((id) => waitStartAt(day, id, t) > head.waitingSince);
  const games = day.games.filter((g) => g.startedAt > head.waitingSince && later(g.playerIds, g.startedAt)).length;
  // คิวที่แอดมินจัดไว้จริงเท่านั้น (ไม่นับคู่ชั่วคราวที่ courtPlan ใช้วางแผนหลายสนามพร้อมกัน)
  const queued = (day.queued ?? []).filter((q) => !q.id.startsWith("plan-") && later(q.playerIds, Infinity)).length;
  return games + queued;
}

/** คนที่เล่นเกมล่าสุด (ที่จบแล้ว) ด้วยกัน: คู่ในเกมเดียวกันนั้นไม่ควรมาเจอกันอีกทันที */
function lastGameMates(day: Day): Set<string> {
  const last = new Map<string, string[]>();
  for (const g of [...day.games].filter((x) => x.endedAt).sort((a, b) => a.endedAt! - b.endedAt!)) for (const id of g.playerIds) last.set(id, g.playerIds);
  const out = new Set<string>();
  for (const [id, ids] of last) for (const o of ids) if (o !== id && last.get(o) === ids) out.add(pairKey(id, o));
  return out;
}

/**
 * 4 คนในเกมเดียวกันห่างกันได้ไม่เกินนี้ (ระดับมือ ไม่รวมฟอร์มวันนี้)
 * 1 = ลง/ขึ้นได้ขั้นเดียว เช่น BG กับ N, N กับ S แต่ New กับ P หรือ BG กับ S ไม่ได้
 * ไม่มีชุดที่เข้าเงื่อนไข = ไม่จัด รอคนเพิ่ม (คนต้นคิวที่หาคนระดับใกล้กันไม่ได้ ให้คนถัดไปลงก่อน)
 * แต่ถ้าถูกข้ามมาครบ STARVED_AFTER เกมแล้ว ผ่อนเป็น RELAXED_LEVEL_GAP สำหรับชุดที่มีคนนั้น
 */
export const MAX_LEVEL_GAP = 1;
/** รอจนคนที่มาทีหลังได้ลงไปแล้วเท่านี้เกม (รวมคิวที่จัดไว้) ผ่อนเพดานให้ชุดที่มีคนนั้นเป็น RELAXED_LEVEL_GAP */
export const STARVED_AFTER = 2;
export const RELAXED_LEVEL_GAP = 2;

/**
 * เลือก 4 คนลงสนามถัดไป
 * คนแรกของคิวได้ลงก่อน อีก 3 คนเลือกจากคนต้นคิว (window) ให้ฝีมือใกล้กัน (ห่างไม่เกิน MAX_LEVEL_GAP) และไม่เจอคนเดิมซ้ำ
 * shown: ชุดที่เคยแนะนำไปแล้ว (กด "แนะนำใหม่") จะได้คนชุดใหม่ ไม่วนกลับมาชุดเดิม
 */
export function nextMatch(
  day: Day,
  players: Player[],
  window = 12,
  shown: string[][] = [],
): [string, string, string, string] | null {
  const queue = waitingQueue(day, players);
  if (queue.length < 4) return null;

  const pairs = activePairs(day).map((r) => [r.from, r.to] as [string, string]);
  const partners = partnerCounts(day);
  const met = metCounts(day);
  const form = formToday(day, players);
  const shownSets = shown.map((ids) => new Set(ids));
  const recent = lastGameMates(day);

  // คนที่ถูกข้ามมาครบ STARVED_AFTER เกมแล้ว: ชุดที่มีคนนี้ผ่อนเพดานเป็น RELAXED_LEVEL_GAP (ไม่ให้ใครไม่ได้ลงเลย)
  const starved = new Set(queue.filter((e) => bypassCount(day, e) >= STARVED_AFTER).map((e) => e.player.id));

  const search = (q: QueueEntry[]) => {
    const head = q[0].player;
    // คู่ที่ขอไว้ของคนต้นคิว ดึงเข้ามาพิจารณาด้วยแม้อยู่ท้ายคิว
    const mates = new Set(pairs.flatMap(([a, b]) => (a === head.id ? [b] : b === head.id ? [a] : [])));
    // กดแนะนำใหม่หลายครั้ง ขยายวงให้มีคนใหม่ให้เลือก
    const reach = Math.max(4, window + shown.length * 3);
    const pool = q
      .slice(1)
      .map((e, i) => ({ p: e.player, rank: i + 1 }))
      .filter((x) => x.rank < reach || mates.has(x.p.id));

    let best: { teams: [string, string, string, string]; score: number; spread: number } | null = null;
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++)
        for (let k = j + 1; k < pool.length; k++) {
          const four = [head, pool[i].p, pool[j].p, pool[k].p];
          const base = four.map((p) => strength(p.level));
          const cap = four.some((p) => starved.has(p.id)) ? RELAXED_LEVEL_GAP : MAX_LEVEL_GAP;
          if (Math.max(...base) - Math.min(...base) > cap + 1e-9) continue;
          const levels = four.map((p) => skillOf(p, form));
          const spread = Math.max(...levels) - Math.min(...levels);
          // 4 คนห่างกันเกิน 1 ระดับ = ต้องให้มือหนักไปแบกมือเบาถึงจะสูสี ยิ่งห่างยิ่งเลี่ยงหนัก
          // (ห่าง 2 ระดับ +20, 3 ระดับ +80, 4 ระดับ +180) หนักกว่าการข้ามคิวไปไม่กี่ลำดับ แต่คนต้นคิวยังได้ลงเสมอ
          const gapPenalty = spread * 3 + Math.max(0, spread - 1) ** 2 * 20;
          const split = splitTeams(four, partners, pairs, form);
          // ได้ลงพร้อมคู่ที่ขอไว้ = ดีมาก
          const ids = new Set(four.map((p) => p.id));
          const pairBonus = pairs.filter(([a, b]) => ids.has(a) && ids.has(b)).length * 40;
          // ให้น้ำหนักกับลำดับคิว เพื่อไม่ให้คนรอนานถูกข้าม
          const waitPenalty = pool[i].rank + pool[j].rank + pool[k].rank;
          // เคยเจอกันในเกมวันนี้แล้ว (ทั้งคู่หูและคู่แข่ง) ยิ่งเจอบ่อยยิ่งเลี่ยง
          let seen = 0;
          // เพิ่งเล่นเกมล่าสุดด้วยกัน (เกมที่เพิ่งจบ) เลี่ยงแรงกว่า ไม่ให้กลุ่มเดิมได้เล่นกันติด ๆ
          let justPlayed = 0;
          for (let x = 0; x < 4; x++)
            for (let y = x + 1; y < 4; y++) {
              const key = pairKey(four[x].id, four[y].id);
              seen += met.get(key) ?? 0;
              if (recent.has(key)) justPlayed++;
            }
          // ชุดที่แนะนำไปแล้ว: ซ้ำคนเดิมมาก = ไม่เอา
          const again = shownSets.reduce((n, set) => n + Math.max(0, four.filter((p) => set.has(p.id)).length - 1) ** 2, 0);
          // คนที่ไม่อยากเจอกัน เลี่ยงให้มากที่สุด แต่ถ้าไม่มีทางเลือกก็ยังจัดได้
          const score = split.cost + gapPenalty + waitPenalty * 2 + seen * 5 + justPlayed * 25 + again * 15 + (hasAvoid(four) ? 1000 : 0) - pairBonus;
          if (!best || score < best.score) best = { teams: split.teams, score, spread };
        }
    return best;
  };

  // คนต้นคิวได้ลงก่อนถ้ามีชุดที่ห่างไม่เกิน MAX_LEVEL_GAP ถ้าไม่มี ให้คนถัดไปเป็นหัวชุดแทน
  for (let i = 0; i + 4 <= queue.length; i++) {
    const result = search(queue.slice(i));
    if (result) return result.teams;
  }
  return null;
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
 * auto = false (แอดมินปิดโหมดจัดคนลงอัตโนมัติ): มีแค่คู่ที่แอดมินจัดคิวสนามไว้เอง ไม่ดึงคนจากคิวรวมขึ้นรอสนามไหน
 * fixed = true (โหมดรอสนามเดิม): คู่ที่ขึ้นรอสนามไหนแล้วรอสนามนั้น ไม่โยกไปสนามอื่นที่ว่างก่อน
 *   ไม่ให้สนามที่กำลังจบแย่งคู่แรก (ไม่ใช้ first) และสนามที่เพิ่งว่างเรียงตามเวลาเริ่มเกมล่าสุดของสนามนั้น
 *   (ไม่กระโดดขึ้นหน้า) ลำดับสนามจึงเหมือนตอนที่คู่นั้นเห็นว่ารอสนามไหน
 */
export function courtPlan(day: Day, players: Player[], courts: number | number[], first?: number, auto = true, fixed = false): Map<number, CourtNext> {
  const started = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g.startedAt]));
  if (fixed) {
    first = undefined;
    // รอสนามเดิม: สนามที่เพิ่งว่างไม่แย่งคู่ที่รอสนามอื่นอยู่แล้ว
    // ถ้าตอนสนามนี้ว่าง มีคนรอครบ 4 อยู่แล้ว (มีคู่ที่รอสนามอื่นอยู่) ให้สนามนี้เรียงตามเวลาเริ่มเกมล่าสุดของสนาม
    // ถ้าคนรอครบ 4 ทีหลัง (ตอนว่างยังไม่มีคู่รอ) ไม่มีใครถูกโยก สนามว่างได้คู่ก่อนตามปกติ
    const since = waitingQueue(day, players).map((e) => e.waitingSince).sort((a, b) => a - b);
    const readyAt = since.length >= 4 ? since[3] : Infinity;
    const last = new Map<number, { startedAt: number; endedAt: number }>();
    for (const g of day.games) if (g.endedAt && !started.has(g.court) && g.startedAt >= (last.get(g.court)?.startedAt ?? -Infinity)) last.set(g.court, { startedAt: g.startedAt, endedAt: g.endedAt });
    for (const [c, g] of last) if (readyAt < g.endedAt) started.set(c, g.startedAt);
  }
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
    if (!auto) continue;
    const m = nextMatch(d, players);
    if (!m) continue;
    plan.set(c, { court: c, playerIds: m });
    // คนที่จัดให้สนามนี้แล้ว ไม่อยู่ในคิวรวมสำหรับสนามถัดไป
    d = { ...d, queued: [...(d.queued ?? []), { id: `plan-${c}`, court: c, playerIds: m, at: Infinity }] };
  }
  return plan;
}

/** courtPlan ตามที่ตั้งค่าไว้: เบอร์สนาม โหมดจัดคนลงอัตโนมัติ (ปิด = มีแค่คู่ที่แอดมินจัดเอง) และโหมดรอสนามเดิม */
export function clubPlan(day: Day, players: Player[], settings: Pick<Settings, "courtCount" | "courtNumbers" | "autoAssign" | "fixedCourt">, first?: number): Map<number, CourtNext> {
  return courtPlan(day, players, courtList(settings), first, settings.autoAssign !== false, settings.fixedCourt === true);
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

/**
 * คู่ที่จะลงสนามต่อทันทีหลังเกมนี้จบ (null = ไม่ลงต่อ)
 * lastRound: แอดมินกำลังจะจบก๊วน กดผลได้เลยโดยไม่ลงคู่ถัดไป (ไม่สร้างเกมใหม่ ไม่เพิ่มค่าลูก)
 */
export function autoNext(day: Day, players: Player[], courts: number[], game: { id: string; court: number }, lastRound = false, auto = true, fixed = false): CourtNext | null {
  if (lastRound || !courts.includes(game.court)) return null;
  const next = courtPlan(day, players, courts, game.court, auto, fixed).get(game.court);
  return next && queueBlockers(day, next, game.id).length === 0 ? next : null;
}

/** หลังครบเวลาเตรียมลงสนามเกินเท่านี้ ไม่เริ่มเกมเอง (เช่น เปิดแอพกลับมาทีหลัง คนอาจไม่อยู่แล้ว) ให้แอดมินกดลงสนามเอง */
export const START_GRACE_MS = 3 * 60_000;

export interface PendingStart {
  queued: QueuedGame;
  /** เวลาที่จะเริ่มเกมเอง (null = รอแอดมินกด "ลงสนาม") */
  startAt: number | null;
}

/**
 * คู่ที่ "เตรียมลงสนาม" ของสนามนี้: สนามว่างเพราะเพิ่งจบเกม และคู่แรกของคิวสนามนี้ขึ้นรอตั้งแต่ก่อน/ตอนจบเกมนั้น
 * (คู่ที่แอดมินจัดใส่สนามที่ว่างอยู่แล้วทีหลัง ไม่ใช่ ให้กดลงสนามเองเหมือนเดิม)
 * ใช้เวลาจบเกมจากข้อมูลจริง ทุกเครื่องเห็นเวลานับถอยหลังตรงกัน
 */
export function pendingStart(day: Day, court: number, settings: Pick<Settings, "startDelay">): PendingStart | null {
  const delay = settings.startDelay ?? 0;
  if (delay === 0) return null;
  if (day.games.some((g) => !g.endedAt && g.court === court)) return null;
  const q = courtQueue(day, court)[0];
  if (!q) return null;
  let ended = -Infinity;
  for (const g of day.games) if (g.court === court && g.endedAt && g.endedAt > ended) ended = g.endedAt;
  // คิวขึ้นหลังจบเกมไม่กี่วินาที = ระบบดึงคู่ต่อไปขึ้นตอนกดผล
  if (ended === -Infinity || q.at > ended + 5000) return null;
  return { queued: q, startAt: delay < 0 ? null : ended + delay * 1000 };
}
