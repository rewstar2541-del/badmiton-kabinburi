"use client";

import { useState } from "react";
import { daySummary, lastFinishedGame, LOW_RATING } from "@/lib/ratings";
import { useStore, useToday } from "@/lib/store";
import type { Game, Player } from "@/lib/types";
import { locale, t } from "@/lib/i18n";
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
  const [editing, setEditing] = useState(false);
  const game = lastFinishedGame(day, playerId);
  if (!game) return null;
  const key = `${playerId}:${game.id}`;
  const done = rated[key] ?? game.ratings?.[playerId];
  if (done === 0) return null;
  if (done && !editing)
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-1 text-sm text-zinc-600">
        <span>
          {t("ขอบคุณที่ให้คะแนน")} <span className="text-amber-500">{"★".repeat(done)}</span>
        </span>
        <button className="min-h-10 px-2 text-xs font-semibold underline" onClick={() => setEditing(true)}>
          {t("แก้")}
        </button>
      </p>
    );

  const save = (stars: number) => {
    const next = { ...rated, [key]: stars };
    writeRated(next);
    setRated(next);
    setEditing(false);
  };
  const rate = async (stars: number) => {
    setBusy(true);
    setError("");
    const err = await social({ kind: "rate", game: game.id, stars }, playerId, savedPin.get());
    setBusy(false);
    // ข้อความจากฐานข้อมูลที่ไม่ใช่ภาษาไทย (เช่นยังไม่ได้รัน SQL) ไม่ต้องโชว์ผู้เล่น
    if (err) setError(/[ก-๙]/.test(err) ? t(err) : t("ส่งคะแนนไม่สำเร็จ ลองใหม่อีกครั้ง"));
    else save(stars);
  };
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const mine = game.playerIds.indexOf(playerId) < 2 ? 0 : 2;
  const partner = game.playerIds.slice(mine, mine + 2).filter((id) => id !== playerId);
  const others = game.playerIds.slice(2 - mine, 4 - mine);

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("เกมเมื่อกี้ฝีมือสูสีไหม?")}</h3>
        <p className="text-xs text-zinc-500">{t("คู่กับ {a} · เจอ {b}", { a: names(partner, byId), b: names(others, byId) })}</p>
      </div>
      <div className="flex justify-between gap-1" role="group" aria-label={t("ให้คะแนน 1-5 ดาว")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={busy}
            onClick={() => rate(n)}
            aria-label={t("{n} ดาว", { n })}
            className={`flex h-14 w-12 flex-col items-center justify-center rounded-2xl text-xl leading-none transition active:scale-95 disabled:opacity-50 ${
              n <= (done ?? 0) ? "bg-amber-100 text-amber-500" : "bg-amber-50 text-amber-400"
            }`}
          >
            ★<span className="mt-0.5 text-xs font-semibold text-zinc-600">{n}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-zinc-600">
        <span>{t("ฝีมือห่างมาก")}</span>
        <span>{t("สูสี สนุก")}</span>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">{busy ? t("กำลังส่ง...") : t("เฉพาะแอดมินเห็น ใช้ปรับการจัดคู่")}</p>
        <button className="min-h-11 shrink-0 px-3 text-sm font-semibold text-zinc-600 underline disabled:opacity-50" disabled={busy} onClick={() => (done ? setEditing(false) : save(0))}>
          {done ? t("ไม่แก้") : t("ข้าม")}
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
          <span key={id} className="flex min-w-0 max-w-full items-center gap-1">
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
      <span className="text-xs text-zinc-400">{t("พบ")}</span>
      <TeamNames ids={g.playerIds.slice(2)} byId={byId} />
    </div>
  );
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold">{t("คะแนนเกมวันนี้")}</h3>
        <span className="shrink-0 font-semibold text-amber-600 tabular-nums">★ {s.avg.toFixed(1)}</span>
      </div>
      <p className="text-xs text-zinc-500">{t("ให้คะแนน {n} ครั้ง · มีคะแนน {g} จาก {all} เกมที่จบแล้ว", { n: s.count, g: s.games, all: s.finished })}</p>
      {s.low.length > 0 ? (
        <>
          <p className="text-sm font-medium text-amber-900">{t("เกมที่ได้ไม่เกิน {n} ดาว อาจจัดฝีมือห่างไป", { n: LOW_RATING })}</p>
          <ul className="divide-y divide-zinc-100">
            {s.low.map((r) => (
              <li key={r.game.id} className="flex items-start gap-3 py-2">
                <span className="w-14 shrink-0 text-xs text-zinc-500">
                  {t("สนาม {n}", { n: r.game.court })}
                  <span className="block">{new Date(r.game.startedAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
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
