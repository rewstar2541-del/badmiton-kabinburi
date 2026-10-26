"use client";

import { useState } from "react";
import { daySummary, lastFinishedGame, LOW_RATING } from "@/lib/ratings";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player } from "@/lib/types";
import { t } from "@/lib/i18n";
import { savedPin } from "./PickMe";
import { Card, LevelBadge } from "./ui";

const KEY = "badminton-kabinburi:rated";

/** เกมที่ให้คะแนนหรือกดข้ามไปแล้วบนเครื่องนี้ (ผู้เล่น:เกม -> ดาว, 0 = ข้าม) ผู้เล่นอ่านคะแนนจากฐานข้อมูลไม่ได้ */
function readRated(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function writeRated(v: Record<string, number>) {
  try {
    // เก็บแค่ 30 เกมล่าสุด
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(v).slice(-30))));
  } catch {}
}

function names(ids: string[], byId: Map<string, Player>) {
  return ids.map((id) => byId.get(id)?.name ?? "?").join(", ");
}

/** ผู้เล่น: เล่นจบเกมแล้ว ถามว่าเกมสูสี/สนุกแค่ไหน 1-5 ดาว (เฉพาะเกมล่าสุด ถามครั้งเดียว) */
export function RateLastGame({ playerId }: { playerId: string }) {
  const { state, social } = useStore();
  const { day } = useToday();
  const [rated, setRated] = useState(readRated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const game = lastFinishedGame(day, playerId);
  if (!game) return null;
  const key = `${playerId}:${game.id}`;
  const done = rated[key] ?? game.ratings?.[playerId];
  if (done === 0) return null;
  if (done)
    return (
      <p className="rounded-2xl bg-zinc-100 px-4 py-2 text-center text-sm text-zinc-600">
        {t("ขอบคุณที่ให้คะแนน")} {"★".repeat(done)}
      </p>
    );

  const save = (stars: number) => {
    const next = { ...rated, [key]: stars };
    writeRated(next);
    setRated(next);
  };
  const rate = async (stars: number) => {
    setBusy(true);
    const err = await social({ kind: "rate", game: game.id, stars }, playerId, savedPin.get());
    setBusy(false);
    if (err) setError(t(err));
    else save(stars);
  };
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const mine = game.playerIds.indexOf(playerId) < 2 ? 0 : 2;
  const partner = game.playerIds.slice(mine, mine + 2).filter((id) => id !== playerId);
  const others = game.playerIds.slice(2 - mine, 4 - mine);

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("เกมเมื่อกี้เป็นยังไง?")}</h3>
        <p className="text-xs text-zinc-500">{t("คู่กับ {a} · เจอ {b}", { a: names(partner, byId), b: names(others, byId) })}</p>
      </div>
      <div className="flex justify-between gap-1" role="group" aria-label={t("ให้คะแนน 1-5 ดาว")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={busy}
            onClick={() => rate(n)}
            aria-label={t("{n} ดาว", { n })}
            className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-2xl text-amber-500 transition active:scale-95 disabled:opacity-50"
          >
            ★
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{t("ฝีมือห่างมาก")}</span>
        <span>{t("สูสี สนุก")}</span>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-400">{t("แอดมินเห็นคนเดียว ใช้ปรับการจัดคู่")}</p>
        <button className="shrink-0 text-xs text-zinc-500 underline" onClick={() => save(0)}>
          {t("ข้าม")}
        </button>
      </div>
    </Card>
  );
}

function TeamNames({ ids, byId }: { ids: string[]; byId: Map<string, Player> }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {ids.map((id) => {
        const p = byId.get(id);
        return (
          <span key={id} className="flex items-center gap-1">
            <span className="truncate">{p?.name ?? "?"}</span>
            {p && <LevelBadge level={p.level} />}
          </span>
        );
      })}
    </span>
  );
}

/** แอดมิน: คะแนนเฉลี่ยของวันนี้ และเกมที่ได้คะแนนต่ำ (อาจจัดฝีมือห่างไป) */
export function GameRatingsCard() {
  const { state } = useStore();
  const { day } = useToday();
  const s = daySummary(day);
  if (!s.count) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const row = (g: Game) => (
    <div className="space-y-0.5 text-sm">
      <TeamNames ids={g.playerIds.slice(0, 2)} byId={byId} />
      <span className="text-xs text-zinc-400">vs</span>
      <TeamNames ids={g.playerIds.slice(2)} byId={byId} />
    </div>
  );
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold">{t("คะแนนเกมวันนี้")}</h3>
        <span className="shrink-0 font-semibold text-amber-600 tabular-nums">★ {s.avg.toFixed(1)}</span>
      </div>
      <p className="text-xs text-zinc-500">{t("ให้คะแนนแล้ว {n} ครั้ง จาก {g} เกม", { n: s.count, g: s.games })}</p>
      {s.low.length > 0 ? (
        <>
          <p className="text-sm font-medium text-amber-900">{t("เกมที่ได้ไม่เกิน {n} ดาว อาจจัดฝีมือห่างไป", { n: LOW_RATING })}</p>
          <ul className="divide-y divide-zinc-100">
            {s.low.map((r) => (
              <li key={r.game.id} className="flex items-start gap-3 py-2">
                <span className="w-14 shrink-0 text-xs text-zinc-500">{t("สนาม {n}", { n: r.game.court })}</span>
                <div className="min-w-0 flex-1">{row(r.game)}</div>
                <span className="shrink-0 text-right text-sm font-semibold text-red-600 tabular-nums">
                  ★ {r.avg.toFixed(1)}
                  <span className="block text-[11px] font-normal text-zinc-400">{t("{n} คน", { n: r.count })}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-emerald-700">{t("ยังไม่มีเกมที่ได้คะแนนต่ำ")}</p>
      )}
    </Card>
  );
}
