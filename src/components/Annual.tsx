"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { annualExpiryFor, annualStatus, type AnnualRule, type Player } from "@/lib/types";
import { Avatar, Button, Card, Sheet, baht, inputClass } from "./ui";

function fmt(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

/** สถานะสมาชิกรายปีของผู้เล่นคนนี้ (ไม่ใช่สมาชิก = ไม่แสดง) ใช้ในหน้ายอดของฉันและโปรไฟล์ */
export function AnnualInfo({ player }: { player: Player }) {
  const { date } = useToday();
  const st = annualStatus(player, date);
  if (!st) return null;
  if (st.kind === "upcoming")
    return (
      <div className="rounded-3xl bg-zinc-100 p-4 text-ink">
        <div className="font-display font-semibold">{t("สมาชิกรายปี")}</div>
        <div className="text-sm">{t("เริ่มใช้ {date} ถึง {until}", { date: fmt(st.from ?? ""), until: fmt(st.until) })}</div>
      </div>
    );
  const tone = st.kind === "expired" ? "bg-zinc-100 text-zinc-700" : st.kind === "soon" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300" : "bg-lime/30 text-ink";
  return (
    <div className={`rounded-3xl p-4 ${tone}`}>
      <div className="font-display font-semibold">{st.kind === "expired" ? t("สมาชิกรายปีหมดอายุแล้ว") : t("สมาชิกรายปี")}</div>
      <div className="text-sm">
        {st.kind === "expired"
          ? t("หมดอายุ {date} คิดค่าสนามรายวันตามปกติ ติดต่อแอดมินเพื่อต่ออายุ", { date: fmt(st.until) })
          : t("ใช้ได้ถึง {date} (เหลือ {n} วัน) ไม่ต้องจ่ายค่าสนามรายวัน/รายเดือน ค่าลูกและค่าน้ำคิดตามปกติ", { date: fmt(st.until), n: st.daysLeft })}
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
  const others = people
    .filter((p) => !p.annualUntil && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
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
                : st.kind === "upcoming"
                  ? t("จะเริ่ม {date}", { date: fmt(st.from ?? "") })
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
          <div className="font-display text-2xl font-semibold">{members.filter((p) => annualStatus(p, date)?.kind === "active" || annualStatus(p, date)?.kind === "soon").length}</div>
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
      {members.length === 0 && <Card className="py-6 text-center text-sm text-zinc-500">{t("ยังไม่มีสมาชิกรายปี กดรับเงินที่ชื่อด้านล่างเพื่อเพิ่ม")}</Card>}
      <input className={inputClass} aria-label={t("ค้นหาชื่อเพื่อเพิ่มสมาชิกรายปี")} placeholder={t("ค้นหาชื่อเพื่อเพิ่มสมาชิกรายปี")} value={q} onChange={(e) => setQ(e.target.value)} />
      {others.length > 0 && <ul className="space-y-2">{others.map(row)}</ul>}
      <RulesEditor />
      {target && (
        <AnnualSheet
          key={target.id}
          player={target}
          onClose={() => setTarget(null)}
          onSave={(i) => {
            const prev = target.annualFrom && target.annualUntil ? { from: target.annualFrom, until: target.annualUntil } : undefined;
            dispatch({ type: "recordAnnual", playerId: target.id, paidOn: date, prev, ...i });
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
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const mine = (state.annualPayments ?? []).filter((x) => x.playerId === player.id).reverse();
  const history = [...(state.annualPayments ?? [])].reverse();
  const rules = state.annualRules ?? [];
  // ยอดตั้งต้น: ยอดล่าสุดของคนนี้ ไม่เคยจ่ายใช้แพ็กเกจถูกสุด ไม่มีแพ็กเกจใช้ยอดล่าสุดของก๊วน
  const last = history.find((x) => x.playerId === player.id) ?? (rules.length ? undefined : history[0]);
  const cheapest = rules.find((r) => r.minAmount > 0);
  const active = annualStatus(player, date)?.kind === "active" || annualStatus(player, date)?.kind === "soon";
  // ต่ออายุขณะยังไม่หมด: เริ่มต่อจากวันหมดอายุเดิม ไม่เสียวันที่เหลือ
  const start = active && player.annualUntil ? player.annualUntil : date;
  const [from, setFrom] = useState(active ? player.annualFrom ?? date : date);
  const [manual, setManual] = useState<string | null>(null);
  const [amount, setAmount] = useState(last ? String(last.amount) : cheapest ? String(cheapest.minAmount) : "");
  const base = active ? start : from;
  // วันหมดอายุตามกติกายอดจ่าย (แอดมินแก้เองได้ ถ้าแก้แล้วจะไม่ถูกเปลี่ยนตามยอดอีก)
  const auto = annualExpiryFor(rules, Number(amount) || 0, base);
  const until = manual ?? auto;
  const setUntil = (v: string) => setManual(v);
  const valid = until >= from && amount !== "" && Number(amount) >= 0;
  return (
    <Sheet
      onClose={onClose}
      title={
        <div>
          <h3 className="font-display text-lg font-semibold">{t("สมาชิกรายปี {name}", { name: player.name })}</h3>
          <p className="text-xs text-zinc-500">{rules.length ? t("วันหมดอายุเปลี่ยนตามยอดที่รับ (ตามกติกาที่ตั้งไว้) และแก้เองได้") : t("วันหมดอายุตั้งเองได้ ค่าเริ่มต้นคือ 1 ปีหลังเริ่ม")}</p>
        </div>
      }
    >
      <div className="space-y-3">
        {rules.some((r) => r.minAmount > 0) && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("แพ็กเกจรายปี")}>
              {rules
                .filter((r) => r.minAmount > 0)
                .map((r) => {
                  const on = Number(amount) === r.minAmount && !manual;
                  return (
                    <button
                      key={r.minAmount}
                      type="button"
                      aria-pressed={on}
                      className={`min-h-11 rounded-2xl px-3 py-2 text-left text-sm ${on ? "bg-ink text-white" : "bg-zinc-100 text-ink"}`}
                      onClick={() => {
                        setAmount(String(r.minAmount));
                        setManual(null);
                      }}
                    >
                      <span className="block font-semibold">{baht(r.minAmount)}</span>
                      <span className={`block text-xs ${on ? "text-white/70" : "text-zinc-500"}`}>
                        {t("ถึง {date}", { date: fmt(annualExpiryFor(rules, r.minAmount, base)) })}
                      </span>
                    </button>
                  );
                })}
            </div>
            {active && <p className="text-xs text-zinc-500">{t("ยังไม่หมดอายุ นับต่อจากวันหมดอายุเดิม {date}", { date: fmt(start) })}</p>}
          </div>
        )}
        <label className="block text-sm">
          <span className="text-zinc-500">{t("เริ่มใช้งาน")}</span>
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">{t("วันหมดอายุ (รวมวันนี้)")}</span>
          <input type="date" className={inputClass} value={until} min={from} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">{t("ยอดที่รับ (บาท)")}</span>
          <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <Button variant="accent" className="w-full" disabled={!valid} onClick={() => {
            if (confirm(t("บันทึกรับเงิน {amount} จาก {name} ใช้ได้ถึง {date}?", { amount: baht(Number(amount)), name: player.name, date: fmt(until) })))
              onSave({ from, until, amount: Number(amount) });
          }}>
          {t("ได้รับเงินแล้ว {amount}", { amount: baht(Number(amount) || 0) })}
        </Button>
        {mine.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <div className="text-sm font-semibold">{t("ประวัติการจ่าย")}</div>
            {mine.map((x) => (
              <div key={x.id} className="flex items-center gap-2 text-sm text-zinc-600">
                <span className="min-w-0 flex-1">
                  {fmt(x.paidOn)} · {baht(x.amount)} · {t("ถึง {date}", { date: fmt(x.until) })}
                </span>
                <button
                  className="min-h-11 shrink-0 px-2 text-xs font-semibold text-red-600"
                  onClick={() => {
                    if (confirm(t("ลบรายการจ่ายนี้? (วันหมดอายุไม่เปลี่ยน)"))) dispatch({ type: "removeAnnualPayment", id: x.id });
                  }}
                >
                  {t("ลบ")}
                </button>
              </div>
            ))}
          </div>
        )}
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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** แอดมิน: กติกาวันหมดอายุตามยอดที่จ่าย เช่น 1,000 หมดอายุ มิ.ย. ปีหน้า / 2,000 ขึ้นไป ธ.ค. ปีหน้า */
export function RulesEditor() {
  const { state, dispatch } = useStore();
  const saved = state.annualRules ?? [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnnualRule[]>(saved);
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(locale(), { month: "long" });
  const set = (i: number, patch: Partial<AnnualRule>) => setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (!open)
    return (
      <Card className="space-y-1">
        <div className="font-display font-semibold">{t("กติกาวันหมดอายุตามยอดที่จ่าย")}</div>
        {saved.length === 0 && <p className="text-sm text-zinc-500">{t("ยังไม่ได้ตั้ง ตอนนี้หมดอายุหลังจ่าย 1 ปี")}</p>}
        {saved.map((r) => (
          <p key={r.minAmount} className="text-sm text-zinc-600">
            {t("จ่ายตั้งแต่ {amount} หมดอายุสิ้นเดือน {month} {when}", {
              amount: baht(r.minAmount),
              month: monthName(r.endMonth),
              when: r.yearsAhead === 0 ? t("ปีเดียวกัน") : r.yearsAhead === 1 ? t("ปีหน้า") : t("อีก {n} ปี", { n: r.yearsAhead }),
            })}
          </p>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            setDraft(saved);
            setOpen(true);
          }}
        >
          {t("แก้กติกา")}
        </Button>
      </Card>
    );
  const valid = draft.every((r) => r.minAmount >= 0 && r.endMonth >= 1 && r.endMonth <= 12) && new Set(draft.map((r) => r.minAmount)).size === draft.length;
  return (
    <Card className="space-y-3">
      <div className="font-display font-semibold">{t("กติกาวันหมดอายุตามยอดที่จ่าย")}</div>
      {draft.map((r, i) => (
        <div key={i} className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <label className="block text-sm">
            <span className="text-zinc-500">{t("จ่ายตั้งแต่ (บาท)")}</span>
            <input className={inputClass} inputMode="numeric" value={String(r.minAmount)} onChange={(e) => set(i, { minAmount: Number(e.target.value.replace(/[^\d]/g, "")) })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="text-zinc-500">{t("หมดอายุสิ้นเดือน")}</span>
              <select className={inputClass} value={r.endMonth} onChange={(e) => set(i, { endMonth: Number(e.target.value) })}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t("ของปี")}</span>
              <select className={inputClass} value={r.yearsAhead} onChange={(e) => set(i, { yearsAhead: Number(e.target.value) })}>
                <option value={0}>{t("ปีเดียวกัน")}</option>
                <option value={1}>{t("ปีหน้า")}</option>
                <option value={2}>{t("อีก {n} ปี", { n: 2 })}</option>
              </select>
            </label>
          </div>
          <button className="min-h-11 text-xs font-semibold text-red-600" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
            {t("ลบกติกานี้")}
          </button>
        </div>
      ))}
      <Button variant="ghost" className="w-full" onClick={() => setDraft([...draft, { minAmount: (draft.at(-1)?.minAmount ?? 0) + 1000, endMonth: 12, yearsAhead: 1 }])}>
        {t("+ เพิ่มกติกา")}
      </Button>
      {!valid && <p className="text-xs text-red-600">{t("ยอดต้องไม่ซ้ำกัน")}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          {t("ยกเลิก")}
        </Button>
        <Button
          variant="accent"
          className="flex-1"
          disabled={!valid}
          onClick={() => {
            dispatch({ type: "setAnnualRules", rules: [...draft].sort((a, b) => a.minAmount - b.minAmount) });
            setOpen(false);
          }}
        >
          {t("บันทึกกติกา")}
        </Button>
      </div>
    </Card>
  );
}
