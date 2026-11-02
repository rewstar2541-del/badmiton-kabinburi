"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { clock, courtsAt, normalizeCourts, rentAt, rentShares, rentSpan, rentTotal } from "@/lib/courtSplit";
import { dayAmount } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import type { Day, DayRent, Player } from "@/lib/types";
import { Avatar, Button, Card, Sheet, baht, inputClass } from "./ui";

const hh = clock;
const quarters = (a: number, b: number) => Array.from({ length: Math.max(Math.round((b - a) * 4) + 1, 0) }, (_, i) => a + i / 4);
const slots = (r: { start: number; end: number }) => Array.from({ length: Math.max(Math.ceil(r.end - r.start - 1e-9), 0) }, (_, i) => r.start + i);

function HourSelect({ value, from, to, onChange, label, disabled }: { value: number; from: number; to: number; onChange: (h: number) => void; label: string; disabled?: boolean }) {
  return (
    <select aria-label={label} disabled={disabled} className="min-h-11 rounded-xl bg-zinc-100 px-2 text-base disabled:opacity-60" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {quarters(from, to).map((h) => (
        <option key={h} value={h}>
          {hh(h)}
        </option>
      ))}
    </select>
  );
}

/** คนที่อยู่แต่ละชั่วโมง และคนละเท่าไร */
function HourTable({ rent, day }: { rent: DayRent; day: Day }) {
  const counted = day.checkIns.filter((c) => c.courtFee === undefined).map((c) => rentSpan(rent, c.at, c.hours));
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 rounded-2xl bg-zinc-50 p-3 text-sm">
      <span className="text-zinc-500">{t("ชั่วโมง")}</span>
      <span className="text-right text-zinc-500">{t("คน")}</span>
      <span className="text-right text-zinc-500">{t("คนละ")}</span>
      {slots(rent).map((h) => {
        const e = Math.min(h + 1, rent.end);
        const n = counted.filter((s) => s.from < e && h < s.to).length;
        return [
          <span key={`h${h}`} className="whitespace-nowrap">{`${hh(h)}-${hh(e)}`}{rent.courts && <span className="text-zinc-500">{` · ${t("{n} คอร์ท", { n: courtsAt(rent, h) })}`}</span>}</span>,
          <span key={`n${h}`} className="text-right">{n}</span>,
          <span key={`s${h}`} className="text-right font-semibold">{n ? baht(Math.round((rentAt(rent, h) * (e - h)) / n)) : "–"}</span>,
        ];
      })}
    </div>
  );
}

/** ผู้เล่น (ยอดของฉัน): วันสนามเช่า ดูอย่างเดียว เวลามา-กลับแอดมินเป็นคนแก้ */
export function MyRentHours({ player, day, rent }: { player: Player; day: Day; rent: DayRent }) {
  const { state } = useStore();
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  if (!ci) return null;
  const span = rentSpan(rent, ci.at, ci.hours);
  const share = dayAmount(day, player, state.settings, state.monthly).courtFee;
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="font-display font-semibold">{t("สนามเช่า")}</h2>
        <span className="rounded-2xl bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{rentLabel(rent)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>{t("เวลาของฉัน")}</span>
        <span className="font-semibold">{`${hh(span.from)}-${hh(span.to)}`}</span>
      </div>
      <HourTable rent={rent} day={day} />
      <div className="flex justify-between font-semibold">
        <span>{t("ค่าสนามของฉันตอนนี้")}</span>
        <span>{baht(share)}</span>
      </div>
      <p className="text-xs text-zinc-500">{t("หารตามคนที่อยู่แต่ละชั่วโมง เวลาไม่ตรงแจ้งแอดมินให้แก้")}</p>
    </Card>
  );
}

export type RentDraft = { start: number; end: number; perHour: string; courts: number[]; legacy?: boolean };

export const rentDraft = (r?: DayRent): RentDraft =>
  r ? { start: r.start, end: r.end, perHour: String(r.perHour), courts: slots(r).map((h) => courtsAt(r, h)), legacy: !r.courts } : { start: 19, end: 22, perHour: "", courts: [1, 1, 1] };

/** ค่าสนามเช่าครั้งล่าสุด ใช้เป็นค่าเริ่มต้นตอนตั้งสนามเช่าวันใหม่ */
export const lastRent = (days: Day[]): DayRent | undefined => [...days].filter((d) => d.rent).sort((a, b) => b.date.localeCompare(a.date))[0]?.rent;

export const rentDraftOk = (d: RentDraft) => Number(d.perHour) > 0 && d.end > d.start;

export const rentFromDraft = (d: RentDraft): DayRent => {
  const courts = normalizeCourts(d.start, d.end, d.courts);
  return { start: d.start, end: d.end, perHour: Number(d.perHour), ...(courts ? { courts } : {}) };
};

/** "18:30" → 18.5 ปัดทุก 15 นาที */
const parseTime = (v: string) => {
  const [a, b] = v.split(":").map(Number);
  return Number.isNaN(a) ? null : Math.round((a + (b || 0) / 60) * 4) / 4;
};

/** ฟอร์มสนามเช่า: เวลาเริ่ม-เลิก ราคาต่อคอร์ท และจำนวนคอร์ทแต่ละชั่วโมง (ใช้ทั้งตอนประกาศและหน้าคิดเงิน) */
export function RentFields({ value, onChange }: { value: RentDraft; onChange: (d: RentDraft) => void }) {
  // เปลี่ยนเวลาเริ่ม/เลิก: จำนวนคอร์ทของชั่วโมงเดิมยังอยู่ ชั่วโมงใหม่ใช้ค่าของชั่วโมงที่ใกล้ที่สุด
  const reshape = (start: number, end: number) => {
    const at = (h: number) => value.courts[Math.min(Math.max(h - value.start, 0), value.courts.length - 1)] ?? 1;
    onChange({ ...value, start, end, courts: slots({ start, end }).map((h) => at(h)) });
  };
  const setCourts = (i: number, n: number) => onChange({ ...value, courts: value.courts.map((c, j) => (j === i ? Math.min(Math.max(n, 1), 20) : c)) });
  const price = Number(value.perHour) || 0;
  const total = value.courts.reduce((sum, c) => sum + c * price, 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-medium">
          {t("เริ่มเช่า")}
          <input type="time" step={900} className={`${inputClass} mt-1`} value={hh(value.start)} onChange={(e) => {
              const h = parseTime(e.target.value);
              if (h !== null) reshape(Math.min(h, 23.75), Math.max(value.end, h + 0.25));
            }} />
        </label>
        <label className="block text-sm font-medium">
          {t("เลิก")}
          <input type="time" step={900} className={`${inputClass} mt-1`} value={value.end >= 24 ? "23:59" : hh(value.end)} onChange={(e) => {
              const h = parseTime(e.target.value);
              if (h !== null && h > value.start) reshape(value.start, h);
            }} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t("ค่าเช่าต่อคอร์ท ต่อชั่วโมง")}
        <input className={`${inputClass} mt-1`} inputMode="numeric" value={value.perHour} onChange={(e) => onChange({ ...value, perHour: e.target.value.replace(/\D/g, ""), legacy: false })} />
      </label>
      <div className="space-y-1">
        <div className="text-sm font-medium">{t("จำนวนคอร์ทแต่ละชั่วโมง")}</div>
        {value.legacy && value.courts.some((c) => c > 1) && (
          <p className="text-xs font-semibold text-amber-800">{t("ราคาเดิมเป็นค่าเช่ารวมทุกคอร์ท ถ้าเพิ่มคอร์ท ให้แก้เป็นราคาต่อ 1 คอร์ทด้วย")}</p>
        )}
        {value.courts.map((c, i) => (
          <div key={value.start + i} className="flex items-center gap-1 text-sm">
            <span className="w-[5rem] shrink-0 whitespace-nowrap text-[13px]">{`${hh(value.start + i)}-${hh(value.start + i + 1)}`}</span>
            <button type="button" aria-label={t("ลดคอร์ท")} disabled={c <= 1} className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-lg font-bold ring-1 ring-zinc-200 disabled:opacity-40" onClick={() => setCourts(i, c - 1)}>
              −
            </button>
            <span className="min-w-8 shrink-0 text-center text-base font-semibold">{c}</span>
            <button type="button" aria-label={t("เพิ่มคอร์ท")} className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-lg font-bold ring-1 ring-zinc-200" onClick={() => setCourts(i, c + 1)}>
              +
            </button>
            <span className="flex-1 whitespace-nowrap text-right text-xs text-zinc-500">{price ? (c * price).toLocaleString() : ""}</span>
          </div>
        ))}
      </div>
      {!!price && <div className="text-right text-sm font-semibold">{t("ค่าเช่ารวม {amount}", { amount: baht(total) })}</div>}
    </>
  );
}

/** สรุปสนามเช่าบรรทัดเดียว เช่น 19:00-22:00 · 4-5 คอร์ท · คอร์ทละ 200 */
export function rentLabel(rent: DayRent): string {
  const cs = slots(rent).map((h) => courtsAt(rent, h));
  const lo = Math.min(...cs);
  const hi = Math.max(...cs);
  if (!rent.courts) return t("{from}-{to} ชม.ละ {amount}", { from: hh(rent.start), to: hh(rent.end), amount: baht(rent.perHour) });
  return t("{from}-{to} · {courts} คอร์ท · คอร์ทละ {amount}/ชม.", { from: hh(rent.start), to: hh(rent.end), courts: lo === hi ? String(lo) : `${lo}-${hi}`, amount: baht(rent.perHour) });
}

/** แอดมิน: แก้เวลาเช่า จำนวนคอร์ท และค่าเช่าของวันนี้ได้จากหน้านี้เลย (เก็บที่ประกาศของวัน) */
function RentEdit({ rent, day }: { rent?: DayRent; day: Day }) {
  const { dispatch, state } = useStore();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(() => rentDraft(rent ?? lastRent(state.days)));
  const paid = day.checkIns.filter((c) => c.paidAt).length;
  const save = () => {
    if (paid && !confirm(t("มีคนจ่ายแล้ว {n} คน ยอดของคนที่จ่ายแล้วจะเปลี่ยนด้วย บันทึกไหม?", { n: paid }))) return;
    const next = rentFromDraft(draft);
    dispatch({ type: "setAnnouncement", date: day.date, message: day.announcement ?? "", rent: next });
    // ขยาย/ย่อเวลาเลิก: คนที่ตั้งไว้ว่าอยู่ถึงเลิกเดิม ให้อยู่ถึงเลิกใหม่ด้วย
    if (rent && next.end !== rent.end)
      for (const c of day.checkIns)
        if (!c.paidAt && c.hours && c.hours.to >= rent.end) dispatch({ type: "setHours", date: day.date, playerId: c.playerId, hours: { from: Math.min(c.hours.from, next.end - 0.25), to: next.end } });
    setSaved(true);
    setOpen(false);
  };
  if (!open)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-sm">
        <span className="min-w-0 flex-1">
          {saved && <span className="block text-xs font-semibold text-emerald-700">{t("บันทึกแล้ว")}</span>}
          {rent ? rentLabel(rent) : t("วันนี้ยังไม่ได้ตั้งเป็นสนามเช่า")}
        </span>
        <Button
          className="shrink-0"
          onClick={() => {
            setDraft(rentDraft(rent ?? lastRent(state.days)));
            setSaved(false);
            setOpen(true);
          }}
        >
          {rent ? t("แก้เวลา/ค่าเช่า") : t("ตั้งสนามเช่า")}
        </Button>
      </div>
    );
  return (
    <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
      <RentFields value={draft} onChange={setDraft} />
      {!!paid && <p className="text-xs font-semibold text-amber-800">{t("มีคนจ่ายแล้ว {n} คน ถ้าแก้ ยอดของคนที่จ่ายแล้วจะเปลี่ยนด้วย ต้องเก็บเพิ่มหรือคืนส่วนต่างเอง", { n: paid })}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setOpen(false)}>
          {t("ยกเลิก")}
        </Button>
        <Button variant="primary" className="flex-1" disabled={!rentDraftOk(draft)} onClick={save}>
          {t("บันทึก")}
        </Button>
      </div>
    </div>
  );
}

/** ตั้งค่า > ราคาและสนาม: สนามเช่าของวันนี้ (ต้องประกาศจัดก๊วนก่อน) */
export function RentTodayCard() {
  const { day } = useToday();
  return (
    <Card className="space-y-2">
      <h2 className="font-display font-semibold">{t("สนามเช่าวันนี้")}</h2>
      <p className="text-xs text-zinc-500">{t("ตั้งเวลา ราคาต่อคอร์ท และจำนวนคอร์ทแต่ละชั่วโมง แต่ละชั่วโมงหารให้คนที่อยู่ วันใหม่จะดึงค่าครั้งล่าสุดมาให้")}</p>
      {day.announcement !== undefined ? <RentEdit rent={day.rent} day={day} /> : <p className="rounded-2xl bg-zinc-50 p-3 text-sm">{t("วันนี้ยังไม่ได้ประกาศจัดก๊วน ประกาศก่อนแล้วตั้งสนามเช่าได้")}</p>}
    </Card>
  );
}

/** แอดมิน (คิดเงิน > วันนี้): วันสนามเช่า ดู/แก้เวลามา-กลับของแต่ละคน ยอดเปลี่ยนทันที */
export function RentHoursSheet({ rent, onClose }: { rent: DayRent; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const shares = rentShares(rent, day.checkIns);
  // ยอดจริงของแต่ละคน (คนจ่ายแล้วยอดคงที่)
  const feeOf = (id: string) => {
    const p = byId.get(id);
    return p ? dayAmount(day, p, state.settings, state.monthly).courtFee : (shares.get(id) ?? 0);
  };
  const collected = day.checkIns.reduce((sum, c) => sum + feeOf(c.playerId), 0);
  return (
    <Sheet title={t("สนามเช่า: เวลามา-กลับ")} onClose={onClose}>
      <RentEdit rent={rent} day={day} />
      <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
        {t("ค่าเช่ารวม {rent} · หารได้ {got}", { rent: baht(rentTotal(rent)), got: baht(collected) })}
      </div>
      <HourTable rent={rent} day={day} />
      {day.checkIns.some((c) => c.courtFee !== undefined && !c.paidAt) && (
        <Button
          className="w-full"
          onClick={() => {
            if (!confirm(t("ล้างยอดที่แก้เองของทุกคนที่ยังไม่จ่าย แล้วหารค่าเช่าใหม่?"))) return;
            for (const c of day.checkIns)
              if (c.courtFee !== undefined && !c.paidAt) dispatch({ type: "setBillFees", date: day.date, playerId: c.playerId, courtFee: null, shuttleFee: c.shuttleFee ?? null });
          }}
        >
          {t("ให้ทุกคนหารค่าเช่า (ล้างยอดที่แก้เอง)")}
        </Button>
      )}
      <ul className="space-y-2">
        {day.checkIns.map((c) => {
          const p = byId.get(c.playerId);
          if (!p) return null;
          const s = rentSpan(rent, c.at, c.hours);
          const set = (v: { from: number; to: number }) => dispatch({ type: "setHours", date: day.date, playerId: c.playerId, hours: v });
          return (
            <li key={c.playerId} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-zinc-100">
              <div className="flex items-center gap-2">
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                {c.courtFee !== undefined ? (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{t("แก้ยอดเอง {amount}", { amount: baht(c.courtFee) })}</span>
                ) : (
                  <span className="shrink-0 font-display text-lg font-semibold">{baht(feeOf(c.playerId))}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* จ่ายแล้วล็อกเวลา ยอดที่จ่ายจะได้ไม่เปลี่ยน */}
                <HourSelect label={t("มา")} disabled={Boolean(c.paidAt)} value={s.from} from={rent.start} to={rent.end - 0.25} onChange={(h) => set({ from: h, to: Math.max(s.to, h + 0.25) })} />
                <span>–</span>
                <HourSelect label={t("เวลากลับ")} disabled={Boolean(c.paidAt)} value={s.to} from={s.from + 0.25} to={rent.end} onChange={(h) => set({ ...s, to: h })} />
                {c.paidAt && <span className="text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500">{t("ไม่ให้ใครหาร เช่นโค้ช ให้กดชื่อในหน้าคิดเงินแล้วแก้ค่าสนามเอง คนที่แก้ยอดเองไม่นับในการหาร คนอื่นหารค่าเช่าเต็ม")}</p>
      <Button className="w-full" onClick={onClose}>
        {t("ปิด")}
      </Button>
    </Sheet>
  );
}
