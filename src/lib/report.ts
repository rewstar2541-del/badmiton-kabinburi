import { dayAmount } from "./billing";
import { monthlyAmount, type State } from "./state";
import { monthOf, type Expense, type ExpenseCategory } from "./types";

export interface DayRow {
  date: string;
  players: number;
  games: number;
  shuttles: number;
  courtFee: number;
  shuttleFee: number;
  drinks: number;
  total: number;
  received: number;
  unpaid: number;
}

export interface PlayerRow {
  name: string;
  visits: number;
  monthly: boolean;
  courtFee: number;
  shuttleFee: number;
  drinks: number;
  total: number;
  received: number;
  unpaid: number;
}

export interface MonthReport {
  month: string;
  days: DayRow[];
  players: PlayerRow[];
  monthlyFees: { name: string; paidAt: number; amount: number }[];
  /** รายจ่ายของก๊วนในเดือนนี้ เรียงตามวันที่ */
  expenses: Expense[];
  expenseBy: Record<ExpenseCategory, number>;
  /** รวมทั้งเดือน: ยอดรายวัน + ค่าสมาชิกรายเดือน, รายจ่าย และกำไร (รายรับที่เก็บได้แล้ว - รายจ่าย) */
  totals: DayRow & { monthlyFees: number; income: number; expenses: number; profit: number };
}

/** รายงานรายเดือนสำหรับทำบัญชี: แยกรายวัน รายคน และค่าสมาชิกรายเดือน */
export function monthReport(state: State, month: string): MonthReport {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const perPlayer = new Map<string, PlayerRow>();
  const days: DayRow[] = [];

  for (const d of state.days.filter((x) => monthOf(x.date) === month).sort((a, b) => a.date.localeCompare(b.date))) {
    const row: DayRow = {
      date: d.date,
      players: d.checkIns.length,
      games: d.games.filter((g) => g.endedAt).length,
      shuttles: d.games.reduce((s, g) => s + g.shuttles, 0),
      courtFee: 0,
      shuttleFee: 0,
      drinks: 0,
      total: 0,
      received: 0,
      unpaid: 0,
    };
    for (const c of d.checkIns) {
      const p = byId.get(c.playerId);
      if (!p) continue;
      const a = dayAmount(d, p, state.settings, state.monthly);
      row.courtFee += a.courtFee;
      row.shuttleFee += a.shuttleFee;
      row.drinks += a.drinkFee;
      row.total += a.amount;
      if (c.paidAt) row.received += a.amount;
      else row.unpaid += a.amount;

      const pr = perPlayer.get(p.id) ?? {
        name: p.name,
        visits: 0,
        monthly: Boolean(state.monthly[month]?.[p.id]),
        courtFee: 0,
        shuttleFee: 0,
        drinks: 0,
        total: 0,
        received: 0,
        unpaid: 0,
      };
      pr.visits++;
      pr.courtFee += a.courtFee;
      pr.shuttleFee += a.shuttleFee;
      pr.drinks += a.drinkFee;
      pr.total += a.amount;
      if (c.paidAt) pr.received += a.amount;
      else pr.unpaid += a.amount;
      perPlayer.set(p.id, pr);
    }
    days.push(row);
  }

  const monthlyFees = Object.entries(state.monthly[month] ?? {})
    .map(([id, paidAt]) => ({ name: byId.get(id)?.name ?? id, paidAt, amount: monthlyAmount(state, month, id) }))
    .sort((a, b) => a.paidAt - b.paidAt);

  const sum = (k: keyof DayRow) => days.reduce((s, r) => s + (r[k] as number), 0);
  const monthlyTotal = monthlyFees.reduce((s, m) => s + m.amount, 0);
  const expenses = (state.expenses ?? []).filter((e) => monthOf(e.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const expenseBy: Record<ExpenseCategory, number> = { court: 0, shuttle: 0, other: 0 };
  for (const e of expenses) expenseBy[e.category] += e.amount;
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const income = sum("received") + monthlyTotal;
  return {
    month,
    days,
    players: [...perPlayer.values()].sort((a, b) => a.name.localeCompare(b.name, "th")),
    monthlyFees,
    expenses,
    expenseBy,
    totals: {
      date: month,
      players: sum("players"),
      games: sum("games"),
      shuttles: sum("shuttles"),
      courtFee: sum("courtFee"),
      shuttleFee: sum("shuttleFee"),
      drinks: sum("drinks"),
      total: sum("total"),
      received: sum("received"),
      unpaid: sum("unpaid"),
      monthlyFees: monthlyTotal,
      income,
      expenses: expenseTotal,
      profit: income - expenseTotal,
    },
  };
}
