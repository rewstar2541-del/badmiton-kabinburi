"use client";

import { ClubCorner } from "./ClubCorner";
import { StockWarning } from "./Stock";
import { PairRequests } from "./Pairs";
import { useEffect, useState } from "react";
import { presence, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player, Team } from "@/lib/types";
import { MatchBuilder } from "./MatchBuilder";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";
import { MyRestCard } from "./RestButton";
import { PendingNotice, PickMe, useMe } from "./PickMe";

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
    // basis-0 + min-w-0: แต่ละฝั่งกว้างครึ่งสนามพอดี ชื่อยาวไม่ล้นข้ามเส้นกลาง
    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-2 py-3">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
          team === "A" ? "bg-lime text-ink" : "bg-sky-300 text-ink"
        }`}
      >
        {t("ทีม {team}", { team })}
      </span>
      {ids.map((id) => {
        const p = byId.get(id);
        return (
          <div key={id} className="flex w-full items-center gap-2 rounded-2xl bg-black/20 px-2 py-1.5 backdrop-blur-sm">
            <Avatar name={p?.name ?? "?"} photo={p?.photo} size={28} ring />
            <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold [overflow-wrap:anywhere] text-white" title={p?.name}>
              {p?.name ?? "?"}
            </span>
            {p && (
              <span className="shrink-0">
                <LevelBadge level={p.level} />
              </span>
            )}
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
          {t("{n} นาที", { n: minutes(now - game.startedAt) })}
        </span>
        {!auth.isAdmin && (
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Icon.Shuttle width={16} height={16} /> {t("{n} ลูก", { n: game.shuttles })}
          </span>
        )}
        {auth.isAdmin && <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
          <button
            className="grid size-8 place-items-center rounded-full bg-white shadow-sm active:scale-95"
            onClick={() => setShuttles(game.shuttles - 1)}
            aria-label={t("ลดลูก")}
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
            aria-label={t("เพิ่มลูก")}
          >
            <Icon.Plus width={16} height={16} />
          </button>
        </div>}
      </div>
      {auth.isAdmin && (
        <>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="accent" onClick={() => end("A")} className="flex items-center justify-center gap-1.5">
          <Icon.Trophy width={16} height={16} /> {t("ทีม {team} ชนะ", { team: "A" })}
        </Button>
        <Button onClick={() => end("B")} className="flex items-center justify-center gap-1.5 !bg-sky-300 text-ink">
          <Icon.Trophy width={16} height={16} /> {t("ทีม {team} ชนะ", { team: "B" })}
        </Button>
      </div>
      <div className="flex justify-center gap-4 text-xs text-zinc-400">
        <button className="underline-offset-2 active:underline" onClick={() => end()}>
          {t("จบไม่บันทึกผล")}
        </button>
        <button
          className="text-red-500 underline-offset-2 active:underline"
          onClick={() => {
            if (confirm(t("ยกเลิกเกมนี้? ลูกที่ใช้จะไม่ถูกคิดเงิน"))) dispatch({ type: "cancelGame", date, gameId: game.id });
          }}
        >
          {t("ยกเลิกเกม")}
        </button>
      </div>
        </>
      )}
    </div>
  );
}

export function CourtsTab() {
  const { state, auth, dispatch } = useStore();
  const { date, day } = useToday();
  const [building, setBuilding] = useState<number | null>(null);
  const now = useNow();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  const active = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));
  const resting = day.checkIns.filter((c) => presence(day, c.playerId) === "resting").map((c) => byId.get(c.playerId)).filter((p) => p !== undefined);
  const home = day.checkIns.filter((c) => presence(day, c.playerId) === "home").length;
  const rest = (playerId: string, on: boolean) => dispatch({ type: "setResting", date, playerId, resting: on });

  if (!auth.isAdmin)
    return (
      <div className="space-y-4">
        <PlayerCourts />
        <ClubCorner />
      </div>
    );


  return (
    <div className="space-y-4">
      <StockWarning />
      <PairRequests />
      <SectionTitle right={t("ว่าง {n} สนาม", { n: courts.length - active.size })}>{t("สนาม")}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {courts.map((c) => {
          const g = active.get(c);
          return (
            <Card key={c}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{t("สนาม {n}", { n: c })}</h3>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    g ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${g ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
                  {g ? t("กำลังเล่น") : t("ว่าง")}
                </span>
              </div>
              {g ? (
                <ActiveCourt game={g} byId={byId} date={date} now={now} />
              ) : !auth.isAdmin ? (
                <div className="court-surface flex h-24 items-center justify-center rounded-2xl text-sm font-semibold text-white/80">
                  {t("ว่าง")}
                </div>
              ) : (
                <button
                  disabled={queue.length < 4}
                  onClick={() => setBuilding(c)}
                  className="court-surface flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl text-white transition active:scale-[0.99] disabled:opacity-40 disabled:grayscale"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-lime text-ink shadow-lg">
                    <Icon.Plus width={22} height={22} strokeWidth={2.6} />
                  </span>
                  <span className="text-sm font-semibold">
                    {queue.length < 4 ? t("รอคนครบ 4 (มี {n})", { n: queue.length }) : t("จัดคู่ลงสนาม")}
                  </span>
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {building !== null && <MatchBuilder court={building} onClose={() => setBuilding(null)} />}

      <SectionTitle right={t("{n} คน", { n: queue.length })}>{t("คิวรอลงสนาม")}</SectionTitle>
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
                {t("เล่น {n} เกม", { n: e.gamesPlayed })}
                <br />
                {t("รอ {n} นาที", { n: minutes(now - e.waitingSince) })}
              </span>
              {auth.isAdmin && (
                <button
                  onClick={() => rest(e.player.id, true)}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 active:bg-zinc-200"
                >
                  {t("พัก")}
                </button>
              )}
            </li>
          ))}
          {queue.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">{t("ไม่มีคนรอ")}</li>}
        </ol>
      </Card>

      {resting.length > 0 && (
        <>
          <SectionTitle right={t("{n} คน", { n: resting.length })}>{t("พักอยู่")}</SectionTitle>
          <Card className="p-2">
            <ul>
              {resting.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 opacity-80">
                  <Avatar name={p.name} photo={p.photo} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <LevelBadge level={p.level} />
                  {auth.isAdmin && (
                    <button
                      onClick={() => rest(p.id, false)}
                      className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink"
                    >
                      {t("กลับมาเล่น")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {home > 0 && <p className="px-1 text-xs text-zinc-500">{t("จ่ายเงินแล้วกลับบ้าน {n} คน", { n: home })}</p>}
      <ClubCorner />
    </div>
  );
}

/** หน้าสนามของผู้เล่น: สนามและคิวของตัวเองด้านบน แล้วทุกสนามและคิวแบบเดียวกับแอดมิน (ดูอย่างเดียว เหมือนจอทีวี) */
function PlayerCourts() {
  const { state } = useStore();
  const { day } = useToday();
  const [me, setMe] = useMe();
  const now = useNow();
  const player = state.players.find((p) => p.id === me);
  if (!player) return <PickMe onPick={setMe} hint={t("เข้าสู่ระบบครั้งเดียว เครื่องนี้จะจำไว้ แล้วดูสนามและคิวของคุณได้")} />;
  if (player.pending) return <PendingNotice name={player.name} onNotMe={() => setMe(null)} />;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  const active = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));
  const myGame = day.games.find((g) => !g.endedAt && g.playerIds.includes(player.id));
  const myPos = queue.findIndex((e) => e.player.id === player.id);
  const status = presence(day, player.id);

  return (
    <div className="space-y-4">
      <SectionTitle>{t("สนามของฉัน")}</SectionTitle>
      {myGame ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{t("คุณอยู่สนาม {n}", { n: myGame.court })}</h3>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Icon.Clock width={14} height={14} />
              {t("{n} นาที", { n: minutes(now - myGame.startedAt) })}
            </span>
          </div>
          <div className="court-surface flex gap-1 rounded-2xl px-2">
            <CourtSide ids={myGame.playerIds.slice(0, 2)} byId={byId} team="A" />
            <CourtSide ids={myGame.playerIds.slice(2)} byId={byId} team="B" />
          </div>
        </Card>
      ) : (
        <Card className="py-6 text-center">
          {status === "waiting" && myPos >= 0 ? (
            <>
              <div className="font-display text-4xl font-semibold">{myPos + 1}</div>
              <div className="text-sm text-zinc-500">
                {myPos < 4 ? t("คิวของคุณ ใกล้ได้ลงแล้ว") : t("คิวของคุณ จากที่รอ {n} คน", { n: queue.length })}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              {status === "resting"
                ? t("พักอยู่ ระบบข้ามคิวให้")
                : status === "home"
                  ? t("จ่ายแล้ว ถือว่ากลับบ้านแล้ว")
                  : t("วันนี้ยังไม่ได้เช็คอิน")}
            </p>
          )}
        </Card>
      )}
      <MyRestCard />

      <SectionTitle right={t("ว่าง {n} สนาม", { n: courts.length - active.size })}>{t("สนามทั้งหมด")}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {courts.map((c) => {
          const g = active.get(c);
          return (
            <Card key={c}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{t("สนาม {n}", { n: c })}</h3>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    g ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${g ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
                  {g ? t("กำลังเล่น") : t("ว่าง")}
                </span>
              </div>
              {g ? (
                <ActiveCourt game={g} byId={byId} date={day.date} now={now} />
              ) : (
                <div className="court-surface flex h-24 items-center justify-center rounded-2xl text-sm font-semibold text-white/80">
                  {t("ว่าง")}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle right={t("{n} คน", { n: queue.length })}>{t("คิวรอลงสนาม")}</SectionTitle>
      <Card className="p-2">
        <ol>
          {queue.map((e, i) => (
            <li key={e.player.id} className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${e.player.id === player.id ? "bg-lime/30" : ""}`}>
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
              <span className="w-20 text-right text-[11px] leading-tight text-zinc-500">{t("รอ {n} นาที", { n: minutes(now - e.waitingSince) })}</span>
            </li>
          ))}
          {queue.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">{t("ไม่มีคนรอ")}</li>}
        </ol>
      </Card>
    </div>
  );
}
