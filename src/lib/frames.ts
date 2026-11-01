import type { Level, Player } from "./types";

/** กรอบพิเศษตามเทศกาล แอดมินแจกให้คนที่มาเล่น หรือขายให้คนที่อยากได้ */
export type FestivalFrameId = "newyear" | "songkran" | "loykrathong" | "halloween" | "christmas";

export const FESTIVAL_FRAMES: { id: FestivalFrameId; name: string; emoji: string; colors: [string, string, string] }[] = [
  { id: "newyear", name: "ปีใหม่", emoji: "🎆", colors: ["#fde68a", "#1e3a8a", "#0b1a4a"] },
  { id: "songkran", name: "สงกรานต์", emoji: "💦", colors: ["#7dd3fc", "#ec4899", "#0369a1"] },
  { id: "loykrathong", name: "ลอยกระทง", emoji: "🪷", colors: ["#fde68a", "#d97706", "#1e1b4b"] },
  { id: "halloween", name: "ฮาโลวีน", emoji: "🎃", colors: ["#fdba74", "#7c3aed", "#3b0764"] },
  { id: "christmas", name: "คริสต์มาส", emoji: "🎄", colors: ["#fca5a5", "#dc2626", "#14532d"] },
];

export const isFrameId = (id: string): id is FestivalFrameId => FESTIVAL_FRAMES.some((f) => f.id === id);

export const frameName = (id: FestivalFrameId) => FESTIVAL_FRAMES.find((f) => f.id === id)?.name ?? id;

export type Frame = { kind: "level"; level: Level } | { kind: "festival"; id: FestivalFrameId };

/** กรอบที่ใส่อยู่จริง (กรอบระดับเปลี่ยนตามระดับมือปัจจุบัน กรอบเทศกาลต้องยังมีอยู่) */
export function frameOf(p: Pick<Player, "frame" | "frames" | "level" | "guestOf">): Frame | null {
  if (!p.frame || p.guestOf) return null;
  if (p.frame === "level") return { kind: "level", level: p.level };
  return isFrameId(p.frame) && p.frames?.includes(p.frame) ? { kind: "festival", id: p.frame } : null;
}

/** ตัวเลือกให้ผู้เล่นเลือกเอง: ไม่ใส่ / กรอบระดับมือตัวเอง / กรอบเทศกาล (ที่ยังไม่มีล็อกไว้) */
export function frameChoices(p: Pick<Player, "frames">): { value: string | null; locked: boolean }[] {
  return [
    { value: null, locked: false },
    { value: "level", locked: false },
    ...FESTIVAL_FRAMES.map((f) => ({ value: f.id, locked: !p.frames?.includes(f.id) })),
  ];
}

export function grantFrame(p: Player, id: FestivalFrameId): Player {
  const frames = p.frames ?? [];
  return frames.includes(id) ? { ...p, frames } : { ...p, frames: [...frames, id] };
}

/** เอากรอบคืน ถ้ากำลังใส่อยู่ก็ถอดออกด้วย */
export function revokeFrame(p: Player, id: FestivalFrameId): Player {
  const out: Player = { ...p, frames: (p.frames ?? []).filter((f) => f !== id) };
  if (out.frame === id) delete out.frame;
  return out;
}
