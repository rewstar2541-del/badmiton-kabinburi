"use client";

import { useEffect, useState } from "react";
import { nextMatch, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player, Team } from "@/lib/types";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle } from "./ui";

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

function CourtSide({ ids, byId, team }: { ids: string[]; byId: Map<string, Player>; team: Team }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
          team === "A" ? "bg-lime text-ink" : "bg-sky-300 text-ink"
        }`}
      >
        ทีม {team}
      </span>
      {ids.map((id) => {
        const p = byId.get(id);
        return (
          <div key={id} className="flex w-full items-center gap-2 rounded-2xl bg-black/20 px-2 py-1.5 backdrop-blur-sm">
            <Avatar name={p?.name ?? "?"} photo={p?.photo} size={28} ring />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{p?.name ?? "?"}</span>
            {p && <LevelBadge level={p.level} />}
          </div>
        );
      })}
    </div>
  );
}

function ActiveCourt({ game, byId, date, now }: { game: Game; byId: Map<string, Player>; date: string; now: number }) {
  const { dispatch, auth } = useStore();
  const end = (winner?: Team) => dispatch({ type: "endGame", date, gameId: game.id, winner });
  const setShuttles = (n: number) => dispatch({ type: "setShuttles", date, gameId: game.id, shuttles: n });

  return (
    <div className="space-y-3">
      <div className="court-surface flex gap-1 rounded-2xl px-2">
        <CourtSide ids={game.playerIds.slice(0, 2)} byId={byId} team="A" />
        <CourtSide ids={game.playerIds.slice(2)} byId={byId} team="B" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Icon.Clock width={14} height={14} />
          {minutes(now - game.startedAt)} นาที
        </span>
        {!auth.isAdmin && (
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Icon.Shuttle width={16} height={16} /> {game.shuttles} ลูก
          </span>
        )}
        {auth.isAdmin && <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
          <button
            className="grid size-8 place-items-center rounded-full bg-white shadow-sm active:scale-95"
            onClick={() => setShuttles(game.shuttles - 1)}
            aria-label="ลดลูก"
          >
            <Icon.Minus width={16} height={16} />
          </button>
          <span className="flex min-w-14 items-center justify-center gap-1 font-display font-semibold">
            <Icon.Shuttle width={16} height={16} />
            {game.shuttles}
          </span>
          <button
            className="grid size-8 place-items-center rounded-full bg-white shadow-sm active:scale-95"
            onClick={() => setShuttles(game.shuttles + 1)}
            aria-label="เพิ่มลูก"
          >
            <Icon.Plus width={16} height={16} />
          </button>
        </div>}
      </div>
      {auth.isAdmin && (
        <>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="accent" onClick={() => end("A")} className="flex items-center justify-center gap-1.5">
          <Icon.Trophy width={16} height={16} /> ทีม A ชนะ
        </Button>
        <Button onClick={() => end("B")} className="flex items-center justify-center gap-1.5 !bg-sky-300 text-ink">
          <Icon.Trophy width={16} height={16} /> ทีม B ชนะ
        </Button>
      </div>
      <div className="flex justify-center gap-4 text-xs text-zinc-400">
        <button className="underline-offset-2 active:underline" onClick={() => end()}>
          จบไม่บันทึกผล
        </button>
        <button
          className="text-red-500 underline-offset-2 active:underline"
          onClick={() => {
            if (confirm("ยกเลิกเกมนี้? ลูกที่ใช้จะไม่ถูกคิดเงิน")) dispatch({ type: "cancelGame", date, gameId: game.id });
          }}
        >
          ยกเลิกเกม
        </button>
      </div>
        </>
      )}
    </div>
  );
}

export function CourtsTab() {
  const { state, dispatch, auth } = useStore();
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
      <SectionTitle right={`ว่าง ${courts.length - active.size} สนาม`}>สนาม</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {courts.map((c) => {
          const g = active.get(c);
          return (
            <Card key={c}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">สนาม {c}</h3>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    g ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${g ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
                  {g ? "กำลังเล่น" : "ว่าง"}
                </span>
              </div>
              {g ? (
                <ActiveCourt game={g} byId={byId} date={date} now={now} />
              ) : !auth.isAdmin ? (
                <div className="court-surface flex h-24 items-center justify-center rounded-2xl text-sm font-semibold text-white/80">
                  ว่าง
                </div>
              ) : (
                <button
                  disabled={queue.length < 4}
                  onClick={() => fill(c)}
                  className="court-surface flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl text-white transition active:scale-[0.99] disabled:opacity-40 disabled:grayscale"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-lime text-ink shadow-lg">
                    <Icon.Plus width={22} height={22} strokeWidth={2.6} />
                  </span>
                  <span className="text-sm font-semibold">
                    {queue.length < 4 ? `รอคนครบ 4 (มี ${queue.length})` : "จัดคู่ลงสนาม"}
                  </span>
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle right={`${queue.length} คน`}>คิวรอลงสนาม</SectionTitle>
      <Card className="p-2">
        <ol>
          {queue.map((e, i) => (
            <li key={e.player.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${
                  i < 4 ? "bg-lime text-ink" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
              <Avatar name={e.player.name} photo={e.player.photo} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium">{e.player.name}</span>
              <LevelBadge level={e.player.level} />
              <span className="w-20 text-right text-[11px] leading-tight text-zinc-500">
                เล่น {e.gamesPlayed} เกม
                <br />
                รอ {minutes(now - e.waitingSince)} นาที
              </span>
            </li>
          ))}
          {queue.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">ไม่มีคนรอ</li>}
        </ol>
      </Card>
    </div>
  );
}
