"use client";

import { useState } from "react";
import { billFor, type Bill } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { PayQr } from "./PayQr";
import { Button, Card, baht, inputClass } from "./ui";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BillDetail({ player, bill, onClose }: { player: Player; bill: Bill; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("น้ำ");
  const drinks = day.drinks.filter((d) => d.playerId === player.id);
  const s = state.settings;

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{player.name}</h3>
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
        </div>

        <div className="space-y-1">
          <Row label={player.isMonthly ? "ค่าสนาม (รายเดือน)" : "ค่าสนาม"} value={baht(bill.courtFee)} />
          <Row
            label={`ค่าลูก ${bill.shuttleCount} ลูก (${s.firstShuttleFee} + ${s.nextShuttleFee}×${Math.max(0, bill.shuttleCount - 1)})`}
            value={baht(bill.shuttleFee)}
          />
          <Row label="ค่าน้ำ" value={baht(bill.drinkFee)} />
          {bill.carriedOver > 0 && <Row label="ค้างจ่ายครั้งก่อน" value={baht(bill.carriedOver)} />}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-lg font-semibold dark:border-zinc-700">
            <span>รวม</span>
            <span>{baht(bill.total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">ค่าน้ำ</div>
          {drinks.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span>
                {d.note} {baht(d.amount)}
              </span>
              <button className="text-xs text-red-600 underline" onClick={() => dispatch({ type: "removeDrink", date, drinkId: d.id })}>
                ลบ
              </button>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(amount);
              if (!n || n <= 0) return;
              dispatch({ type: "addDrink", date, playerId: player.id, amount: n, note: note.trim() || "น้ำ" });
              setAmount("");
            }}
          >
            <input className={`${inputClass} min-w-0 flex-[2]`} value={note} onChange={(e) => setNote(e.target.value)} />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              inputMode="numeric"
              placeholder="บาท"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button type="submit">เพิ่ม</Button>
          </form>
        </div>

        {bill.paid ? (
          <div className="space-y-2 text-center">
            <p className="font-medium text-emerald-600">จ่ายแล้ว</p>
            <button className="text-xs underline" onClick={() => dispatch({ type: "unmarkPaid", date, playerId: player.id })}>
              ยกเลิกสถานะจ่ายแล้ว
            </button>
          </div>
        ) : (
          bill.total > 0 && (
            <div className="flex flex-col items-center gap-3">
              <PayQr promptPayId={s.promptPayId} amount={bill.total} />
              <Button
                variant="primary"
                className="w-full"
                onClick={() => dispatch({ type: "markPaid", date, playerId: player.id })}
              >
                ได้รับเงินแล้ว {baht(bill.total)}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function BillingTab() {
  const { state } = useStore();
  const { day } = useToday();
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));

  const rows = day.checkIns
    .map((c) => byId.get(c.playerId))
    .filter((p): p is Player => Boolean(p))
    .map((p) => ({ player: p, bill: billFor(state.days, day, p, state.settings) }))
    .sort((a, b) => Number(a.bill.paid) - Number(b.bill.paid) || a.player.name.localeCompare(b.player.name, "th"));

  const total = rows.reduce((s, r) => s + r.bill.total, 0);
  const received = rows.filter((r) => r.bill.paid).reduce((s, r) => s + r.bill.total, 0);
  const shuttlesUsed = day.games.reduce((s, g) => s + g.shuttles, 0);
  const openRow = rows.find((r) => r.player.id === open);

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-zinc-500">ยอดรวม</div>
          <div className="font-semibold">{baht(total)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">รับแล้ว</div>
          <div className="font-semibold text-emerald-600">{baht(received)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">ลูกที่ใช้</div>
          <div className="font-semibold">{shuttlesUsed} ลูก</div>
        </div>
      </Card>

      <ul className="space-y-2">
        {rows.map(({ player, bill }) => (
          <li key={player.id}>
            <button
              onClick={() => setOpen(player.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="flex-1">
                <span className="font-medium">{player.name}</span>
                <span className="block text-xs text-zinc-500">
                  {bill.shuttleCount} ลูก{bill.drinkFee > 0 && ` · น้ำ ${bill.drinkFee}`}
                  {bill.carriedOver > 0 && ` · ค้าง ${bill.carriedOver}`}
                </span>
              </span>
              <span className={`font-semibold ${bill.paid ? "text-emerald-600 line-through" : ""}`}>{baht(bill.total)}</span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="py-8 text-center text-sm text-zinc-500">ยังไม่มีคนเช็คอินวันนี้</li>}
      </ul>

      {openRow && <BillDetail player={openRow.player} bill={openRow.bill} onClose={() => setOpen(null)} />}
    </div>
  );
}
