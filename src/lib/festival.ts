/** ธีมเทศกาล: เปลี่ยนสีหลักของแอพ + ของตกแต่งหัวแอพ (auto = ตามวันที่) */
export type Festival = "halloween" | "christmas" | "newyear" | "songkran";
export type FestivalSetting = "auto" | "off" | Festival;

export const FESTIVALS: {
  id: Festival;
  name: string;
  emoji: string;
  greeting: string;
  wish: string;
  /** สีพื้นแบนเนอร์ (ไล่สี) */
  colors: [string, string];
  /** ของตกแต่งรอบแบนเนอร์ */
  decor: string[];
  /** ของที่ลอยลงมาบนจอ */
  falling: string[];
}[] = [
  {
    id: "halloween",
    name: "ฮาโลวีน",
    emoji: "🎃",
    greeting: "สุขสันต์วันฮาโลวีน",
    wish: "ตีแบดให้สนุก อย่าให้ผีแย่งลูกนะ 👻",
    colors: ["#ff9a3c", "#7b3fe4"],
    decor: ["👻", "🦇", "🕸️", "🍬", "🕯️"],
    falling: ["🦇", "🍬", "👻", "🍂"],
  },
  {
    id: "christmas",
    name: "คริสต์มาส",
    emoji: "🎄",
    greeting: "เมอร์รี่คริสต์มาส",
    wish: "ขอให้ตีแบดสนุก ได้ของขวัญเยอะๆ 🎁",
    colors: ["#e63946", "#2a9d8f"],
    decor: ["🎅", "⛄", "🎁", "⭐", "🔔"],
    falling: ["❄️", "❄️", "⭐", "❄️"],
  },
  {
    id: "newyear",
    name: "ปีใหม่",
    emoji: "🎆",
    greeting: "สวัสดีปีใหม่",
    wish: "ปีนี้ขอให้ตบแรง รับได้ทุกลูก 🏸",
    colors: ["#22306b", "#d4a017"],
    decor: ["🎉", "🥂", "✨", "🎊", "🧧"],
    falling: ["✨", "🎊", "🎉", "✨"],
  },
  {
    id: "songkran",
    name: "สงกรานต์",
    emoji: "💦",
    greeting: "สุขสันต์วันสงกรานต์",
    wish: "เล่นน้ำแล้วอย่าลืมมาตีแบดนะ 🌸",
    colors: ["#38bdf8", "#f472b6"],
    decor: ["🌸", "🐘", "🔫", "🌼", "☀️"],
    falling: ["💧", "🌸", "💦", "🌼"],
  },
];

/** ช่วงวันที่ของแต่ละเทศกาล (MM-DD) ใช้ตอนตั้งเป็นอัตโนมัติ */
const RANGES: [Festival, string, string][] = [
  ["songkran", "04-08", "04-16"],
  ["halloween", "10-20", "10-31"],
  ["christmas", "12-15", "12-26"],
  ["newyear", "12-27", "12-31"],
  ["newyear", "01-01", "01-05"],
];

export function activeFestival(setting: FestivalSetting | undefined, date: string): Festival | null {
  if (setting === "off") return null;
  if (setting && setting !== "auto") return setting;
  const md = date.slice(5);
  return RANGES.find(([, from, to]) => md >= from && md <= to)?.[0] ?? null;
}

export function festivalInfo(f: Festival | null) {
  return FESTIVALS.find((x) => x.id === f) ?? null;
}
