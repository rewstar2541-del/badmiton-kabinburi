/**
 * โหมดงานแข่ง: ข้อมูลและกติกา (ฟังก์ชันบริสุทธิ์ ไม่แตะหน้าจอหรือฐานข้อมูล)
 *
 * กติกาของก๊วน: แต่ละมือแข่งแยกกัน ทั้ง 4 คนในสนามเป็นมือเดียวกัน
 * รอบแรกจับคู่สุ่ม ชนะไปสายบน แพ้ไปสายล่าง แต่ละสายแพ้ = ตกรอบ
 * แต่ละสายแข่งจนจบในสายตัวเอง แพ้รอบรองได้ที่ 3 ร่วม ชนะชิงที่ 1-2
 */

export type PayStatus = "no" | "slip" | "yes";

export interface TDivision {
  id: string;
  /** ชื่อมือ เช่น NEW, NB, N- (พิมพ์เองต่องาน) */
  code: string;
  /** วันแข่ง YYYY-MM-DD */
  date: string;
  maxPairs: number;
  /** ต่ำกว่านี้ตอนปิดรับ มือนี้ไม่เปิดแข่ง */
  minPairs: number;
  /** จำนวนเกมต่อแมตช์ตามสาย/รอบ (1 หรือ 3) */
  bestOf: { r1: number; early: number; final: number };
  drawn?: boolean;
}

export interface TTeam {
  id: string;
  divId: string;
  /** ชื่อผู้เล่น 2 คน */
  names: [string, string];
  /** id ผู้เล่นในก๊วน (คนนอกไม่มี) */
  playerIds: [string?, string?];
  guest?: boolean;
  pay: PayStatus;
  /** รูปสลิปที่แนบ (โหมดทดลองเก็บในเครื่อง) */
  slip?: string;
  /** ใครมาถึงแล้ว [คนแรก, คนที่สอง] */
  here: [boolean, boolean];
}

export type Bracket = "R1" | "U" | "L";

export interface TMatch {
  id: string;
  divId: string;
  bracket: Bracket;
  /** รอบในสาย เริ่ม 0 */
  round: number;
  slot: number;
  a?: string;
  b?: string;
  /** แต้มแต่ละเกม [ทีม a, ทีม b] */
  games: [number, number][];
  winner?: string;
  /** ทีมที่ได้บาย (ไม่ต้องแข่ง) */
  bye?: boolean;
  court?: number;
  /** ลำดับเรียก (แมตช์ที่ N) */
  no?: number;
  /** ผลที่ผู้เล่นส่ง รอคู่แข่งยืนยัน (ทีมที่ส่ง) */
  pendingBy?: string;
  /** คู่แข่งกดว่าผลไม่ตรง ให้แอดมินตัดสิน */
  disputed?: boolean;
}

export interface Tourney {
  id: string;
  name: string;
  /** ค่าสมัครต่อคู่ (รวมค่าลูก) */
  fee: number;
  /** วันปิดรับสมัคร YYYY-MM-DD */
  closeDate: string;
  mapUrl?: string;
  note?: string;
  courts: number;
  divisions: TDivision[];
  teams: TTeam[];
  matches: TMatch[];
  /** เลขแมตช์ถัดไป */
  nextNo: number;
}

/* ---------- คะแนน ---------- */

/** เกมจบหรือยัง: 21 แต้ม ถ้า 20-20 ต้องนำ 2 สูงสุด 30 คืน 0 = ทีม a ชนะ, 1 = ทีม b, null = ยังไม่จบ */
export function gameWinner([x, y]: [number, number]): 0 | 1 | null {
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  if (hi < 21) return null;
  if (hi === 30 || hi - lo >= 2) return x > y ? 0 : 1;
  return null;
}

/** แต้มนี้เป็นไปได้ไหม (ใช้ตรวจผลที่ผู้เล่นกรอก) */
export function validGame(g: [number, number]): boolean {
  const [x, y] = g;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 30 || y > 30) return false;
  const w = gameWinner(g);
  if (w === null) return false;
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  // ชนะเกิน 21 ได้เฉพาะตอนดิวส์ (แพ้ไม่ต่ำกว่า hi-2) หรือ 30-29
  if (hi > 21 && !(hi - lo === 2 || (hi === 30 && lo === 29))) return false;
  return true;
}

export function bestOfFor(div: TDivision, m: TMatch, totalRounds: number): number {
  if (m.bracket === "R1") return div.bestOf.r1;
  return m.round === totalRounds - 1 ? div.bestOf.final : div.bestOf.early;
}

/** ผู้ชนะแมตช์จากแต้มแต่ละเกม: 0/1 หรือ null ถ้ายังไม่ครบ */
export function matchWinner(games: [number, number][], bestOf: number): 0 | 1 | null {
  const need = Math.floor(bestOf / 2) + 1;
  let a = 0;
  let b = 0;
  for (const g of games) {
    const w = gameWinner(g);
    if (w === 0) a++;
    if (w === 1) b++;
  }
  if (a >= need) return 0;
  if (b >= need) return 1;
  return null;
}

/** ต้องแสดงช่องเกม 3 ไหม (ซ่อนถ้ามีทีมชนะ 2 เกมแรกแล้ว) */
export function needsGame3(games: [number, number][]): boolean {
  const w = games.slice(0, 2).map(gameWinner);
  return !(w[0] !== null && w[0] === w[1]);
}

/* ---------- สายแข่ง ---------- */

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const nextPow2 = (n: number) => (n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n)));

/** จำนวนรอบของสายที่มีทีม n ทีม */
export function roundsFor(n: number): number {
  return n <= 1 ? 0 : Math.log2(nextPow2(n));
}

export function divTeams(t: Tourney, divId: string): TTeam[] {
  return t.teams.filter((x) => x.divId === divId);
}

/** มือนี้คนพอเปิดแข่งไหม */
export function divOpen(t: Tourney, div: TDivision): boolean {
  return divTeams(t, div.id).length >= div.minPairs;
}

/** สร้างสายแพ้คัดออก (สายบน/ล่าง) จากรายชื่อทีม ทีมที่เกินกำลังสองได้บายรอบแรก */
function buildElim(divId: string, bracket: Bracket, teamIds: string[], id: () => string): TMatch[] {
  const size = nextPow2(teamIds.length);
  const rounds = roundsFor(teamIds.length);
  const out: TMatch[] = [];
  // วางทีมแบบเว้นช่องบาย: ทีมที่ได้บายกระจายกันไม่เจอกันเอง
  const seats: (string | undefined)[] = new Array(size).fill(undefined);
  const byes = size - teamIds.length;
  // คู่ที่ได้บายเลือกตามลำดับกลับบิต (0, ครึ่งล่าง, ส่วนสี่...) ทีมที่ได้บายจะไม่เจอกันเองรอบสอง
  const pairs = size / 2;
  const bits = Math.log2(pairs);
  const rev = (i: number) => {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    return r;
  };
  const byePairs = new Set(Array.from({ length: pairs }, (_, i) => rev(i)).slice(0, byes));
  let k = 0;
  for (let i = 0; i < pairs; i++) {
    seats[i * 2] = teamIds[k++];
    if (!byePairs.has(i)) seats[i * 2 + 1] = teamIds[k++];
  }
  for (let r = 0; r < rounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let s = 0; s < count; s++) {
      const m: TMatch = { id: id(), divId, bracket, round: r, slot: s, games: [] };
      if (r === 0) {
        m.a = seats[s * 2];
        m.b = seats[s * 2 + 1];
        if (m.a && !m.b) {
          m.winner = m.a;
          m.bye = true;
        }
      }
      out.push(m);
    }
  }
  // ผู้ได้บายขึ้นรอบถัดไปทันที
  for (const m of out.filter((x) => x.bye)) placeWinner(out, m);
  return out;
}

/** ใส่ผู้ชนะลงแมตช์ถัดไปในสายเดียวกัน */
function placeWinner(ms: TMatch[], m: TMatch) {
  const next = ms.find((x) => x.divId === m.divId && x.bracket === m.bracket && x.round === m.round + 1 && x.slot === m.slot >> 1);
  if (!next || !m.winner) return;
  if (m.slot % 2 === 0) next.a = m.winner;
  else next.b = m.winner;
}

/**
 * จับสลากมือนี้: เฉพาะทีมที่จ่ายแล้ว สุ่มจับคู่รอบแรก
 * ทีมเป็นเลขคี่ ทีมสุดท้ายที่สุ่มได้บาย (ขึ้นสายบนเลย)
 */
export function draw(t: Tourney, divId: string, rand = Math.random, id = defaultId): Tourney {
  const div = t.divisions.find((d) => d.id === divId);
  if (!div || div.drawn) return t;
  const ids = shuffle(
    divTeams(t, divId)
      .filter((x) => x.pay === "yes")
      .map((x) => x.id),
    rand,
  );
  if (ids.length < 2) return t;
  const r1: TMatch[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    const m: TMatch = { id: id(), divId, bracket: "R1", round: 0, slot: i / 2, a: ids[i], b: ids[i + 1], games: [] };
    if (!m.b) {
      m.winner = m.a;
      m.bye = true;
    }
    r1.push(m);
  }
  return {
    ...t,
    divisions: t.divisions.map((d) => (d.id === divId ? { ...d, drawn: true } : d)),
    matches: [...t.matches.filter((m) => m.divId !== divId), ...r1],
  };
}

/** รอบแรกจบครบแล้ว สร้างสายบน (ผู้ชนะ) และสายล่าง (ผู้แพ้) */
function maybeBuildBrackets(t: Tourney, divId: string, id: () => string): TMatch[] {
  const r1 = t.matches.filter((m) => m.divId === divId && m.bracket === "R1");
  const has = t.matches.some((m) => m.divId === divId && m.bracket !== "R1");
  if (has || r1.length === 0 || r1.some((m) => !m.winner)) return t.matches;
  const winners = r1.map((m) => m.winner!);
  const losers = r1.filter((m) => !m.bye).map((m) => (m.winner === m.a ? m.b! : m.a!));
  // สายที่มีทีมเดียว: ได้ที่ 1 ของสายนั้นเลย
  const solo = (bracket: Bracket, x: string): TMatch[] => [{ id: id(), divId, bracket, round: 0, slot: 0, a: x, games: [], winner: x, bye: true }];
  const upper = winners.length >= 2 ? buildElim(divId, "U", winners, id) : winners.length === 1 ? solo("U", winners[0]) : [];
  const lower = losers.length >= 2 ? buildElim(divId, "L", losers, id) : losers.length === 1 ? solo("L", losers[0]) : [];
  return [...t.matches, ...upper, ...lower];
}

/** บันทึกผลแมตช์ (กรรมการ แอดมิน หรือผลที่ยืนยันแล้ว) แล้วเลื่อนผู้ชนะ */
export function setResult(t: Tourney, matchId: string, games: [number, number][], id = defaultId): Tourney {
  const m0 = t.matches.find((m) => m.id === matchId);
  const div = t.divisions.find((d) => d.id === m0?.divId);
  if (!m0 || !div || !m0.a || !m0.b) return t;
  const total = roundsFor(t.matches.filter((m) => m.divId === m0.divId && m.bracket === m0.bracket && m.round === 0).length * 2);
  const w = matchWinner(games, bestOfFor(div, m0, total));
  if (m0.winner && resultLocked(t, m0)) return t;
  const ms = t.matches
    // แก้ผลรอบแรกหลังสร้างสายแล้ว (ยังไม่มีใครแข่งในสาย): สร้างสายใหม่
    .filter((m) => !(m0.bracket === "R1" && m.divId === m0.divId && m.bracket !== "R1"))
    .map((m) => ({ ...m }));
  const m = ms.find((x) => x.id === matchId)!;
  m.games = games;
  m.pendingBy = undefined;
  m.disputed = undefined;
  if (w === null) {
    m.winner = undefined;
    return { ...t, matches: ms };
  }
  m.winner = w === 0 ? m.a : m.b;
  m.court = undefined;
  placeWinner(ms, m);
  const next = { ...t, matches: ms };
  return { ...next, matches: maybeBuildBrackets(next, m.divId, id) };
}

/** แก้ผลแมตช์นี้ไม่ได้แล้ว เพราะรอบถัดไปเริ่มแข่งแล้ว */
export function resultLocked(t: Tourney, m: TMatch): boolean {
  const started = (x: TMatch) => x.games.length > 0 || (!!x.winner && !x.bye) || !!x.court;
  if (m.bracket === "R1") return t.matches.some((x) => x.divId === m.divId && x.bracket !== "R1" && started(x));
  const next = t.matches.find((x) => x.divId === m.divId && x.bracket === m.bracket && x.round === m.round + 1 && x.slot === m.slot >> 1);
  return !!next && started(next);
}

/** ผู้เล่นส่งผล รอคู่แข่งยืนยัน */
export function submitResult(t: Tourney, matchId: string, byTeam: string, games: [number, number][]): Tourney {
  return { ...t, matches: t.matches.map((m) => (m.id === matchId ? { ...m, games, pendingBy: byTeam, disputed: false } : m)) };
}

/** คู่แข่งตอบ: ตรง = บันทึกผล, ไม่ตรง = ให้แอดมินตัดสิน */
export function confirmResult(t: Tourney, matchId: string, ok: boolean, id = defaultId): Tourney {
  const m = t.matches.find((x) => x.id === matchId);
  if (!m || !m.pendingBy) return t;
  if (ok) return setResult(t, matchId, m.games, id);
  return { ...t, matches: t.matches.map((x) => (x.id === matchId ? { ...x, disputed: true } : x)) };
}

/* ---------- ตาราง / เรียกลงสนาม ---------- */

export function team(t: Tourney, id?: string): TTeam | undefined {
  return id ? t.teams.find((x) => x.id === id) : undefined;
}

export function teamName(t: Tourney, id?: string): string {
  const x = team(t, id);
  return x ? `${x.names[0]} & ${x.names[1]}` : "";
}

const ready = (x?: TTeam) => !!x && x.here[0] && x.here[1];

/** แมตช์ที่รอแข่ง (รู้ทั้ง 2 ทีมแล้ว ยังไม่จบ) เรียงตามรอบ */
export function pending(t: Tourney): TMatch[] {
  const order: Record<Bracket, number> = { R1: 0, U: 1, L: 1 };
  return t.matches
    .filter((m) => m.a && m.b && !m.winner)
    .sort((x, y) => (x.no ?? 1e9) - (y.no ?? 1e9) || order[x.bracket] - order[y.bracket] || x.round - y.round || x.slot - y.slot);
}

/** กำลังเล่นอยู่ในสนาม */
export function onCourt(t: Tourney): TMatch[] {
  return t.matches.filter((m) => m.court && !m.winner);
}

/** แมตช์ที่ถัดไปได้ (ทั้ง 4 คนมาครบ ไม่มีทีมไหนกำลังเล่นอยู่) */
export function callable(t: Tourney): TMatch[] {
  const busy = new Set(onCourt(t).flatMap((m) => [m.a, m.b]));
  return pending(t).filter((m) => !m.court && ready(team(t, m.a)) && ready(team(t, m.b)) && !busy.has(m.a) && !busy.has(m.b));
}

/** เรียกลงสนามที่ว่างให้ครบ คืนงานแข่งใหม่ */
export function fillCourts(t: Tourney): Tourney {
  let next = t;
  for (let c = 1; c <= t.courts; c++) {
    if (onCourt(next).some((m) => m.court === c)) continue;
    const m = callable(next)[0];
    if (!m) break;
    next = {
      ...next,
      nextNo: next.nextNo + (m.no ? 0 : 1),
      matches: next.matches.map((x) => (x.id === m.id ? { ...x, court: c, no: x.no ?? next.nextNo } : x)),
    };
  }
  return next;
}

/** ลำดับแมตช์ทั้งหมดของทีมนี้ที่ยังไม่จบ และอีกกี่แมตช์ถึงคิว */
export function myNext(t: Tourney, teamId: string): { match?: TMatch; ahead: number } {
  const list = pending(t);
  const i = list.findIndex((m) => m.a === teamId || m.b === teamId);
  if (i < 0) return { ahead: 0 };
  const playing = onCourt(t).length;
  return { match: list[i], ahead: list[i].court ? 0 : Math.max(0, i - playing) };
}

/** อันดับของมือที่จบแล้ว ต่อสาย: [ที่ 1, ที่ 2, ที่ 3 ร่วม...] */
export function placings(t: Tourney, divId: string, bracket: "U" | "L"): { first?: string; second?: string; third: string[] } {
  const ms = t.matches.filter((m) => m.divId === divId && m.bracket === bracket);
  if (ms.length === 0) return { third: [] };
  const last = Math.max(...ms.map((m) => m.round));
  const final = ms.find((m) => m.round === last);
  const semis = ms.filter((m) => m.round === last - 1 && m.winner && !m.bye);
  return {
    first: final?.winner,
    second: final?.winner ? (final.winner === final.a ? final.b : final.a) : undefined,
    third: semis.map((m) => (m.winner === m.a ? m.b! : m.a!)),
  };
}

let seq = 0;
function defaultId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `t${Date.now().toString(36)}${(seq++).toString(36)}`;
  }
}

/* ---------- ตัวอย่างสำหรับโหมดทดลอง ---------- */

const SAMPLE = ["บอล", "แพร", "โอ๊ต", "ต้น", "เอก", "ฝน", "จูน", "ริว", "นุ่น", "ปิ่น", "ก้อง", "ฟ้า", "ภู", "มายด์", "แทน", "บีม", "กอล์ฟ", "เบียร์", "มิ้นท์", "ปุ้ย", "เต้", "ข้าว", "หมู", "ปลา", "ตาล", "นัท", "เอ็ม", "แบงค์", "ปอ", "ฟิล์ม", "ออม", "เจ"];

export function sampleTourney(date: string, id = defaultId): Tourney {
  const d2 = new Date(date + "T00:00:00");
  d2.setDate(d2.getDate() + 1);
  const date2 = d2.toISOString().slice(0, 10);
  const bo = { r1: 1, early: 1, final: 3 };
  const divs: TDivision[] = [
    { id: "new", code: "NEW", date, maxPairs: 16, minPairs: 4, bestOf: bo },
    { id: "n", code: "N", date, maxPairs: 8, minPairs: 4, bestOf: bo },
    { id: "bg", code: "BG", date: date2, maxPairs: 16, minPairs: 4, bestOf: bo },
  ];
  const teams: TTeam[] = [];
  for (let i = 0; i < 16; i++) {
    const a = SAMPLE[(i * 2) % SAMPLE.length];
    const b = SAMPLE[(i * 2 + 1) % SAMPLE.length];
    teams.push({ id: id(), divId: "new", names: [a, b], playerIds: [], pay: i < 14 ? "yes" : i === 14 ? "slip" : "no", here: [i < 12, i < 11] });
  }
  for (let i = 0; i < 6; i++)
    teams.push({ id: id(), divId: "n", names: [SAMPLE[(i * 2 + 7) % 32], SAMPLE[(i * 2 + 8) % 32]], playerIds: [], pay: "yes", here: [true, true], guest: i === 5 });
  for (let i = 0; i < 3; i++)
    teams.push({ id: id(), divId: "bg", names: [SAMPLE[(i * 2 + 20) % 32], SAMPLE[(i * 2 + 21) % 32]], playerIds: [], pay: "no", here: [false, false] });
  return {
    id: "demo-tourney",
    name: "หนุมานคัพ ครั้งที่ 1",
    fee: 800,
    closeDate: date,
    mapUrl: "https://maps.google.com/?q=สนามแบดมินตันกบินทร์บุรี",
    courts: 4,
    divisions: divs,
    teams,
    matches: [],
    nextNo: 1,
  };
}

/** โหมดทดลอง: สุ่มผลให้แมตช์ที่อยู่ในสนามทั้งหมด แล้วเรียกคู่ต่อไป */
export function simulate(t: Tourney, rand = Math.random, id = defaultId): Tourney {
  // ในโหมดทดลอง ถือว่าทุกทีมมาถึงแล้ว
  let next = fillCourts({ ...t, teams: t.teams.map((x) => ({ ...x, here: [true, true] as [boolean, boolean] })) });
  for (const m of onCourt(next)) {
    const div = next.divisions.find((d) => d.id === m.divId)!;
    const total = roundsFor(next.matches.filter((x) => x.divId === m.divId && x.bracket === m.bracket && x.round === 0).length * 2);
    const bo = bestOfFor(div, m, total);
    const games: [number, number][] = [];
    while (matchWinner(games, Math.max(bo, 1)) === null && games.length < 3) {
      const lose = Math.floor(rand() * 19);
      games.push(rand() < 0.5 ? [21, lose] : [lose, 21]);
    }
    next = setResult(next, m.id, games, id);
    // ถ้าเป็นนัดชิง (best of 3) ผลข้างบนอาจยังไม่ครบ เติมให้จบ
    let guard = 0;
    while (!next.matches.find((x) => x.id === m.id)?.winner && guard++ < 3) {
      const cur = next.matches.find((x) => x.id === m.id)!;
      const l = Math.floor(rand() * 19);
      next = setResult(next, m.id, [...cur.games, rand() < 0.5 ? [21, l] : [l, 21]], id);
    }
  }
  return fillCourts(next);
}
