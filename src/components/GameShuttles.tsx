"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import type { Day, Game, Player } from "@/lib/types";
import { Card, Icon, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** แก้จำนวนลูกของเกม (จบแล้วก็แก้ได้) ยอดค่าลูกของทั้ง 4 คนในเกมคำนวณใหม่เอง */
export function GameShuttleRow({ game, byId, day, me }: { game: Game; byId: Map<string, Player>; day: Day; me?: string }) {
  const { dispatch } = useStore();
  const set = (n: number) => dispatch({ type: "setShuttles", date: day.date, gameId: game.id, shuttles: n });
  const paid = new Set(day.checkIns.filter((c) => c.paidAt).map((c) => c.playerId));
  // คนอื่นในเกมที่จ่ายไปแล้ว ยอดของเขาจะเปลี่ยนตาม ถามก่อน
  const paidOthers = game.playerIds.filter((id) => id !== me && paid.has(id));
  const change = (n: number) => {
    if (n < 0) return;
    if (paidOthers.length && !confirm(t("{names} จ่ายเงินแล้ว แก้ลูกเกมนี้ยอดของเขาจะเปลี่ยนด้วย แก้ต่อ?", { names: paidOthers.map((id) => byId.get(id)?.name ?? "?").join(", ") })))
      return;
    set(n);
  };
  const name = (id: string) => (
    <span key={id} className={id === me ? "font-semibold text-ink" : ""}>
      {byId.get(id)?.name ?? "?"}
      {paid.has(id) && <span className="text-emerald-600"> ✓</span>}
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
          className="grid size-9 place-items-center rounded-full bg-white shadow-sm active:scale-95 disabled:opacity-40"
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
          className="grid size-9 place-items-center rounded-full bg-white shadow-sm active:scale-95"
          onClick={() => change(game.shuttles + 1)}
          aria-label={t("เพิ่มลูก")}
        >
          <Icon.Plus width={16} height={16} />
        </button>
      </div>
    </li>
  );
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
          <p className="px-2 pt-1 pb-2 text-xs text-zinc-500">{t("แก้จำนวนลูกได้ ค่าลูกของทั้ง 4 คนในเกมนั้นคำนวณใหม่ทันที")}</p>
          <ul className="divide-y divide-zinc-100">
            {done.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} />
            ))}
          </ul>
          <button className="w-full py-2 text-xs font-medium text-zinc-500" onClick={() => setOpen(false)}>
            {t("ซ่อน")}
          </button>
        </Card>
      ) : (
        <button
          className="w-full rounded-2xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600"
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
  const games = day.games.filter((g) => g.playerIds.includes(playerId)).sort((a, b) => a.startedAt - b.startedAt);
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
      <p className="px-1 text-xs text-zinc-500">
        {adjusted ? t("ค่าลูกของคนนี้แอดมินแก้ยอดเงินไว้ แก้จำนวนลูกแล้วยอดเงินไม่เปลี่ยน (กดคิดตามราคาปกติก่อน)") : t("แก้ลูกของเกม = แก้ให้ทั้ง 4 คนในเกมนั้น")}
      </p>
    </div>
  );
}
