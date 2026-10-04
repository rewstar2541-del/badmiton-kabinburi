"use client";

import { useState } from "react";
import { billFor, dayAmount, shuttleFormula, type Bill } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { monthOf, type Drink, type Player } from "@/lib/types";
import { ExportReport } from "./ExportReport";
import { Ledger } from "./Ledger";
import { PayQr } from "./PayQr";
import { SlipReview } from "./Slips";
import { Avatar, Button, Card, Icon, SearchInput, SectionTitle, Sheet, baht, inputClass } from "./ui";
import { visibleRoster } from "@/lib/roster";
import { Auto } from "@/lib/autoTranslate";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** แก้ราคาค่าน้ำรายการเดียว */
function DrinkRow({ drink, date }: { drink: Drink; date: string }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(drink.amount));
  if (editing)
    return (
      <form
        className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!(n > 0)) return;
          dispatch({ type: "editDrink", date, drinkId: drink.id, amount: n, note: drink.note });
          setEditing(false);
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          <Auto text={drink.note} />
        </span>
        <input
          className={`${inputClass} w-20 py-1.5`}
          inputMode="numeric"
          autoFocus
          aria-label={t("บาท")}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <Button type="submit">{t("บันทึก")}</Button>
      </form>
    );
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        <Auto text={drink.note} /> · {baht(drink.amount)}
      </span>
      <button className="text-xs font-semibold text-sky-700" onClick={() => setEditing(true)}>
        {t("แก้ราคา")}
      </button>
      <button className="text-xs text-red-500" onClick={() => dispatch({ type: "removeDrink", date, drinkId: drink.id })}>
        {t("ลบ")}
      </button>
    </div>
  );
}

/** แอดมินแก้ค่าสนาม / ค่าลูกของคนนี้วันนี้ (เช่น ลดให้ หรือคิดผิด) */
function FeeEditor({ player, bill }: { player: Player; bill: Bill }) {
  const { dispatch } = useStore();
  const { date, day } = useToday();
  const [open, setOpen] = useState(false);
  const [court, setCourt] = useState(String(bill.courtFee));
  const [shuttle, setShuttle] = useState(String(bill.shuttleFee));
  if (!day.checkIns.some((c) => c.playerId === player.id)) return null;
  const adjusted = bill.courtAdjusted || bill.shuttleAdjusted;
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const clean = (v: string) => v.replace(/[^\d.]/g, "");

  if (!open)
    return (
      <button className="w-full rounded-2xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600" onClick={() => setOpen(true)}>
        {adjusted ? t("แก้ยอดค่าสนาม / ค่าลูกแล้ว (กดเพื่อดู)") : t("แก้ยอดค่าสนาม / ค่าลูก ของคนนี้วันนี้")}
      </button>
    );
  return (
    <form
      className="space-y-2 rounded-3xl bg-zinc-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        // เก็บเฉพาะช่องที่แก้ ช่องที่ไม่ได้แตะยังคิดตามราคาปกติ
        const keep = (v: string, now: number, adjusted: boolean) => (adjusted || num(v) !== now ? num(v) : null);
        dispatch({
          type: "setBillFees",
          date,
          playerId: player.id,
          courtFee: keep(court, bill.courtFee, bill.courtAdjusted),
          shuttleFee: keep(shuttle, bill.shuttleFee, bill.shuttleAdjusted),
        });
        setOpen(false);
      }}
    >
      <div className="text-sm font-semibold">{t("แก้ยอดของคนนี้วันนี้")}</div>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 text-xs text-zinc-500">
          {t("ค่าสนาม")}
          <input className={inputClass} inputMode="numeric" value={court} onChange={(e) => setCourt(clean(e.target.value))} />
        </label>
        <label className="min-w-0 flex-1 text-xs text-zinc-500">
          {t("ค่าลูกรวม")}
          <input className={inputClass} inputMode="numeric" value={shuttle} onChange={(e) => setShuttle(clean(e.target.value))} />
        </label>
      </div>
      <p className="text-xs text-zinc-500">{t("ใช้เฉพาะบิลของคนนี้วันนี้ ราคาปกติแก้ที่แท็บตั้งค่า")}</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1">
          {t("บันทึก")}
        </Button>
        {adjusted ? (
          <Button
            type="button"
            onClick={() => {
              dispatch({ type: "setBillFees", date, playerId: player.id, courtFee: null, shuttleFee: null });
              setOpen(false);
            }}
          >
            {t("คิดตามราคาปกติ")}
          </Button>
        ) : (
          <Button type="button" onClick={() => setOpen(false)}>
            {t("ยกเลิก")}
          </Button>
        )}
      </div>
    </form>
  );
}

function BillDetail({ player, bill, onClose }: { player: Player; bill: Bill; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(() => t("น้ำ"));
  const drinks = day.drinks.filter((d) => d.playerId === player.id);
  const host = player.guestOf ? state.players.find((p) => p.id === player.guestOf) : undefined;
  const s = state.settings;

  return (
    <Sheet
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <Avatar name={player.name} photo={player.photo} size={44} />
          <div>
            <h3 className="font-display text-lg font-semibold">{player.name}</h3>
            <p className="text-xs text-zinc-500">{bill.monthlyMember ? t("สมาชิกรายเดือน") : t("จ่ายรายวัน")}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-2 rounded-3xl bg-zinc-50 p-4">
        <Row label={(bill.monthlyMember ? t("ค่าสนาม (จ่ายรายเดือนแล้ว)") : t("ค่าสนาม")) + (bill.courtAdjusted ? ` (${t("แอดมินแก้ยอด")})` : "")} value={baht(bill.courtFee)} />
        <Row
          label={
            t("ค่าลูก {n} ลูก", { n: bill.shuttleCount }) +
            shuttleFormula(bill) +
            (bill.shuttleAdjusted ? ` (${t("แอดมินแก้ยอด")})` : "")
          }
          value={baht(bill.shuttleFee)}
        />
        <Row label={t("ค่าน้ำ")} value={baht(bill.drinkFee)} />
        {bill.carriedOver > 0 && <Row label={t("ค้างจ่ายครั้งก่อน")} value={baht(bill.carriedOver)} />}
        {bill.guests.map((g) => (
          <Row key={g.playerId} label={t("แขก: {name}", { name: g.name })} value={baht(g.amount)} />
        ))}
        <div className="flex items-baseline justify-between border-t border-dashed border-zinc-300 pt-3">
          <span className="font-medium">{t("รวม")}</span>
          <span className="font-display text-2xl font-semibold">{baht(bill.total)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">{t("ค่าน้ำ")}</div>
        {drinks.map((d) => (
          <DrinkRow key={d.id} drink={d} date={date} />
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!n || n <= 0) return;
            dispatch({ type: "addDrink", date, playerId: player.id, amount: n, note: note.trim() || t("น้ำ") });
            setAmount("");
          }}
        >
          <input className={`${inputClass} min-w-0 flex-[2]`} value={note} onChange={(e) => setNote(e.target.value)} />
          <input
            className={`${inputClass} min-w-0 flex-1`}
            inputMode="numeric"
            placeholder={t("บาท")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button type="submit">{t("เพิ่ม")}</Button>
        </form>
      </div>

      <FeeEditor key={`${bill.courtFee}|${bill.shuttleFee}`} player={player} bill={bill} />

      <SlipReview playerId={player.id} />

      {bill.paid ? (
        <div className="space-y-2 rounded-3xl bg-emerald-50 p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-emerald-700">
            <Icon.Check width={18} height={18} /> {t("จ่ายแล้ว")}
          </p>
          <button className="text-xs text-zinc-500 underline" onClick={() => dispatch({ type: "unmarkPaid", date, playerId: player.id })}>
            {t("ยกเลิกสถานะจ่ายแล้ว")}
          </button>
        </div>
      ) : host ? (
        <p className="rounded-3xl bg-amber-50 p-4 text-center text-sm text-amber-900">
          {t("แขกของ {name} ยอดนี้รวมในบิลของ {name} จ่ายพร้อมกัน", { name: host.name })}
        </p>
      ) : (
        bill.total > 0 && (
          <div className="flex flex-col items-center gap-3">
            <PayQr promptPayId={s.promptPayId} amount={bill.total} />
            <Button variant="accent" className="w-full" onClick={() => dispatch({ type: "markPaid", date, playerId: player.id })}>
              {t("บันทึกว่าจ่ายแล้ว {amount}", { amount: baht(bill.total) })}
            </Button>
            <p className="text-center text-xs text-zinc-500">{t("ปกติผู้เล่นกดจ่ายเองในหน้ายอดของฉัน ปุ่มนี้ไว้ใช้เมื่อผู้เล่นจ่ายเงินสดกับแอดมิน")}</p>
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
    .map((p) => ({ player: p, bill: billFor(state.days, day, p, state.settings, state.monthly, state.players) }))
    .sort((a, b) => Number(a.bill.paid) - Number(b.bill.paid) || a.player.name.localeCompare(b.player.name, "th"));

  // นับยอดวันนี้ของแต่ละคนเอง (แขกนับในแถวของแขก ไม่นับซ้ำในบิลคนพามา)
  // รับแล้ว = คนที่เช็คอินวันนี้ถูกปิดยอดแล้ว ไม่ขึ้นกับว่าคนพามายังค้างยอดแขกที่เพิ่มทีหลังไหม
  const paidToday = new Set(day.checkIns.filter((c) => c.paidAt).map((c) => c.playerId));
  const own = (p: Player) => dayAmount(day, p, state.settings, state.monthly).amount;
  const total = rows.reduce((s, r) => s + own(r.player) + (paidToday.has(r.player.id) ? 0 : r.bill.carriedOver), 0);
  const received = rows.filter((r) => paidToday.has(r.player.id)).reduce((s, r) => s + own(r.player), 0);
  const shuttlesUsed = day.games.reduce((s, g) => s + g.shuttles, 0);
  const openRow = rows.find((r) => r.player.id === open);
  const withSlip = new Set(day.slips?.map((s) => s.playerId));

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="text-xs text-white/60">{t("ยอดรวมวันนี้")}</div>
        <div className="font-display text-3xl font-semibold">{baht(total)}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: total ? `${(received / total) * 100}%` : 0 }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/70">
          <span>{t("รับแล้ว {amount}", { amount: baht(received) })}</span>
          <span>{t("ใช้ลูก {n} ลูก", { n: shuttlesUsed })}</span>
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
                  {t("{n} ลูก", { n: bill.shuttleCount })}
                  {bill.drinkFee > 0 && ` · ${t("น้ำ {n}", { n: bill.drinkFee })}`}
                  {bill.monthlyMember && ` · ${t("รายเดือน")}`}
                  {bill.carriedOver > 0 && ` · ${t("ค้าง {n}", { n: bill.carriedOver })}`}
                  {bill.guests.length > 0 && ` · ${t("รวมแขก {n} คน", { n: bill.guests.length })}`}
                  {player.guestOf && ` · ${t("แขกของ {name}", { name: byId.get(player.guestOf)?.name ?? "?" })}`}
                </span>
              </span>
              {!bill.paid && withSlip.has(player.id) && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{t("มีสลิป")}</span>
              )}
              {bill.paid ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>
              ) : player.guestOf ? (
                <span className="text-xs text-zinc-400">{t("รวมในบิลคนพามา")}</span>
              ) : (
                <span className="font-display text-lg font-semibold">{bill.total}฿</span>
              )}
            </button>
          </li>
        ))}
        {rows.length === 0 && <Card className="py-10 text-center text-sm text-zinc-500">{t("ยังไม่มีคนเช็คอินวันนี้")}</Card>}
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
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
}

/** แอดมินบันทึกว่าใครจ่ายรายเดือนของเดือนไหนแล้ว แก้ไขย้อนหลังได้ */
function MonthlyView() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const [month, setMonth] = useState(monthOf(date));
  const [payFor, setPayFor] = useState<Player | null>(null);
  const [q, setQ] = useState("");
  const paid = state.monthly[month] ?? {};
  const fee = state.settings.monthlyFee;

  const members = state.players.filter((p) => !p.guestOf && !p.pending);
  const count = members.filter((p) => paid[p.id]).length;
  // สมาชิกรายเดือนที่ยังไม่จ่ายเดือนนี้
  // ใช้แบบสมาชิกปัจจุบัน จึงแสดงเฉพาะเดือนนี้ (เดือนก่อนๆ บางคนอาจยังเป็นรายวัน)
  const owing = members.filter((p) => month === monthOf(date) && p.plan === "monthly" && !paid[p.id]).sort((a, b) => a.name.localeCompare(b.name, "th"));
  // แสดงคนที่จ่ายแล้วหรือมาเล่นในเดือนนี้ คนอื่นค้นหาชื่อ
  const came = new Set(state.days.filter((d) => monthOf(d.date) === month).flatMap((d) => d.checkIns.map((c) => c.playerId)));
  const players = visibleRoster(members, q, (p) => Boolean(paid[p.id]) || came.has(p.id) || p.plan === "monthly").sort(
    (a, b) => Number(Boolean(paid[b.id])) - Number(Boolean(paid[a.id])) || a.name.localeCompare(b.name, "th"),
  );
  const hidden = members.length - players.length;
  const slipIn = new Set(state.days.filter((d) => monthOf(d.date) === month).flatMap((d) => (d.slips ?? []).map((x) => x.playerId)));

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-center justify-between">
          <button className="grid size-9 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("เดือนก่อน")}>
            ‹
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
            <div className="text-xs text-white/60">{t("ค่าสมาชิก {amount}", { amount: baht(fee) })}</div>
          </div>
          <button className="grid size-9 place-items-center rounded-full bg-white/10" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("เดือนถัดไป")}>
            ›
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-white/[0.07] py-2">
            <div className="font-display text-2xl font-semibold">{count}</div>
            <div className="text-[11px] text-white/60">{t("คนจ่ายแล้ว")}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.07] py-2">
            <div className="font-display text-2xl font-semibold">{(count * fee).toLocaleString("th-TH")}</div>
            <div className="text-[11px] text-white/60">{t("บาทที่เก็บได้")}</div>
          </div>
        </div>
      </div>
      {owing.length > 0 && (
        <div className="space-y-2 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display font-semibold text-amber-950">{t("สมาชิกรายเดือนที่ยังไม่จ่าย")}</h3>
            <span className="shrink-0 text-sm text-amber-900">
              {t("{n} คน", { n: owing.length })} · {baht(owing.length * fee)}
            </span>
          </div>
          <ul className="space-y-1.5">
            {owing.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2">
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <button className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600" onClick={() => setPayFor(p)}>
                  {t("รับเงิน")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Ledger key={month} month={month} />
      <ExportReport month={month} />
      <p className="px-1 text-xs text-zinc-500">
        {t("คนที่จ่ายเดือนนี้แล้ว ระบบไม่คิดค่าสนามรายวันให้อัตโนมัติ ถ้าบันทึกผิด แตะเพื่อแก้ได้เลย")}
      </p>

      <SearchInput value={q} onChange={setQ} />
      {!q.trim() && hidden > 0 && (
        <p className="px-1 text-xs text-zinc-500">{t("แสดงเฉพาะคนที่จ่ายแล้วหรือมาเล่นเดือนนี้ อีก {n} คนพิมพ์ชื่อค้นหา", { n: hidden })}</p>
      )}
      <ul className="space-y-2">
        {players.map((p) => {
          const at = paid[p.id];
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
              <Avatar name={p.name} photo={p.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-zinc-500">
                  {at
                    ? t("จ่ายเมื่อ {date}", { date: new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" }) })
                    : t("ยังไม่จ่าย")}
                </span>
              </span>
              {!at && slipIn.has(p.id) && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{t("มีสลิป")}</span>
              )}
              {at ? (
                <button
                  className="flex items-center gap-1 rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-ink"
                  onClick={() => {
                    if (confirm(t("ยกเลิกรายเดือน {month} ของ {name}? ระบบจะกลับมาคิดค่าสนามรายวัน", { month: monthLabel(month), name: p.name })))
                      dispatch({ type: "setMonthlyPaid", month, playerId: p.id, paid: false });
                  }}
                >
                  <Icon.Check width={14} height={14} strokeWidth={3} /> {t("จ่ายแล้ว")}
                </button>
              ) : (
                <button className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600" onClick={() => setPayFor(p)}>
                  {t("รับเงิน")}
                </button>
              )}
            </li>
          );
        })}
        {players.length === 0 && (
          <Card className="py-10 text-center text-sm text-zinc-500">{members.length ? t("ไม่พบชื่อที่ค้นหา") : t("ยังไม่มีผู้เล่น")}</Card>
        )}
      </ul>

      {payFor && (
        <Sheet
          onClose={() => setPayFor(null)}
          title={
            <div>
              <h3 className="font-display text-lg font-semibold">{t("รายเดือน {name}", { name: payFor.name })}</h3>
              <p className="text-xs text-zinc-500">{monthLabel(month)}</p>
            </div>
          }
        >
          <SlipReview playerId={payFor.id} month={month} />
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
              {t("ได้รับเงินแล้ว {amount}", { amount: baht(fee) })}
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
      <SectionTitle>{t("คิดเงิน")}</SectionTitle>
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
            {t(label)}
          </button>
        ))}
      </div>
      {view === "daily" ? <DailyView /> : <MonthlyView />}
    </div>
  );
}
