"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import type { Day, Game, Player } from "@/lib/types";
import { Card, Icon, SearchInput, SectionTitle, inputClass } from "./ui";
import { locale, t } from "@/lib/i18n";
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
    <div className="min-w-0 break-words text-zinc-700">
      <span>
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="text-zinc-300"> · </span>}
            <span className={id === me ? "underline decoration-lime decoration-2 underline-offset-4" : ""}>{byId.get(id)?.name ?? "?"}</span>
          </span>
        ))}
      </span>
      {won && <Win />}
    </div>
  );
}

function Win() {
  return <span className="ml-1.5 inline-block rounded-full bg-lime px-1.5 align-middle text-[11px] font-bold uppercase leading-4 text-ink">win</span>;
}

/** วันที่สั้นๆ ไม่มีปี เช่น ศ. 30 ต.ค. */
function dateLabel(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
}

/** แถวเกม (แอดมิน): กดแถวเพื่อแก้จำนวนลูก หรือลบเกมที่ไม่ได้เล่นจริง */
export function GameShuttleRow({ game, byId, day, me, open, onToggle, past = false }: { game: Game; byId: Map<string, Player>; day: Day; me?: string; open: boolean; onToggle: (open: boolean) => void; past?: boolean }) {
  const { dispatch } = useStore();
  const setOpen = onToggle;
  const lockPaid = useLockPaid(game, day);
  const ci = new Map(day.checkIns.map((c) => [c.playerId, c]));
  const fixed = game.playerIds.filter((id) => ci.get(id)?.paidAt || ci.get(id)?.shuttleFee !== undefined);
  const change = (n: number) => {
    if (n < 0) return;
    lockPaid();
    dispatch({ type: "setShuttles", date: day.date, gameId: game.id, shuttles: n });
  };
  const remove = () => {
    // วันก่อน: บอกวันที่ด้วย กันลบผิดวัน
    const time = (past ? `${dateLabel(day.date)} ` : "") + clock(game.startedAt);
    if (!confirm(t("ลบเกมนี้ (สนาม {n} · {time})? ใช้เมื่อเกมนี้ไม่ได้เล่นจริง ลูกและผลแพ้ชนะของเกมนี้จะหายไป", { n: game.court, time }))) return;
    lockPaid();
    dispatch({ type: "cancelGame", date: day.date, gameId: game.id });
  };
  return (
    <li>
      <button className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-zinc-50" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="w-12 shrink-0">
          <div className="font-display text-sm font-semibold tabular-nums">{clock(game.startedAt)}</div>
          <div className="text-xs text-zinc-500">{t("สนาม {n}", { n: game.court })}</div>
        </div>
        <div className="min-w-0 flex-1 text-sm leading-6">
          <Team ids={game.playerIds.slice(0, 2)} byId={byId} won={game.winner === "A"} me={me} />
          <Team ids={game.playerIds.slice(2)} byId={byId} won={game.winner === "B"} me={me} />
        </div>
        {!game.endedAt && <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-emerald-700">{t("กำลังเล่น")}</span>}
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${game.shuttles === 0 ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-ink"}`}>
          <Icon.Shuttle width={14} height={14} />
          {game.shuttles}
        </span>
        <Icon.ChevronRight width={16} height={16} className={`shrink-0 text-zinc-400 transition ${open ? "rotate-90" : ""}`} />
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
          {past && <p className="text-xs text-amber-800">{t("เกมวันก่อน: คนที่ยังไม่จ่าย ยอดค้างจะเปลี่ยนตาม")}</p>}
          {fixed.length > 0 && (
            <p className="text-xs text-zinc-500">
              {t("ยอดเงินไม่เปลี่ยน (จ่ายแล้วหรือแอดมินแก้ยอดไว้): {names}", { names: fixed.map((id) => byId.get(id)?.name ?? "?").join(", ") })}
            </p>
          )}
          <button className="min-h-11 w-full rounded-2xl bg-ink text-sm font-semibold text-white" onClick={() => setOpen(false)}>
            {t("เสร็จ")}
          </button>
          {/* เกมที่ยังเล่นอยู่ ใช้ปุ่มยกเลิกเกมที่หน้าสนาม (คู่ในคิวจะได้ลงต่อถูก) */}
          {game.endedAt && (
            <button className="mx-auto mt-2 block min-h-11 px-3 text-sm font-medium text-red-600 underline-offset-2 active:underline" onClick={remove}>
              {t("ลบเกมนี้ (ไม่ได้เล่นจริง)")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** หน้าสนาม (แอดมิน): เกมที่จบแล้ววันนี้ กดเปิดดูแล้วแก้จำนวนลูกได้ */
export function FinishedGames({ byId }: { byId: Map<string, Player> }) {
  const { day } = useToday();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const done = day.games.filter((g) => g.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  if (done.length === 0) return null;
  const total = done.reduce((s, g) => s + g.shuttles, 0);
  return (
    <>
      <SectionTitle right={<span className="whitespace-nowrap">{t("{n} เกม · {m} ลูก", { n: done.length, m: total })}</span>}>{t("เกมที่จบแล้ววันนี้")}</SectionTitle>
      {open ? (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {done.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} open={editing === g.id} onToggle={(o) => setEditing(o ? g.id : null)} />
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

/** เมนูก๊วน > ประวัติเกม (แอดมิน): เลือกวัน หรือค้นชื่อทุกวัน แล้วแก้ลูก/ลบเกมที่ไม่ได้เล่นจริง */
export function GamesHistory() {
  const { state } = useStore();
  const { day: today } = useToday();
  const [date, setDate] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const dates = state.days
    .filter((d) => d.games.some((g) => g.endedAt))
    .map((d) => d.date)
    .sort((x, y) => y.localeCompare(x));
  if (!dates.length) return <Card className="py-10 text-center text-sm text-zinc-500">{t("ยังไม่มีเกมที่จบ")}</Card>;
  // วันที่เลือกไม่มีเกมเหลือแล้ว (เช่นลบเกมสุดท้าย) ไปวันล่าสุดที่มีเกม
  const picked = date && dates.includes(date) ? date : dates[0];
  const needle = q.trim().toLowerCase();
  const match = (g: Game) => g.playerIds.some((id) => (byId.get(id)?.name ?? "").toLowerCase().includes(needle));
  // ค้นชื่อ: หาทุกวัน ไม่ค้น: วันที่เลือก
  const groups = (needle ? dates : [picked])
    .map((d) => {
      const day = state.days.find((x) => x.date === d)!;
      const games = day.games.filter((g) => g.endedAt && (!needle || match(g))).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
      return { day, games };
    })
    .filter((x) => x.games.length);
  const label = (d: string) => (d === today.date ? t("วันนี้") : new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", year: "2-digit" }));
  return (
    <div className="space-y-3">
      <SearchInput value={q} onChange={(v) => { setQ(v); setEditing(null); }} placeholder={t("ค้นหาชื่อผู้เล่น (ทุกวัน)")} />
      {!needle && (
        <select className={inputClass} value={picked} onChange={(e) => { setDate(e.target.value); setEditing(null); }} aria-label={t("ดูวัน")}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {label(d)}
            </option>
          ))}
        </select>
      )}
      {groups.map(({ day, games }) => (
        <div key={day.date} className="space-y-1.5">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold">{label(day.date)}</span>
            <span className="whitespace-nowrap text-xs text-zinc-500">{t("{n} เกม · {m} ลูก", { n: games.length, m: games.reduce((s, g) => s + g.shuttles, 0) })}</span>
          </div>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
            {games.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} past={day.date !== today.date} open={editing === g.id} onToggle={(o) => setEditing(o ? g.id : null)} />
            ))}
          </ul>
        </div>
      ))}
      {needle && groups.length === 0 && <Card className="py-8 text-center text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</Card>}
    </div>
  );
}

/** หน้าบิล (แอดมิน): เกมของคนนี้วันนี้ แก้ลูกรายเกมได้ */
export function PlayerGameShuttles({ playerId, adjusted }: { playerId: string; adjusted: boolean }) {
  const { state } = useStore();
  const { day } = useToday();
  const [editing, setEditing] = useState<string | null>(null);
  const games = day.games.filter((g) => g.playerIds.includes(playerId)).sort((a, b) => b.startedAt - a.startedAt);
  if (games.length === 0) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{t("เกมของคนนี้วันนี้ (กดเพื่อแก้)")}</div>
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
        {games.map((g) => (
          <GameShuttleRow key={g.id} game={g} byId={byId} day={day} me={playerId} open={editing === g.id} onToggle={(o) => setEditing(o ? g.id : null)} />
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
          const won = !!g.endedAt && g.winner === mine;
          const result = !g.endedAt ? t("กำลังเล่น") : g.draw ? t("เสมอ") : g.winner && !won ? t("แพ้") : "";
          return (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-zinc-400">{i + 1}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="break-words">
                  <span className="text-zinc-500">{t("คู่กับ")}</span> {name(partner)}
                  {won && <Win />}
                </div>
                <div className="break-words text-zinc-500">
                  {t("พบ")} {opp.map(name).join(" · ")}
                </div>
                <div className="text-xs text-zinc-500">
                  {clock(g.startedAt)} · {t("สนาม {n}", { n: g.court })}
                  {result && <span> · {result}</span>}
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
