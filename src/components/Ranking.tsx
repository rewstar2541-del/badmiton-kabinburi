"use client";

import { useEffect, useMemo, useState } from "react";
import { monthRanking } from "@/lib/club";
import { locale, t } from "@/lib/i18n";
import type { State } from "@/lib/state";
import { today, useStore } from "@/lib/store";
import { useMe } from "./PickMe";
import { Avatar, Card, Icon } from "./ui";

/**
 * ประวัติเกมย้อนหลังสำหรับอันดับ/สรุปรายปี
 * แอดมินและโหมดทดลองมีครบอยู่แล้วใน state ผู้เล่นทั่วไปโหลดเพิ่มครั้งเดียว แล้วใช้เกมวันนี้จาก state ที่อัปเดตสด
 */
export function useHistory(from: string): { data: Pick<State, "days" | "players"> | null; failed: boolean } {
  const { state, history, auth } = useStore();
  const full = auth.isAdmin || !auth.online;
  const [loaded, setLoaded] = useState<{ from: string; s: State } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (full) return;
    let alive = true;
    history(from)
      .then((s) => alive && setLoaded({ from, s }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [full, from, history]);
  const data = useMemo(() => {
    if (full) return state;
    if (!loaded || loaded.from !== from) return null;
    const d = today();
    return { players: state.players, days: [...loaded.s.days.filter((x) => x.date < d), ...state.days.filter((x) => x.date >= d)] };
  }, [full, state, loaded, from]);
  return { data, failed: failed && !data };
}

const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString(locale(), { month: "long", year: "numeric" });

/** ตารางอันดับรายเดือน (ทุกคนเห็น) */
export function RankingCard({ onYear }: { onYear?: () => void }) {
  const now = today().slice(0, 7);
  const [month, setMonth] = useState(now);
  const [all, setAll] = useState(false);
  const [me] = useMe();
  const { data, failed } = useHistory("2000-01-01");
  const rows = useMemo(() => (data ? monthRanking(data, month) : []), [data, month]);
  const byId = new Map((data?.players ?? []).map((p) => [p.id, p]));
  const mine = rows.findIndex((r) => r.id === me);
  const shown = all ? rows : rows.slice(0, 10);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <Icon.Trophy width={20} height={20} /> {t("ตารางอันดับ")}
        </h3>
        <div className="flex items-center gap-1 text-sm">
          <button className="grid size-8 place-items-center rounded-full bg-zinc-100" aria-label={t("เดือนก่อน")} onClick={() => setMonth(shift(month, -1))}>
            ‹
          </button>
          <span className="min-w-24 text-center font-semibold">{monthLabel(month)}</span>
          <button
            className="grid size-8 place-items-center rounded-full bg-zinc-100 disabled:opacity-30"
            aria-label={t("เดือนถัดไป")}
            disabled={month >= now}
            onClick={() => setMonth(shift(month, 1))}
          >
            ›
          </button>
        </div>
      </div>
      {!data ? (
        <p className="text-sm text-zinc-500">{failed ? t("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง") : t("กำลังโหลด...")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("เดือนนี้ยังไม่มีผลแพ้ชนะ")}</p>
      ) : (
        <>
          {mine >= 0 && (
            <p className="rounded-2xl bg-lime/40 px-3 py-2 text-sm font-semibold">
              {t("คุณอยู่อันดับ {n} จาก {m} คน", { n: mine + 1, m: rows.length })}
            </p>
          )}
          <ol className="divide-y divide-zinc-100">
            {shown.map((r, i) => {
              const p = byId.get(r.id);
              return (
                <li key={r.id} className={`flex items-center gap-2.5 py-2 ${r.id === me ? "font-semibold" : ""}`}>
                  <span className={`w-6 shrink-0 text-center font-display font-semibold tabular-nums ${i < 3 ? "text-amber-600" : "text-zinc-400"}`}>{i + 1}</span>
                  <Avatar name={p?.name ?? "?"} photo={p?.photo} size={30} />
                  <span className="min-w-0 flex-1 truncate">{p?.name ?? "?"}</span>
                  <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{t("ชนะ {w}/{g}", { w: r.wins, g: r.games })}</span>
                  <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${r.delta >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </span>
                </li>
              );
            })}
          </ol>
          {rows.length > 10 && (
            <button className="w-full text-sm font-semibold text-zinc-600 underline" onClick={() => setAll(!all)}>
              {all ? t("ย่อ") : t("ดูทั้งหมด {n} คน", { n: rows.length })}
            </button>
          )}
        </>
      )}
      <p className="text-xs text-zinc-500">
        {t("แต้มขึ้นลงตามผลแพ้ชนะ ชนะทีมเก่งกว่าได้แต้มมากกว่า")}
      </p>
      {onYear && (
        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white" onClick={onYear}>
          {t("ดูสรุปก๊วนปี {year}", { year: yearLabel(today().slice(0, 4)) })}
        </button>
      )}
    </Card>
  );
}

/** ปีตามภาษา (ไทยเป็น พ.ศ.) */
export const yearLabel = (y: string) => new Date(`${y}-06-01T00:00:00`).toLocaleDateString(locale(), { year: "numeric" });
