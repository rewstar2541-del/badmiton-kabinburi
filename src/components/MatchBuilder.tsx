"use client";

import { useState } from "react";
import { nextMatch, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player } from "@/lib/types";
import { Avatar, Button, Icon, LevelBadge, Sheet } from "./ui";
import { t } from "@/lib/i18n";

type Slots = (string | null)[];

/**
 * จัดคู่ลงสนาม: เริ่มจากคู่ที่ระบบแนะนำ แอดมินแตะช่องแล้วแตะชื่อเพื่อเปลี่ยนคนได้
 * แตะชื่อที่อยู่ในอีกช่องจะสลับกัน แตะช่องที่เลือกอยู่ซ้ำเพื่อเอาคนออก
 */
export function MatchBuilder({ court, onClose }: { court: number; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const queue = waitingQueue(day, state.players);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const suggest = (): Slots => nextMatch(day, state.players) ?? [0, 1, 2, 3].map((i) => queue[i]?.player.id ?? null);
  const [slots, setSlots] = useState<Slots>(suggest);
  const [selected, setSelected] = useState<number | null>(null);

  const tapSlot = (i: number) => {
    if (selected === i) {
      setSlots((s) => s.map((x, j) => (j === i ? null : x)));
      setSelected(null);
    } else setSelected(i);
  };

  const pick = (id: string) => {
    setSlots((s) => {
      const target = selected ?? s.findIndex((x) => x === null);
      if (target < 0) return s;
      const next = [...s];
      const from = next.indexOf(id);
      if (from >= 0) next[from] = next[target];
      next[target] = id;
      return next;
    });
    setSelected(null);
  };

  const full = slots.every(Boolean);
  const teamSum = (ids: Slots) => ids.reduce((n, id) => n + (id ? (byId.get(id)?.level ?? 0) : 0), 0);

  const slot = (i: number) => {
    const p: Player | undefined = slots[i] ? byId.get(slots[i]!) : undefined;
    const on = selected === i;
    return (
      <button
        key={i}
        onClick={() => tapSlot(i)}
        className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition ${
          on ? "bg-white text-ink ring-2 ring-lime" : "bg-black/20 text-white backdrop-blur-sm"
        }`}
      >
        {p ? (
          <>
            <Avatar name={p.name} photo={p.photo} size={28} ring />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
            <LevelBadge level={p.level} />
          </>
        ) : (
          <span className="flex h-7 flex-1 items-center justify-center text-xs opacity-70">{on ? t("แตะชื่อด้านล่าง") : t("ว่าง")}</span>
        )}
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} title={<h3 className="font-display text-lg font-semibold">{t("จัดคู่ สนาม {n}", { n: court })}</h3>}>
      <div className="court-surface flex gap-1 rounded-2xl px-2 py-3">
        {(["A", "B"] as const).map((team, ti) => (
          <div key={team} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${team === "A" ? "bg-lime text-ink" : "bg-sky-300 text-ink"}`}
            >
              {t("ทีม {team}", { team })} · {teamSum(slots.slice(ti * 2, ti * 2 + 2))}
            </span>
            {slot(ti * 2)}
            {slot(ti * 2 + 1)}
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {t("แตะช่องที่ต้องการเปลี่ยน แล้วแตะชื่อจากคิว แตะช่องเดิมซ้ำเพื่อเอาออก ตัวเลขข้างทีมคือผลรวมระดับมือ")}
      </p>

      <ul className="grid grid-cols-2 gap-1.5">
        {queue.map((e, i) => {
          const inSlot = slots.includes(e.player.id);
          return (
            <li key={e.player.id}>
              <button
                onClick={() => pick(e.player.id)}
                className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left text-sm ${
                  inSlot ? "bg-lime/30" : "bg-zinc-100 active:bg-zinc-200"
                }`}
              >
                <span className="w-4 text-center text-[11px] text-zinc-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.player.name}</span>
                <LevelBadge level={e.player.level} />
                <span className="text-[10px] text-zinc-500">{t("{n} เกม", { n: e.gamesPlayed })}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            setSlots(suggest());
            setSelected(null);
          }}
          className="flex items-center gap-1.5"
        >
          <Icon.Shuttle width={16} height={16} /> {t("แนะนำใหม่")}
        </Button>
        <Button
          variant="accent"
          className="flex-1"
          disabled={!full}
          onClick={() => {
            dispatch({ type: "startGame", date, court, playerIds: slots as Game["playerIds"] });
            onClose();
          }}
        >
          {full ? t("เริ่มเกม") : t("ต้องมีครบ 4 คน")}
        </Button>
      </div>
    </Sheet>
  );
}
