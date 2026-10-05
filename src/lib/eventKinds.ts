/** สีและไอคอนของประกาศแต่ละประเภท (หัวข้อเก็บเป็นภาษาไทย null = จัดก๊วนปกติ) */
export interface EventStyle {
  emoji: string;
  /** ข้อความไทย ใช้เป็นคีย์แปล */
  label: string;
  box: string;
  badge: string;
  /** สีช่องในปฏิทิน */
  cell: string;
}

export const SESSION_STYLE: EventStyle = {
  emoji: "🏸",
  label: "วันจัดก๊วน",
  box: "bg-lime text-ink",
  badge: "bg-ink text-lime",
  cell: "bg-lime/40",
};

const STYLES: Record<string, EventStyle> = {
  กินเลี้ยง: { emoji: "🍲", label: "กินเลี้ยง", box: "border-2 border-orange-300 bg-orange-50 text-orange-950", badge: "bg-orange-500 text-white", cell: "bg-orange-200" },
  ทำความสะอาดสนาม: { emoji: "🧹", label: "ทำความสะอาดสนาม", box: "border-2 border-sky-300 bg-sky-50 text-sky-950", badge: "bg-sky-500 text-white", cell: "bg-sky-200" },
  แข่งขันในก๊วน: { emoji: "🏆", label: "แข่งขันในก๊วน", box: "border-2 border-violet-300 bg-violet-50 text-violet-950", badge: "bg-violet-500 text-white", cell: "bg-violet-200" },
};

const OTHER: EventStyle = { emoji: "⭐", label: "อีเว้นพิเศษ", box: "border-2 border-amber-300 bg-amber-50 text-amber-950", badge: "bg-amber-400 text-ink", cell: "bg-amber-200" };

export function eventStyle(title?: string | null): EventStyle {
  if (!title) return SESSION_STYLE;
  return STYLES[title] ?? OTHER;
}
