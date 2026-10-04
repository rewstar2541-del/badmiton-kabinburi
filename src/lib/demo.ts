import { prepare, reducer, today, type State } from "./state";
import { DEFAULT_SETTINGS, type Level, type Player } from "./types";

/** โหมดทดลอง: เปิดด้วย ?demo หรือ build ด้วย NEXT_PUBLIC_DEMO=1 ข้อมูลอยู่ในเครื่องเท่านั้น */
export function isDemo(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO === "1") return true;
  try {
    return new URLSearchParams(window.location.search).has("demo");
  } catch {
    return false;
  }
}

const NAMES: [string, Player["gender"], Level][] = [
  ["ต้น", "male", 4],
  ["ฝน", "female", 2],
  ["บอล", "male", 5],
  ["แพร", "female", 3],
  ["เอก", "male", 3],
  ["มิว", "female", 1],
  ["โอ๊ต", "male", 4],
  ["จูน", "female", 3],
  ["ปั้น", "male", 2],
  ["นุ่น", "female", 4],
  ["เจ", "male", 3],
  ["ใบเตย", "female", 2],
];

/** ข้อมูลตัวอย่าง: ผู้เล่น 12 คน ประกาศจัดก๊วนวันนี้ มีคนลงชื่อและเช็คอินบางส่วน */
export function demoState(): State {
  const date = today();
  const now = Date.now();
  let s: State = {
    players: [],
    settings: { ...DEFAULT_SETTINGS, promptPayId: "0812345678" },
    days: [],
    monthly: {},
  };
  const run = (i: Parameters<typeof prepare>[0], at = now) => (s = reducer(s, prepare(i, at)));
  NAMES.forEach(([name, gender, level], i) =>
    run({ type: "addPlayer", player: { name, gender, level, phone: `08123456${String(i).padStart(2, "0")}` } }),
  );
  run({ type: "setAnnouncement", date, message: "วันนี้ 1 ทุ่ม ถึง 4 ทุ่ม" });
  s.players.slice(0, 10).forEach((p, i) => run({ type: "signUp", date, playerId: p.id }, now - (60 - i) * 60000));
  s.players.slice(0, 8).forEach((p, i) => run({ type: "checkIn", date, playerId: p.id }, now - (40 - i * 3) * 60000));
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[0].id, paid: true });
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[3].id, paid: true });
  return s;
}
