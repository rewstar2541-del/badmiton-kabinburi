import { nextMatch } from "./matchmaking";
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
  ["กอล์ฟ", "male", 5],
  ["ภูมิ", "male", 4],
  ["มายด์", "female", 3],
  ["เบนซ์", "male", 1],
  ["ฟ้า", "female", 2],
  ["ก้อง", "male", 3],
  ["ตั้ม", "male", 4],
  ["แนน", "female", 3],
  ["บิว", "male", 2],
  ["เมย์", "female", 4],
  ["อาร์ม", "male", 3],
  ["ปุ๊ก", "female", 2],
  ["ไผ่", "male", 4],
  ["ขิม", "female", 3],
];

/**
 * เวอร์ชันข้อมูลเดโม: เปลี่ยนเลขนี้เมื่อข้อมูลตัวอย่างหรือการตั้งค่าเดโมเปลี่ยน
 * เครื่องที่เก็บเดโมรุ่นเก่าไว้จะได้ข้อมูลชุดใหม่เองโดยไม่ต้องกด "เริ่มใหม่"
 */
export const DEMO_VERSION = 2;

/** ตั้งค่าสนามของเดโม ให้ตรงกับก๊วนจริง: 4 สนาม (เบอร์ 1-4) แอดมินจัดคนลงเอง เตรียมลงสนาม 20 วินาที */
export const DEMO_COURTS = { courtCount: 4, courtNumbers: [] as number[], autoAssign: false, fixedCourt: false, startDelay: 20, lastRoundDate: null };

/** ข้อมูลเดโมที่เก็บในเครื่องยังใช้ได้ไหม: รุ่นเดียวกันและสร้างวันนี้ (ข้ามวันแล้วสร้างใหม่ ให้มีเกมวันนี้ให้ดูเสมอ) */
export function demoFresh(meta: { version?: number; date?: string } | null, date = today()): boolean {
  return !!meta && meta.version === DEMO_VERSION && meta.date === date;
}

/**
 * ข้อมูลตัวอย่าง: ผู้เล่น 18 คน ประกาศจัดก๊วนวันนี้ ลงชื่อครบ เช็คอินแล้ว 17 (เหลือ 1 คนให้ลองกดเช็คอิน)
 * เกมวันนี้และวันก่อนจัดด้วย nextMatch ตัวจริง (เหมือนกดจัดคนลงในหน้าสนาม) ไม่ได้เลือกคนเอง
 * หน้าเดโมจะได้จับคู่มือเหมือนของจริง
 */
export function demoState(): State {
  const date = today();
  const now = Date.now();
  let s: State = {
    players: [],
    settings: { ...DEFAULT_SETTINGS, promptPayId: "0812345678", promptPayOn: true, bankOn: true, ...DEMO_COURTS },
    days: [],
    monthly: {},
    closed: {},
  };
  const run = (i: Parameters<typeof prepare>[0], at = now) => (s = reducer(s, prepare(i, at)));
  NAMES.forEach(([name, gender, level]) =>
    run({ type: "addPlayer", player: { name, gender, level } }),
  );
  run({ type: "setAnnouncement", date, message: "วันนี้ 1 ทุ่ม ถึง 4 ทุ่ม", cap: 30 });
  const n = s.players.length;
  s.players.forEach((p, i) => run({ type: "signUp", date, playerId: p.id }, now - (120 - i) * 60000));
  s.players.slice(0, n - 1).forEach((p, i) => run({ type: "checkIn", date, playerId: p.id }, now - (75 - i) * 60000));
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[0].id, paid: true });
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[3].id, paid: true });
  const ids = s.players.map((p) => p.id);
  const pad = (n: number) => String(n).padStart(2, "0");
  // จัดคนลงด้วยระบบจริง (nextMatch) ทุกเกม: ลงสนาม / จบเกมพร้อมผล ตามลำดับเวลา
  const dayOf = (d: string) => s.days.find((x) => x.date === d)!;
  const start = (d: string, court: number, at: number) => {
    const four = nextMatch(dayOf(d), s.players);
    if (four) run({ type: "startGame", date: d, court, playerIds: four }, at);
  };
  const end = (d: string, court: number, winner: "A" | "B", shuttles: number, at: number) => {
    const g = dayOf(d).games.find((x) => x.court === court && !x.endedAt);
    if (!g) return;
    run({ type: "setShuttles", date: d, gameId: g.id, shuttles });
    run({ type: "endGame", date: d, gameId: g.id, winner }, at);
  };
  const queue = (court: number, at: number) => {
    const four = nextMatch(dayOf(date), s.players);
    if (four) run({ type: "queueGame", date, court, playerIds: four }, at);
  };
  const min = (m: number) => now - m * 60000;
  // วันนี้ 4 สนาม เริ่มห่างกันสนามละ 3 นาที เกมละ 12 นาที (เรียงตามเวลาจริง ระบบจัดคู่เห็นข้อมูลเหมือนตอนกดจริง)
  type Ev = { at: number; run: () => void };
  const evs: Ev[] = [];
  [1, 2, 3, 4].forEach((court, c) => {
    // สนาม 4 เกมสุดท้ายเริ่ม 14 นาทีก่อน แล้วจบตอนเปิดเดโม (ดูด้านล่าง) สนามอื่นเกมสุดท้ายยังเล่นอยู่
    for (let k = 0, t = 62 - c * 3; t > (court === 4 ? 12 : 0); k++, t -= 13) {
      const st = t;
      evs.push({ at: min(st), run: () => start(date, court, min(st)) });
      if (st - 12 > (court === 4 ? 12 : 0)) evs.push({ at: min(st - 12), run: () => end(date, court, (k + c) % 2 ? "B" : "A", 1 + ((k + c) % 2), min(st - 12)) });
    }
  });
  evs.sort((a, b) => a.at - b.at).forEach((e) => e.run());
  // คิวรอสนาม 1 ที่แอดมินจัดไว้ แล้วสนาม 4 เพิ่งจบ: คู่ที่จัดไว้ขึ้น "เตรียมลงสนาม" นับถอยหลัง 20 วินาทีตอนเปิดเดโม
  queue(4, min(2));
  queue(1, min(1));
  end(date, 4, "A", 2, now);
  // ค่าน้ำและสลิปโอนเงินตัวอย่างวันนี้
  run({ type: "addDrink", date, playerId: ids[2], amount: 20, note: "น้ำ" });
  run({ type: "addDrink", date, playerId: ids[4], amount: 35, note: "น้ำเกลือแร่" });
  run({ type: "addSlip", date, playerId: ids[0], amount: 100 }, now - 5 * 60000);
  // ประวัติเกม 2 วันก่อนหน้า (ให้เห็นแท็บประวัติเกมและสถิติคู่หู) จัดด้วยระบบจริงเหมือนกัน
  [2, 5].forEach((back, k) => {
    const d = new Date(now - back * 86400000);
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const at = now - back * 86400000;
    ids.slice(k * 6, k * 6 + 12).forEach((id) => run({ type: "signUp", date: day, playerId: id }, at - 3600000));
    ids.slice(k * 6, k * 6 + 12).forEach((id, i) => run({ type: "checkIn", date: day, playerId: id }, at - 3000000 + i * 60000));
    const t = (m: number) => at - 2280000 + m * 60000;
    start(day, 1, t(0));
    start(day, 2, t(1));
    end(day, 1, "A", 1, t(12));
    start(day, 1, t(13));
    end(day, 2, "B", 2, t(15));
    start(day, 2, t(16));
    end(day, 1, "B", 1, t(26));
    end(day, 2, "A", 2, t(29));
  });
  // วันเกิดวันนี้ และบอร์ดของหาย / ฝากขาย ตัวอย่าง
  s = { ...s, players: s.players.map((p, i) => (i === 7 ? { ...p, birthday: date.slice(5) } : p)) };
  run({ type: "addBoardPost", post: { playerId: ids[2], kind: "sell", title: "ไม้ Yonex Astrox 77 มือสอง", detail: "ใช้มา 6 เดือน เอ็นใหม่", price: 2500 } }, now - 2 * 86400000);
  run({ type: "addBoardPost", post: { playerId: ids[1], kind: "lost", title: "ผ้าเช็ดตัวสีชมพู", detail: "ลืมไว้ที่ม้านั่งสนาม 3 เมื่อวาน" } }, now - 86400000);
  run({ type: "addNotice", notice: { kind: "news", title: "เก็บเงินค่าเสื้อก๊วน ตัวละ 350 บาท", body: "จ่ายได้ที่แอดมินถึงสิ้นเดือนนี้" } }, now - 3600000);
  {
    const ev = new Date(now + 5 * 86400000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    run({ type: "setAnnouncement", date: `${ev.getFullYear()}-${p2(ev.getMonth() + 1)}-${p2(ev.getDate())}`, message: "หลังตีเสร็จ กินหมูกระทะที่ร้านหน้าสนาม", title: "กินเลี้ยง", fee: 150 });
  }
  // วันงดเล่นตัวอย่าง: อีก 3 วัน
  const off = new Date(now + 3 * 86400000);
  run({ type: "setClosed", date: `${off.getFullYear()}-${pad(off.getMonth() + 1)}-${pad(off.getDate())}`, reason: "สนามปิดปรับปรุง" });
  return s;
}
