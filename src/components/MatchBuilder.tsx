"use client";

import { useState } from "react";
import { FORM_MARK, formToday, hasAvoid, nextMatch, skillOf, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { strength, type Game, type Player } from "@/lib/types";
import { Avatar, Button, Icon, LevelBadge, Sheet } from "./ui";
import { t } from "@/lib/i18n";

type Slots = (string | null)[];

/**
 * จัดคู่ลงสนาม: เริ่มจากคู่ที่ระบบแนะนำ แอดมินแตะช่องแล้วแตะชื่อเพื่อเปลี่ยนคนได้
 * แตะชื่อที่อยู่ในอีกช่องจะสลับกัน แตะช่องที่เลือกอยู่ซ้ำเพื่อเอาคนออก
 * queue: จัดคู่รอลงสนามนี้ต่อจากเกมที่เล่นอยู่ (ยังไม่เริ่มเกม)
 * initial: เริ่มจากคู่นี้ (แก้คู่ที่ระบบจัดให้อัตโนมัติ) editId: แก้คู่ที่จัดคิวไว้แล้ว (คงลำดับคิวเดิม)
 * reserved: คนที่ระบบจัดให้สนามอื่นแล้ว ปุ่มแนะนำใหม่จะไม่ดึงมา (แตะเลือกเองได้)
 */
export function MatchBuilder({
  court,
  onClose,
  queue: toQueue = false,
  initial,
  editId,
  reserved = [],
  courtOf,
}: {
  court: number;
  onClose: () => void;
  queue?: boolean;
  initial?: string[];
  editId?: string;
  reserved?: string[];
  /** ผู้เล่น -> สนามที่ระบบจัดให้รอ (แสดงในรายชื่อ จะได้รู้ว่ากำลังดึงคนจากสนามอื่น) */
  courtOf?: Map<string, number>;
}) {
  const { state, dispatch } = useStore();
  const { date, day: today } = useToday();
  // แก้คู่ในคิว: คนในคู่นั้นกลับมาเลือกได้
  const day = editId ? { ...today, queued: (today.queued ?? []).filter((q) => q.id !== editId) } : today;
  const queue = waitingQueue(day, state.players);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const forSuggest = reserved.length
    ? {
        ...day,
        queued: [
          ...(day.queued ?? []),
          ...Array.from({ length: Math.ceil(reserved.length / 4) }, (_, i) => ({ id: `reserved-${i}`, court: 0, playerIds: reserved.slice(i * 4, i * 4 + 4) as Game["playerIds"], at: Infinity })),
        ],
      }
    : day;
  // ชุดที่แนะนำไปแล้ว กดแนะนำใหม่จะได้คนชุดใหม่
  const [shown, setShown] = useState<string[][]>(() => (initial ? [initial] : []));
  const suggest = (seen: string[][] = []): Slots =>
    // ครั้งแรกเลี่ยงคนที่ระบบจัดให้สนามอื่นแล้ว กดแนะนำใหม่ดึงจากคิวรวมทั้งหมด จะได้มีคนใหม่ให้หมุน
    (seen.length ? null : nextMatch(forSuggest, state.players)) ?? nextMatch(day, state.players, 8, seen) ?? [0, 1, 2, 3].map((i) => queue[i]?.player.id ?? null);
  const [picked, setSlots] = useState<Slots>(() => initial ?? suggest());
  const [selected, setSelected] = useState<number | null>(null);
  // แอดมินอีกเครื่องอาจส่งคนในช่องลงสนามอื่นไปแล้ว หรือใช้สนามนี้ไปแล้ว: เอาคนนั้นออกจากช่องเสมอ
  const onCourt = new Set([...day.games.filter((g) => !g.endedAt).flatMap((g) => g.playerIds), ...(day.queued ?? []).flatMap((q) => q.playerIds)]);
  const courtTaken = !toQueue && day.games.some((g) => !g.endedAt && g.court === court);
  const slots = picked.map((id) => (id && onCourt.has(id) ? null : id));

  // แตะช่องหนึ่งแล้วแตะอีกช่อง = สลับตำแหน่ง (ซ้าย/ขวา/บน/ล่าง) ชื่อไม่หลุด แตะช่องเดิมซ้ำ = ยกเลิกเลือก
  const tapSlot = (i: number) => {
    if (selected === null) return setSelected(i);
    // ช่องที่เลือกไว้ว่าง: แตะช่องอื่น = เปลี่ยนไปเลือกช่องนั้น (ไม่ย้ายชื่อ)
    if (selected !== i && !slots[selected]) return setSelected(i);
    if (selected !== i) {
      const next = [...slots];
      [next[selected], next[i]] = [next[i], next[selected]];
      setSlots(next);
    }
    setSelected(null);
  };
  const clearSlot = (i: number) => {
    setSlots(slots.map((x, j) => (j === i ? null : x)));
    setSelected(null);
  };

  const pick = (id: string) => {
    setSlots(() => {
      const s = slots;
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
  const chosen = slots.map((id) => (id ? byId.get(id) : undefined)).filter((p) => p !== undefined);
  const clash = hasAvoid(chosen);
  // ฟอร์มวันนี้ (ชนะ/แพ้ติดๆ กัน) ระบบนับรวมตอนจัดคู่ด้วย
  const form = formToday(day, state.players);
  const skillSum = (ids: Slots) => ids.reduce((n, id) => {
      const p = id ? byId.get(id) : undefined;
      return n + (p ? skillOf(p, form) : 0);
    }, 0);
  const edge = skillSum(slots.slice(0, 2)) - skillSum(slots.slice(2, 4));
  const teamSum = (ids: Slots) => ids.reduce((n, id) => {
      const p = id ? byId.get(id) : undefined;
      return n + (p ? strength(p.level) : 0);
    }, 0);
  // ตัวเลขข้างทีมเป็นระดับมือล้วน ถ้าฟอร์มทำให้ผลต่างเปลี่ยน บอกไว้ จะได้ไม่งงว่าทำไมไม่ตรงกับตัวเลข
  const formCounts = Math.abs(edge - (teamSum(slots.slice(0, 2)) - teamSum(slots.slice(2, 4)))) >= 0.25;
  const marked = slots.some((id) => id && Math.abs(form.get(id) ?? 0) >= FORM_MARK);

  const slot = (i: number) => {
    const p: Player | undefined = slots[i] ? byId.get(slots[i]!) : undefined;
    const on = selected === i;
    return (
      <div key={i} className="relative w-full">
        <button
          onClick={() => tapSlot(i)}
          className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition ${
            on ? "bg-white text-ink ring-2 ring-lime" : selected !== null ? "bg-black/30 text-white ring-1 ring-white/60" : "bg-black/20 text-white backdrop-blur-sm"
          }`}
        >
          {p ? (
            <>
              <Avatar name={p.name} photo={p.photo} size={28} ring />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              {!on && <FormMark value={form.get(p.id)} />}
              {on ? <span className="w-8" /> : <LevelBadge level={p.level} />}
            </>
          ) : (
            <span className="flex h-7 flex-1 items-center justify-center text-xs opacity-70">{on ? t("แตะชื่อด้านล่าง") : t("ว่าง")}</span>
          )}
        </button>
        {on && p && (
          <button
            onClick={() => clearSlot(i)}
            aria-label={t("เอาออก")}
            className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-zinc-200 text-zinc-600 active:scale-95"
          >
            <Icon.X width={14} height={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <Sheet onClose={onClose} title={<h3 className="font-display text-lg font-semibold">{toQueue ? t("จัดคิวรอลง สนาม {n}", { n: court }) : t("จัดคู่ สนาม {n}", { n: court })}</h3>}>
      <div className="court-surface flex gap-1 rounded-2xl px-2 py-3">
        {(["A", "B"] as const).map((team, ti) => (
          <div key={team} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-2">
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
        {t("แตะชื่อในสนาม แล้วแตะอีกช่องเพื่อสลับ หรือแตะชื่อจากคิวเพื่อเปลี่ยนคน ตัวเลขข้างทีม = ผลรวมระดับมือ")}
        {marked && <> {t("▲▼ = ฟอร์มวันนี้ ระบบนับรวมตอนจัดคู่")}</>}
      </p>

      {full && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${Math.abs(edge) <= 0.5 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {Math.abs(edge) <= 0.5
            ? t("เกมสูสี ฝีมือสองทีมใกล้กัน")
            : Math.abs(edge) <= 1.5
              ? t("ทีม {team} เหนือกว่าเล็กน้อย", { team: edge > 0 ? "A" : "B" })
              : t("ทีม {team} เหนือกว่ามาก ลองสลับคน", { team: edge > 0 ? "A" : "B" })}
          {formCounts && <> {t("(นับฟอร์มวันนี้ด้วย)")}</>}
        </p>
      )}

      {clash && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("มีคู่ที่ไม่อยากเจอกันในเกมนี้")}</p>
      )}

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
                <FormMark value={form.get(e.player.id)} dark={false} />
                <LevelBadge level={e.player.level} />
                <span className="text-right text-[10px] leading-tight text-zinc-500">
                  {t("{n} เกม", { n: e.gamesPlayed })}
                  {courtOf?.get(e.player.id) && courtOf.get(e.player.id) !== court && (
                    <span className="block font-semibold text-emerald-700">{t("รอสนาม {n}", { n: courtOf.get(e.player.id)! })}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            const seen = [...shown, slots.filter((x): x is string => !!x)];
            setShown(seen);
            setSlots(suggest(seen));
            setSelected(null);
          }}
          className="flex items-center gap-1.5"
        >
          <Icon.Shuttle width={16} height={16} /> {t("แนะนำใหม่")}
        </Button>
        <Button
          variant="accent"
          className="flex-1"
          disabled={!full || courtTaken}
          onClick={() => {
            if (!full || courtTaken) return;
            const playerIds = slots as Game["playerIds"];
            if (editId) dispatch({ type: "editQueued", date, id: editId, playerIds });
            else dispatch({ type: toQueue ? "queueGame" : "startGame", date, court, playerIds });
            onClose();
          }}
        >
          {courtTaken ? t("สนามนี้มีเกมอยู่แล้ว") : !full ? t("ต้องมีครบ 4 คน") : toQueue ? t("เข้าคิวสนาม {n}", { n: court }) : t("เริ่มเกม")}
        </Button>
      </div>
    </Sheet>
  );
}

/** ▲ ฟอร์มดี / ▼ ฟอร์มตก วันนี้ (ไม่ขึ้นถ้าฟอร์มใกล้ศูนย์) */
function FormMark({ value = 0, dark = true }: { value?: number; dark?: boolean }) {
  if (Math.abs(value) < FORM_MARK) return null;
  const up = value > 0;
  const label = up ? t("ฟอร์มดีวันนี้") : t("ฟอร์มตกวันนี้");
  return (
    <span className={`text-sm font-bold ${up ? (dark ? "text-lime" : "text-emerald-600") : dark ? "text-amber-300" : "text-amber-600"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
