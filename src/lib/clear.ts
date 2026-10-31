import type { State } from "./state";

/** ประเภทข้อมูลที่ล้างแยกได้ (ไม่แตะรายชื่อผู้เล่น แอดมิน และตั้งค่า) */
export type ClearKind = "games" | "tourneys" | "bills" | "signups" | "monthly" | "expenses" | "polls" | "board" | "photos" | "closed";

export const CLEAR_KINDS: { value: ClearKind; label: string; hint: string; dated: boolean }[] = [
  { value: "games", label: "ประวัติเกมและผลแพ้ชนะ", hint: "ใช้คิดค่าลูก อันดับ สถิติคู่หู", dated: true },
  { value: "tourneys", label: "ประวัติงานแข่ง", hint: "งานแข่งที่จบแล้ว ทีม ผลแข่ง สลิปสมัคร งานที่เปิดอยู่ไม่ลบ", dated: false },
  { value: "bills", label: "เช็คอินและบิลรายวัน", hint: "เช็คอิน ค่าน้ำ การจ่ายเงิน สลิป ราคาที่ล็อกไว้", dated: true },
  { value: "signups", label: "ประกาศและการลงชื่อ", hint: "ประกาศ คนลงชื่อ คำขอจับคู่", dated: true },
  { value: "monthly", label: "ค่าสมาชิกรายเดือน", hint: "ใครจ่ายเดือนไหน (ลบทั้งเดือน)", dated: true },
  { value: "expenses", label: "รายจ่ายของก๊วน", hint: "ค่าเช่าสนาม ค่าลูก ฯลฯ", dated: true },
  { value: "polls", label: "โหวตวันตีพิเศษ", hint: "โหวตและคะแนน", dated: true },
  { value: "board", label: "บอร์ดของหาย / ฝากขาย", hint: "โพสต์และรูป", dated: true },
  { value: "photos", label: "รูปกิจกรรม", hint: "รูปและไฟล์รูป", dated: true },
  { value: "closed", label: "วันงดเล่น", hint: "วันที่ตั้งงดเล่นไว้", dated: true },
];

const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** จำนวนรายการที่จะถูกลบ (จากข้อมูลที่โหลดอยู่ รูปกิจกรรมนับไม่ได้ คืน null) */
export function clearCount(state: State, kind: ClearKind, from: string, to: string): number | null {
  const days = state.days.filter((d) => inRange(d.date, from, to));
  switch (kind) {
    case "games":
      return days.reduce((n, d) => n + d.games.length, 0);
    case "bills":
      return days.reduce((n, d) => n + d.checkIns.length + d.drinks.length, 0);
    case "signups":
      return days.reduce((n, d) => n + (d.announcement !== undefined ? 1 : 0) + (d.signups?.length ?? 0) + (d.pairs?.length ?? 0), 0);
    case "monthly":
      return Object.entries(state.monthly).filter(([m]) => inRange(m, from.slice(0, 7), to.slice(0, 7))).reduce((n, [, v]) => n + Object.keys(v).length, 0);
    case "expenses":
      return (state.expenses ?? []).filter((e) => inRange(e.date, from, to)).length;
    case "polls":
      return (state.polls ?? []).filter((p) => inRange(dayOf(p.createdAt), from, to)).length;
    case "board":
      return (state.board ?? []).filter((b) => inRange(dayOf(b.at), from, to)).length;
    case "closed":
      return Object.keys(state.closed).filter((d) => inRange(d, from, to)).length;
    case "photos":
    case "tourneys":
      return null;
  }
}

/** ล้างในเครื่อง (state) ตามประเภทและช่วงวันที่ (งานแข่งเก็บแยก ล้างด้วย clearTourneyHistory) */
export function clearState(state: State, kinds: ClearKind[], from: string, to: string): State {
  const k = new Set(kinds);
  const out = (date: string) => !inRange(date, from, to);
  let s: State = {
    ...state,
    days: state.days.map((d) => {
      if (out(d.date)) return d;
      const nd = { ...d };
      if (k.has("games")) nd.games = [];
      if (k.has("bills")) {
        nd.checkIns = [];
        nd.drinks = [];
        nd.prices = undefined;
        nd.slips = undefined;
      }
      if (k.has("signups")) {
        nd.announcement = undefined;
        nd.announcementTitle = undefined;
        nd.announcementFee = undefined;
        nd.announcementCap = undefined;
        nd.signups = undefined;
        nd.pairs = undefined;
      }
      return nd;
    }),
  };
  if (k.has("monthly")) {
    const keep = (m: string) => !inRange(m, from.slice(0, 7), to.slice(0, 7));
    s = {
      ...s,
      monthly: Object.fromEntries(Object.entries(s.monthly).filter(([m]) => keep(m))),
      monthlyAmounts: Object.fromEntries(Object.entries(s.monthlyAmounts ?? {}).filter(([m]) => keep(m))),
    };
  }
  if (k.has("expenses")) s = { ...s, expenses: (s.expenses ?? []).filter((e) => out(e.date)) };
  if (k.has("polls")) s = { ...s, polls: (s.polls ?? []).filter((p) => out(dayOf(p.createdAt))) };
  if (k.has("board")) s = { ...s, board: (s.board ?? []).filter((b) => out(dayOf(b.at))) };
  if (k.has("closed")) s = { ...s, closed: Object.fromEntries(Object.entries(s.closed).filter(([d]) => out(d))) };
  return s;
}

/** ขอบเขตเวลาของวันที่ (เวลาไทย) สำหรับคอลัมน์ timestamptz */
export const startOf = (date: string) => `${date}T00:00:00+07:00`;
export const endOf = (date: string) => `${date}T23:59:59.999+07:00`;
