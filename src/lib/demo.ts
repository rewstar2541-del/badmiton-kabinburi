import { prepare, reducer, today, type State } from "./state";
import { DEFAULT_SETTINGS, type Game, type Level, type Player } from "./types";

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
    settings: { ...DEFAULT_SETTINGS, promptPayId: "0812345678", promptPayOn: true, bankOn: true, courtNumbers: [], autoAssign: true },
    days: [],
    monthly: {},
    closed: {},
  };
  const run = (i: Parameters<typeof prepare>[0], at = now) => (s = reducer(s, prepare(i, at)));
  NAMES.forEach(([name, gender, level]) =>
    run({ type: "addPlayer", player: { name, gender, level } }),
  );
  run({ type: "setAnnouncement", date, message: "วันนี้ 1 ทุ่ม ถึง 4 ทุ่ม", cap: 9 });
  s.players.slice(0, 10).forEach((p, i) => run({ type: "signUp", date, playerId: p.id }, now - (60 - i) * 60000));
  s.players.slice(0, 8).forEach((p, i) => run({ type: "checkIn", date, playerId: p.id }, now - (40 - i * 3) * 60000));
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[0].id, paid: true });
  run({ type: "setMonthlyPaid", month: date.slice(0, 7), playerId: s.players[3].id, paid: true });
  // เกมที่จบแล้ววันนี้ พร้อมผลแพ้ชนะ (ให้เห็นสถิติคู่หู)
  const ids = s.players.map((p) => p.id);
  const pad = (n: number) => String(n).padStart(2, "0");
  const played: [number[], "A" | "B", number][] = [
    [[5, 0, 1, 2], "A", 2],
    [[5, 6, 3, 4], "A", 1],
    [[1, 5, 0, 7], "B", 2],
  ];
  played.forEach(([four, winner, shuttles], i) => {
    const start = now - (30 - i * 9) * 60000;
    run({ type: "startGame", date, court: 1 + (i % 2), playerIds: four.map((n) => ids[n]) as Game["playerIds"] }, start);
    const g = s.days.find((d) => d.date === date)!.games.at(-1)!;
    run({ type: "setShuttles", date, gameId: g.id, shuttles });
    run({ type: "endGame", date, gameId: g.id, winner }, start + 8 * 60000);
  });
  // เกมที่กำลังเล่นอยู่ 2 สนาม + คิวรอสนามละ 1 คู่ (ให้ลองเปลี่ยนตัว กดผลเอง และคิว)
  run({ type: "startGame", date, court: 1, playerIds: [2, 3, 4, 6].map((n) => ids[n]) as Game["playerIds"] }, now - 6 * 60000);
  run({ type: "startGame", date, court: 2, playerIds: [0, 1, 5, 7].map((n) => ids[n]) as Game["playerIds"] }, now - 3 * 60000);
  run({ type: "queueGame", date, court: 1, playerIds: [0, 5, 3, 7].map((n) => ids[n]) as Game["playerIds"] }, now);
  run({ type: "queueGame", date, court: 2, playerIds: [2, 1, 4, 6].map((n) => ids[n]) as Game["playerIds"] }, now);
  // ค่าน้ำและสลิปโอนเงินตัวอย่างวันนี้
  run({ type: "addDrink", date, playerId: ids[2], amount: 20, note: "น้ำ" });
  run({ type: "addDrink", date, playerId: ids[4], amount: 35, note: "น้ำเกลือแร่" });
  run({ type: "addSlip", date, playerId: ids[0], amount: 100 }, now - 5 * 60000);
  // ประวัติเกม 2 วันก่อนหน้า (ให้เห็นแท็บประวัติเกมและสถิติคู่หู)
  [2, 5].forEach((back, k) => {
    const d = new Date(now - back * 86400000);
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const at = now - back * 86400000;
    ids.slice(0, 8).forEach((id) => run({ type: "signUp", date: day, playerId: id }, at - 3600000));
    ids.slice(0, 8).forEach((id) => run({ type: "checkIn", date: day, playerId: id }, at - 3000000));
    ([[[0, 1, 2, 3], "A"], [[4, 5, 6, 7], "B"], [[0, 4, 1, 5], "A"]] as [number[], "A" | "B"][]).forEach(([four, winner], i) => {
      const t0 = at - (2400000 - i * 900000);
      run({ type: "startGame", date: day, court: 1 + ((i + k) % 2), playerIds: four.map((n) => ids[n]) as Game["playerIds"] }, t0);
      const g = s.days.find((x) => x.date === day)!.games.at(-1)!;
      run({ type: "setShuttles", date: day, gameId: g.id, shuttles: 1 + (i % 2) });
      run({ type: "endGame", date: day, gameId: g.id, winner }, t0 + 8 * 60000);
    });
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
