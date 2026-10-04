"use client";

import { useState } from "react";
import { billFor, type Bill } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import { monthOf, type Player } from "@/lib/types";
import { PayQr } from "./PayQr";
import { Avatar, Button, Card, Icon, SectionTitle, baht, inputClass } from "./ui";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          {title}
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-zinc-100" aria-label="ปิด">
            <Icon.X width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
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
    <Sheet
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <Avatar name={player.name} photo={player.photo} size={44} />
          <div>
            <h3 className="font-display text-lg font-semibold">{player.name}</h3>
            <p className="text-xs text-zinc-500">{bill.monthlyMember ? "สมาชิกรายเดือน" : "จ่ายรายวัน"}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-2 rounded-3xl bg-zinc-50 p-4">
        <Row label={bill.monthlyMember ? "ค่าสนาม (จ่ายรายเดือนแล้ว)" : "ค่าสนาม"} value={baht(bill.courtFee)} />
        <Row
          label={`ค่าลูก ${bill.shuttleCount} ลูก${bill.shuttleCount > 0 ? ` (${s.firstShuttleFee} + ${s.nextShuttleFee}×${bill.shuttleCount - 1})` : ""}`}
          value={baht(bill.shuttleFee)}
        />
        <Row label="ค่าน้ำ" value={baht(bill.drinkFee)} />
        {bill.carriedOver > 0 && <Row label="ค้างจ่ายครั้งก่อน" value={baht(bill.carriedOver)} />}
        <div className="flex items-baseline justify-between border-t border-dashed border-zinc-300 pt-3">
          <span className="font-medium">รวม</span>
          <span className="font-display text-2xl font-semibold">{baht(bill.total)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">ค่าน้ำ</div>
        {drinks.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
            <span>
              {d.note} · {baht(d.amount)}
            </span>
            <button className="text-xs text-red-500" onClick={() => dispatch({ type: "removeDrink", date, drinkId: d.id })}>
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
        <div className="space-y-2 rounded-3xl bg-emerald-50 p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-emerald-700">
            <Icon.Check width={18} height={18} /> จ่ายแล้ว
          </p>
          <button className="text-xs text-zinc-500 underline" onClick={() => dispatch({ type: "unmarkPaid", date, playerId: player.id })}>
            ยกเลิกสถานะจ่ายแล้ว
          </button>
        </div>
      ) : (
        bill.total > 0 && (
          <div className="flex flex-col items-center gap-3">
            <PayQr promptPayId={s.promptPayId} amount={bill.total} />
            <Button variant="accent" className="w-full" onClick={() => dispatch({ type: "markPaid", date, playerId: player.id })}>
              ได้รับเงินแล้ว {baht(bill.total)}
            </Button>
          </div>
        )
      )}
    </Sheet>
  );
}

function DailyView() {
  const { state } = useStore();
  const { day } = useToday();
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));

  const rows = day.checkIns
    .map((c) => byId.get(c.playerId))
    .filter((p): p is Player => Boolean(p))
    .map((p) => ({ player: p, bill: billFor(state.days, day, p, state.settings, state.monthly) }))
    .sort((a, b) => Number(a.bill.paid) - Number(b.bill.paid) || a.player.name.localeCompare(b.player.name, "th"));

  const total = rows.reduce((s, r) => s + r.bill.total, 0);
  const received = rows.filter((r) => r.bill.paid).reduce((s, r) => s + r.bill.total, 0);
  const shuttlesUsed = day.games.reduce((s, g) => s + g.shuttles, 0);
  const openRow = rows.find((r) => r.player.id === open);

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="text-xs text-white/60">ยอดรวมวันนี้</div>
        <div className="font-display text-3xl font-semibold">{baht(total)}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: total ? `${(received / total) * 100}%` : 0 }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/70">
          <span>รับแล้ว {baht(received)}</span>
          <span>ใช้ลูก {shuttlesUsed} ลูก</span>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map(({ player, bill }) => (
          <li key={player.id}>
            <button
              onClick={() => setOpen(player.id)}
              className="flex w-full items-center gap-3 rounded-3xl bg-white px-4 py-3 text-left shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.99]"
            >
              <Avatar name={player.name} photo={player.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{player.name}</span>
                <span className="block text-xs text-zinc-500">
                  {bill.shuttleCount} ลูก{bill.drinkFee > 0 && ` · น้ำ ${bill.drinkFee}`}
                  {bill.monthlyMember && " · รายเดือน"}
                  {bill.carriedOver > 0 && ` · ค้าง ${bill.carriedOver}`}
                </span>
              </span>
              {bill.paid ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">จ่ายแล้ว</span>
              ) : (
                <span className="font-display text-lg font-semibold">{bill.total}฿</span>
              )}
            </button>
          </li>
        ))}
        {rows.length === 0 && <Card className="py-10 text-center text-sm text-zinc-500">ยังไม่มีคนเช็คอินวันนี้</Card>}
      </ul>

      {openRow && <BillDetail player={openRow.player} bill={openRow.bill} onClose={() => setOpen(null)} />}
    </>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

/** แอดมินบันทึกว่าใครจ่ายรายเดือนของเดือนไหนแล้ว แก้ไขย้อนหลังได้ */
function MonthlyView() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const [month, setMonth] = useState(monthOf(date));
  const [payFor, setPayFor] = useState<Player | null>(null);
  const paid = state.monthly[month] ?? {};
  const fee = state.settings.monthlyFee;

  const players = [...state.players].sort(
    (a, b) => Number(Boolean(paid[b.id])) - Number(Boolean(paid[a.id])) || a.name.localeCompare(b.name, "th"),
  );
  const count = players.filter((p) => paid[p.id]).length;

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-center justify-between">
          <button className="grid size-9 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="เดือนก่อน">
            ‹
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
            <div className="text-xs text-white/60">ค่าสมาชิก {baht(fee)}</div>
          </div>
          <button className="grid size-9 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="เดือนถัดไป">
            ›
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-white/[0.07] py-2">
            <div className="font-display text-2xl font-semibold">{count}</div>
            <div className="text-[11px] text-white/60">คนจ่ายแล้ว</div>
          </div>
          <div className="rounded-2xl bg-white/[0.07] py-2">
            <div className="font-display text-2xl font-semibold">{(count * fee).toLocaleString("th-TH")}</div>
            <div className="text-[11px] text-white/60">บาทที่เก็บได้</div>
          </div>
        </div>
      </div>
      <p className="px-1 text-xs text-zinc-500">
        คนที่จ่ายเดือนนี้แล้ว ระบบไม่คิดค่าสนามรายวันให้อัตโนมัติ ถ้าบันทึกผิด แตะเพื่อแก้ได้เลย
      </p>

      <ul className="space-y-2">
        {players.map((p) => {
          const at = paid[p.id];
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
              <Avatar name={p.name} photo={p.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-zinc-500">
                  {at ? `จ่ายเมื่อ ${new Date(at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : "ยังไม่จ่าย"}
                </span>
              </span>
              {at ? (
                <button
                  className="flex items-center gap-1 rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-ink"
                  onClick={() => {
                    if (confirm(`ยกเลิกรายเดือน ${monthLabel(month)} ของ ${p.name}? ระบบจะกลับมาคิดค่าสนามรายวัน`))
                      dispatch({ type: "setMonthlyPaid", month, playerId: p.id, paid: false });
                  }}
                >
                  <Icon.Check width={14} height={14} strokeWidth={3} /> จ่ายแล้ว
                </button>
              ) : (
                <button className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600" onClick={() => setPayFor(p)}>
                  รับเงิน
                </button>
              )}
            </li>
          );
        })}
        {players.length === 0 && <Card className="py-10 text-center text-sm text-zinc-500">ยังไม่มีผู้เล่น</Card>}
      </ul>

      {payFor && (
        <Sheet
          onClose={() => setPayFor(null)}
          title={
            <div>
              <h3 className="font-display text-lg font-semibold">รายเดือน {payFor.name}</h3>
              <p className="text-xs text-zinc-500">{monthLabel(month)}</p>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3">
            <PayQr promptPayId={state.settings.promptPayId} amount={fee} />
            <Button
              variant="accent"
              className="w-full"
              onClick={() => {
                dispatch({ type: "setMonthlyPaid", month, playerId: payFor.id, paid: true });
                setPayFor(null);
              }}
            >
              ได้รับเงินแล้ว {baht(fee)}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}

export function BillingTab() {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  return (
    <div className="space-y-4">
      <SectionTitle>คิดเงิน</SectionTitle>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {(
          [
            ["daily", "วันนี้"],
            ["monthly", "รายเดือน"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${view === id ? "bg-ink text-white" : "text-zinc-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "daily" ? <DailyView /> : <MonthlyView />}
    </div>
  );
}
