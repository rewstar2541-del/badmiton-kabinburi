"use client";

import { useMemo, useState, type ReactNode } from "react";
import { carriedOver, guestsOf } from "@/lib/billing";
import { t } from "@/lib/i18n";
import { presence, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { goToTab } from "./Membership";
import { savedPin, useMe } from "./PickMe";
import { Icon, Sheet, baht, levelCode } from "./ui";

const WEEK = 7 * 24 * 3600 * 1000;

type Tone = "pair" | "court" | "ok" | "money";
interface Note {
  id: string;
  tone: Tone;
  title: string;
  sub: string;
  at: number;
  /** คำขอคู่ที่รอเราตอบ (นับเป็นเรื่องใหม่จนกว่าจะตอบ) */
  pairId?: string;
  /** เราเป็นคนตอบเอง ไม่ต้องนับเป็นเรื่องใหม่ */
  mine?: boolean;
  onTap?: () => void;
}

const TONE: Record<Tone, { bg: string; icon: ReactNode }> = {
  pair: { bg: "bg-violet-100 text-violet-700", icon: <Icon.Hand width={22} height={22} /> },
  court: { bg: "bg-lime text-ink", icon: <Icon.Court width={22} height={22} /> },
  ok: { bg: "bg-emerald-100 text-emerald-700", icon: <Icon.Check width={22} height={22} /> },
  money: { bg: "bg-amber-100 text-amber-700", icon: <Icon.Wallet width={22} height={22} /> },
};

/** ที่จำในเครื่อง: เรื่องที่อ่านแล้ว และระดับมือล่าสุดที่เห็น (ไม่ต้องเก็บในฐานข้อมูล) */
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, v: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  },
};

/** เวลาตอนนี้ (แยกไว้ให้ส่วนที่จำระดับมือเรียกใช้) */
const clock = () => Date.now();

function ago(at: number, now: number) {
  const m = Math.max(0, Math.round((now - at) / 60000));
  if (m < 1) return t("เมื่อกี้");
  if (m < 60) return t("{n} นาทีที่แล้ว", { n: m });
  if (m < 60 * 24) return t("{n} ชม.ที่แล้ว", { n: Math.round(m / 60) });
  if (m < 60 * 48) return t("เมื่อวาน");
  return t("{n} วันก่อน", { n: Math.floor(m / 1440) });
}

/** รวบรวมเรื่องที่ควรแจ้งผู้เล่นคนนี้ จากข้อมูลที่แอพมีอยู่แล้ว */
function useNotes(meId: string | null) {
  const { state } = useStore();
  const { day, date } = useToday();
  const player = state.players.find((p) => p.id === meId);
  // จำระดับมือล่าสุดไว้ ถ้าเปลี่ยน (แอดมินอนุมัติ) ให้เกิดเรื่องแจ้ง
  const levelLog = useMemo(() => {
    if (!player) return [];
    const key = `badminton-kabinburi:bell-level:${player.id}`;
    const logKey = `badminton-kabinburi:bell-levellog:${player.id}`;
    const last = store.get<number | null>(key, null);
    let log = store.get<{ level: number; at: number }[]>(logKey, []);
    if (last !== null && last !== player.level) {
      log = [{ level: player.level, at: clock() }, ...log].slice(0, 5);
      store.set(logKey, log);
    }
    store.set(key, player.level);
    const since = clock() - WEEK;
    return log.filter((l) => l.at > since);
  }, [player?.id, player?.level]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) return [];
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  const notes: Note[] = [];

  // ตอบรับได้เฉพาะตอนที่ทั้งสองคนยังอยู่ที่สนาม (เช็คอินแล้วและยังไม่จ่าย)
  const here = (id: string) => day.checkIns.some((c) => c.playerId === id && !c.paidAt);
  for (const r of day.pairs ?? []) {
    if (r.to === player.id && r.status === "pending" && here(r.from) && here(r.to))
      notes.push({ id: `pair:${r.id}`, tone: "pair", title: t("{name} ขอคู่กับคุณ", { name: name(r.from) }), sub: t("เกมถัดไป"), at: r.at, pairId: r.id });
    // ตอบไปแล้ว: เก็บไว้ในรายการให้เห็นว่าตอบอะไรไป
    if (r.to === player.id && (r.status === "accepted" || r.status === "declined"))
      notes.push({ id: `pair:${r.id}`, tone: "pair", title: t("{name} ขอคู่กับคุณ", { name: name(r.from) }), sub: r.status === "accepted" ? t("รับคู่แล้ว ได้เล่นคู่กันเกมถัดไป") : t("ตอบไม่สะดวกแล้ว"), at: r.at, mine: true });
    if (r.from === player.id && r.status === "accepted")
      notes.push({ id: `pairok:${r.id}`, tone: "pair", title: t("{name} รับคู่ของคุณแล้ว", { name: name(r.to) }), sub: t("ได้เล่นคู่กันเกมถัดไป"), at: r.at });
    if (r.from === player.id && r.status === "declined")
      notes.push({ id: `pairno:${r.id}`, tone: "pair", title: t("{name} ไม่สะดวกเล่นคู่รอบนี้", { name: name(r.to) }), sub: t("ลองขอคู่กับคนอื่นได้"), at: r.at });
  }

  const status = presence(day, player.id);
  const game = day.games.find((g) => !g.endedAt && g.playerIds.includes(player.id));
  if (status === "playing" && game)
    notes.push({ id: `court:${game.id}`, tone: "court", title: t("ถึงคิวแล้ว ลงสนาม {n}", { n: game.court }), sub: t("ไปที่สนามได้เลย"), at: game.startedAt, onTap: () => goToTab("courts") });
  if (status === "waiting") {
    const pos = waitingQueue(day, state.players).findIndex((e) => e.player.id === player.id) + 1;
    const round = day.games.filter((g) => g.playerIds.includes(player.id)).length;
    // เวลา = ตอนที่เกมล่าสุดจบ (คิวขยับ) หรือตอนเช็คอิน
    const moved = Math.max(day.checkIns.find((c) => c.playerId === player.id)?.at ?? 0, ...day.games.map((g) => g.endedAt ?? 0));
    if (pos > 0 && pos <= 4)
      notes.push({ id: `turn:${date}:${round}`, tone: "court", title: t("ใกล้ถึงคิวแล้ว"), sub: t("คิวที่ {n} เตรียมตัวได้เลย", { n: pos }), at: moved, onTap: () => goToTab("courts") });
  }

  for (const l of levelLog)
    notes.push({ id: `level:${l.at}`, tone: "ok", title: t("ระดับมือเปลี่ยนแล้ว"), sub: t("ระดับมือของคุณเป็น {level} แล้ว", { level: levelCode(l.level as never) }), at: l.at });

  // ยอดค้างจากวันก่อน รวมแขกที่เราพามา (ตรงกับหน้ายอดของฉัน)
  const owed = [player, ...guestsOf(state.players, player.id)].reduce((sum, p) => sum + carriedOver(state.days, date, p, state.settings, state.monthly), 0);
  if (owed > 0)
    notes.push({ id: `owed:${date}:${owed}`, tone: "money", title: t("มียอดค้างจ่าย {amount}", { amount: baht(owed) }), sub: t("แตะเพื่อดูยอดและจ่ายเงิน"), at: Date.parse(date + "T00:00:00"), onTap: () => goToTab("mybill") });

  return notes.sort((a, b) => Number(!!b.pairId) - Number(!!a.pairId) || b.at - a.at);
}

/** กระดิ่งแจ้งเตือนในแอพ: เห็นตอนเปิดแอพ ไม่ส่งข้อความออกไปข้างนอก (ไม่มีค่าใช้จ่าย) */
export function Bell() {
  const { social } = useStore();
  const [me] = useMe();
  const notes = useNotes(me);
  const seenKey = `badminton-kabinburi:bell-seen:${me}`;
  const [seen, setSeen] = useState<string[]>(() => store.get<string[]>(seenKey, []));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [now, setNow] = useState(0);

  // คำขอคู่ที่ยังไม่ตอบนับเป็นเรื่องใหม่เสมอ เรื่องที่เราตอบเองไม่นับ
  const isNew = (n: Note) => !!n.pairId || (!n.mine && !seen.includes(n.id));
  const unread = notes.filter(isNew);
  const remember = (ids: string[]) => {
    const next = [...new Set([...seen, ...ids])].slice(-200);
    setSeen(next);
    store.set(seenKey, next);
  };
  const close = () => {
    remember(notes.filter((n) => !n.pairId).map((n) => n.id));
    setOpen(false);
    setError(null);
  };
  const answer = async (id: string, accept: boolean) => {
    if (!me || busy) return;
    setBusy(true);
    let err: string | null = null;
    try {
      err = await social({ kind: "respondPair", id, accept }, me, savedPin.get());
    } catch {
      err = "เชื่อมต่อไม่ได้ ลองใหม่";
    }
    setBusy(false);
    // ข้อความจากระบบที่แปลไม่ได้ (เช่นเน็ตหลุด) แสดงเป็นข้อความกลางๆ แทน
    setError(err ? { id, text: /[\u0E00-\u0E7F]/.test(err) ? t(err) : t("เชื่อมต่อไม่ได้ ลองใหม่") } : null);
    if (!err) remember([`pair:${id}`]);
  };

  const row = (n: Note) => {
    const fresh = isNew(n);
    const tone = TONE[n.tone];
    const body = (
      <>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone.bg}`}>{tone.icon}</span>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <b className="min-w-0 text-base leading-snug [overflow-wrap:anywhere]">{n.title}</b>
            <span className="shrink-0 text-[13px] text-zinc-500">{ago(n.at, now)}</span>
          </div>
          <div className="text-[15px] text-zinc-600">{n.sub}</div>
        </div>
        {n.onTap && <Icon.ChevronRight width={18} height={18} className="mt-3 shrink-0 text-zinc-400" />}
      </>
    );
    return (
      <li key={n.id} className={`rounded-2xl p-3.5 ${fresh ? "bg-lime/15 ring-[1.5px] ring-lime" : "bg-zinc-50 ring-1 ring-zinc-200"}`}>
        {n.onTap ? (
          <button
            className="flex w-full gap-3"
            onClick={() => {
              close();
              n.onTap!();
            }}
          >
            {body}
          </button>
        ) : (
          <div className="flex gap-3">{body}</div>
        )}
        {n.pairId && (
          <div className="mt-3 grid grid-cols-2 gap-2 pl-14">
            <button disabled={busy} onClick={() => answer(n.pairId!, false)} className="h-11 rounded-xl bg-zinc-100 font-semibold disabled:opacity-50">
              {t("ไม่สะดวก")}
            </button>
            <button disabled={busy} onClick={() => answer(n.pairId!, true)} className="h-11 rounded-xl bg-lime font-semibold text-ink disabled:opacity-50">
              {t("รับคู่")}
            </button>
          </div>
        )}
        {error && n.pairId === error.id && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error.text}</p>}
      </li>
    );
  };

  const fresh = notes.filter(isNew);
  const old = notes.filter((n) => !isNew(n));

  return (
    <>
      <button
        onClick={() => {
          setNow(Date.now());
          setOpen(true);
        }}
        className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200"
        aria-label={unread.length ? t("การแจ้งเตือน ใหม่ {n} เรื่อง", { n: unread.length }) : t("การแจ้งเตือน")}
      >
        <Icon.Bell width={20} height={20} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <Sheet
          onClose={close}
          title={
            <div>
              <h3 className="font-display text-xl font-semibold">{t("การแจ้งเตือน")}</h3>
              <p className="text-sm text-zinc-600">{fresh.length ? t("ใหม่ {n} เรื่อง", { n: fresh.length }) : t("ไม่มีเรื่องใหม่")}</p>
            </div>
          }
        >
          {notes.length === 0 ? (
            <p className="rounded-2xl bg-zinc-50 px-4 py-8 text-center text-[15px] text-zinc-600">{t("ยังไม่มีการแจ้งเตือน เรื่องขอคู่ ถึงคิว และยอดค้างจ่ายจะขึ้นที่นี่")}</p>
          ) : (
            <div className="space-y-3">
              {fresh.length > 0 && <ul className="space-y-2.5">{fresh.map(row)}</ul>}
              {old.length > 0 && (
                <>
                  {fresh.length > 0 && <p className="px-1 pt-1 text-sm font-semibold text-zinc-600">{t("ก่อนหน้านี้")}</p>}
                  <ul className="space-y-2.5">{old.map(row)}</ul>
                </>
              )}
            </div>
          )}
          <p className="text-center text-sm text-zinc-500">{t("ไม่เด้งเตือนในมือถือ เปิดแอพแล้วดูที่นี่")}</p>
        </Sheet>
      )}
    </>
  );
}
