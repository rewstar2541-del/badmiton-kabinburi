import type { Day, Player, Settings } from "./types";

export interface Bill {
  playerId: string;
  courtFee: number;
  shuttleCount: number;
  shuttleFee: number;
  drinkFee: number;
  /** ยอดค้างจ่ายจากวันก่อนๆ */
  carriedOver: number;
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
export function dayAmount(day: Day, player: Player, s: Settings): Omit<Bill, "carriedOver" | "total" | "paid"> & { amount: number } {
  const courtFee = player.isMonthly ? 0 : s.courtFee;
  const shuttleCount = shuttleCountFor(day, player.id);
  const sFee = shuttleFee(shuttleCount, s);
  const drinkFee = day.drinks
    .filter((d) => d.playerId === player.id)
    .reduce((sum, d) => sum + d.amount, 0);
  return {
    playerId: player.id,
    courtFee,
    shuttleCount,
    shuttleFee: sFee,
    drinkFee,
    amount: courtFee + sFee + drinkFee,
  };
}

/** ยอดที่ยังไม่จ่ายจากวันก่อนหน้า `beforeDate` */
export function carriedOver(days: Day[], beforeDate: string, player: Player, s: Settings): number {
  return days
    .filter((d) => d.date < beforeDate)
    .reduce((sum, d) => {
      const ci = d.checkIns.find((c) => c.playerId === player.id);
      if (!ci || ci.paidAt) return sum;
      return sum + dayAmount(d, player, s).amount;
    }, 0);
}

export function billFor(days: Day[], day: Day, player: Player, s: Settings): Bill {
  const { amount, ...parts } = dayAmount(day, player, s);
  const prev = carriedOver(days, day.date, player, s);
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  return { ...parts, carriedOver: prev, total: amount + prev, paid: Boolean(ci?.paidAt) };
}

/**
 * จ่ายวันนี้ = ปิดยอดวันนี้และยอดค้างทั้งหมด
 * คืนค่า days ใหม่ที่ทุกวันที่ผู้เล่นค้างจ่าย (จนถึงวันนี้) ถูกตั้ง paidAt
 */
export function markPaid(days: Day[], date: string, playerId: string, at: number): Day[] {
  return days.map((d) =>
    d.date > date
      ? d
      : {
          ...d,
          checkIns: d.checkIns.map((c) =>
            c.playerId === playerId && !c.paidAt ? { ...c, paidAt: at } : c,
          ),
        },
  );
}
