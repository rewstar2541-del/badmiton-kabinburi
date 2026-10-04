"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { locale, t, useLang } from "@/lib/i18n";
import { presence, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { Avatar, Icon, LevelBadge } from "./ui";

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Name({ p, big }: { p?: Player; big?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar name={p?.name ?? "?"} photo={p?.photo} size={big ? 40 : 32} ring />
      <span className={`min-w-0 truncate font-semibold ${big ? "text-2xl" : "text-xl"}`}>{p?.name ?? "?"}</span>
      {p && <LevelBadge level={p.level} />}
    </div>
  );
}

/** จอสนาม: เปิดบนแท็บเล็ตหรือทีวีที่สนาม ด้วย ?tv แสดงสนาม คิวถัดไป อัปเดตเองเมื่อข้อมูลเปลี่ยน */
export function TvView() {
  const { state, ready } = useStore();
  const { day } = useToday();
  const now = useClock();
  useLang();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const queue = waitingQueue(day, state.players);
  const games = new Map(day.games.filter((g) => !g.endedAt).map((g) => [g.court, g]));
  const courts = Array.from({ length: state.settings.courtCount }, (_, i) => i + 1);
  const resting = day.checkIns.filter((c) => presence(day, c.playerId) === "resting").length;

  if (!ready) return <div className="grid flex-1 place-items-center bg-ink text-white/60">{t("กำลังโหลด...")}</div>;

  return (
    <div className="flex min-h-full flex-1 flex-col gap-5 bg-ink p-5 text-white lg:p-8">
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-lime text-ink">
          <Icon.Shuttle width={30} height={30} strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-3xl leading-tight font-semibold">
          {APP_NAME[0]} <span className="text-lime">{APP_NAME[1]}</span>
        </h1>
        <div className="ml-auto text-right">
          <div className="font-display text-4xl font-semibold tabular-nums">
            {new Date(now).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-sm text-white/60">
            {new Date(now).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </header>

      {day.announcement && (
        <div className="flex items-center gap-3 rounded-2xl bg-lime px-5 py-3 text-xl text-ink">
          <Icon.Megaphone /> <span className="font-semibold">{day.announcement || t("วันนี้มีจัดก๊วน")}</span>
        </div>
      )}

      <div className="grid flex-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="grid content-start gap-4 sm:grid-cols-2">
          {courts.map((c) => {
            const g = games.get(c);
            return (
              <div key={c} className="rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-semibold">{t("สนาม {n}", { n: c })}</h2>
                  <span className="text-lg text-white/60 tabular-nums">
                    {g ? t("{n} นาที", { n: Math.max(0, Math.floor((now - g.startedAt) / 60000)) }) : t("ว่าง")}
                  </span>
                </div>
                {g ? (
                  <div className="court-surface grid grid-cols-2 gap-2 rounded-2xl p-3">
                    {[g.playerIds.slice(0, 2), g.playerIds.slice(2)].map((team, i) => (
                      <div key={i} className="flex min-w-0 flex-col gap-2">
                        {team.map((id) => (
                          <Name key={id} p={byId.get(id)} />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="court-surface grid h-28 place-items-center rounded-2xl text-xl font-semibold text-white/80">
                    {t("ว่าง")}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
          <h2 className="mb-1 font-display text-2xl font-semibold">{t("คิวถัดไป")}</h2>
          <p className="mb-4 text-sm text-white/60">
            {t("{n} คน", { n: queue.length })}
            {resting > 0 && ` · ${t("พักอยู่ {n} คน", { n: resting })}`}
          </p>
          <ol className="space-y-2">
            {queue.slice(0, 12).map((e, i) => (
              <li
                key={e.player.id}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${i < 4 ? "bg-lime text-ink" : "bg-white/[0.04]"}`}
              >
                <span className="w-6 text-center font-display text-xl font-semibold tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xl font-semibold">{e.player.name}</span>
                <LevelBadge level={e.player.level} />
              </li>
            ))}
            {queue.length === 0 && <li className="py-8 text-center text-lg text-white/60">{t("ไม่มีคนรอ")}</li>}
          </ol>
          {queue.length > 0 && <p className="mt-3 text-sm text-white/60">{t("4 คนแรกเตรียมลงสนามถัดไป")}</p>}
        </section>
      </div>
    </div>
  );
}
