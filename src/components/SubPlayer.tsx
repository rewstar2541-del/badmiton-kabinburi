"use client";

import { useState } from "react";
import { presence, queuedSpot, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { withSub, type Game, type Player } from "@/lib/types";
import { Avatar, Button, LevelBadge, Sheet } from "./ui";
import { t } from "@/lib/i18n";

/**
 * เปลี่ยนตัวระหว่างเกม (บาดเจ็บ เหนื่อย): แตะคนที่จะออก แล้วแตะคนที่จะลงแทน
 * คนเข้ายืนตำแหน่ง/ทีมเดิมของคนออก เกมเล่นต่อ (ไม่เริ่มเกมใหม่)
 * ค่าลูก: คนออกจ่ายลูกที่ใช้ไปแล้ว (รวมลูกที่กำลังตี) คนเข้าเริ่มนับจากลูกถัดไป
 * ผลแพ้ชนะ: เป็นของคนที่เล่นจนจบ คนออกไม่นับแพ้ชนะ
 */
export function SubPlayer({ game, onClose }: { game: Game; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const [out, setOut] = useState<string | null>(null);
  const [inId, setIn] = useState<string | null>(null);
  const [restOut, setRestOut] = useState(true);

  // คนที่ลงแทนได้: คิวรอก่อน (ตามลำดับคิว) ตามด้วยคนที่จัดคู่รอสนามไว้ แล้วคนที่พักอยู่
  const queued = waitingQueue(day, state.players).map((e) => e.player);
  const seen = new Set(queued.map((p) => p.id));
  const others = day.checkIns
    .filter((c) => !seen.has(c.playerId))
    .map((c) => ({ p: byId.get(c.playerId), status: presence(day, c.playerId) }))
    .filter((x): x is { p: Player; status: "waiting" | "resting" } => !!x.p && (x.status === "waiting" || x.status === "resting"))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "waiting" ? -1 : 1));
  const candidates: { p: Player; note?: string }[] = [
    ...queued.map((p) => ({ p })),
    ...others.map(({ p, status }) => {
      const spot = queuedSpot(day, p.id);
      return { p, note: status === "resting" ? t("พักอยู่") : spot ? t("จัดคิวสนาม {n} ไว้", { n: spot.court }) : undefined };
    }),
  ];
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "");

  const apply = () => {
    if (!out || !inId) return;
    // แอดมินอีกเครื่องอาจจบเกม/เปลี่ยนตัวคนนี้ไปแล้ว
    const live = day.games.find((g) => g.id === game.id && !g.endedAt);
    if (!live || !live.playerIds.includes(out)) return onClose();
    dispatch({ type: "subPlayer", date, gameId: game.id, ...withSub(live, out, inId, Date.now()) });
    if (presence(day, inId) === "resting") dispatch({ type: "setResting", date, playerId: inId, resting: false });
    if (restOut) dispatch({ type: "setResting", date, playerId: out, resting: true });
    onClose();
  };

  return (
    <Sheet onClose={onClose} title={<h3 className="font-display text-lg font-semibold">{t("เปลี่ยนตัว สนาม {n}", { n: game.court })}</h3>}>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-zinc-700">{t("1. ใครออก")}</div>
        <div className="court-surface flex gap-1 rounded-2xl px-2 py-3">
          {(["A", "B"] as const).map((team, ti) => (
            <div key={team} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${team === "A" ? "bg-lime text-ink" : "bg-sky-300 text-ink"}`}>
                {t("ทีม {team}", { team })}
              </span>
              {game.playerIds.slice(ti * 2, ti * 2 + 2).map((id) => {
                const p = byId.get(id);
                const on = out === id;
                return (
                  <button
                    key={id}
                    onClick={() => setOut(on ? null : id)}
                    aria-pressed={on}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition active:scale-[0.98] ${
                      on ? "bg-red-500 text-white ring-2 ring-white" : "bg-black/20 text-white"
                    }`}
                  >
                    <Avatar name={p?.name ?? "?"} photo={p?.photo} size={28} ring />
                    <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold [overflow-wrap:anywhere]">
                      {on ? `${p?.name ?? "?"} ↓` : (p?.name ?? "?")}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-zinc-700">{t("2. ใครลงแทน")}</div>
        {candidates.length === 0 ? (
          <p className="rounded-2xl bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">{t("ไม่มีคนรอ ให้คนเช็คอินก่อน")}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-zinc-50 p-1">
            {candidates.map(({ p, note }) => {
              const on = inId === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setIn(on ? null : p.id)}
                    aria-pressed={on}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left active:scale-[0.99] ${on ? "bg-lime" : "bg-white"}`}
                  >
                    <Avatar name={p.name} photo={p.photo} size={32} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{p.name}</span>
                      {note && <span className="text-xs text-zinc-500">{note}</span>}
                    </span>
                    <LevelBadge level={p.level} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-zinc-50 px-3 text-sm">
        <input type="checkbox" className="size-5 accent-ink" checked={restOut} onChange={(e) => setRestOut(e.target.checked)} />
        {t("ให้คนออกพักก่อน (ไม่ขึ้นคิว)")}
      </label>

      {out && inId && (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("{out} จ่าย {n} ลูกที่ใช้ไปแล้ว {in} เริ่มนับจากลูกถัดไป ผลแพ้ชนะเป็นของคนที่เล่นจนจบ", { out: name(out), in: name(inId), n: game.shuttles })}
        </p>
      )}

      <Button variant="primary" className="w-full disabled:opacity-40" disabled={!out || !inId} onClick={apply}>
        {out && inId ? t("เปลี่ยน {out} เป็น {in}", { out: name(out), in: name(inId) }) : t("เลือกคนออกและคนลงแทน")}
      </Button>
    </Sheet>
  );
}
