"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { rentShares, rentSpan } from "@/lib/courtSplit";
import { dayAmount } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import type { Day, DayRent, Player } from "@/lib/types";
import { savedPin } from "./PickMe";
import { Avatar, Button, Card, Sheet, baht, inputClass } from "./ui";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const range = (a: number, b: number) =>
  Array.from({ length: Math.max(b - a + 1, 0) }, (_, i) => a + i);

function HourSelect({
  value,
  from,
  to,
  onChange,
  label,
  disabled,
}: {
  value: number;
  from: number;
  to: number;
  onChange: (h: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      className="min-h-11 rounded-xl bg-zinc-100 px-2 text-base disabled:opacity-60"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {range(from, to).map((h) => (
        <option key={h} value={h}>
          {hh(h)}
        </option>
      ))}
    </select>
  );
}

/** คนที่อยู่แต่ละชั่วโมง และคนละเท่าไร */
function HourTable({ rent, day }: { rent: DayRent; day: Day }) {
  const counted = day.checkIns
    .filter((c) => c.courtFee === undefined)
    .map((c) => rentSpan(rent, c.at, c.hours));
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-1 rounded-2xl bg-zinc-50 p-3 text-sm">
      <span className="text-zinc-500">{t("ชั่วโมง")}</span>
      <span className="text-right text-zinc-500">{t("คน")}</span>
      <span className="text-right text-zinc-500">{t("คนละ")}</span>
      {range(rent.start, rent.end - 1).map((h) => {
        const n = counted.filter((s) => s.from <= h && h < s.to).length;
        return [
          <span key={`h${h}`}>{`${hh(h)}-${hh(h + 1)}`}</span>,
          <span key={`n${h}`} className="text-right">
            {n}
          </span>,
          <span key={`s${h}`} className="text-right font-semibold">
            {n ? baht(Math.round(rent.perHour / n)) : "–"}
          </span>,
        ];
      })}
    </div>
  );
}

/** ผู้เล่น (ยอดของฉัน): วันสนามเช่า บอกเวลามา/กลับของตัวเอง */
export function MyRentHours({
  player,
  day,
  rent,
}: {
  player: Player;
  day: Day;
  rent: DayRent;
}) {
  const { setMyHours, state } = useStore();
  const { settings, monthly } = state;
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  const now = ci ? rentSpan(rent, ci.at, ci.hours) : null;
  const [span, setSpan] = useState(now);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!ci || !now || !span) return null;
  const share = dayAmount(day, player, settings, monthly).courtFee;
  const changed = span.from !== now.from || span.to !== now.to;
  const save = async () => {
    setBusy(true);
    const err = await setMyHours(player.id, savedPin.get(), span.from, span.to);
    setBusy(false);
    setMsg(
      err ? { ok: false, text: t(err) } : { ok: true, text: t("บันทึกแล้ว") },
    );
  };
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display font-semibold">
          {t("สนามเช่า")}
        </h2>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          {t("{from}-{to} ชม.ละ {amount}", {
            from: hh(rent.start),
            to: hh(rent.end),
            amount: baht(rent.perHour),
          })}
        </span>
      </div>
      <p className="text-sm text-zinc-500">
        {t(
          "แต่ละชั่วโมงหารค่าเช่าให้คนที่อยู่ ยอดจะลดลงถ้ามีคนมาเพิ่ม จ่ายตอนกลับจะได้ยอดจริง",
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {t("ฉันอยู่")}
        <HourSelect
          label={t("มา")}
          value={span.from}
          from={rent.start}
          to={rent.end - 1}
          disabled={Boolean(ci.paidAt)}
          onChange={(h) => setSpan({ from: h, to: Math.max(span.to, h + 1) })}
        />
        <span>–</span>
        <HourSelect
          label={t("เวลากลับ")}
          value={span.to}
          from={span.from + 1}
          to={rent.end}
          disabled={Boolean(ci.paidAt)}
          onChange={(h) => setSpan({ ...span, to: h })}
        />
        {changed && (
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {t("บันทึก")}
          </Button>
        )}
      </div>
      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
        >
          {msg.text}
        </p>
      )}
      <HourTable rent={rent} day={day} />
      <div className="flex justify-between font-semibold">
        <span>{t("ค่าสนามของฉันตอนนี้")}</span>
        <span>{baht(share)}</span>
      </div>
    </Card>
  );
}

/** แอดมิน: แก้เวลาเช่าและค่าเช่าต่อชั่วโมงของวันนี้ได้จากหน้านี้เลย (เก็บที่ประกาศของวัน) */
function RentEdit({ rent, day }: { rent: DayRent; day: Day }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(rent.start);
  const [end, setEnd] = useState(rent.end);
  const [perHour, setPerHour] = useState(String(rent.perHour));
  const ok = Number(perHour) > 0 && end > start;
  const paid = day.checkIns.filter((c) => c.paidAt).length;
  if (!open)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-sm">
        <span className="min-w-0 flex-1">
          {t("{from}-{to} ชม.ละ {amount}", {
            from: hh(rent.start),
            to: hh(rent.end),
            amount: baht(rent.perHour),
          })}
        </span>
        <Button
          className="shrink-0"
          onClick={() => {
            setStart(rent.start);
            setEnd(rent.end);
            setPerHour(String(rent.perHour));
            setOpen(true);
          }}
        >
          {t("แก้เวลา/ค่าเช่า")}
        </Button>
      </div>
    );
  return (
    <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-medium">
          {t("เริ่มเช่า")}
          <select
            className={`${inputClass} mt-1`}
            value={start}
            onChange={(e) => {
              const h = Number(e.target.value);
              setStart(h);
              setEnd((x) => Math.max(x, h + 1));
            }}
          >
            {range(6, 23).map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("เลิก")}
          <select
            className={`${inputClass} mt-1`}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
          >
            {range(start + 1, 24).map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t("ค่าเช่าสนามรวม ต่อชั่วโมง (ทุกคอร์ทรวมกัน)")}
        <input
          className={`${inputClass} mt-1`}
          inputMode="numeric"
          value={perHour}
          onChange={(e) => setPerHour(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <p className="text-xs text-zinc-500">
        {t(
          "เพิ่ม/ลดคอร์ท ให้แก้ค่าเช่ารวมต่อชั่วโมง เช่น 2 คอร์ท คอร์ทละ 200 ใส่ 400",
        )}
      </p>
      {!!paid && (
        <p className="text-xs font-semibold text-amber-800">
          {t("คนที่จ่ายแล้ว {n} คน ยอดไม่เปลี่ยน", { n: paid })}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setOpen(false)}>
          {t("ยกเลิก")}
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!ok}
          onClick={() => {
            dispatch({
              type: "setAnnouncement",
              date: day.date,
              message: day.announcement ?? "",
              rent: { start, end, perHour: Number(perHour) },
            });
            setOpen(false);
          }}
        >
          {t("บันทึก")}
        </Button>
      </div>
    </div>
  );
}

/** แอดมิน (คิดเงิน > วันนี้): วันสนามเช่า ดู/แก้เวลามา-กลับของแต่ละคน ยอดเปลี่ยนทันที */
export function RentHoursSheet({
  rent,
  onClose,
}: {
  rent: DayRent;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const shares = rentShares(rent, day.checkIns);
  // ยอดจริงของแต่ละคน (คนจ่ายแล้วยอดคงที่)
  const feeOf = (id: string) => {
    const p = byId.get(id);
    return p
      ? dayAmount(day, p, state.settings, state.monthly).courtFee
      : (shares.get(id) ?? 0);
  };
  const collected = day.checkIns.reduce((sum, c) => sum + feeOf(c.playerId), 0);
  return (
    <Sheet title={t("สนามเช่า: เวลามา-กลับ")} onClose={onClose}>
      <RentEdit rent={rent} day={day} />
      <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
        {t("ค่าเช่ารวม {rent} · หารได้ {got}", {
          rent: baht(rent.perHour * (rent.end - rent.start)),
          got: baht(collected),
        })}
      </div>
      <HourTable rent={rent} day={day} />
      {day.checkIns.some((c) => c.courtFee !== undefined && !c.paidAt) && (
        <Button
          className="w-full"
          onClick={() => {
            if (
              !confirm(
                t("ล้างยอดที่แก้เองของทุกคนที่ยังไม่จ่าย แล้วหารค่าเช่าใหม่?"),
              )
            )
              return;
            for (const c of day.checkIns)
              if (c.courtFee !== undefined && !c.paidAt)
                dispatch({
                  type: "setBillFees",
                  date: day.date,
                  playerId: c.playerId,
                  courtFee: null,
                  shuttleFee: c.shuttleFee ?? null,
                });
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
          const set = (v: { from: number; to: number }) =>
            dispatch({
              type: "setHours",
              date: day.date,
              playerId: c.playerId,
              hours: v,
            });
          return (
            <li
              key={c.playerId}
              className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-zinc-100"
            >
              <div className="flex items-center gap-2">
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {p.name}
                </span>
                {c.courtFee !== undefined ? (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {t("แก้ยอดเอง {amount}", { amount: baht(c.courtFee) })}
                  </span>
                ) : (
                  <span className="shrink-0 font-display text-lg font-semibold">
                    {baht(feeOf(c.playerId))}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* จ่ายแล้วล็อกเวลา ยอดที่จ่ายจะได้ไม่เปลี่ยน */}
                <HourSelect
                  label={t("มา")}
                  disabled={Boolean(c.paidAt)}
                  value={s.from}
                  from={rent.start}
                  to={rent.end - 1}
                  onChange={(h) => set({ from: h, to: Math.max(s.to, h + 1) })}
                />
                <span>–</span>
                <HourSelect
                  label={t("เวลากลับ")}
                  disabled={Boolean(c.paidAt)}
                  value={s.to}
                  from={s.from + 1}
                  to={rent.end}
                  onChange={(h) => set({ ...s, to: h })}
                />
                {c.paidAt && (
                  <span className="text-xs font-semibold text-emerald-700">
                    {t("จ่ายแล้ว")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500">
        {t(
          "ไม่ให้ใครหาร เช่นโค้ช ให้กดชื่อในหน้าคิดเงินแล้วแก้ค่าสนามเอง คนที่แก้ยอดเองไม่นับในการหาร คนอื่นหารค่าเช่าเต็ม",
        )}
      </p>
      <Button className="w-full" onClick={onClose}>
        {t("ปิด")}
      </Button>
    </Sheet>
  );
}
