"use client";

import { PairRequests } from "./Pairs";
import { useEffect, useMemo, useState } from "react";
import { courtPlan, courtQueue, plannedCourt, queueByCourt, presence, queueBlockers, queuedSpot, waitingQueue, type CourtNext } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player, QueuedGame, Team } from "@/lib/types";
import { MatchBuilder } from "./MatchBuilder";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";
import { MyRestCard } from "./RestButton";
import { PendingNotice, PickMe, useMe } from "./PickMe";
import { goToTab } from "./Membership";

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
  const { state } = useStore();
  const { day } = useToday();
  const end = (winner?: Team, draw?: boolean) => {
    // สนามนี้ได้คู่แรกของคิวรวม (คนรอนานสุดไม่ถูกแซง) ถ้าแอดมินจัดคิวสนามนี้ไว้เองใช้คู่นั้น
    const next = courtPlan(day, state.players, state.settings.courtCount, game.court).get(game.court);
    dispatch({ type: "endGame", date, gameId: game.id, winner, draw });
    if (!next) return;
    // ลงต่อทันที ถ้าคนในคู่ยังอยู่ครบ ไม่งั้นแจ้งให้แอดมินแก้คิว
    if (queueBlockers(day, next, game.id).length === 0)
      dispatch({ type: "startGame", date, court: game.court, playerIds: next.playerIds, queuedId: next.queuedId });
    else alert(t("สนาม {n} ยังเริ่มเกมต่อไม่ได้ มีคนในคู่ที่จัดไว้ไม่พร้อม (ชื่อขีดฆ่า) กดแก้หรือเอาคู่นั้นออก", { n: game.court }));
  };
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
        <button className="underline-offset-2 active:underline" onClick={() => end(undefined, true)}>
          {t("จบเสมอ")}
        </button>
        <button className="underline-offset-2 active:underline" onClick={() => end()}>
          {t("จบไม่บันทึกผล")}
        </button>
        <button
          className="text-red-500 underline-offset-2 active:underline"
          onClick={() => {
            if (confirm(t("ยกเลิกเกมนี้? (ไม่คิดค่าลูก)"))) dispatch({ type: "cancelGame", date, gameId: game.id });
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

/** ชื่อ 4 คนของคู่ที่จัดไว้ ทีม A vs ทีม B (คนที่ลงไม่ได้ขีดฆ่า) */
function QueuedTeams({ q, byId, blocked }: { q: Pick<QueuedGame, "playerIds">; byId: Map<string, Player>; blocked: Set<string> }) {
  const name = (id: string) => (
    <span key={id} className={`truncate ${blocked.has(id) ? "text-red-500 line-through" : ""}`}>
      {byId.get(id)?.name ?? "?"}
    </span>
  );
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
      <span className="flex min-w-0 flex-1 basis-0 flex-col leading-tight">{q.playerIds.slice(0, 2).map(name)}</span>
      <span className="shrink-0 text-xs font-bold text-zinc-400">VS</span>
      <span className="flex min-w-0 flex-1 basis-0 flex-col leading-tight">{q.playerIds.slice(2).map(name)}</span>
    </span>
  );
}

/** แก้คู่ที่รอสนาม: คู่อัตโนมัติ (ยังไม่มี id) หรือคู่ที่จัดคิวไว้ (มี id) */
type EditTarget = { court: number; playerIds: string[]; queuedId?: string };

/**
 * คิวรอลงของสนามหนึ่ง: คู่ถัดไปมาจากคิวรวมอัตโนมัติ (คิว 1-4 สนาม 1, 5-8 สนาม 2)
 * แอดมินกด "แก้" เปลี่ยนคนได้ (กลายเป็นคู่ที่แอดมินจัด) และจัดคิวต่อได้อีกหลายคู่
 * เกมจบแล้วคู่แรกลงต่อทันที สนามว่างกด "ลงสนาม" เอง
 */
function CourtQueue({
  court,
  free,
  next,
  waiting,
  onAdd,
  onEdit,
  byId,
}: {
  court: number;
  free: boolean;
  next?: CourtNext;
  waiting: number;
  onAdd: () => void;
  onEdit: (e: EditTarget) => void;
  byId: Map<string, Player>;
}) {
  const { dispatch, auth } = useStore();
  const { date, day } = useToday();
  const locked = courtQueue(day, court);
  // แถวแรก = คู่ถัดไป (อัตโนมัติถ้าแอดมินยังไม่ได้จัดเอง) ตามด้วยคิวที่แอดมินจัดต่อไว้
  const rows: { playerIds: Game["playerIds"]; queuedId?: string }[] = next && !next.queuedId ? [next] : locked.map((q) => ({ playerIds: q.playerIds, queuedId: q.id }));
  if (rows.length === 0) return null;
  const anyBlocked = rows.some((r) => queueBlockers(day, r).length > 0);
  return (
    <div className="mt-3 space-y-1.5 border-t border-zinc-200 pt-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-600">
        {free ? t("พร้อมลงสนามนี้") : t("รอลงต่อสนามนี้")}
        {!rows[0].queuedId && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{t("จัดอัตโนมัติ")}</span>}
      </div>
      <ol className="space-y-1.5">
        {rows.map((q, i) => {
          const blocked = new Set(queueBlockers(day, q));
          const ready = blocked.size === 0;
          return (
            <li key={q.queuedId ?? "auto"} className={`space-y-2 rounded-2xl p-2 ${i === 0 ? "bg-lime/25" : "bg-zinc-50"}`}>
              <div className="flex items-center gap-2">
                {rows.length > 1 && (
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-lime text-ink" : "bg-zinc-200 text-zinc-600"}`}>
                    {i + 1}
                  </span>
                )}
                <QueuedTeams q={q} byId={byId} blocked={blocked} />
              </div>
              {auth.isAdmin && (
                // ปุ่มแยกบรรทัด กดง่ายบนจอแคบ ชื่อไม่ถูกบีบ
                <div className="flex items-center gap-2">
                  {free && i === 0 && (
                    <button
                      disabled={!ready}
                      onClick={() => {
                        // กันกดซ้ำ/แอดมินอีกเครื่องเพิ่งลงสนามนี้ไป
                        if (day.games.some((g) => !g.endedAt && g.court === court)) return;
                        dispatch({ type: "startGame", date, court, playerIds: q.playerIds, queuedId: q.queuedId });
                      }}
                      className="h-11 flex-1 rounded-full bg-ink px-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
                    >
                      {t("ลงสนาม")}
                    </button>
                  )}
                  <button
                    onClick={() => onEdit({ court, playerIds: q.playerIds, queuedId: q.queuedId })}
                    className={`h-11 rounded-full bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-300 active:scale-95 ${free && i === 0 ? "" : "flex-1"}`}
                  >
                    {t("แก้")}
                  </button>
                  {q.queuedId && (
                    <button
                      onClick={() => {
                        if (confirm(t("เอาคู่นี้ออกจากคิว?"))) dispatch({ type: "unqueueGame", date, id: q.queuedId! });
                      }}
                      aria-label={t("เอาออกจากคิว")}
                      className="ml-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 active:bg-zinc-200"
                    >
                      <Icon.X width={18} height={18} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {auth.isAdmin && anyBlocked && (
        <p className="text-[11px] text-red-500">{t("ชื่อขีดฆ่า = พัก กลับบ้าน หรือยังเล่นสนามอื่น เอาคู่นั้นออกแล้วจัดใหม่")}</p>
      )}
      {auth.isAdmin && waiting >= 4 && rows[0].queuedId && (
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 py-2 text-sm font-semibold text-zinc-600 active:bg-zinc-50"
        >
          <Icon.Plus width={16} height={16} /> {t("จัดคิวต่ออีกคู่")}
        </button>
      )}
    </div>
  );
}

export function CourtsTab() {
  const { state, auth, dispatch } = useStore();
  const { date, day } = useToday();
  const [building, setBuilding] = useState<{ court: number; queue: boolean; initial?: string[]; editId?: string } | null>(null);
  const now = useNow();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  // คำนวณใหม่เฉพาะตอนข้อมูลเปลี่ยน (นาฬิกาเดินทุก 15 วินาทีไม่ต้องคำนวณ)
  const plan = useMemo(() => courtPlan(day, state.players, state.settings.courtCount), [day, state.players, state.settings.courtCount]);
  const courtOf = new Map([...plan.values()].filter((n) => !n.queuedId).flatMap((n) => n.playerIds.map((id) => [id, n.court] as const)));
  // คนในคิวรวมที่ระบบจัดให้สนามอื่นแล้ว (แนะนำใหม่จะไม่ดึงมา)
  const reservedFor = (court: number) => [...plan.values()].filter((n) => n.court !== court && !n.queuedId).flatMap((n) => n.playerIds);
  const active = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));
  const resting = day.checkIns.filter((c) => presence(day, c.playerId) === "resting").map((c) => byId.get(c.playerId)).filter((p) => p !== undefined);
  const home = day.checkIns.filter((c) => presence(day, c.playerId) === "home").length;
  const rest = (playerId: string, on: boolean) => dispatch({ type: "setResting", date, playerId, resting: on });
  // จบก๊วนแล้ว: ไม่มีเกม ไม่มีคนรอ ไม่มีคิวสนาม เหลือแต่คนพักที่ยังไม่จ่าย
  const ended = active.size === 0 && queue.length === 0 && !(day.queued ?? []).length && resting.length > 0;
  const [showRest, setShowRest] = useState(false);

  if (!auth.isAdmin)
    return (
      <div className="space-y-4">
        <PlayerCourts />
      </div>
    );


  return (
    <div className="space-y-4">
      <PairRequests />
      <SectionTitle right={t("ว่าง {n} สนาม", { n: courts.length - active.size })}>{t("สนาม")}</SectionTitle>
      <Button
        className="w-full !rounded-3xl !bg-red-600 !py-4 !text-base !text-white shadow-[0_10px_24px_-10px_rgba(220,38,38,0.7)] active:scale-[0.98]"
        onClick={() => {
          const running = [...active.values()];
          const msg = running.length ? t("จบก๊วน? จะจบเกมที่กำลังเล่นอยู่ {n} เกม (ไม่บันทึกผล) ล้างคิว แล้วไปหน้าคิดเงิน", { n: running.length }) : t("จบก๊วน? ล้างคิว แล้วไปหน้าคิดเงิน");
          if (!confirm(msg)) return;
          running.forEach((g) => dispatch({ type: "endGame", date, gameId: g.id }));
          (day.queued ?? []).forEach((q) => dispatch({ type: "unqueueGame", date, id: q.id }));
          // ล้างคิว: คนที่ยังรอหรือเพิ่งลงจากสนามเป็นพักทั้งหมด (ยังไม่จ่าย ยังเห็นในหน้าคิดเงิน)
          day.checkIns.filter((c) => !c.paidAt && !c.resting).forEach((c) => dispatch({ type: "setResting", date, playerId: c.playerId, resting: true }));
          goToTab("billing");
        }}
      >
        🏁 {t("จบก๊วน")}
      </Button>
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
              ) : plan.has(c) ? null : (
                <button
                  disabled={queue.length < 4}
                  onClick={() => setBuilding({ court: c, queue: false })}
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
              <CourtQueue
                court={c}
                free={!g}
                next={plan.get(c)}
                waiting={queue.length}
                onAdd={() => setBuilding({ court: c, queue: true })}
                // แก้แล้วเก็บเป็นคิวที่แอดมินจัด (ไม่เริ่มเกมเอง) สนามว่างกดลงสนามอีกที
                onEdit={(e) => setBuilding({ court: c, queue: true, initial: e.playerIds, editId: e.queuedId })}
                byId={byId}
              />
            </Card>
          );
        })}
      </div>

      {building !== null && (
        <MatchBuilder
          court={building.court}
          queue={building.queue}
          initial={building.initial}
          editId={building.editId}
          reserved={reservedFor(building.court)}
          courtOf={courtOf}
          onClose={() => setBuilding(null)}
        />
      )}

      {!ended && (
        <>
      <SectionTitle right={t("{n} คน", { n: queue.length })}>{t("คิวรอลงสนาม")}</SectionTitle>
      <Card className="p-2">
        <ol>
          {queueByCourt(queue, plan).map((e, i) => (
            <li key={e.player.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${
                  i < 4 ? "bg-lime text-ink" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
              <Avatar name={e.player.name} photo={e.player.photo} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{e.player.name}</span>
                {courtOf.get(e.player.id) && (
                  <span className="text-xs font-semibold whitespace-nowrap text-emerald-700">
                    {t("รอสนาม {n}", { n: courtOf.get(e.player.id)! })}
                  </span>
                )}
              </span>
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
        </>
      )}

      {/* หลังจบก๊วน: ทุกคนที่ยังไม่จ่ายถูกพักไว้ บอกว่าจบแล้วและพาไปคิดเงิน (ดูรายชื่อ/ให้กลับมาเล่นได้ถ้าเปิดต่อ) */}
      {ended && (
        <Card className="space-y-3 text-center">
          <div className="font-display text-lg font-semibold">🏁 {t("จบก๊วนแล้ว")}</div>
          <p className="text-sm text-zinc-600">{t("ยังไม่จ่ายเงิน {n} คน", { n: resting.length })}</p>
          <Button variant="accent" className="w-full" onClick={() => goToTab("billing")}>
            {t("ไปหน้าคิดเงิน")}
          </Button>
          <button className="min-h-11 text-sm font-semibold text-zinc-500 underline-offset-2 active:underline" onClick={() => setShowRest(!showRest)}>
            {showRest ? t("ซ่อนรายชื่อ") : t("ดูรายชื่อ / ให้กลับมาเล่นต่อ")}
          </button>
        </Card>
      )}
      {resting.length > 0 && (!ended || showRest) && (
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
  if (!player) return <PickMe onPick={setMe} hint={t("เข้าครั้งเดียว เครื่องจะจำไว้")} />;
  if (player.pending) return <PendingNotice name={player.name} onNotMe={() => setMe(null)} />;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  const active = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));
  const myGame = day.games.find((g) => !g.endedAt && g.playerIds.includes(player.id));
  const plan = courtPlan(day, state.players, state.settings.courtCount);
  const courtOf = new Map([...plan.values()].filter((n) => !n.queuedId).flatMap((n) => n.playerIds.map((id) => [id, n.court] as const)));
  // อยู่คิวสนามไหน: คู่ที่แอดมินจัดไว้ก่อน ไม่งั้นดูจากที่ระบบจัดอัตโนมัติ
  const planned = plannedCourt(plan, player.id);
  const myPos = queueByCourt(queue, plan).findIndex((e) => e.player.id === player.id);
  const mySpot = queuedSpot(day, player.id) ?? (planned ? { court: planned.court, pos: 0 } : null);
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
          {status === "waiting" && mySpot ? (
            <>
              <div className="font-display text-4xl font-semibold">{t("สนาม {n}", { n: mySpot.court })}</div>
              <div className="text-sm text-zinc-500">
                {mySpot.pos === 0 ? t("ระบบจัดให้รอสนามนี้ อาจเปลี่ยนได้ถ้าคิวขยับ") : mySpot.pos === 1 ? t("คุณได้ลงต่อจากเกมที่เล่นอยู่ เตรียมตัวได้เลย") : t("คิวรอลงสนามนี้ คู่ที่ {n}", { n: mySpot.pos })}
              </div>
            </>
          ) : status === "waiting" && myPos >= 0 ? (
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
              <CourtQueue court={c} free={!g} next={plan.get(c)} waiting={0} onAdd={() => {}} onEdit={() => {}} byId={byId} />
            </Card>
          );
        })}
      </div>

      <SectionTitle right={t("{n} คน", { n: queue.length })}>{t("คิวรอลงสนาม")}</SectionTitle>
      <Card className="p-2">
        <ol>
          {queueByCourt(queue, plan).map((e, i) => (
            <li key={e.player.id} className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${e.player.id === player.id ? "bg-lime/30" : ""}`}>
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${
                  i < 4 ? "bg-lime text-ink" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
              <Avatar name={e.player.name} photo={e.player.photo} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{e.player.name}</span>
                {courtOf.get(e.player.id) && (
                  <span className="text-xs font-semibold whitespace-nowrap text-emerald-700">
                    {t("รอสนาม {n}", { n: courtOf.get(e.player.id)! })}
                  </span>
                )}
              </span>
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
