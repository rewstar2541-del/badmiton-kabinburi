"use client";

import { useEffect, useMemo, useState } from "react";
import { monthRanking, type RankRow } from "@/lib/club";
import { FIRST_QUARTER, nextLevel, periodRecord, prevQuarter, promotionCandidates, quarterMonths, quarterOf } from "@/lib/promotion";
import type { Player } from "@/lib/types";
import { PromotionProgress } from "./MembersDirectory";
import { locale, t } from "@/lib/i18n";
import type { State } from "@/lib/state";
import { today, useStore } from "@/lib/store";
import { appName } from "@/lib/brand";
import { rankingImage } from "@/lib/shareImage";
import { useMe } from "./PickMe";
import { useShareImage } from "./ShareImage";
import { FramedAvatar } from "./AvatarFrame";
import { Avatar, Button, Card, Icon, LevelBadge, levelCode } from "./ui";
import { LEVELS, type Level } from "@/lib/types";

/**
 * ประวัติเกมย้อนหลังสำหรับอันดับ/สรุปรายปี
 * แอดมินและโหมดทดลองมีครบอยู่แล้วใน state ผู้เล่นทั่วไปโหลดเพิ่มครั้งเดียว แล้วใช้เกมวันนี้จาก state ที่อัปเดตสด
 */
export function useHistory(from: string, skip = false): { data: Pick<State, "days" | "players"> | null; failed: boolean } {
  const { state, history, auth } = useStore();
  const full = auth.isAdmin || !auth.online || skip;
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
/** ชื่อไตรมาส เช่น ต.ค. - ธ.ค. 2569 */
export const quarterLabel = (q: string) => {
  const [a, , c] = quarterMonths(q);
  const short = (m: string, year?: boolean) =>
    new Date(m + "-01T00:00:00").toLocaleDateString(locale(), { month: "short", ...(year ? { year: "numeric" } : {}) });
  return `${short(a)} - ${short(c, true)}`;
};

/** ตารางอันดับรายเดือน (ทุกคนเห็น) */
export function RankingCard({ onYear }: { onYear?: () => void }) {
  const now = today().slice(0, 7);
  const [month, setMonth] = useState(now);
  const [all, setAll] = useState(false);
  const [me] = useMe();
  const { data, failed } = useHistory("2000-01-01");
  const rows = useMemo(() => (data ? monthRanking(data, month) : []), [data, month]);
  const { auth, state } = useStore();
  // ข้อมูลผู้เล่นล่าสุด (มีกรอบรูป) ทับข้อมูลจากประวัติ
  const byId = new Map([...(data?.players ?? []), ...state.players].map((p) => [p.id, p]));
  const mine = rows.findIndex((r) => r.id === me);
  const meP = byId.get(me ?? "");
  const quarter = quarterOf(now);
  const myRec = useMemo(() => (data && meP ? periodRecord(data.days, quarterMonths(quarter)).get(meP.id) : undefined), [data, meP, quarter]);
  // ต้นรอบใหม่ (เดือนแรกของไตรมาส) แสดงผลรอบที่แล้วในเดือนปัจจุบันด้วย ผู้เล่นจะได้รู้ว่าเข้าเกณฑ์แล้ว รอยืนยัน
  const lastQ = prevQuarter(quarter);
  const showPromotion = lastQ >= FIRST_QUARTER && (quarterOf(month) === lastQ || (month === now && Number(now.slice(5)) % 3 === 1));
  const myNext = meP ? nextLevel(meP.level) : null;
  const shown = all ? rows : rows.slice(0, 10);
  const img = useShareImage();
  const shareImg = () =>
    img.share(
      () =>
        rankingImage({
          club: appName().join(" "),
          title: t("ตารางอันดับ"),
          month: monthLabel(month),
          rows: shown.map((r, i) => {
            const p = byId.get(r.id);
            return { rank: i + 1, name: p?.name ?? "?", photo: p?.photo, record: t("ชนะ {w}/{g}", { w: r.wins, g: r.games }), delta: r.delta, me: r.id === me };
          }),
          note: t("แต้มขึ้นลงตามผลแพ้ชนะ ชนะทีมเก่งกว่าได้แต้มมากกว่า"),
          podiumNote: month === now ? t("3 อันดับแรก · แต้มที่ได้เดือนนี้") : t("3 อันดับแรก · แต้มที่ได้ในเดือนนั้น"),
        }),
      `ranking-${month}.png`,
    );

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
          {month === now && meP && myNext !== null && !meP.guestOf && !meP.pending && (
            <PromotionProgress rec={myRec ?? { games: 0, decided: 0, wins: 0 }} next={myNext} quarter={quarter} />
          )}
          <Podium rows={rows.slice(0, 3)} byId={byId} current={month === now} />
          <ol className="divide-y divide-zinc-100">
            {shown.map((r, i) => {
              const p = byId.get(r.id);
              return (
                <li key={r.id} className={`flex items-center gap-2.5 py-2 ${r.id === me ? "font-semibold" : ""}`}>
                  <span className={`w-6 shrink-0 text-center font-display font-semibold tabular-nums ${i < 3 ? "text-amber-600" : "text-zinc-400"}`}>{i + 1}</span>
                  {p ? <FramedAvatar player={p} size={30} compact /> : <Avatar name="?" size={30} />}
                  <span className="min-w-0 flex-1 truncate">{p?.name ?? "?"}</span>
                  <span className="shrink-0 text-xs whitespace-nowrap text-zinc-500 tabular-nums">{t("ชนะ {w}/{g}", { w: r.wins, g: r.games })}</span>
                  <span className={`min-w-12 shrink-0 text-right font-semibold whitespace-nowrap tabular-nums ${r.delta >= 0 ? "text-emerald-700" : "text-red-600"}`}>
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
          <Button variant="accent" className="w-full" disabled={img.busy} onClick={shareImg}>
            {img.busy ? t("กำลังสร้างรูป...") : t("แชร์เป็นรูป")}
          </Button>
          {img.failed && <p className="text-center text-xs text-red-600">{t("สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง")}</p>}
          {img.overlay}
        </>
      )}
      {data && showPromotion && <PromotionList quarter={lastQ} data={data} admin={auth.isAdmin || !auth.online} />}
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

/** กราฟแท่ง 3 อันดับแรก (แท่งกลางคืออันดับ 1) สูงตามแต้มที่ได้เดือนนี้ */
function Podium({ rows, byId, current }: { rows: RankRow[]; byId: Map<string, Player>; current: boolean }) {
  if (rows.length === 0) return null;
  const top = Math.max(1, ...rows.map((r) => Math.max(0, r.delta)));
  // แท่งสูง 48-104px ตามแต้ม แท่งเตี้ยสุดยังใส่เหรียญกับแต้มได้ แม้แต้มติดลบหรือเป็นศูนย์
  const height = (r: RankRow) => 48 + Math.round((Math.max(0, r.delta) / top) * 56);
  const order = [1, 0, 2].filter((i) => i < rows.length);
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <figure className="rounded-2xl bg-zinc-50 px-2 pt-3 pb-2" aria-label={t("3 อันดับแรก")}>
      <div className="flex items-end justify-center gap-3">
        {order.map((i) => {
          const r = rows[i];
          const p = byId.get(r.id);
          return (
            <div key={r.id} className="flex w-1/4 min-w-0 flex-col items-center justify-end gap-1">
              {p ? <FramedAvatar player={p} size={i === 0 ? 40 : 32} compact ring /> : <Avatar name="?" size={i === 0 ? 40 : 32} ring />}
              <span className="w-full truncate text-center text-xs font-semibold">{p?.name ?? "?"}</span>
              <div
                className={`flex w-full flex-col items-center justify-start rounded-t-lg pt-1 ${i === 0 ? "bg-lime" : "bg-lime/40"}`}
                style={{ height: height(r) }}
              >
                <span aria-hidden>{medal[i]}</span>
                <span className="text-xs font-bold text-ink tabular-nums">
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1 text-center text-xs text-zinc-500">{current ? t("3 อันดับแรก · แต้มที่ได้เดือนนี้") : t("3 อันดับแรก · แต้มที่ได้ในเดือนนั้น")}</figcaption>
    </figure>
  );
}

/** จำในเครื่องว่าเดือนนี้ยืนยันเลื่อนขั้นใครไปแล้ว (กันเสนอซ้ำหลังระดับเปลี่ยน) */
export function usePromoted(period: string) {
  const key = `badminton-kabinburi:promoted:${period}`;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    } catch {
      return [];
    }
  };
  const [ids, setIds] = useState<string[]>(read);
  const [k, setK] = useState(key);
  if (k !== key) {
    setK(key);
    setIds(read());
  }
  // หลายจุดในหน้าใช้รายการเดียวกัน (การ์ดต้องจัดการ + แผ่นเลื่อนขั้น) แจ้งกันเมื่อมีการยืนยัน
  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(key, sync);
    return () => window.removeEventListener(key, sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const add = (id: string) => {
    const next = [...new Set([...read(), id])];
    setIds(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ไม่จำก็ได้
    }
    window.dispatchEvent(new Event(key));
  };
  return [ids, add] as const;
}

/** คนที่เข้าเกณฑ์เลื่อนขั้นของเดือนที่จบแล้ว แอดมินกดยืนยันทีละคน */
export function PromotionList({ quarter, data: given, admin: isAdmin }: { quarter: string; data?: Pick<State, "days" | "players">; admin?: boolean }) {
  const { state, dispatch, auth } = useStore();
  const own = useHistory(`${quarterMonths(quarter)[0]}-01`, !!given);
  const data = given ?? own.data;
  const admin = isAdmin ?? (auth.isAdmin || !auth.online);
  const [done, markDone] = usePromoted(quarter);
  const list = useMemo(() => (data ? promotionCandidates({ players: data.players, days: data.days }, quarter) : []), [data, quarter]);
  if (!data) return <p className="text-sm text-zinc-500">{own.failed ? t("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง") : t("กำลังโหลด...")}</p>;
  // คนที่ยืนยันไปแล้ว ระดับปัจจุบันเปลี่ยนแล้ว ไม่ต้องเสนอขั้นถัดไปอีก
  const fresh = list.filter((c) => !done.includes(c.id));
  const doneIds = done.filter((id) => state.players.some((p) => p.id === id));
  const label = (l: Level) => `${t(LEVELS.find((x) => x.value === l)?.label ?? "")} (${levelCode(l)})`;
  if (!fresh.length && !doneIds.length) return given ? null : <p className="text-sm text-zinc-500">{t("รอบนี้ไม่มีใครเข้าเกณฑ์เลื่อนขั้น")}</p>;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  return (
    <section className="space-y-2 rounded-2xl bg-lime/30 p-3">
      <h4 className="font-semibold">⬆ {t("เข้าเกณฑ์เลื่อนขั้น {month}", { month: quarterLabel(quarter) })}</h4>
      <ul className="space-y-1.5">
        {fresh.map((c) => {
          const p = byId.get(c.id);
          if (!p) return null;
          return (
            <li key={c.id} className="flex items-center gap-2">
              <Avatar name={p.name} photo={p.photo} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-zinc-600">
                  <LevelBadge level={c.from} /> → <LevelBadge level={c.to} /> · {t("ชนะ {w}/{g} เกม · {r}%", { w: c.wins, g: c.decided, r: c.rate })}
                </span>
              </span>
              {admin && (
                <Button
                  variant="primary"
                  className="min-h-11 shrink-0 !px-3"
                  onClick={() => {
                    if (!confirm(t("เลื่อน {name} จาก {a} เป็น {b}?", { name: p.name, a: label(c.from), b: label(c.to) }))) return;
                    dispatch({ type: "updatePlayer", player: { ...p, level: c.to, levelRequest: undefined } });
                    markDone(p.id);
                  }}
                >
                  {t("เลื่อนขั้น")}
                </Button>
              )}
            </li>
          );
        })}
        {doneIds.map((id) => {
          const p = byId.get(id)!;
          return (
            <li key={id} className="flex items-center gap-2 text-sm text-zinc-600">
              <Avatar name={p.name} photo={p.photo} size={30} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="font-semibold text-emerald-700">✓ {t("เลื่อนเป็น {level} แล้ว", { level: levelCode(p.level) })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
