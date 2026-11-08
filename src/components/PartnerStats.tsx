"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import { gameHistory, partnerStats, type GameResult, type HistoryGame, type MateStat } from "@/lib/social";
import { useStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { Avatar, Button, Card, Icon } from "./ui";
import { EditGamePlayers, lockPaid } from "./GameShuttles";
import { canEditPlayers } from "@/lib/state";

type Tab = "mates" | "history";

/** สถิติกับคู่: แท็บคู่หู/คู่แข่ง และแท็บประวัติการเล่น */
export function PartnerStats({ player, admin = false }: { player: Player; admin?: boolean }) {
  const [tab, setTab] = useState<Tab>("history");
  const tabs: [Tab, string][] = [
    ["mates", t("คู่หูและคู่แข่ง")],
    ["history", t("ประวัติการเล่น")],
  ];
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex rounded-2xl bg-zinc-100 p-1">
        {tabs.map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${tab === v ? "bg-white text-ink shadow-sm" : "text-zinc-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "mates" ? <Mates player={player} /> : <History player={player} admin={admin} />}
    </div>
  );
}

/** ตีคู่กับใครชนะบ่อย และเจอใครแพ้บ่อย (จากเกมที่แอดมินบันทึกผล) */
function Mates({ player }: { player: Player }) {
  const { state } = useStore();
  const s = partnerStats(state, player.id);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const row = (m: MateStat, text: string) => {
    const p = byId.get(m.id);
    return (
      <li key={m.id} className="flex items-center gap-2.5">
        <Avatar name={p?.name ?? "?"} photo={p?.photo} size={30} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p?.name ?? "?"}</span>
        <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{text}</span>
      </li>
    );
  };
  const partners = s.partners.filter((m) => m.wins > 0).slice(0, 3);
  const rivals = s.rivals.filter((m) => m.games > m.wins).slice(0, 3);
  return (
    <Card className="space-y-3">
      {s.decided > 0 && <p className="text-xs text-zinc-500">{t("จาก {n} เกมที่บันทึกผล", { n: s.decided })}</p>}
      {s.decided === 0 ? (
        <p className="text-sm text-zinc-500">{t("ยังไม่มีผลแพ้ชนะ (แอดมินกดผลตอนจบเกม)")}</p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold tracking-wide text-emerald-700">{t("ตีคู่แล้วชนะบ่อย")}</h4>
            {partners.length ? (
              <ul className="space-y-2">{partners.map((m) => row(m, t("ชนะ {w} จาก {g} เกม", { w: m.wins, g: m.games })))}</ul>
            ) : (
              <p className="text-sm text-zinc-500">{t("ยังไม่มี")}</p>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold tracking-wide text-red-600">{t("เจอแล้วแพ้บ่อย")}</h4>
            {rivals.length ? (
              <ul className="space-y-2">{rivals.map((m) => row(m, t("แพ้ {l} จาก {g} เกม", { l: m.games - m.wins, g: m.games })))}</ul>
            ) : (
              <p className="text-sm text-zinc-500">{t("ยังไม่มี")}</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

const RESULT: Record<GameResult, { label: () => string; tone: string; dot: string; mark: string }> = {
  win: { label: () => t("ชนะ"), tone: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", mark: "✓" },
  loss: { label: () => t("แพ้"), tone: "bg-red-100 text-red-700", dot: "bg-red-500", mark: "✕" },
  draw: { label: () => t("เสมอ"), tone: "bg-zinc-200 text-zinc-700", dot: "bg-zinc-400", mark: "–" },
  playing: { label: () => t("กำลังเล่น"), tone: "bg-lime text-ink", dot: "", mark: "" },
  unknown: { label: () => t("ไม่มีผล"), tone: "border border-dashed border-zinc-300 text-zinc-500", dot: "", mark: "" },
};

const PAGE = 30;

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });

/** ประวัติการเล่น: แต่ละเกมคู่กับใคร เจอใคร แพ้หรือชนะ แบ่งตามวัน */
function History({ player, admin }: { player: Player; admin: boolean }) {
  const { state, dispatch } = useStore();
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<HistoryGame | null>(null);
  const all = gameHistory(state, player.id);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  // แอดมินลบเกมที่ไม่ได้เล่นจริง (เฉพาะเกมที่จบแล้ว เกมที่กำลังเล่นยกเลิกที่หน้าสนาม)
  const remove = (h: HistoryGame) => {
    const day = state.days.find((d) => d.date === h.date);
    if (!day) return;
    const time = `${dayLabel(h.date)} ${clock(h.game.startedAt)}`;
    if (!confirm(t("ลบเกมนี้ (สนาม {n} · {time})? ใช้เมื่อเกมนี้ไม่ได้เล่นจริง ลูกและผลแพ้ชนะของเกมนี้จะหายไป", { n: h.game.court, time }))) return;
    lockPaid(h.game, day, state.settings, dispatch);
    dispatch({ type: "cancelGame", date: h.date, gameId: h.game.id });
  };
  const name = (id: string) => byId.get(id)?.name ?? t("ผู้เล่นที่ออกแล้ว");

  if (all.length === 0) return <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">{t("ยังไม่มีเกมที่เล่น")}</p>;

  const count = (r: GameResult) => all.filter((h) => h.result === r).length;
  const wins = count("win");
  const losses = count("loss");
  const rate = wins + losses ? Math.round((wins * 100) / (wins + losses)) : null;
  // เรียงเก่าไปใหม่ ให้เกมล่าสุดอยู่ขวาสุด
  const recent = all.filter((h) => h.result === "win" || h.result === "loss" || h.result === "draw").slice(0, 10).reverse();
  const perDay = new Map<string, { n: number; w: number }>();
  for (const h of all) {
    const x = perDay.get(h.date) ?? { n: 0, w: 0 };
    x.n++;
    if (h.result === "win") x.w++;
    perDay.set(h.date, x);
  }
  const first = all[all.length - 1].date;
  const others = [count("draw") && t("เสมอ {n}", { n: count("draw") }), count("unknown") && t("ไม่มีผล {n}", { n: count("unknown") })].filter(Boolean);

  const days: { date: string; games: HistoryGame[] }[] = [];
  for (const h of all.slice(0, shown)) {
    const last = days[days.length - 1];
    if (last?.date === h.date) last.games.push(h);
    else days.push({ date: h.date, games: [h] });
  }
  // จำนวนเกมทั้งวัน (ไม่ใช่แค่ที่แสดงอยู่) ใช้ในหัววัน
  const dayTotal = (date: string) => t("{n} เกม · ชนะ {w}", { n: perDay.get(date)!.n, w: perDay.get(date)!.w });

  const tiles = [
    { label: t("เกม"), value: String(all.length), tone: "bg-zinc-100" },
    { label: t("ชนะ"), value: String(wins), tone: "bg-emerald-50 text-emerald-700" },
    { label: t("แพ้"), value: String(losses), tone: "bg-red-50 text-red-600" },
    { label: t("อัตราชนะ"), value: rate === null ? "–" : `${rate}%`, tone: "bg-zinc-100" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((x) => (
          <div key={x.label} className={`rounded-2xl px-1 py-2 text-center ${x.tone}`}>
            <div className="font-display text-xl font-semibold tabular-nums">{x.value}</div>
            <div className="text-xs text-zinc-600">{x.label}</div>
          </div>
        ))}
      </div>
      <p className="px-0.5 text-xs text-zinc-500">
        {[t("นับตั้งแต่ {date}", { date: dayLabel(first) }), ...others].join(" · ")}
        {count("unknown") > 0 && <span className="block">{t("ไม่มีผล = แอดมินไม่ได้กดผลแพ้ชนะตอนจบเกม")}</span>}
      </p>
      {admin && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("แตะ ✎ เพื่อแก้คู่ตีที่บันทึกผิด แตะ ✕ เพื่อลบเกมที่ไม่ได้เล่นจริง เกมวันก่อน: คนที่ยังไม่จ่าย ยอดค้างจะเปลี่ยนตาม")}</p>}
      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-600">
          <span className="mr-0.5">{t("{n} เกมล่าสุด", { n: recent.length })}</span>
          {recent.map((h) => (
            <span
              key={h.game.id}
              title={RESULT[h.result].label()}
              aria-label={RESULT[h.result].label()}
              className={`grid size-5 place-items-center rounded-md text-[11px] font-bold text-white ${RESULT[h.result].dot}`}
            >
              {RESULT[h.result].mark}
            </span>
          ))}
        </div>
      )}
      {days.map((d) => (
        <section key={d.date} className="space-y-1.5">
          <h4 className="flex items-baseline justify-between gap-2 px-0.5 pt-1 text-sm font-semibold text-zinc-700">
            <span>{dayLabel(d.date)}</span>
            <span className="shrink-0 text-xs font-normal text-zinc-500">{dayTotal(d.date)}</span>
          </h4>
          <ul className="space-y-1.5">
            {d.games.map((h) => {
              const r = RESULT[h.result];
              const mate = byId.get(h.mate);
              return (
                <li key={h.game.id} className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5">
                  <span className={`w-14 shrink-0 rounded-xl px-1 py-1.5 text-center text-xs leading-tight font-bold ${r.tone}`}>{r.label()}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-zinc-500">{t("คู่")}</span>
                      <Avatar name={name(h.mate)} photo={mate?.photo} size={22} />
                      <span className="truncate font-semibold">{name(h.mate)}</span>
                    </div>
                    <div className="break-words text-[13px] text-zinc-500">{t("เจอ {a} + {b}", { a: name(h.opponents[0]), b: name(h.opponents[1]) })}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs leading-snug text-zinc-500 tabular-nums">
                    {t("สนาม {n}", { n: h.game.court })}
                    <br />
                    {clock(h.game.startedAt)}
                  </div>
                  {admin && h.game.endedAt && (
                  <div className="-mr-1.5 flex shrink-0 flex-col">
                  {canEditPlayers(h.game) && (
                    <button
                      onClick={() => setEditing(h)}
                      className="grid size-11 place-items-center rounded-full text-zinc-500 active:bg-zinc-100"
                      aria-label={t("แก้คนในเกม (คู่ตีผิด)")}
                      title={t("แก้คนในเกม (คู่ตีผิด)")}
                    >
                      <Icon.Edit width={18} height={18} />
                    </button>
                  )}
                    <button
                      onClick={() => remove(h)}
                      className="grid size-11 place-items-center rounded-full text-red-500 active:bg-red-50"
                      aria-label={t("ลบเกมนี้ (ไม่ได้เล่นจริง)")}
                      title={t("ลบเกมนี้ (ไม่ได้เล่นจริง)")}
                    >
                      <Icon.X width={18} height={18} />
                    </button>
                  </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {editing && (() => {
        const day = state.days.find((d) => d.date === editing.date);
        // ใช้เกมล่าสุดในข้อมูล (อีกเครื่องอาจแก้/ลบไปแล้ว)
        const game = day?.games.find((g) => g.id === editing.game.id);
        return day && game && canEditPlayers(game) ? <EditGamePlayers key={game.playerIds.join()} game={game} day={day} onClose={() => setEditing(null)} /> : null;
      })()}
      {shown < all.length && (
        <Button onClick={() => setShown((n) => n + PAGE)} className="w-full">
          {t("ดูเพิ่ม ({n} เกม)", { n: all.length - shown })}
        </Button>
      )}
    </div>
  );
}
