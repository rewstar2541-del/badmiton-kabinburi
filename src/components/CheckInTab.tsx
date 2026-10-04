"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { Button, Card, LevelBadge, inputClass } from "./ui";
import { PlayerForm } from "./PlayersTab";

export function CheckInTab() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const list = state.players
    .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(checked.has(a.id)) - Number(checked.has(b.id)) || a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">เช็คอินวันนี้</h2>
        <span className="text-sm text-zinc-500">มาแล้ว {checked.size} คน</span>
      </div>

      <input className={inputClass} placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)} />

      {adding ? (
        <Card>
          <PlayerForm
            onCancel={() => setAdding(false)}
            onSave={(p) => {
              dispatch({ type: "addPlayer", ...p });
              setAdding(false);
            }}
          />
          <p className="mt-2 text-xs text-zinc-500">เพิ่มแล้วกดเช็คอินในรายชื่อได้เลย</p>
        </Card>
      ) : (
        <Button className="w-full" onClick={() => setAdding(true)}>
          + ผู้เล่นใหม่
        </Button>
      )}

      <ul className="space-y-2">
        {list.map((p) => {
          const on = checked.has(p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() =>
                  dispatch({ type: on ? "undoCheckIn" : "checkIn", date, playerId: p.id })
                }
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  on
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full border text-sm ${
                    on ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="flex-1 font-medium">{p.name}</span>
                {p.isMonthly && <span className="text-xs text-emerald-600">รายเดือน</span>}
                <LevelBadge level={p.level} />
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-500">ยังไม่มีผู้เล่น กด &quot;+ ผู้เล่นใหม่&quot;</li>
        )}
      </ul>
    </div>
  );
}
