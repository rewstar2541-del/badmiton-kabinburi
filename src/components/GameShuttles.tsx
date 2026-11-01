"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import type { Day, Game, Player } from "@/lib/types";
import { Card, Icon, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";
import { pricesFor, shuttleCountFor, shuttleFee } from "@/lib/billing";

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** แก้จำนวนลูกของเกม (จบแล้วก็แก้ได้) ยอดค่าลูกของคนในเกมคำนวณใหม่เอง
 *  ยกเว้นคนที่จ่ายเงินแล้ว: ล็อกค่าลูกไว้ที่ยอดที่จ่ายไป ยอดเงินในบัญชีจะได้ไม่เพี้ยน */
export function GameShuttleRow({ game, byId, day, me }: { game: Game; byId: Map<string, Player>; day: Day; me?: string }) {
  const { state, dispatch } = useStore();
  const ci = new Map(day.checkIns.map((c) => [c.playerId, c]));
  const paid = (id: string) => !!ci.get(id)?.paidAt;
  const locked = (id: string) => ci.get(id)?.shuttleFee !== undefined;
  const change = (n: number) => {
    if (n < 0) return;
    const prices = pricesFor(day, state.settings);
    for (const id of game.playerIds) {
      const c = ci.get(id);
      if (c?.paidAt && c.shuttleFee === undefined)
        dispatch({ type: "setBillFees", date: day.date, playerId: id, courtFee: c.courtFee ?? null, shuttleFee: shuttleFee(shuttleCountFor(day, id), prices) });
    }
    dispatch({ type: "setShuttles", date: day.date, gameId: game.id, shuttles: n });
  };
  const name = (id: string) => (
    <span key={id} className={id === me ? "font-semibold text-ink" : ""}>
      {byId.get(id)?.name ?? "?"}
      {paid(id) ? <span className="text-emerald-700"> ✓</span> : locked(id) && <span className="text-amber-700"> 🔒</span>}
    </span>
  );
  const [a1, a2, b1, b2] = game.playerIds;
  return (
    <li className="flex items-center gap-2 rounded-2xl px-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-zinc-500">
          {t("สนาม {n}", { n: game.court })} · {clock(game.startedAt)}
          {!game.endedAt && <span className="font-semibold text-emerald-700"> · {t("กำลังเล่น")}</span>}
        </div>
        <div className="text-sm leading-snug text-zinc-700">
          {name(a1)} + {name(a2)} <span className="text-zinc-400">{t("พบ")}</span> {name(b1)} + {name(b2)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 p-1">
        <button
          className="grid size-11 place-items-center rounded-full bg-white shadow-sm active:scale-95 disabled:opacity-40"
          onClick={() => change(game.shuttles - 1)}
          disabled={game.shuttles <= 0}
          aria-label={t("ลดลูก")}
        >
          <Icon.Minus width={16} height={16} />
        </button>
        <span className="flex min-w-12 items-center justify-center gap-1 font-display font-semibold">
          <Icon.Shuttle width={15} height={15} />
          {game.shuttles}
        </span>
        <button
          className="grid size-11 place-items-center rounded-full bg-white shadow-sm active:scale-95"
          onClick={() => change(game.shuttles + 1)}
          aria-label={t("เพิ่มลูก")}
        >
          <Icon.Plus width={16} height={16} />
        </button>
      </div>
    </li>
  );
}

/** คำอธิบายเครื่องหมายข้างชื่อ */
function Legend() {
  return <p className="px-2 text-xs text-zinc-500">{t("✓ จ่ายแล้ว / 🔒 แอดมินแก้ยอดไว้ = ยอดเงินคนนั้นไม่เปลี่ยน")}</p>;
}

/** หน้าสนาม (แอดมิน): เกมที่จบแล้ววันนี้ กดเปิดดูแล้วแก้จำนวนลูกได้ */
export function FinishedGames({ byId }: { byId: Map<string, Player> }) {
  const { day } = useToday();
  const [open, setOpen] = useState(false);
  const done = day.games.filter((g) => g.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  if (done.length === 0) return null;
  const total = done.reduce((s, g) => s + g.shuttles, 0);
  return (
    <>
      <SectionTitle right={t("{n} เกม · {m} ลูก", { n: done.length, m: total })}>{t("เกมที่จบแล้ววันนี้")}</SectionTitle>
      {open ? (
        <Card className="p-2">
          <p className="px-2 pt-1 text-xs text-zinc-500">{t("แก้จำนวนลูกได้ ค่าลูกของคนในเกมนั้นคำนวณใหม่ทันที")}</p>
          <Legend />
          <ul className="divide-y divide-zinc-100">
            {done.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} />
            ))}
          </ul>
          <button className="mt-1 min-h-11 w-full rounded-2xl bg-zinc-100 text-sm font-medium text-zinc-600" onClick={() => setOpen(false)}>
            {t("ซ่อน")}
          </button>
        </Card>
      ) : (
        <button
          className="w-full min-h-11 rounded-2xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600"
          onClick={() => setOpen(true)}
        >
          {t("ดู / แก้จำนวนลูก")}
        </button>
      )}
    </>
  );
}

/** หน้าบิล (แอดมิน): เกมของคนนี้วันนี้ แก้ลูกรายเกมได้ */
export function PlayerGameShuttles({ playerId, adjusted }: { playerId: string; adjusted: boolean }) {
  const { state } = useStore();
  const { day } = useToday();
  const games = day.games.filter((g) => g.playerIds.includes(playerId)).sort((a, b) => b.startedAt - a.startedAt);
  if (games.length === 0) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{t("ลูกแต่ละเกม (แก้ได้)")}</div>
      <ul className="divide-y divide-zinc-100 rounded-3xl bg-zinc-50 p-1">
        {games.map((g) => (
          <GameShuttleRow key={g.id} game={g} byId={byId} day={day} me={playerId} />
        ))}
      </ul>
      {adjusted ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("ยอดค่าลูกของคนนี้ล็อกไว้ (จ่ายแล้ว หรือแอดมินแก้ยอด) แก้จำนวนลูกแล้วยอดเงินคนนี้ไม่เปลี่ยน ถ้าจะคิดใหม่ กด แก้ยอดคนนี้ แล้วกด คิดตามราคาปกติ")}
        </p>
      ) : (
        <p className="px-1 text-xs text-zinc-500">{t("แก้ลูกของเกม = แก้ให้ทั้ง 4 คนในเกมนั้น")}</p>
      )}
      <Legend />
    </div>
  );
}
