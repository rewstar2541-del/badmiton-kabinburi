"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { inGame, lineupWith, minShuttles, shuttlesInGame, type Day, type Game, type Player } from "@/lib/types";
import { canEditPlayers, validLineup, type Intent, type State } from "@/lib/state";
import { Avatar, Card, Icon, SearchInput, SectionTitle, Sheet, inputClass } from "./ui";
import { locale, t } from "@/lib/i18n";
import { pricesFor, shuttleCountFor, shuttleFee } from "@/lib/billing";

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ล็อกค่าลูกของคนที่จ่ายเงินแล้วไว้ที่ยอดที่จ่ายไป ก่อนแก้หรือลบเกม ยอดเงินในบัญชีจะได้ไม่เพี้ยน */
export function lockPaid(game: Game, day: Day, settings: State["settings"], dispatch: (a: Intent) => void) {
  const prices = pricesFor(day, settings);
  for (const c of day.checkIns)
    if (inGame(game, c.playerId) && c.paidAt && c.shuttleFee === undefined)
      dispatch({ type: "setBillFees", date: day.date, playerId: c.playerId, courtFee: c.courtFee ?? null, shuttleFee: shuttleFee(shuttleCountFor(day, c.playerId), prices) });
}

function useLockPaid(game: Game, day: Day) {
  const { state, dispatch } = useStore();
  return () => lockPaid(game, day, state.settings, dispatch);
}

function Team({ ids, byId, won, me }: { ids: string[]; byId: Map<string, Player>; won: boolean; me?: string | string[] }) {
  return (
    <div className="min-w-0 break-words text-zinc-700">
      <span>
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="text-zinc-300"> · </span>}
            <span className={(Array.isArray(me) ? me.includes(id) : id === me) ? "underline decoration-lime decoration-2 underline-offset-4" : ""}>{byId.get(id)?.name ?? "?"}</span>
          </span>
        ))}
      </span>
      {won && <Win />}
    </div>
  );
}

/** บรรทัดเปลี่ยนตัว เช่น "เปลี่ยนตัว: บอล แทน ต้น (ต้นจ่าย 2 ลูก)" */
export function SubNotes({ game, byId, className = "text-xs text-amber-800" }: { game: Pick<Game, "subs" | "playerIds" | "shuttles">; byId: Map<string, Player>; className?: string }) {
  if (!game.subs?.length) return null;
  const name = (id: string) => byId.get(id)?.name ?? "?";
  return (
    <>
      {game.subs.map((s, i) => (
        <div key={i} className={`leading-5 [overflow-wrap:anywhere] ${className}`}>
          ⇄ {t("{in} แทน {out} (คนออกจ่าย {n} ลูก)", { in: name(s.in), out: name(s.out), n: shuttlesInGame(game, s.out) })}
        </div>
      ))}
    </>
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
export function GameShuttleRow({ game, byId, day, me, open, onToggle, past = false }: { game: Game; byId: Map<string, Player>; day: Day; me?: string | string[]; open: boolean; onToggle: (open: boolean) => void; past?: boolean }) {
  const { dispatch } = useStore();
  const setOpen = onToggle;
  const [editPlayers, setEditPlayers] = useState(false);
  const lockPaid = useLockPaid(game, day);
  const ci = new Map(day.checkIns.map((c) => [c.playerId, c]));
  const fixed = [...game.playerIds, ...(game.subs ?? []).map((s) => s.out)].filter((id) => ci.get(id)?.paidAt || ci.get(id)?.shuttleFee !== undefined);
  // หน้าบิลของคนเดียว: ถ้าคนนี้ถูกเปลี่ยนตัวออก แสดงทีมตอนที่เขาเล่น และลูกที่เขาจ่าย/ลูกทั้งเกม
  const one = typeof me === "string" ? me : undefined;
  const left = !!one && !game.playerIds.includes(one) && inGame(game, one);
  const lineup = one ? lineupWith(game, one) : game.playerIds;
  const mine = one ? shuttlesInGame(game, one) : game.shuttles;
  const change = (n: number) => {
    if (n < minShuttles(game)) return;
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
          <Team ids={lineup.slice(0, 2)} byId={byId} won={!left && game.winner === "A"} me={me} />
          <Team ids={lineup.slice(2)} byId={byId} won={!left && game.winner === "B"} me={me} />
          {left && <div className="text-xs font-semibold text-zinc-500">{t("เปลี่ยนตัวออก")}</div>}
          <SubNotes game={game} byId={byId} />
        </div>
        {!game.endedAt && <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-emerald-700">{t("กำลังเล่น")}</span>}
        {game.disputedBy && <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-700" title={t("ไม่ตรง")} aria-label={t("ไม่ตรง")}>⚠</span>}
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${game.shuttles === 0 ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-ink"}`}>
          <Icon.Shuttle width={14} height={14} />
          {mine !== game.shuttles ? `${mine}/${game.shuttles}` : game.shuttles}
        </span>
        <Icon.ChevronRight width={16} height={16} className={`shrink-0 text-zinc-400 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mx-3 mb-3 space-y-3 rounded-2xl bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t("จำนวนลูก")}</span>
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
              <button className="grid size-11 place-items-center rounded-full bg-zinc-100 active:scale-95 disabled:opacity-40" onClick={() => change(game.shuttles - 1)} disabled={game.shuttles <= minShuttles(game)} aria-label={t("ลดลูก")}>
                <Icon.Minus width={16} height={16} />
              </button>
              <span className="min-w-10 text-center font-display text-lg font-semibold tabular-nums">{game.shuttles}</span>
              <button className="grid size-11 place-items-center rounded-full bg-zinc-100 active:scale-95" onClick={() => change(game.shuttles + 1)} aria-label={t("เพิ่มลูก")}>
                <Icon.Plus width={16} height={16} />
              </button>
            </div>
          </div>
          {game.endedAt && <ResultEditor game={game} day={day} byId={byId} />}
          {game.endedAt && (
            <button
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-ink ring-1 ring-zinc-200 active:scale-95 disabled:opacity-50"
              onClick={() => setEditPlayers(true)}
              disabled={!canEditPlayers(game)}
            >
              <Icon.Edit width={16} height={16} />
              {t("แก้คนในเกม (คู่ตีผิด)")}
            </button>
          )}
          {game.endedAt && !canEditPlayers(game) && <p className="text-xs text-zinc-500">{t("เกมนี้มีเปลี่ยนตัว แก้คนในเกมไม่ได้ ถ้าบันทึกผิดทั้งเกม ลบเกมนี้")}</p>}
          {past && <p className="text-xs text-amber-800">{t("เกมวันก่อน: คนที่ยังไม่จ่าย ยอดค้างจะเปลี่ยนตาม")}</p>}
          {fixed.length > 0 && (
            <p className="text-xs text-zinc-500">
              {t("ยอดเงินไม่เปลี่ยน (จ่ายแล้วหรือแอดมินแก้ยอดไว้): {names}", { names: fixed.map((id) => byId.get(id)?.name ?? "?").join(", ") })}
            </p>
          )}
          <button className="min-h-11 w-full rounded-2xl bg-lime text-sm font-semibold text-ink" onClick={() => setOpen(false)}>
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
      {editPlayers && <EditGamePlayers game={game} day={day} onClose={() => setEditPlayers(false)} />}
    </li>
  );
}

/**
 * แอดมินแก้คู่ตีของเกมที่จบแล้ว: แตะช่องแล้วแตะชื่อคนที่เล่นจริง (ชื่อที่อยู่อีกช่องจะสลับกัน)
 * หรือแตะช่องหนึ่งแล้วแตะอีกช่องเพื่อสลับคน ผลแพ้ชนะคงตามทีม A/B เดิม
 * ประวัติ สถิติคู่หู อันดับ และค่าลูกของคนที่ยังไม่จ่าย เปลี่ยนตามทันที
 */
export function EditGamePlayers({ game, day, onClose }: { game: Game; day: Day; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [slots, setSlots] = useState<string[]>([...game.playerIds]);
  const [selected, setSelected] = useState<number | null>(0);
  const [q, setQ] = useState("");
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? t("ผู้เล่นที่ออกแล้ว");
  // คนที่เช็คอินวันนั้น (คิดค่าลูกได้) + คนที่อยู่ในเกมเดิม
  const ids = [...new Set([...day.checkIns.map((c) => c.playerId), ...game.playerIds])].filter((id) => byId.has(id) || game.playerIds.includes(id));
  const needle = q.trim().toLowerCase();
  const list = ids.filter((id) => !needle || name(id).toLowerCase().includes(needle)).sort((a, b) => name(a).localeCompare(name(b), locale()));
  const changed = slots.some((id, i) => id !== game.playerIds[i]);
  const tapSlot = (i: number) => {
    if (selected === null || selected === i) return setSelected(selected === i ? null : i);
    const next = [...slots];
    [next[selected], next[i]] = [next[i], next[selected]];
    setSlots(next);
    setSelected(null);
  };
  const pick = (id: string) => {
    if (selected === null) return;
    const next = [...slots];
    const at = next.indexOf(id);
    if (at >= 0) next[at] = next[selected];
    next[selected] = id;
    setSlots(next);
    setSelected(null);
  };
  const save = () => {
    if (!validLineup(slots)) return;
    const after: Game = { ...game, playerIds: slots };
    // ล็อกยอดคนที่จ่ายแล้ว (ทั้งคนเดิมและคนใหม่) ก่อนย้ายลูกของเกมนี้
    lockPaid(game, day, state.settings, dispatch);
    lockPaid(after, day, state.settings, dispatch);
    dispatch({ type: "editGamePlayers", date: day.date, gameId: game.id, playerIds: slots });
    onClose();
  };
  const result = game.draw ? t("เสมอ") : game.winner ? t("ทีม {team} ชนะ", { team: game.winner }) : t("ไม่นับผล");
  const slot = (i: number) => {
    const id = slots[i];
    const moved = id !== game.playerIds[i];
    return (
      <button
        key={i}
        onClick={() => tapSlot(i)}
        aria-pressed={selected === i}
        className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold active:scale-95 ${selected === i ? "bg-lime text-ink ring-2 ring-ink" : moved ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300" : "bg-white text-ink ring-1 ring-zinc-200"}`}
      >
        <Avatar name={name(id)} photo={byId.get(id)?.photo} size={26} />
        <span className="min-w-0 flex-1 truncate">{name(id)}</span>
      </button>
    );
  };
  return (
    <Sheet title={<h2 className="text-lg font-bold">{t("แก้คนในเกม")}</h2>} onClose={onClose} keepOpen={changed}>
      <p className="text-sm text-zinc-600">
        {dateLabel(day.date)} {clock(game.startedAt)} · {t("สนาม {n}", { n: game.court })} · {result}
      </p>
      <div className="space-y-2">
        {(["A", "B"] as const).map((team, k) => (
          <div key={team} className="rounded-2xl bg-zinc-50 p-2">
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-zinc-500">
              {t("ทีม {team}", { team })}
              {game.winner === team && <Win />}
            </div>
            <div className="grid grid-cols-2 gap-2">{[k * 2, k * 2 + 1].map(slot)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {selected === null ? t("แตะช่องที่ผิด แล้วแตะชื่อคนที่เล่นจริง หรือแตะอีกช่องเพื่อสลับคน") : t("แตะชื่อคนที่เล่นจริง หรือแตะอีกช่องเพื่อสลับ")}
      </p>
      {selected !== null && (
        <div className="space-y-2">
          <SearchInput value={q} onChange={setQ} placeholder={t("ค้นหาชื่อ (คนที่มาวันนั้น)")} />
          <div className="flex flex-wrap gap-1.5">
            {list.map((id) => {
              const at = slots.indexOf(id);
              return (
                <button
                  key={id}
                  onClick={() => pick(id)}
                  className={`min-h-11 rounded-full px-3 text-sm font-medium active:scale-95 ${at === selected ? "bg-lime text-ink" : at >= 0 ? "bg-zinc-200 text-zinc-700" : "bg-white text-ink ring-1 ring-zinc-200"}`}
                >
                  {name(id)}
                  {at >= 0 && at !== selected && <span className="ml-1 text-xs text-zinc-500">({t("ทีม {team}", { team: at < 2 ? "A" : "B" })})</span>}
                </button>
              );
            })}
            {list.length === 0 && <p className="px-1 text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</p>}
          </div>
        </div>
      )}
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("ผลแพ้ชนะคงตามทีมเดิม ประวัติ สถิติคู่ และค่าลูกของคนที่ยังไม่จ่ายจะเปลี่ยนตาม คนที่จ่ายแล้วยอดไม่เปลี่ยน")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-11 rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-700" onClick={onClose}>
          {t("ยกเลิก")}
        </button>
        <button className="min-h-11 rounded-2xl bg-lime text-sm font-semibold text-ink disabled:opacity-40" onClick={save} disabled={!changed || !validLineup(slots)}>
          {t("บันทึก")}
        </button>
      </div>
    </Sheet>
  );
}

/** แอดมินแก้ผลเกมที่จบแล้ว (เลือกแล้วป้าย "ไม่ตรง" หายไป) และดูว่าใครกดผล / ใครแจ้งไม่ตรง */
function ResultEditor({ game, day, byId }: { game: Game; day: Day; byId: Map<string, Player> }) {
  const { dispatch } = useStore();
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const cur = game.draw ? "draw" : (game.winner ?? "none");
  const opts = [
    { k: "A", label: t("ทีม {team} ชนะ", { team: "A" }) },
    { k: "draw", label: t("เสมอ") },
    { k: "B", label: t("ทีม {team} ชนะ", { team: "B" }) },
    { k: "none", label: t("ไม่นับผล") },
  ] as const;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t("ผลเกม")}</div>
      {(game.reportedBy || game.disputedBy) && (
        <p className={`text-xs ${game.disputedBy ? "font-semibold text-red-700" : "text-zinc-500"}`}>
          {game.reportedBy && t("{name} กดผลเอง", { name: name(game.reportedBy) })}
          {game.disputedBy && ` · ${t("{name} แจ้งว่าไม่ตรง", { name: name(game.disputedBy) })}`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => (
          <button
            key={o.k}
            aria-pressed={cur === o.k}
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold active:scale-95 ${cur === o.k ? "bg-lime text-ink" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}
            onClick={() => dispatch({ type: "setResult", date: day.date, gameId: game.id, winner: o.k === "A" || o.k === "B" ? o.k : undefined, draw: o.k === "draw" || undefined })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {game.disputedBy && (
        <button
          className="min-h-11 w-full rounded-xl bg-white text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 active:scale-95"
          onClick={() => dispatch({ type: "setResult", date: day.date, gameId: game.id, winner: game.winner, draw: game.draw })}
        >
          {t("ผลเดิมถูกแล้ว (เอาป้ายออก)")}
        </button>
      )}
    </div>
  );
}

/** หน้าสนาม (แอดมิน): เกมที่จบแล้ววันนี้ กดเปิดดูแล้วแก้จำนวนลูกได้ */
export function FinishedGames({ byId }: { byId: Map<string, Player> }) {
  const { day } = useToday();
  const [show, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const done = day.games.filter((g) => g.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  if (done.length === 0) return null;
  const total = done.reduce((s, g) => s + g.shuttles, 0);
  const disputed = done.filter((g) => g.disputedBy).length;
  // มีเกมที่ผู้เล่นแจ้งว่าผลไม่ตรง เปิดรายการให้เห็นเลย
  const open = show || disputed > 0;
  return (
    <>
      <SectionTitle right={<span className="whitespace-nowrap">{t("{n} เกม · {m} ลูก", { n: done.length, m: total })}</span>}>{t("เกมที่จบแล้ววันนี้")}</SectionTitle>
      {disputed > 0 && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700" role="status">⚠ {t("ผู้เล่นแจ้งว่าผลไม่ตรง {n} เกม กดเกมที่มีป้ายเพื่อแก้ผล", { n: disputed })}</p>}
      {open ? (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {done.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} open={editing === g.id} onToggle={(o) => setEditing(o ? g.id : null)} />
            ))}
          </ul>
          {disputed === 0 && (
            <button className="min-h-11 w-full border-t border-zinc-100 text-sm font-medium text-zinc-500" onClick={() => setOpen(false)}>
              {t("ซ่อน")}
            </button>
          )}
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
  const [limit, setLimit] = useState(SEARCH_DAYS);
  const [editing, setEditing] = useState<string | null>(null);
  // แอดมินโหลดประวัติทั้งหมด: กันพิมพ์แล้วค้างด้วย deferred + จำกัดจำนวนวันที่แสดง
  const deferredQ = useDeferredValue(q);
  const byId = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);
  const days = useMemo(() => state.days.filter((d) => d.games.some((g) => g.endedAt)).sort((x, y) => y.date.localeCompare(x.date)), [state.days]);
  const needle = deferredQ.trim().toLowerCase();
  const found = useMemo(() => {
    if (!needle) return null;
    const ids = state.players.filter((p) => p.name.toLowerCase().includes(needle)).map((p) => p.id);
    const out: { day: Day; games: Game[] }[] = [];
    for (const day of days) {
      const games = day.games.filter((g) => g.endedAt && ids.some((id) => inGame(g, id)));
      if (games.length) out.push({ day, games: games.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)) });
    }
    return { ids, groups: out };
  }, [needle, days, state.players]);
  if (!days.length) return <Card className="py-10 text-center text-sm text-zinc-500">{t("ยังไม่มีเกมที่จบ")}</Card>;
  // วันที่เลือกไม่มีเกมเหลือแล้ว (เช่นลบเกมสุดท้าย) ไปวันล่าสุดที่มีเกม
  const pickedDay = days.find((d) => d.date === date) ?? days[0];
  const groups = found
    ? found.groups.slice(0, limit)
    : [{ day: pickedDay, games: pickedDay.games.filter((g) => g.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)) }];
  const more = found ? found.groups.length - groups.length : 0;
  const label = (d: string) => (d === today.date ? t("วันนี้") : new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", year: "2-digit" }));
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchInput value={q} onChange={(v) => { setQ(v); setEditing(null); setLimit(SEARCH_DAYS); }} placeholder={t("ค้นหาชื่อผู้เล่น (ทุกวัน)")} />
        {q && (
          <button className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-zinc-400 active:bg-zinc-100" onClick={() => { setQ(""); setEditing(null); }} aria-label={t("ล้างคำค้น")}>
            <Icon.X width={18} height={18} />
          </button>
        )}
      </div>
      {!found && (
        <label className="block">
          <span className="mb-1 block px-1 text-sm text-zinc-500">{t("ดูวัน")}</span>
          <select className={inputClass} value={pickedDay.date} onChange={(e) => { setDate(e.target.value); setEditing(null); }}>
            {days.map((d) => (
              <option key={d.date} value={d.date}>
                {label(d.date)}
              </option>
            ))}
          </select>
        </label>
      )}
      {groups.map(({ day, games }) => (
        <div key={day.date} className="space-y-1.5">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold">{found ? label(day.date) : ""}</span>
            <span className="whitespace-nowrap text-sm text-zinc-500">{t("{n} เกม · {m} ลูก", { n: games.length, m: games.reduce((s, g) => s + g.shuttles, 0) })}</span>
          </div>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
            {games.map((g) => (
              <GameShuttleRow key={g.id} game={g} byId={byId} day={day} me={found?.ids} past={day.date !== today.date} open={editing === g.id} onToggle={(o) => setEditing(o ? g.id : null)} />
            ))}
          </ul>
        </div>
      ))}
      {more > 0 && (
        <button className="min-h-11 w-full rounded-full bg-zinc-100 px-4 text-sm font-semibold active:bg-zinc-200" onClick={() => setLimit(limit + SEARCH_DAYS)}>
          {t("ดูวันก่อนหน้าอีก ({n} วัน)", { n: more })}
        </button>
      )}
      {found && found.groups.length === 0 && <Card className="py-8 text-center text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</Card>}
    </div>
  );
}

const SEARCH_DAYS = 10;

/** หน้าบิล (แอดมิน): เกมของคนนี้วันนี้ แก้ลูกรายเกมได้ */
export function PlayerGameShuttles({ playerId, adjusted }: { playerId: string; adjusted: boolean }) {
  const { state } = useStore();
  const { day } = useToday();
  const [editing, setEditing] = useState<string | null>(null);
  const games = day.games.filter((g) => inGame(g, playerId)).sort((a, b) => b.startedAt - a.startedAt);
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
        <p className="px-1 text-xs text-zinc-500">{games.some((g) => g.subs?.length) ? t("แก้ลูกของเกม = แก้ให้คนที่อยู่ในสนามตอนนี้ คนที่เปลี่ยนตัวออกไปแล้วยอดไม่เปลี่ยน") : t("แก้ลูกของเกม = แก้ให้ทั้ง 4 คนในเกมนั้น")}</p>
      )}
    </div>
  );
}

/** หน้ายอดของฉัน (ผู้เล่น): เกมที่ตัวเองเล่นวันนี้และจำนวนลูก ให้ตรวจเองว่าตรงกับบิล */
export function MyGames({ playerId }: { playerId: string }) {
  const { state } = useStore();
  const { day } = useToday();
  const games = day.games.filter((g) => inGame(g, playerId)).sort((a, b) => a.startedAt - b.startedAt);
  if (games.length === 0) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const total = games.reduce((s, g) => s + shuttlesInGame(g, playerId), 0);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h3 className="font-semibold">{t("เกมของฉันวันนี้")}</h3>
        <span className="text-xs text-zinc-500">{t("{n} เกม · {m} ลูก", { n: games.length, m: total })}</span>
      </div>
      <ol className="divide-y divide-zinc-100">
        {games.map((g, i) => {
          // ถูกเปลี่ยนตัวออก: ดูคู่/คู่แข่งตอนที่ยังเล่นอยู่ ไม่นับแพ้ชนะ
          const left = !g.playerIds.includes(playerId);
          const ids = lineupWith(g, playerId);
          const mine = ids.indexOf(playerId) < 2 ? "A" : "B";
          const partner = ids.find((id, j) => id !== playerId && (j < 2) === (mine === "A"))!;
          const opp = ids.filter((_, j) => (j < 2) !== (mine === "A"));
          const won = !left && !!g.endedAt && g.winner === mine;
          const result = left ? t("เปลี่ยนตัวออก") : !g.endedAt ? t("กำลังเล่น") : g.draw ? t("เสมอ") : g.winner && !won ? t("แพ้") : "";
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
                {shuttlesInGame(g, playerId)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">{t("จำนวนลูกไม่ตรง หรือมีเกมที่ไม่ได้เล่น แจ้งแอดมินให้แก้ได้")}</p>
    </Card>
  );
}
