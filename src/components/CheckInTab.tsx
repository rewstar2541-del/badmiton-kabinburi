"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { LEVELS, isMonthlyPaid, type Player } from "@/lib/types";
import { AnnounceCard } from "./AnnounceCard";
import { AdminAddGuest } from "./Guests";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";
import { nameMatch } from "@/lib/roster";

export function CheckInTab() {
  const { state, dispatch } = useStore();
  const { day } = useToday();
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
  // แสดงทุกคนที่ลงทะเบียนแล้ว แบ่งโซนตามระดับมือ ในแต่ละโซนคนที่ลงชื่อวันนี้ขึ้นก่อน
  const list = (q.trim() ? roster.filter((p) => nameMatch(p, q)) : roster).sort(
    (a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "th"),
  );
  const groups = LEVELS.map((l) => ({ level: l, players: list.filter((p) => p.level === l.value) })).filter((g) => g.players.length);
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const toggle = (v: number) =>
    setClosed((c) => {
      const n = new Set(c);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  const members = state.players.filter((p) => !p.pending && !p.guestOf).length;

  return (
    <div className="space-y-4">
      <AnnounceCard />
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

      {groups.map(({ level, players }) => {
        const open = q.trim() !== "" || !closed.has(level.value);
        const inCount = players.filter((p) => checked.has(p.id)).length;
        const signedCount = players.filter((p) => signed.has(p.id) && !checked.has(p.id)).length;
        return (
          <section key={level.value} className="space-y-2.5">
            <button
              className="flex w-full items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2.5 text-left"
              onClick={() => toggle(level.value)}
              aria-expanded={open}
            >
              <LevelBadge level={level.value} />
              <span className="min-w-0 flex-1 truncate font-semibold">{t(level.label)}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                {t("มาแล้ว {a}/{b}", { a: inCount, b: players.length })}
                {signedCount > 0 && ` · ${t("ลงชื่อ {n}", { n: signedCount })}`}
              </span>
              <span className="shrink-0 text-sm text-zinc-400">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {players.map((p) => (
                  <PlayerTile key={p.id} p={p} on={checked.has(p.id)} signed={signed.has(p.id)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {list.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">
          {state.players.length === 0 ? t("ยังไม่มีผู้เล่น กดปุ่ม + เพื่อลงทะเบียน") : t("ไม่พบชื่อที่ค้นหา")}
        </Card>
      )}
    </div>
  );
}

function PlayerTile({ p, on, signed }: { p: Player; on: boolean; signed: boolean }) {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  return (
    <li>
      <button
        onClick={() => dispatch({ type: on ? "undoCheckIn" : "checkIn", date, playerId: p.id })}
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
