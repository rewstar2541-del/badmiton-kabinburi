"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { addYears, annualStatus, type Player } from "@/lib/types";
import { Avatar, Button, Card, Sheet, baht, inputClass } from "./ui";

function fmt(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

/** สถานะสมาชิกรายปีของผู้เล่นคนนี้ (ไม่ใช่สมาชิก = ไม่แสดง) ใช้ในหน้ายอดของฉันและโปรไฟล์ */
export function AnnualInfo({ player }: { player: Player }) {
  const { date } = useToday();
  const st = annualStatus(player, date);
  if (!st) return null;
  const tone = st.kind === "expired" ? "bg-zinc-100 text-zinc-700" : st.kind === "soon" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300" : "bg-lime/30 text-ink";
  return (
    <div className={`rounded-3xl p-4 ${tone}`}>
      <div className="font-display font-semibold">{st.kind === "expired" ? t("สมาชิกรายปีหมดอายุแล้ว") : t("สมาชิกรายปี")}</div>
      <div className="text-sm">
        {st.kind === "expired"
          ? t("หมดอายุ {date} คิดค่าสนามรายวันตามปกติ ติดต่อแอดมินเพื่อต่ออายุ", { date: fmt(st.until) })
          : t("ใช้ได้ถึง {date} (เหลือ {n} วัน) ไม่ต้องจ่ายค่าสนามรายวัน/รายเดือน", { date: fmt(st.until), n: st.daysLeft })}
      </div>
    </div>
  );
}

/** แอดมิน: รายชื่อสมาชิกรายปี บันทึกจ่าย ตั้งวันหมดอายุเอง */
export function AnnualView() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const [target, setTarget] = useState<Player | null>(null);
  const [q, setQ] = useState("");
  const people = state.players.filter((p) => !p.guestOf && !p.pending);
  const members = people
    .filter((p) => p.annualUntil)
    .sort((a, b) => (a.annualUntil ?? "").localeCompare(b.annualUntil ?? ""));
  const soon = members.filter((p) => annualStatus(p, date)?.kind === "soon");
  const others = q.trim() ? people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : [];
  const paid = (state.annualPayments ?? []).filter((x) => x.paidOn.slice(0, 4) === date.slice(0, 4)).reduce((s, x) => s + x.amount, 0);

  const row = (p: Player) => {
    const st = annualStatus(p, date);
    return (
      <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
        <Avatar name={p.name} photo={p.photo} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.name}</span>
          <span className={`block text-xs ${st?.kind === "soon" ? "font-semibold text-amber-700" : st?.kind === "expired" ? "text-red-600" : "text-zinc-500"}`}>
            {!st
              ? t("ยังไม่เป็นสมาชิกรายปี")
              : st.kind === "expired"
                ? t("หมดอายุแล้ว {date}", { date: fmt(st.until) })
                : st.kind === "soon"
                  ? t("ใกล้หมดอายุ {date} (เหลือ {n} วัน)", { date: fmt(st.until), n: st.daysLeft })
                  : t("ใช้ได้ถึง {date}", { date: fmt(st.until) })}
          </span>
        </span>
        <button className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600" onClick={() => setTarget(p)}>
          {st ? t("ต่ออายุ/แก้ไข") : t("รับเงิน")}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 rounded-3xl bg-ink p-5 text-center text-white">
        <div>
          <div className="font-display text-2xl font-semibold">{members.filter((p) => annualStatus(p, date)?.kind !== "expired").length}</div>
          <div className="text-[11px] text-white/60">{t("สมาชิกรายปีที่ใช้งานอยู่")}</div>
        </div>
        <div>
          <div className="font-display text-2xl font-semibold">{paid.toLocaleString("th-TH")}</div>
          <div className="text-[11px] text-white/60">{t("บาทที่เก็บได้ปีนี้")}</div>
        </div>
      </div>
      {soon.length > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-300">
          {t("ใกล้หมดอายุ {n} คน: {names}", { n: soon.length, names: soon.map((p) => p.name).join(", ") })}
        </p>
      )}
      <p className="px-1 text-xs text-zinc-500">{t("สมาชิกรายปีไม่ถูกคิดค่าสนามรายวัน ค่าลูกและค่าน้ำยังคิดตามปกติ")}</p>
      <ul className="space-y-2">{members.map(row)}</ul>
      {members.length === 0 && <Card className="py-6 text-center text-sm text-zinc-500">{t("ยังไม่มีสมาชิกรายปี ค้นหาชื่อด้านล่างเพื่อเพิ่ม")}</Card>}
      <input className={inputClass} placeholder={t("ค้นหาชื่อเพื่อเพิ่มสมาชิกรายปี")} value={q} onChange={(e) => setQ(e.target.value)} />
      {others.length > 0 && <ul className="space-y-2">{others.filter((p) => !p.annualUntil).map(row)}</ul>}
      {target && (
        <AnnualSheet
          key={target.id}
          player={target}
          onClose={() => setTarget(null)}
          onSave={(i) => {
            dispatch({ type: "recordAnnual", playerId: target.id, paidOn: date, ...i });
            setTarget(null);
          }}
          onExpiry={(until) => {
            dispatch({ type: "setAnnualExpiry", playerId: target.id, until });
            setTarget(null);
          }}
          onClear={() => {
            dispatch({ type: "clearAnnual", playerId: target.id });
            setTarget(null);
          }}
        />
      )}
    </>
  );
}

function AnnualSheet({
  player,
  onClose,
  onSave,
  onExpiry,
  onClear,
}: {
  player: Player;
  onClose: () => void;
  onSave: (i: { from: string; until: string; amount: number }) => void;
  onExpiry: (until: string) => void;
  onClear: () => void;
}) {
  const { state } = useStore();
  const { date } = useToday();
  const history = [...(state.annualPayments ?? [])].reverse();
  const last = history.find((x) => x.playerId === player.id) ?? history[0];
  const active = annualStatus(player, date)?.kind === "active" || annualStatus(player, date)?.kind === "soon";
  // ต่ออายุขณะยังไม่หมด: เริ่มต่อจากวันหมดอายุเดิม ไม่เสียวันที่เหลือ
  const start = active && player.annualUntil ? player.annualUntil : date;
  const [from, setFrom] = useState(active ? player.annualFrom ?? date : date);
  const [until, setUntil] = useState(addYears(start, 1));
  const [amount, setAmount] = useState(last ? String(last.amount) : "");
  const valid = until >= from && amount !== "" && Number(amount) >= 0;
  return (
    <Sheet
      onClose={onClose}
      title={
        <div>
          <h3 className="font-display text-lg font-semibold">{t("สมาชิกรายปี {name}", { name: player.name })}</h3>
          <p className="text-xs text-zinc-500">{t("วันหมดอายุตั้งเองได้ ค่าเริ่มต้นคือ 1 ปีหลังเริ่ม")}</p>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-zinc-500">{t("เริ่มใช้งาน")}</span>
          <input type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value) setUntil(addYears(e.target.value, 1)); }} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">{t("วันหมดอายุ (รวมวันนี้)")}</span>
          <input type="date" className={inputClass} value={until} min={from} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">{t("ยอดที่รับ (บาท)")}</span>
          <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <Button variant="accent" className="w-full" disabled={!valid} onClick={() => onSave({ from, until, amount: Number(amount) })}>
          {t("ได้รับเงินแล้ว {amount}", { amount: baht(Number(amount) || 0) })}
        </Button>
        {player.annualUntil && (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={!until || until < (player.annualFrom ?? "")} onClick={() => onExpiry(until)}>
              {t("แก้เฉพาะวันหมดอายุ (ไม่บันทึกเงิน)")}
            </Button>
            <Button
              variant="ghost"
              className="text-red-500"
              onClick={() => {
                if (confirm(t("ยกเลิกสมาชิกรายปีของ {name}?", { name: player.name }))) onClear();
              }}
            >
              {t("ยกเลิกสมาชิก")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
