/** ช่วงที่อยู่สนาม [from, to) เป็นชั่วโมง, null = ไม่หาร */
export type Span = { from: number; to: number } | null;

/** แต่ละชั่วโมงหารค่าเช่าให้คนที่อยู่ชั่วโมงนั้น แล้วรวมของแต่ละคน (ปัดเป็นบาท) */
export function splitByHour(spans: Map<string, Span>, start: number, end: number, perHour: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let h = start; h < end; h++) {
    const here = [...spans].filter(([, s]) => s && s.from <= h && h < s.to).map(([id]) => id);
    for (const id of here) out.set(id, (out.get(id) ?? 0) + perHour / here.length);
  }
  for (const [id, v] of out) out.set(id, Math.round(v));
  return out;
}
