"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid } from "@/lib/types";
import { AnnounceCard } from "./AnnounceCard";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle, inputClass } from "./ui";

export function CheckInTab() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const signed = new Set(day.signups?.map((s) => s.playerId));
  // ยังไม่เช็คอินขึ้นก่อน ในนั้นคนที่ลงชื่อไว้ขึ้นก่อน
  const rank = (id: string) => (checked.has(id) ? 2 : signed.has(id) ? 0 : 1);
  const list = state.players
    .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-4">
      <AnnounceCard />
      <SectionTitle right={`${checked.size}/${state.players.length} คน${signed.size ? ` · ลงชื่อ ${signed.size}` : ""}`}>เช็คอินวันนี้</SectionTitle>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
          <input className={`${inputClass} pl-11`} placeholder="ค้นหาชื่อเล่น" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="accent" className="px-4" onClick={() => setAdding(true)} aria-label="ลงทะเบียนผู้เล่นใหม่">
          <Icon.Plus width={20} height={20} strokeWidth={2.5} />
        </Button>
      </div>

      {adding && (
        <Card>
          <h3 className="mb-3 font-display font-semibold">ลงทะเบียนผู้เล่นใหม่</h3>
          <PlayerForm
            onCancel={() => setAdding(false)}
            onSave={(player) => {
              dispatch({ type: "addPlayer", player });
              setAdding(false);
            }}
          />
        </Card>
      )}

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {list.map((p) => {
          const on = checked.has(p.id);
          return (
            <li key={p.id}>
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
                  {signed.has(p.id) && !on && <span className="text-[11px] font-medium text-sky-600">ลงชื่อ</span>}
                  {isMonthlyPaid(state.monthly, date, p.id) && (
                    <span className={`text-[11px] font-medium ${on ? "text-lime" : "text-emerald-600"}`}>รายเดือน</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && (
        <Card className="py-10 text-center text-sm text-zinc-500">
          {state.players.length === 0 ? "ยังไม่มีผู้เล่น กดปุ่ม + เพื่อลงทะเบียน" : "ไม่พบชื่อที่ค้นหา"}
        </Card>
      )}
    </div>
  );
}
