"use client";

import { useEffect, useState } from "react";
import { nextMatch, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player } from "@/lib/types";
import { Button, Card, LevelBadge } from "./ui";

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function minutes(ms: number) {
  return Math.max(0, Math.floor(ms / 60000));
}

function TeamLine({ ids, byId }: { ids: string[]; byId: Map<string, Player> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map((id, i) => {
        const p = byId.get(id);
        return (
          <span key={id} className="flex items-center gap-1">
            {i > 0 && <span className="text-zinc-400">+</span>}
            <span className="font-medium">{p?.name ?? "?"}</span>
            {p && <LevelBadge level={p.level} />}
          </span>
        );
      })}
    </div>
  );
}

function ActiveCourt({ game, byId, date, now }: { game: Game; byId: Map<string, Player>; date: string; now: number }) {
  const { dispatch } = useStore();
  const end = (winner?: "A" | "B") => dispatch({ type: "endGame", date, gameId: game.id, winner });
  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm">
        <div className="flex gap-2">
          <span className="w-10 shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">ทีม A</span>
          <TeamLine ids={game.playerIds.slice(0, 2)} byId={byId} />
        </div>
        <div className="flex gap-2">
          <span className="w-10 shrink-0 text-xs font-semibold text-indigo-700 dark:text-indigo-400">ทีม B</span>
          <TeamLine ids={game.playerIds.slice(2)} byId={byId} />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
        <span className="text-sm">ลูกที่ใช้</span>
        <div className="flex items-center gap-3">
          <Button
            className="px-3 py-1"
            onClick={() => dispatch({ type: "setShuttles", date, gameId: game.id, shuttles: game.shuttles - 1 })}
          >
            −
          </Button>
          <span className="w-6 text-center text-lg font-semibold">{game.shuttles}</span>
          <Button
            className="px-3 py-1"
            onClick={() => dispatch({ type: "setShuttles", date, gameId: game.id, shuttles: game.shuttles + 1 })}
          >
            +
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => end("A")}>
          ทีม A ชนะ
        </Button>
        <Button variant="primary" className="!bg-indigo-600" onClick={() => end("B")}>
          ทีม B ชนะ
        </Button>
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>เล่นมา {minutes(now - game.startedAt)} นาที</span>
        <span className="flex gap-3">
          <button className="underline" onClick={() => end()}>
            จบไม่บันทึกผล
          </button>
          <button
            className="text-red-600 underline"
            onClick={() => {
              if (confirm("ยกเลิกเกมนี้? ลูกที่ใช้จะไม่ถูกคิดเงิน"))
                dispatch({ type: "cancelGame", date, gameId: game.id });
            }}
          >
            ยกเลิกเกม
          </button>
        </span>
      </div>
    </div>
  );
}

export function CourtsTab() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const now = useNow();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  const active = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));

  const fill = (court: number) => {
    const teams = nextMatch(day, state.players);
    if (teams) dispatch({ type: "startGame", date, court, playerIds: teams });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {courts.map((c) => {
          const g = active.get(c);
          return (
            <Card key={c}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">สนาม {c}</h3>
                <span className={`text-xs ${g ? "text-emerald-600" : "text-zinc-400"}`}>{g ? "กำลังเล่น" : "ว่าง"}</span>
              </div>
              {g ? (
                <ActiveCourt game={g} byId={byId} date={date} now={now} />
              ) : (
                <Button variant="primary" className="w-full" disabled={queue.length < 4} onClick={() => fill(c)}>
                  {queue.length < 4 ? `รอคนครบ 4 (มี ${queue.length})` : "จัดคู่ลงสนาม"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <h3 className="mb-2 font-semibold">คิวรอลงสนาม ({queue.length})</h3>
        <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {queue.map((e, i) => (
            <li key={e.player.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-5 text-zinc-400">{i + 1}</span>
              <span className="flex-1 font-medium">{e.player.name}</span>
              <LevelBadge level={e.player.level} />
              <span className="w-24 text-right text-xs text-zinc-500">
                เล่น {e.gamesPlayed} · รอ {minutes(now - e.waitingSince)} น.
              </span>
            </li>
          ))}
          {queue.length === 0 && <li className="py-4 text-center text-sm text-zinc-500">ไม่มีคนรอ</li>}
        </ol>
      </Card>
    </div>
  );
}
