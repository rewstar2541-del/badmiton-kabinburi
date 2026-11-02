/** ช่วงที่อยู่สนาม [from, to) เป็นชั่วโมง, null = ไม่หาร */
export type Span = { from: number; to: number } | null;

/** แต่ละชั่วโมงหารค่าเช่าให้คนที่อยู่ชั่วโมงนั้น แล้วรวมของแต่ละคน (ปัดเป็นบาท) */
export function splitByHour(spans: Map<string, Span>, start: number, end: number, perHour: number | ((h: number) => number)): Map<string, number> {
  const out = new Map<string, number>();
  const cost = typeof perHour === "number" ? () => perHour : perHour;
  // หารทีละ 15 นาที เวลาเริ่ม/เลิก/มา/กลับ เป็นทศนิยมชั่วโมงได้ (18.5 = 18:30)
  for (let h = start; h < end - 1e-9; h += 0.25) {
    const here = [...spans].filter(([, s]) => s && s.from <= h + 1e-9 && h + 1e-9 < s.to).map(([id]) => id);
    for (const id of here) out.set(id, (out.get(id) ?? 0) + cost(h) / 4 / here.length);
  }
  for (const [id, v] of out) out.set(id, Math.round(v));
  return out;
}

/** ชั่วโมง (เวลาไทย) ของเวลาเช็คอิน ไม่ขึ้นกับเวลาในเครื่อง */
export function bangkokHour(at: number): number {
  return Math.floor(at / 3_600_000 + 7) % 24;
}

/** ชั่วโมงที่แต่ละคนอยู่ ค่าเริ่มต้น = ชั่วโมงที่เช็คอินถึงเลิก ตัดให้อยู่ในเวลาเช่า */
export function rentSpan(rent: { start: number; end: number }, at: number, hours?: { from: number; to: number }): { from: number; to: number } {
  const q = (h: number) => Math.round(h * 4) / 4;
  const from = Math.min(Math.max(q(hours?.from ?? bangkokHour(at)), rent.start), Math.max(rent.end - 0.25, rent.start));
  const to = Math.max(from + 0.25, Math.min(q(hours?.to ?? rent.end), rent.end));
  return { from, to };
}

/** ค่าสนามของแต่ละคนในวันสนามเช่า */
export function rentShares(
  rent: { start: number; end: number; perHour: number; courts?: number[] },
  checkIns: { playerId: string; at: number; hours?: { from: number; to: number }; courtFee?: number }[],
) {
  // คนที่แอดมินแก้ค่าสนามเอง (เช่นโค้ช 0 บาท) ไม่นับในการหาร
  const spans = new Map<string, Span>(checkIns.filter((c) => c.courtFee === undefined).map((c) => [c.playerId, rentSpan(rent, c.at, c.hours)]));
  return splitByHour(spans, rent.start, rent.end, (h) => rentAt(rent, h));
}

/** จำนวนคอร์ทของชั่วโมง h (ไม่ได้ตั้งแยก = 1) */
export function courtsAt(rent: { start: number; courts?: number[] }, h: number): number {
  return rent.courts?.[Math.floor(h - rent.start + 1e-9)] ?? 1;
}

/** ค่าเช่าของชั่วโมง h (ทุกคอร์ทรวมกัน) */
export function rentAt(rent: { start: number; perHour: number; courts?: number[] }, h: number): number {
  return rent.perHour * courtsAt(rent, h);
}

/** ค่าเช่ารวมทั้งวัน */
export function rentTotal(rent: { start: number; end: number; perHour: number; courts?: number[] }): number {
  let sum = 0;
  for (let h = rent.start; h < rent.end - 1e-9; h += 0.25) sum += rentAt(rent, h) / 4;
  return Math.round(sum);
}

/** เก็บจำนวนคอร์ทให้ยาวเท่าจำนวนชั่วโมง ถ้าเป็น 1 ทุกชั่วโมงไม่ต้องเก็บ */
export function normalizeCourts(start: number, end: number, courts?: number[]): number[] | undefined {
  const out = Array.from({ length: Math.max(Math.ceil(end - start - 1e-9), 0) }, (_, i) => Math.max(1, Math.round(courts?.[i] ?? courts?.[courts.length - 1] ?? 1)));
  return out.every((c) => c === 1) ? undefined : out;
}

/** แสดงเวลา เช่น 18.5 → "18:30" */
export function clock(h: number): string {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
