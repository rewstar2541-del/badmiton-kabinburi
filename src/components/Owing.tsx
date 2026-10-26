"use client";

import { useState } from "react";
import { owingList, type Owing } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { Avatar, Button, Card, Icon, Sheet, baht } from "./ui";

const shortDate = (date: string, loc = locale()) => new Date(date + "T00:00:00").toLocaleDateString(loc, { day: "numeric", month: "short" });

/**
 * ข้อความทักเตือน ใส่ยอดแยกวัน (ไม่เกิน 10 วันล่าสุด) และลิงก์แอพ
 * เป็นภาษาไทยเสมอ ไม่ตามภาษาที่แอดมินใช้อยู่ (คนรับส่วนใหญ่อ่านไทย)
 */
function reminderText(player: Player, o: Owing): string {
  const recent = o.days.slice(-10);
  const thb = (n: number) => `${n.toLocaleString("th-TH")} บาท`;
  return [
    `สวัสดี ${player.name} 🏸`,
    `ยอดค้างจ่ายค่าก๊วนแบดของคุณ ${thb(o.total)}`,
    ...(o.days.length > recent.length ? [`(และอีก ${o.days.length - recent.length} วันก่อนหน้า)`] : []),
    ...recent.map((d) => `• ${shortDate(d.date, "th-TH")}  ${thb(d.amount)}`),
    "",
    `ดูยอดและจ่ายได้ในแอพ เมนู "ยอดของฉัน"`,
    window.location.origin,
    "ขอบคุณ 🙏",
  ].join("\n");
}

/** เปิด LINE ให้เลือกคนที่จะส่งข้อความหา (ไม่ใช้โควตา LINE OA) สร้างข้อความตอนกด */
function openLine(player: Player, owing: Owing) {
  window.location.href = `https://line.me/R/share?text=${encodeURIComponent(reminderText(player, owing))}`;
}

function LineButton({ player, owing, className = "" }: { player: Player; owing: Owing; className?: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openLine(player, owing);
      }}
      className={`flex items-center justify-center rounded-2xl bg-[#06C755] font-semibold text-white active:scale-95 ${className}`}
    >
      {t("ทัก LINE")}
    </button>
  );
}

function OwingDetail({ player, owing, onClose, onPaid }: { player: Player; owing: Owing; onClose: () => void; onPaid: () => void }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  return (
    <Sheet
      onClose={onClose}
      title={
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={player.name} photo={player.photo} size={44} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{player.name}</h3>
            <p className="text-xs text-zinc-500">{t("ค้าง {n} วัน", { n: owing.days.length })}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-2 rounded-3xl bg-zinc-50 p-4">
        {owing.days.map((d) => (
          <div key={d.date} className="flex justify-between text-sm">
            <span className="text-zinc-500">{shortDate(d.date)}</span>
            <span className="font-medium tabular-nums">{baht(d.amount)}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-dashed border-zinc-300 pt-3">
          <span className="font-medium">{t("รวมค้างจ่าย")}</span>
          <span className="font-display text-2xl font-semibold">{baht(owing.total)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <LineButton player={player} owing={owing} className="h-12 w-full text-base" />
        <p className="text-center text-xs text-zinc-500">{t("กดแล้ว LINE จะให้เลือกแชทที่จะส่ง เลือกชื่อคนนี้")}</p>
      </div>
      <button
        className="min-h-11 w-full text-center text-sm font-semibold text-sky-700 underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(reminderText(player, owing));
            setCopied(true);
          } catch {
            // คัดลอกไม่ได้ (บางเบราว์เซอร์ใน LINE) ให้กดค้างที่ข้อความแทน
            setManual(true);
          }
        }}
      >
        {copied ? t("คัดลอกแล้ว") : t("คัดลอกข้อความไปส่งเอง")}
      </button>
      {manual && <textarea readOnly rows={8} className="w-full rounded-2xl bg-zinc-50 p-3 text-sm" value={reminderText(player, owing)} onFocus={(e) => e.target.select()} />}

      <div className="border-t border-zinc-100 pt-4">
        <Button
          variant="accent"
          className="w-full"
          onClick={() => {
            if (confirm(t("บันทึกว่า {name} จ่ายยอดค้างทั้งหมด {amount} แล้ว?", { name: player.name, amount: baht(owing.total) }))) onPaid();
          }}
        >
          {t("ได้รับเงินแล้ว {amount}", { amount: baht(owing.total) })}
        </Button>
      </div>
    </Sheet>
  );
}

/** แอดมิน: รวมยอดค้างจ่ายจากวันก่อนๆ ของทุกคน เรียงจากค้างมากไปน้อย ทักเตือนทาง LINE ได้ */
export function OwingView() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const [open, setOpen] = useState<string | null>(null);
  // เพิ่งบันทึกรับเงิน (ไว้กดย้อนกลับถ้ากดผิดคน)
  const [done, setDone] = useState<{ player: Player; amount: number; undoDate?: string } | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  // ยอดวันนี้ยังเล่นไม่จบ ดูในแท็บ "วันนี้" หน้านี้นับเฉพาะวันก่อนๆ
  const rows = owingList(state.days, date, state.players, state.settings, state.monthly)
    .map((o) => ({ owing: o, player: byId.get(o.playerId) }))
    .filter((r): r is { owing: Owing; player: Player } => Boolean(r.player));
  const total = rows.reduce((s, r) => s + r.owing.total, 0);
  const openRow = rows.find((r) => r.player.id === open);

  const markPaid = (player: Player, owing: Owing) => {
    const last = owing.days[owing.days.length - 1].date;
    // ย้อนกลับได้จากวันล่าสุดที่คนนี้ค้างเอง (ยอดแขกวันเดียวกันถูกปิดด้วยเวลาเดียวกัน)
    const own = state.days
      .filter((d) => d.date <= last && d.checkIns.some((c) => c.playerId === player.id && !c.paidAt))
      .map((d) => d.date)
      .pop();
    // ปิดยอดค้างทุกวันจนถึงวันล่าสุดที่ค้าง (รวมแขกที่พามา)
    dispatch({ type: "markPaid", date: last, playerId: player.id });
    setDone({ player, amount: owing.total, undoDate: own });
    setOpen(null);
  };

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="text-xs text-white/60">{t("ยอดค้างจ่ายทั้งหมด")}</div>
        <div className="font-display text-3xl font-semibold">{baht(total)}</div>
        <div className="mt-2 text-xs text-white/70">{t("{n} คน · ค้างจากวันก่อน (ไม่รวมวันนี้และค่ารายเดือน)", { n: rows.length })}</div>
      </div>

      {done && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <Icon.Check width={18} height={18} className="shrink-0" />
          <span className="min-w-0 flex-1">{t("บันทึกว่า {name} จ่ายแล้ว {amount}", { name: done.player.name, amount: baht(done.amount) })}</span>
          {done.undoDate && (
            <button
              className="min-h-11 shrink-0 px-2 font-semibold underline"
              onClick={() => {
                dispatch({ type: "unmarkPaid", date: done.undoDate!, playerId: done.player.id });
                setDone(null);
              }}
            >
              {t("ย้อนกลับ")}
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {rows.map(({ player, owing }) => (
          <li key={player.id} className="flex items-center gap-2 rounded-3xl bg-white py-2 pr-3 pl-2 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]">
            <button onClick={() => setOpen(player.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left active:scale-[0.99]">
              <Avatar name={player.name} photo={player.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{player.name}</span>
                <span className="block text-xs text-zinc-500">
                  {t("{n} วัน · ตั้งแต่ {date}", { n: owing.days.length, date: shortDate(owing.days[0].date) })}
                  {player.guestOf && ` · ${t("แขก")}`}
                </span>
              </span>
              <span className="shrink-0 font-display font-semibold tabular-nums">{baht(owing.total)}</span>
            </button>
            <LineButton player={player} owing={owing} className="h-11 shrink-0 px-3 text-sm" />
          </li>
        ))}
        {rows.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-500">
            <Icon.Check width={24} height={24} className="text-emerald-600" />
            {t("ไม่มีใครค้างจ่าย")}
          </Card>
        )}
      </ul>

      {openRow && <OwingDetail player={openRow.player} owing={openRow.owing} onClose={() => setOpen(null)} onPaid={() => markPaid(openRow.player, openRow.owing)} />}
    </>
  );
}
