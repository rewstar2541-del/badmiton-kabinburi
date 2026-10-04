"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Level, Player } from "@/lib/types";
import { Button, Card, LEVEL_LABEL, LevelBadge, inputClass } from "./ui";

const LEVELS: Level[] = [1, 2, 3, 4, 5];

export function PlayerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Player;
  onSave: (p: { name: string; level: Level; isMonthly: boolean }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState<Level>(initial?.level ?? 3);
  const [isMonthly, setMonthly] = useState(initial?.isMonthly ?? false);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), level, isMonthly });
        if (!initial) {
          setName("");
          setLevel(3);
          setMonthly(false);
        }
      }}
    >
      <input className={inputClass} placeholder="ชื่อผู้เล่น" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-5 gap-1">
        {LEVELS.map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-lg px-1 py-2 text-xs ${
              level === l ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {l}
            <div className="truncate text-[10px] opacity-80">{LEVEL_LABEL[l]}</div>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={isMonthly} onChange={(e) => setMonthly(e.target.checked)} />
        สมาชิกรายเดือน (ไม่คิดค่าสนามรายวัน)
      </label>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" className="flex-1">
          {initial ? "บันทึก" : "เพิ่มผู้เล่น"}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
      </div>
    </form>
  );
}

export function PlayersTab() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-semibold">เพิ่มผู้เล่นใหม่</h2>
        <PlayerForm onSave={(p) => dispatch({ type: "addPlayer", ...p })} />
      </Card>

      <div className="text-sm text-zinc-500">ทั้งหมด {players.length} คน</div>
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            <Card className="py-3">
              {editing === p.id ? (
                <PlayerForm
                  initial={p}
                  onCancel={() => setEditing(null)}
                  onSave={(v) => {
                    dispatch({ type: "updatePlayer", player: { ...p, ...v } });
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <LevelBadge level={p.level} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  {p.isMonthly && <span className="text-xs text-emerald-600">รายเดือน</span>}
                  <Button variant="ghost" onClick={() => setEditing(p.id)}>
                    แก้ไข
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`ลบ ${p.name}?`)) dispatch({ type: "removePlayer", id: p.id });
                    }}
                  >
                    ลบ
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
