"use client";

import { useState } from "react";
import { owingList, type Owing } from "@/lib/billing";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { Avatar, Button, Card, Icon, Sheet, baht } from "./ui";

const shortDate = (date: string) => new Date(date + "T00:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });

/** ข้อความทักเตือน ใส่ยอดแยกวัน (ไม่เกิน 10 วันล่าสุด) และลิงก์แอพ */
function reminderText(player: Player, o: Owing): string {
  const recent = o.days.slice(-10);
  const lines = [
    t("สวัสดี {name} 🏸", { name: player.name }),
    t("ยอดค้างจ่ายค่าก๊วนแบดของคุณ {amount}", { amount: baht(o.total) }),
    ...(o.days.length > recent.length ? [t("(และอีก {n} วันก่อนหน้า)", { n: o.days.length - recent.length })] : []),
    ...recent.map((d) => `• ${shortDate(d.date)}  ${baht(d.amount)}`),
    "",
    t("ดูยอดและจ่ายได้ในแอพ เมนู \"ยอดของฉัน\""),
    window.location.origin,
    t("ขอบคุณ 🙏"),
  ];
  return lines.join("\n");
}

/** เปิด LINE ให้เลือกคนที่จะส่งข้อความหา (ไม่ใช้โควตา LINE OA) */
const lineShareUrl = (text: string) => `https://line.me/R/share?text=${encodeURIComponent(text)}`;

function LineButton({ player, owing, className = "" }: { player: Player; owing: Owing; className?: string }) {
  return (
    <a
      href={lineShareUrl(reminderText(player, owing))}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center justify-center rounded-full bg-[#06C755] font-semibold text-white active:scale-95 ${className}`}
    >
      {t("ทัก LINE")}
    </a>
  );
}

function OwingDetail({ player, owing, onClose }: { player: Player; owing: Owing; onClose: () => void }) {
  const { dispatch } = useStore();
  const [copied, setCopied] = useState(false);
  const last = owing.days[owing.days.length - 1].date;

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

      <LineButton player={player} owing={owing} className="h-12 w-full text-base" />
      <button
        className="w-full text-center text-sm font-semibold text-sky-700"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(reminderText(player, owing));
            setCopied(true);
          } catch {
            prompt(t("คัดลอกข้อความนี้"), reminderText(player, owing));
          }
        }}
      >
        {copied ? t("คัดลอกแล้ว") : t("คัดลอกข้อความไปส่งเอง")}
      </button>
      <p className="text-center text-xs text-zinc-500">{t("กดแล้ว LINE จะให้เลือกแชทที่จะส่ง เลือกชื่อคนนี้")}</p>

      <Button
        variant="accent"
        className="w-full"
        onClick={() => {
          if (!confirm(t("บันทึกว่า {name} จ่ายยอดค้างทั้งหมด {amount} แล้ว?", { name: player.name, amount: baht(owing.total) }))) return;
          // ปิดยอดค้างทุกวันจนถึงวันล่าสุดที่ค้าง (รวมแขกที่พามา)
          dispatch({ type: "markPaid", date: last, playerId: player.id });
          onClose();
        }}
      >
        {t("ได้รับเงินแล้ว {amount}", { amount: baht(owing.total) })}
      </Button>
    </Sheet>
  );
}

/** แอดมิน: รวมยอดค้างจ่ายของทุกคน เรียงจากค้างมากไปน้อย ทักเตือนทาง LINE ได้ */
export function OwingView() {
  const { state } = useStore();
  const { date } = useToday();
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const rows = owingList(state.days, date, state.players, state.settings, state.monthly)
    .map((o) => ({ owing: o, player: byId.get(o.playerId) }))
    .filter((r): r is { owing: Owing; player: Player } => Boolean(r.player));
  const total = rows.reduce((s, r) => s + r.owing.total, 0);
  const openRow = rows.find((r) => r.player.id === open);

  return (
    <>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="text-xs text-white/60">{t("ยอดค้างจ่ายทั้งหมด")}</div>
        <div className="font-display text-3xl font-semibold">{baht(total)}</div>
        <div className="mt-2 text-xs text-white/70">{t("{n} คน (รวมวันนี้ที่ยังไม่จ่าย)", { n: rows.length })}</div>
      </div>

      <ul className="space-y-2">
        {rows.map(({ player, owing }) => (
          <li key={player.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpen(player.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(player.id)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-white px-4 py-3 text-left shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.99]"
            >
              <Avatar name={player.name} photo={player.photo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{player.name}</span>
                <span className="block text-xs text-zinc-500">
                  {owing.days.length === 1 && owing.days[0].date === date
                    ? t("วันนี้")
                    : t("ค้าง {n} วัน · ตั้งแต่ {date}", { n: owing.days.length, date: shortDate(owing.days[0].date) })}
                </span>
              </span>
              <span className="shrink-0 font-display text-lg font-semibold tabular-nums">{owing.total}฿</span>
              <LineButton player={player} owing={owing} className="h-9 shrink-0 px-3 text-xs" />
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-500">
            <Icon.Check width={24} height={24} className="text-emerald-600" />
            {t("ไม่มีใครค้างจ่าย")}
          </Card>
        )}
      </ul>

      {openRow && <OwingDetail player={openRow.player} owing={openRow.owing} onClose={() => setOpen(null)} />}
    </>
  );
}
