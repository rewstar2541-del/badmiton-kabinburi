import { isMonthlyPaid, type Day, type MonthlyPayments, type Player, type Settings } from "./types";

export interface Bill {
  playerId: string;
  /** จ่ายรายเดือนของเดือนนั้นแล้ว จึงไม่คิดค่าสนาม */
  monthlyMember: boolean;
  courtFee: number;
  shuttleCount: number;
  shuttleFee: number;
  drinkFee: number;
  /** ยอดค้างจ่ายจากวันก่อนๆ */
  carriedOver: number;
  /** ยอดของแขกที่พามา (วันนี้ + ค้าง) รวมอยู่ใน total แล้ว */
  guests: { playerId: string; name: string; amount: number }[];
  total: number;
  paid: boolean;
}

export function shuttleCountFor(day: Day, playerId: string): number {
  return day.games
    .filter((g) => g.playerIds.includes(playerId))
    .reduce((sum, g) => sum + g.shuttles, 0);
}

/** ลูกแรกของวันคิด firstShuttleFee ลูกต่อไปคิด nextShuttleFee ต่อลูก */
export function shuttleFee(count: number, s: Settings): number {
  if (count <= 0) return 0;
  return s.firstShuttleFee + (count - 1) * s.nextShuttleFee;
}

/** ยอดของวันนั้นวันเดียว ไม่รวมยอดค้าง */
export function dayAmount(
  day: Day,
  player: Player,
  s: Settings,
  monthly: MonthlyPayments,
): Omit<Bill, "carriedOver" | "guests" | "total" | "paid"> & { amount: number } {
  const monthlyMember = isMonthlyPaid(monthly, day.date, player.id);
  const courtFee = monthlyMember ? 0 : s.courtFee;
  const shuttleCount = shuttleCountFor(day, player.id);
  const sFee = shuttleFee(shuttleCount, s);
  const drinkFee = day.drinks
    .filter((d) => d.playerId === player.id)
    .reduce((sum, d) => sum + d.amount, 0);
  return {
    playerId: player.id,
    monthlyMember,
    courtFee,
    shuttleCount,
    shuttleFee: sFee,
    drinkFee,
    amount: courtFee + sFee + drinkFee,
  };
}

/** ยอดที่ยังไม่จ่ายจากวันก่อนหน้า `beforeDate` */
export function carriedOver(days: Day[], beforeDate: string, player: Player, s: Settings, monthly: MonthlyPayments): number {
  return days
    .filter((d) => d.date < beforeDate)
    .reduce((sum, d) => {
      const ci = d.checkIns.find((c) => c.playerId === player.id);
      if (!ci || ci.paidAt) return sum;
      return sum + dayAmount(d, player, s, monthly).amount;
    }, 0);
}

/** แขกของผู้เล่นคนนี้ */
export function guestsOf(players: Player[], hostId: string): Player[] {
  return players.filter((p) => p.guestOf === hostId);
}

/**
 * บิลของผู้เล่น ถ้าส่ง players มาด้วย จะรวมยอดของแขกที่ผู้เล่นคนนี้พามาไว้ใน total
 * (แขกไม่จ่ายเอง คนพามาจ่ายรวม)
 */
export function billFor(days: Day[], day: Day, player: Player, s: Settings, monthly: MonthlyPayments, players: Player[] = []): Bill {
  const { amount, ...parts } = dayAmount(day, player, s, monthly);
  const prev = carriedOver(days, day.date, player, s, monthly);
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  const guestDues = guestsOf(players, player.id).map((g) => {
    const gci = day.checkIns.find((c) => c.playerId === g.id);
    const today = gci ? dayAmount(day, g, s, monthly).amount : 0;
    const gPrev = carriedOver(days, day.date, g, s, monthly);
    return { playerId: g.id, name: g.name, full: today + gPrev, unpaid: (gci?.paidAt ? 0 : today) + gPrev };
  });
  const unpaid = guestDues.some((g) => g.unpaid > 0);
  // ยังมียอดแขกค้าง แสดงเฉพาะที่ค้าง จ่ายครบแล้วแสดงยอดเต็มเป็นใบเสร็จ
  const guests = guestDues
    .map((g) => ({ playerId: g.playerId, name: g.name, amount: unpaid ? g.unpaid : g.full }))
    .filter((g) => g.amount > 0);
  const guestTotal = guests.reduce((sum, g) => sum + g.amount, 0);
  const selfPaid = Boolean(ci?.paidAt);
  // จ่ายของตัวเองไปแล้วแต่มีแขกค้าง (เช่นเพิ่มแขกทีหลัง) เหลือแค่ยอดแขก
  const own = selfPaid && unpaid ? 0 : amount + prev;
  return { ...parts, carriedOver: prev, guests, total: own + guestTotal, paid: selfPaid && !unpaid };
}

/**
 * จ่ายวันนี้ = ปิดยอดวันนี้และยอดค้างทั้งหมด
 * คืนค่า days ใหม่ที่ทุกวันที่ผู้เล่นค้างจ่าย (จนถึงวันนี้) ถูกตั้ง paidAt
 */
export function markPaid(days: Day[], date: string, playerId: string | string[], at: number): Day[] {
  const ids = new Set(Array.isArray(playerId) ? playerId : [playerId]);
  return days.map((d) =>
    d.date > date
      ? d
      : {
          ...d,
          checkIns: d.checkIns.map((c) =>
            ids.has(c.playerId) && !c.paidAt ? { ...c, paidAt: at } : c,
          ),
        },
  );
}
