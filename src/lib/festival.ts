/** ธีมเทศกาล: เปลี่ยนสีหลักของแอพ + ของตกแต่งหัวแอพ (auto = ตามวันที่) */
export type Festival = "halloween" | "christmas" | "newyear" | "songkran";
export type FestivalSetting = "auto" | "off" | Festival;

export const FESTIVALS: { id: Festival; name: string; emoji: string; greeting: string }[] = [
  { id: "halloween", name: "ฮาโลวีน", emoji: "🎃", greeting: "🎃 🦇 สุขสันต์วันฮาโลวีน 👻" },
  { id: "christmas", name: "คริสต์มาส", emoji: "🎄", greeting: "🎄 ⛄ เมอร์รี่คริสต์มาส 🎁" },
  { id: "newyear", name: "ปีใหม่", emoji: "🎆", greeting: "🎆 🎉 สวัสดีปีใหม่ 🥂" },
  { id: "songkran", name: "สงกรานต์", emoji: "💦", greeting: "💦 🌸 สุขสันต์วันสงกรานต์ 🔫" },
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
