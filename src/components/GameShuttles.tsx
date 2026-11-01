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

/** ล็อกค่าลูกของคนที่จ่ายเงินแล้วไว้ที่ยอดที่จ่ายไป ก่อนแก้หรือลบเกม ยอดเงินในบัญชีจะได้ไม่เพี้ยน */
function useLockPaid(game: Game, day: Day) {
  const { state, dispatch } = useStore();
  return () => {
    const prices = pricesFor(day, state.settings);
    for (const c of day.checkIns)
      if (game.playerIds.includes(c.playerId) && c.paidAt && c.shuttleFee === undefined)
        dispatch({ type: "setBillFees", date: day.date, playerId: c.playerId, courtFee: c.courtFee ?? null, shuttleFee: shuttleFee(shuttleCountFor(day, c.playerId), prices) });
  };
}

function Team({ ids, byId, won, me }: { ids: string[]; byId: Map<string, Player>; won: boolean; me?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-zinc-700">
      <span className="truncate">
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="text-zinc-300"> · </span>}
            <span className={id === me ? "underline decoration-lime decoration-2 underline-offset-4" : ""}>{byId.get(id)?.name ?? "?"}</span>
          </span>
        ))}
      </span>
      {won && <span className="shrink-0 rounded-full bg-lime px-1.5 text-[10px] font-bold uppercase leading-4 text-ink">win</span>}
    </div>
  );
}

/** แถวเกม (แอดมิน): กดแถวเพื่อแก้จำนวนลูก หรือลบเกมที่ไม่ได้เล่นจริง */
export function GameShuttleRow({ game, byId, day, me }: { game: Game; byId: Map<string, Player>; day: Day; me?: string }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const lockPaid = useLockPaid(game, day);
  const ci = new Map(day.checkIns.map((c) => [c.playerId, c]));
  const fixed = game.playerIds.filter((id) => ci.get(id)?.paidAt || ci.get(id)?.shuttleFee !== undefined);
  const change = (n: number) => {
    if (n < 0) return;
    lockPaid();
    dispatch({ type: "setShuttles", date: day.date, gameId: game.id, shuttles: n });
  };
  const remove = () => {
    if (!confirm(t("ลบเกมนี้ (สนาม {n} · {time})? ใช้เมื่อเกมนี้ไม่ได้เล่นจริง ลูกและผลแพ้ชนะของเกมนี้จะหายไป", { n: game.court, time: clock(game.startedAt) }))) return;
    lockPaid();
    dispatch({ type: "cancelGame", date: day.date, gameId: game.id });
  };
  return (
    <li>
      <button className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-zinc-50" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="w-12 shrink-0">
          <div className="font-display text-sm font-semibold tabular-nums">{clock(game.startedAt)}</div>
          <div className="text-[11px] text-zinc-400">{t("สนาม {n}", { n: game.court })}</div>
        </div>
        <div className="min-w-0 flex-1 text-sm leading-6">
          <Team ids={game.playerIds.slice(0, 2)} byId={byId} won={game.winner === "A"} me={me} />
          <Team ids={game.playerIds.slice(2)} byId={byId} won={game.winner === "B"} me={me} />
        </div>
        {!game.endedAt && <span className="text-[11px] font-semibold text-emerald-700">{t("กำลังเล่น")}</span>}
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${game.shuttles === 0 ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-ink"}`}>
          <Icon.Shuttle width={14} height={14} />
          {game.shuttles}
        </span>
      </button>
      {open && (
        <div className="mx-3 mb-3 space-y-3 rounded-2xl bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t("จำนวนลูก")}</span>
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
              <button className="grid size-11 place-items-center rounded-full bg-zinc-100 active:scale-95 disabled:opacity-40" onClick={() => change(game.shuttles - 1)} disabled={game.shuttles <= 0} aria-label={t("ลดลูก")}>
                <Icon.Minus width={16} height={16} />
              </button>
              <span className="min-w-10 text-center font-display text-lg font-semibold tabular-nums">{game.shuttles}</span>
              <button className="grid size-11 place-items-center rounded-full bg-zinc-100 active:scale-95" onClick={() => change(game.shuttles + 1)} aria-label={t("เพิ่มลูก")}>
                <Icon.Plus width={16} height={16} />
              </button>
            </div>
          </div>
          {fixed.length > 0 && (
            <p className="text-xs text-zinc-500">
              {t("ยอดเงินไม่เปลี่ยน (จ่ายแล้วหรือแอดมินแก้ยอดไว้): {names}", { names: fixed.map((id) => byId.get(id)?.name ?? "?").join(", ") })}
            </p>
          )}
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-2xl bg-white text-sm font-semibold text-red-600 shadow-sm active:bg-red-50" onClick={remove}>
              {t("ลบเกมนี้ (ไม่ได้เล่นจริง)")}
            </button>
            <button className="min-h-11 rounded-2xl bg-ink px-5 text-sm font-semibold text-white" onClick={() => setOpen(false)}>
              {t("เสร็จ")}
            </button>
          </div>
        </div>
      )}
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
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {done.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} />
            ))}
          </ul>
          <button className="min-h-11 w-full border-t border-zinc-100 text-sm font-medium text-zinc-500" onClick={() => setOpen(false)}>
            {t("ซ่อน")}
          </button>
        </Card>
      ) : (
        <button
          className="w-full min-h-11 rounded-2xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600"
          onClick={() => setOpen(true)}
        >
          {t("ดู / แก้ / ลบเกม")}
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
      <div className="text-sm font-semibold">{t("เกมของคนนี้วันนี้ (กดเพื่อแก้)")}</div>
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-100">
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
    </div>
  );
}

/** หน้ายอดของฉัน (ผู้เล่น): เกมที่ตัวเองเล่นวันนี้และจำนวนลูก ให้ตรวจเองว่าตรงกับบิล */
export function MyGames({ playerId }: { playerId: string }) {
  const { state } = useStore();
  const { day } = useToday();
  const games = day.games.filter((g) => g.playerIds.includes(playerId)).sort((a, b) => a.startedAt - b.startedAt);
  if (games.length === 0) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const total = games.reduce((s, g) => s + g.shuttles, 0);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h3 className="font-semibold">{t("เกมของฉันวันนี้")}</h3>
        <span className="text-xs text-zinc-500">{t("{n} เกม · {m} ลูก", { n: games.length, m: total })}</span>
      </div>
      <ol className="divide-y divide-zinc-100">
        {games.map((g, i) => {
          const mine = g.playerIds.indexOf(playerId) < 2 ? "A" : "B";
          const partner = g.playerIds.find((id, j) => id !== playerId && (j < 2) === (mine === "A"))!;
          const opp = g.playerIds.filter((_, j) => (j < 2) !== (mine === "A"));
          const result = !g.endedAt ? t("กำลังเล่น") : g.draw ? t("เสมอ") : g.winner ? (g.winner === mine ? t("ชนะ") : t("แพ้")) : "";
          return (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-zinc-400">{i + 1}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate">
                  <span className="text-zinc-500">{t("คู่กับ")}</span> {name(partner)}
                </div>
                <div className="truncate text-zinc-500">
                  {t("พบ")} {opp.map(name).join(" · ")}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {clock(g.startedAt)} · {t("สนาม {n}", { n: g.court })}
                  {result && <span className={g.winner === mine ? " font-semibold text-emerald-700" : ""}> · {result}</span>}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-semibold tabular-nums">
                <Icon.Shuttle width={14} height={14} />
                {g.shuttles}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">{t("จำนวนลูกไม่ตรง หรือมีเกมที่ไม่ได้เล่น แจ้งแอดมินให้แก้ได้")}</p>
    </Card>
  );
}
