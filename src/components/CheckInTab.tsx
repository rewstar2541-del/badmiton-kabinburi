"use client";

import { PollAdmin } from "./Polls";
import { StockWarning } from "./Stock";
import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid, type Player } from "@/lib/types";
import { AnnounceCard } from "./AnnounceCard";
import { AdminAddGuest } from "./Guests";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";
import { daysBefore, nameMatch, rosterCompare, visitCounts } from "@/lib/roster";
import { LevelGroups, RosterSortSwitch, useRosterSort } from "./RosterSort";

export function CheckInTab() {
  const { state, dispatch } = useStore();
  const { day, date } = useToday();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);

  const waiting = state.players.filter((p) => p.pending).length;
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const signed = new Set(day.signups?.map((s) => s.playerId));
  // ยังไม่เช็คอินขึ้นก่อน ในนั้นคนที่ลงชื่อไว้ขึ้นก่อน
  const rank = (id: string) => (checked.has(id) ? 2 : signed.has(id) ? 0 : 1);
  // แขกที่ไม่ได้มาวันนี้ และคนที่ยังรออนุมัติ ไม่ต้องแสดง
  const roster = state.players.filter((p) => !p.pending && (!p.guestOf || checked.has(p.id)));
  // แสดงทุกคนที่ลงทะเบียนแล้ว เรียงตามที่เลือก คนที่ลงชื่อวันนี้ขึ้นก่อนเสมอ (ถ้าแบ่งตามระดับมือ ขึ้นก่อนในแต่ละกลุ่ม)
  const [sort, setSort] = useRosterSort();
  const counts = visitCounts(state.days, daysBefore(date, 30));
  const cmp = rosterCompare(sort === "level" ? "name" : sort, counts);
  const list = (q.trim() ? roster.filter((p) => nameMatch(p, q)) : roster).sort((a, b) => rank(a.id) - rank(b.id) || cmp(a, b));
  const visits = sort === "often" ? counts : undefined;
  const tiles = (players: Player[]) => (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {players.map((p) => (
        <PlayerTile key={p.id} p={p} on={checked.has(p.id)} signed={signed.has(p.id)} visits={visits?.get(p.id) ?? (visits && 0)} />
      ))}
    </ul>
  );
  const members = state.players.filter((p) => !p.pending && !p.guestOf).length;

  return (
    <div className="space-y-4">
      <StockWarning />
      <AnnounceCard />
      <PollAdmin compact />
      <SignupList />
      {waiting > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {t("มีคนสมัครใหม่รออนุมัติ {n} คน ดูที่หน้าผู้เล่น", { n: waiting })}
        </p>
      )}
      <SectionTitle right={t("{a}/{b} คน", { a: checked.size, b: members }) + (signed.size ? ` · ${t("ลงชื่อ {n}", { n: signed.size })}` : "")}>
        {t("เช็คอินวันนี้")}
      </SectionTitle>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
          <input className={`${inputClass} pl-11`} placeholder={t("ค้นหาชื่อเล่น")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="accent" className="px-4" onClick={() => setAdding(true)} aria-label={t("ลงทะเบียนผู้เล่นใหม่")}>
          <Icon.Plus width={20} height={20} strokeWidth={2.5} />
        </Button>
      </div>

      <button className="text-sm font-semibold text-zinc-600 underline" onClick={() => setAddingGuest(true)}>
        {t("+ เพิ่มแขกที่สมาชิกพามา")}
      </button>
      {addingGuest && <AdminAddGuest onClose={() => setAddingGuest(false)} />}

      {adding && (
        <Card>
          <h3 className="mb-3 font-display font-semibold">{t("ลงทะเบียนผู้เล่นใหม่")}</h3>
          <PlayerForm
            onCancel={() => setAdding(false)}
            onSave={(player) => {
              dispatch({ type: "addPlayer", player });
              setAdding(false);
            }}
          />
        </Card>
      )}

      <RosterSortSwitch value={sort} onChange={setSort} />
      {sort === "level" ? (
        <LevelGroups
          players={list}
          forceOpen={q.trim() !== ""}
          summary={(players) => {
            const inCount = players.filter((p) => checked.has(p.id)).length;
            const signedCount = players.filter((p) => signed.has(p.id) && !checked.has(p.id)).length;
            return t("มาแล้ว {a}/{b}", { a: inCount, b: players.length }) + (signedCount > 0 ? ` · ${t("ลงชื่อ {n}", { n: signedCount })}` : "");
          }}
        >
          {tiles}
        </LevelGroups>
      ) : (
        tiles(list)
      )}
      {list.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">
          {state.players.length === 0 ? t("ยังไม่มีผู้เล่น กดปุ่ม + เพื่อลงทะเบียน") : t("ไม่พบชื่อที่ค้นหา")}
        </Card>
      )}
    </div>
  );
}

function PlayerTile({ p, on, signed, visits }: { p: Player; on: boolean; signed: boolean; visits?: number }) {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  return (
    <li>
      <button
        onClick={() => {
          if (!on) return dispatch({ type: "checkIn", date, playerId: p.id });
          const day = state.days.find((d) => d.date === date);
          if (day?.checkIns.find((c) => c.playerId === p.id)?.paidAt)
            return alert(t("{name} จ่ายเงินแล้ว ต้องกดยกเลิกการจ่ายในหน้าคิดเงินก่อน", { name: p.name }));
          const games = day?.games.filter((g) => g.playerIds.includes(p.id)).length ?? 0;
          if (games > 0 && !confirm(t("{name} เล่นไปแล้ว {n} เกม ยกเลิกเช็คอินแล้วจะไม่คิดค่าสนาม ยืนยันไหม?", { name: p.name, n: games })))
            return;
          dispatch({ type: "undoCheckIn", date, playerId: p.id });
        }}
        className={`relative flex w-full flex-col items-center gap-2 rounded-3xl px-3 pt-4 pb-3 text-center transition active:scale-[0.97] ${
          on ? "bg-ink text-white shadow-lg shadow-ink/20" : "bg-white shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)]"
        }`}
      >
        <span
          className={`absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full transition ${
            on ? "bg-lime text-ink" : "bg-zinc-100 text-transparent"
          }`}
        >
          <Icon.Check width={14} height={14} strokeWidth={3} />
        </span>
        <Avatar name={p.name} photo={p.photo} size={52} />
        <span className="w-full truncate font-semibold">{p.name}</span>
        {visits !== undefined && (
          <span className={`-mt-1.5 text-[11px] ${on ? "text-white/60" : "text-zinc-500"}`}>{t("มา {n} ครั้ง/30 วัน", { n: visits })}</span>
        )}
        <span className="flex items-center gap-1.5">
          <LevelBadge level={p.level} />
          {p.guestOf && <span className={`text-[11px] font-medium ${on ? "text-amber-300" : "text-amber-600"}`}>{t("แขก")}</span>}
          {signed && !on && <span className="text-[11px] font-medium text-sky-600">{t("ลงชื่อ")}</span>}
          {isMonthlyPaid(state.monthly, date, p.id) && (
            <span className={`text-[11px] font-medium ${on ? "text-lime" : "text-emerald-600"}`}>{t("รายเดือน")}</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** รายชื่อคนที่ลงชื่อว่าจะมาวันนี้ (แอดมินเท่านั้น) แตะชื่อที่ยังไม่มาเพื่อเช็คอินให้ */
export function SignupList({ bare }: { bare?: boolean }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const list = [...(day.signups ?? [])].sort((a, b) => a.at - b.at);
  if (!list.length && !bare) return null;
  const arrived = list.filter((s) => checked.has(s.playerId)).length;
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("ลงชื่อว่าจะมา {n} คน", { n: list.length })}</h3>
        <span className="text-xs text-zinc-500">{t("มาแล้ว {n} คน", { n: arrived })}</span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("ยังไม่มีใครลงชื่อ")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((s) => {
            const p = byId.get(s.playerId);
            const on = checked.has(s.playerId);
            return (
              <li key={s.playerId}>
                <button
                  disabled={on}
                  onClick={() => dispatch({ type: "checkIn", date, playerId: s.playerId })}
                  title={on ? t("มาแล้ว") : t("แตะเพื่อเช็คอิน")}
                  className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-medium ${
                    on ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-800"
                  }`}
                >
                  <Avatar name={p?.name ?? "?"} photo={p?.photo} size={22} />
                  {p?.name ?? "?"}
                  {on && <Icon.Check width={14} height={14} strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.some((s) => !checked.has(s.playerId)) && <p className="text-xs text-zinc-500">{t("แตะชื่อคนที่ยังไม่มา เพื่อเช็คอินให้")}</p>}
    </>
  );
  return bare ? <div className="space-y-3">{body}</div> : <Card className="space-y-3">{body}</Card>;
}
