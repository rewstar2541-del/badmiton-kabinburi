"use client";

import { useState, type ReactNode } from "react";
import { LEVELS, type Level, type Player } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { RosterSort } from "@/lib/roster";
import { LevelBadge } from "./ui";

const KEY = "badminton-kabinburi:roster-sort";
const SORTS: { value: RosterSort; label: string }[] = [
  { value: "often", label: "มาบ่อย" },
  { value: "level", label: "ระดับมือ" },
  { value: "name", label: "ชื่อ ก-ฮ" },
];

/** แบบเรียงรายชื่อที่เลือกไว้ จำไว้ในเครื่อง ใช้ร่วมกันทั้งหน้าเช็คอินและหน้าผู้เล่น */
export function useRosterSort(): [RosterSort, (s: RosterSort) => void] {
  const [sort, setSort] = useState<RosterSort>(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (SORTS.some((s) => s.value === v)) return v as RosterSort;
    } catch {}
    return "often";
  });
  return [
    sort,
    (s) => {
      setSort(s);
      try {
        localStorage.setItem(KEY, s);
      } catch {}
    },
  ];
}

export function RosterSortSwitch({ value, onChange }: { value: RosterSort; onChange: (s: RosterSort) => void }) {
  return (
    <div role="group" aria-label={t("เรียงตาม")} className="flex items-center gap-2 text-xs">
      <span className="shrink-0 text-zinc-500">{t("เรียงตาม")}</span>
      <div className="flex rounded-full bg-zinc-100 p-0.5">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            aria-pressed={value === s.value}
            className={`rounded-full px-3 py-1.5 font-semibold ${value === s.value ? "bg-ink text-white" : "text-zinc-600"}`}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** แบ่งรายชื่อเป็นกลุ่มตามระดับมือ กดหัวกลุ่มเพื่อพับ/กาง */
export function LevelGroups({
  players,
  forceOpen,
  summary,
  children,
}: {
  players: Player[];
  forceOpen?: boolean;
  summary: (players: Player[]) => string;
  children: (players: Player[]) => ReactNode;
}) {
  const [closed, setClosed] = useState<Set<Level>>(new Set());
  const toggle = (v: Level) =>
    setClosed((c) => {
      const n = new Set(c);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  return LEVELS.map((level) => {
    const list = players.filter((p) => p.level === level.value);
    if (!list.length) return null;
    const open = forceOpen || !closed.has(level.value);
    return (
      <section key={level.value} className="space-y-2.5">
        <button
          className="flex w-full items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2.5 text-left"
          onClick={() => toggle(level.value)}
          aria-expanded={open}
        >
          <LevelBadge level={level.value} />
          <span className="min-w-0 flex-1 truncate font-semibold">{t(level.label)}</span>
          <span className="shrink-0 text-xs text-zinc-500">{summary(list)}</span>
          <span className="shrink-0 text-sm text-zinc-400">{open ? "▲" : "▼"}</span>
        </button>
        {open && children(list)}
      </section>
    );
  });
}
