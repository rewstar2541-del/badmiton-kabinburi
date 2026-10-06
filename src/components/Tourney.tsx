"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import {
  bestOfFor,
  callable,
  confirmResult,
  divOpen,
  divTeams,
  draw,
  fillCourts,
  gameWinner,
  matchWinner,
  myNext,
  needsGame3,
  onCourt,
  pending,
  placings,
  roundsFor,
  setResult,
  simTick,
  finished,
  submitResult,
  teamName,
  validGame,
  type TMatch,
  type TTeam,
  type Tourney,
} from "@/lib/tourney";
import { useTourney } from "@/lib/tourneyStore";
import { resizeSlip } from "@/lib/image";
import { Hero } from "./Home";
import { PayQr } from "./PayQr";
import { useMe } from "./PickMe";
import { Button, Card, Icon, SectionTitle, Sheet, inputClass } from "./ui";

/* ---------- ส่วนที่ใช้ร่วมกัน ---------- */

function dayLabel(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

function Tag({ children, tone = "bg-zinc-100 text-zinc-700" }: { children: ReactNode; tone?: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{children}</span>;
}

function Seg<T extends string>({ value, items, onChange }: { value: T; items: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-zinc-200 p-0.5">
      {items.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`h-10 flex-1 rounded-full text-sm font-semibold ${v === value ? "bg-ink text-white" : "text-zinc-600"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function DivChips({ t: tr, value, onChange, dark }: { t: Tourney; value: string; onChange: (id: string) => void; dark?: boolean }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tr.divisions.map((d) => (
        <button
          key={d.id}
          onClick={() => onChange(d.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${d.id === value ? "bg-lime text-ink" : dark ? "bg-white/10 text-white" : "bg-white text-zinc-600"}`}
        >
          {t("มือ {c}", { c: d.code })}
        </button>
      ))}
    </div>
  );
}

const PAY_TONE = { yes: "bg-emerald-50 text-emerald-700", slip: "bg-amber-100 text-amber-800", no: "bg-red-50 text-red-600" };
const PAY_LABEL = { yes: "จ่ายแล้ว", slip: "รอตรวจสลิป", no: "ยังไม่จ่าย" };

function divOf(tr: Tourney, id: string) {
  return tr.divisions.find((d) => d.id === id)!;
}

function bracketRounds(tr: Tourney, m: TMatch) {
  return roundsFor(tr.matches.filter((x) => x.divId === m.divId && x.bracket === m.bracket && x.round === 0).length * 2);
}

function boOf(tr: Tourney, m: TMatch) {
  return bestOfFor(divOf(tr, m.divId), m, bracketRounds(tr, m));
}

function stageLabel(tr: Tourney, m: TMatch) {
  if (m.bracket === "R1") return t("รอบแรก");
  const total = bracketRounds(tr, m);
  const side = m.bracket === "U" ? t("สายบน") : t("สายล่าง");
  const left = total - m.round;
  const r = left === 1 ? t("ชิง") : left === 2 ? t("รอบรอง") : t("รอบ {n} คู่", { n: 2 ** left });
  return `${side} · ${r}`;
}

function scoreText(m: TMatch) {
  return m.games.map((g) => g.join("-")).join(" · ");
}

/** QR ของลิงก์ (หน้าผู้ชม / หน้าสมัคร) พร้อมปุ่มคัดลอก */
function LinkQr({ url, title, sub }: { url: string; title: string; sub: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="space-y-3">
      <div className="grid place-items-center gap-1 rounded-3xl bg-white p-4 text-center text-ink ring-1 ring-zinc-200">
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="text-sm text-zinc-500">{sub}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="QR" width={240} height={240} /> : <div className="size-60 animate-pulse rounded-xl bg-zinc-100" />}
      </div>
      <p className="text-center text-sm text-zinc-500">{t("กดค้างที่รูปเพื่อบันทึก แล้วปริ้นท์ติดสนามหรือใส่โปสเตอร์")}</p>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? t("คัดลอกแล้ว") : t("คัดลอกลิงก์")}
      </Button>
    </div>
  );
}

function siteUrl(param: string) {
  const u = new URL(location.href);
  const demo = u.searchParams.has("demo");
  u.search = param ? (demo ? `?demo&${param}` : `?${param}`) : demo ? "?demo" : "";
  u.hash = "";
  return u.toString();
}

/* ---------- สายแข่งแบบกล่องมีเส้น ---------- */

export function BracketView({ t: tr, divId, bracket, dark, w = 150 }: { t: Tourney; divId: string; bracket: "U" | "L"; dark?: boolean; w?: number }) {
  const ms = tr.matches.filter((m) => m.divId === divId && m.bracket === bracket);
  if (ms.length === 0)
    return <p className={`py-6 text-center text-sm ${dark ? "text-white/60" : "text-zinc-500"}`}>{t("สายนี้จะขึ้นหลังรอบแรกจบครบ")}</p>;
  const rounds = Math.max(...ms.map((m) => m.round)) + 1;
  const first = ms.filter((m) => m.round === 0).length;
  const slot = 64;
  const gap = 30;
  const bh = 52;
  const top = 24;
  const H = first * slot + top;
  const W = rounds * (w + gap) - gap;
  const cy = (r: number, i: number) => top + (i + 0.5) * slot * 2 ** r;
  const line = dark ? "rgba(255,255,255,.35)" : "#cbd5e1";
  const title = (r: number) => {
    const left = rounds - r;
    return left === 1 ? t("ชิงที่ 1-2") : left === 2 ? t("รอบรอง") : t("รอบ {n} คู่", { n: 2 ** left });
  };
  const p = placings(tr, divId, bracket);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: W, height: H }}>
          <svg className="absolute inset-0" width={W} height={H} aria-hidden>
            {ms
              .filter((m) => m.round > 0)
              .flatMap((m) =>
                [0, 1].map((k) => {
                  const x1 = (m.round - 1) * (w + gap) + w;
                  return (
                    <path
                      key={`${m.id}${k}`}
                      d={`M${x1} ${cy(m.round - 1, m.slot * 2 + k)} H${x1 + gap / 2} V${cy(m.round, m.slot)} H${x1 + gap}`}
                      fill="none"
                      stroke={line}
                      strokeWidth={2}
                    />
                  );
                }),
              )}
          </svg>
          {Array.from({ length: rounds }, (_, r) => (
            <div key={r} className={`absolute text-xs font-semibold ${dark ? "text-white/60" : "text-zinc-500"}`} style={{ left: r * (w + gap), top: 0 }}>
              {title(r)}
            </div>
          ))}
          {ms.map((m) => {
            const live = !!m.court && !m.winner;
            return (
              <div
                key={m.id}
                className={`absolute overflow-hidden rounded-xl text-[13px] ${dark ? "bg-white/10" : "bg-white shadow-sm ring-1 ring-zinc-200"} ${live ? "ring-2 ring-lime" : ""}`}
                style={{ left: m.round * (w + gap), top: cy(m.round, m.slot) - bh / 2, width: w, height: bh }}
              >
                {[m.a, m.b].map((tid, k) => {
                  const win = !!m.winner && m.winner === tid;
                  const lost = !!m.winner && !win;
                  const won = m.games.filter((g) => gameWinner(g) === k).length;
                  return (
                    <div
                      key={k}
                      className={`flex h-[26px] items-center justify-between gap-1 px-2 ${k === 0 ? (dark ? "border-b border-white/10" : "border-b border-zinc-100") : ""} ${win ? "font-bold" : lost ? "opacity-45" : ""}`}
                    >
                      <span className="truncate">{tid ? teamName(tr, tid) : m.bye && k === 1 ? t("บาย") : "-"}</span>
                      <span className={`tabular-nums ${win ? (dark ? "text-lime" : "text-emerald-700") : ""}`}>{m.games.length ? won : live ? "•" : ""}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {p.first && (
        <div className={`flex flex-wrap gap-1.5 text-sm ${dark ? "text-white" : ""}`}>
          <Tag tone="bg-amber-200 text-amber-900">🥇 {teamName(tr, p.first)}</Tag>
          {p.second && <Tag tone="bg-zinc-200 text-zinc-800">🥈 {teamName(tr, p.second)}</Tag>}
          {p.third.map((x) => (
            <Tag key={x} tone="bg-orange-100 text-orange-800">
              🥉 {teamName(tr, x)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

/** ตารางแข่งรวมสกอร์: กำลังเล่น > รอคิว > จบแล้ว */
function MatchList({ t: tr, divId, dark, mine, only }: { t: Tourney; divId?: string; dark?: boolean; mine?: string; only?: "done" | "queue" }) {
  const rank = (m: TMatch) => (m.court && !m.winner ? 0 : !m.winner ? 1 : 2);
  const ms = tr.matches
    .filter((m) => (!divId || m.divId === divId) && !m.bye && (m.a || m.b))
    .filter((m) => (only === "done" ? !!m.winner : only === "queue" ? !m.winner && !m.court : true))
    .sort((x, y) => rank(x) - rank(y) || (x.no ?? 999) - (y.no ?? 999));
  const sub = dark ? "text-white/60" : "text-zinc-500";
  if (ms.length === 0)
    return <p className={`py-6 text-center text-sm ${sub}`}>{only === "done" ? t("ยังไม่มีผล") : only === "queue" ? t("ยังไม่มีแมตช์ที่รอแข่ง") : t("ยังไม่ได้จับสลาก")}</p>;
  return (
    <ul className="space-y-2">
      {ms.map((m) => {
        const live = m.court && !m.winner;
        const me = mine && (m.a === mine || m.b === mine);
        return (
          <li key={m.id} className={`flex items-center gap-3 rounded-2xl p-3 ${dark ? "bg-white/10" : me ? "bg-lime/30" : "bg-zinc-50"} ${live ? "ring-2 ring-lime" : ""}`}>
            <span className="w-16 shrink-0 text-sm">
              <span className="block font-semibold">{m.no ? t("แมตช์ {n}", { n: m.no }) : t("รอคิว")}</span>
              <span className={sub}>{live ? t("สนาม {n}", { n: m.court! }) : stageLabel(tr, m).split(" · ")[0]}</span>
            </span>
            <span className="min-w-0 flex-1 space-y-0.5 text-[15px]">
              {[m.a, m.b].map((tid, k) => (
                <span key={k} className={`flex justify-between gap-2 ${m.winner ? (m.winner === tid ? "font-bold" : "opacity-45") : ""}`}>
                  <span className="truncate">{tid ? teamName(tr, tid) : t("รอผล")}</span>
                  <span className="shrink-0 tabular-nums">{m.games.map((g) => g[k]).join("  ")}</span>
                </span>
              ))}
            </span>
            {live && <span className="shrink-0 text-xs font-semibold text-emerald-500">{t("กำลังเล่น")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Brackets({ t: tr, dark, initialDiv, mine }: { t: Tourney; dark?: boolean; initialDiv?: string; mine?: string }) {
  const [div, setDiv] = useState(initialDiv ?? tr.divisions[0]?.id);
  const [side, setSide] = useState<"R1" | "U" | "L">("R1");
  if (!div) return null;
  const segItems: ["R1" | "U" | "L", string][] = [
    ["R1", t("ผลแข่ง")],
    ["U", t("สายบน")],
    ["L", t("สายล่าง")],
  ];
  return (
    <div className="space-y-3">
      <DivChips t={tr} value={div} onChange={setDiv} dark={dark} />
      <div className={dark ? "[&_.bg-zinc-200]:bg-white/10 [&_.text-zinc-600]:text-white/70" : ""}>
        <Seg value={side} items={segItems} onChange={setSide} />
      </div>
      {side === "R1" ? <MatchList t={tr} divId={div} dark={dark} mine={mine} only="done" /> : <BracketView t={tr} divId={div} bracket={side} dark={dark} />}
      <p className={`text-sm ${dark ? "text-white/60" : "text-zinc-500"}`}>{t("ชนะรอบแรกไปสายบน แพ้ไปสายล่าง · แพ้ในสาย = ตกรอบ · แพ้รอบรองได้ที่ 3 ร่วม")}</p>
    </div>
  );
}

/** ตารางแข่ง: กำลังเล่น + คิวถัดไป */
function Schedule({ t: tr, mine, dark, limit = 12 }: { t: Tourney; mine?: string; dark?: boolean; limit?: number }) {
  const list = pending(tr).slice(0, limit);
  if (list.length === 0) return <p className={`py-4 text-center text-sm ${dark ? "text-white/60" : "text-zinc-500"}`}>{t("ยังไม่มีแมตช์ที่รอแข่ง")}</p>;
  return (
    <ul className={`divide-y ${dark ? "divide-white/10" : "divide-zinc-100"}`}>
      {list.map((m) => {
        const me = mine && (m.a === mine || m.b === mine);
        return (
          <li key={m.id} className={`flex items-center gap-3 py-2.5 ${me ? (dark ? "" : "-mx-2 rounded-2xl bg-lime/30 px-2") : ""}`}>
            <span className="w-16 shrink-0 text-sm">
              <span className="block font-semibold">{m.no ? t("แมตช์ {n}", { n: m.no }) : t("รอคิว")}</span>
              <span className={dark ? "text-white/60" : "text-zinc-500"}>{m.court ? t("สนาม {n}", { n: m.court }) : stageLabel(tr, m).split(" · ")[0]}</span>
            </span>
            <span className="min-w-0 flex-1 text-[15px]">
              <span className="block truncate font-semibold">{teamName(tr, m.a)}</span>
              <span className="block truncate">{t("พบ {x}", { x: teamName(tr, m.b) })}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${dark ? "bg-white/10 text-lime" : "bg-zinc-100"}`}>{divOf(tr, m.divId).code}</span>
              {m.court && <span className="text-xs font-semibold text-emerald-500">{t("กำลังเล่น")}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** สนามทั้งหมด: ใครเจอใคร แต้มสด */
function CourtsGrid({ t: tr, onPick }: { t: Tourney; cols?: number; onPick?: (m: TMatch) => void }) {
  const on = onCourt(tr);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: tr.courts }, (_, i) => i + 1).map((c) => {
        const m = on.find((x) => x.court === c);
        const Box = onPick && m ? "button" : "div";
        const cur = m ? (m.games.length ? m.games[m.games.length - 1] : [0, 0]) : null;
        return (
          <Card key={c} className="text-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">
                {t("สนาม {n}", { n: c })}
                {m && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold">{divOf(tr, m.divId).code}</span>}
              </h3>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                <span className={`size-1.5 rounded-full ${m ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
                {m ? (m.no ? t("แมตช์ {n}", { n: m.no }) : t("กำลังเล่น")) : t("ว่าง")}
              </span>
            </div>
            {m && cur ? (
              <Box onClick={onPick ? () => onPick(m) : undefined} className="court-surface flex w-full gap-1 rounded-2xl px-2 text-left">
                {[m.a, m.b].map((tid, k) => (
                  <div key={k} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 py-3 text-white">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k === 0 ? "bg-lime text-ink" : "bg-sky-300 text-ink"}`}>{teamName(tr, tid)}</span>
                    <span className="font-display text-4xl font-bold tabular-nums">{cur[k]}</span>
                    <span className="text-xs text-white/70 tabular-nums">{t("เกม {n}", { n: Math.max(1, m.games.length) })}</span>
                  </div>
                ))}
              </Box>
            ) : (
              <div className="court-surface flex h-24 items-center justify-center rounded-2xl text-sm font-semibold text-white/80">{t("ว่าง")}</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- กรอกผล ---------- */

function ScoreSheet({ t: tr, m, onClose, onSave, note }: { t: Tourney; m: TMatch; onClose: () => void; onSave: (g: [number, number][]) => void; note?: string }) {
  const bo = boOf(tr, m);
  const [vals, setVals] = useState<string[][]>(() => Array.from({ length: bo }, (_, i) => (m.games[i] ? m.games[i].map(String) : ["", ""])));
  const games = vals.map((v) => [Number(v[0]), Number(v[1])] as [number, number]).filter((_, i) => vals[i][0] !== "" && vals[i][1] !== "");
  const show = bo === 3 && !needsGame3(games) ? 2 : bo;
  const used = games.slice(0, show);
  const bad = used.some((g) => !validGame(g));
  const done = matchWinner(used, bo) !== null;
  return (
    <Sheet title={<h2 className="font-display text-xl font-semibold">{m.no ? t("กรอกผล แมตช์ {n}", { n: m.no }) : t("กรอกผล")}</h2>} onClose={onClose} keepOpen>
      <p className="text-sm text-zinc-500">
        {divOf(tr, m.divId).code} · {stageLabel(tr, m)} · {bo === 3 ? t("ชนะ 2 ใน 3 เกม") : t("เกมเดียว")}
      </p>
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: `1fr repeat(${show}, 4rem)` }}>
        <span />
        {Array.from({ length: show }, (_, i) => (
          <span key={i} className="text-center text-sm font-semibold text-zinc-500">
            {t("เกม {n}", { n: i + 1 })}
          </span>
        ))}
        {[m.a, m.b].map((tid, k) => (
          <FragmentRow key={k}>
            <span className="min-w-0 truncate font-semibold">{teamName(tr, tid)}</span>
            {Array.from({ length: show }, (_, i) => (
              <input
                key={i}
                inputMode="numeric"
                aria-label={`${teamName(tr, tid)} ${t("เกม {n}", { n: i + 1 })}`}
                value={vals[i][k]}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setVals((old) => old.map((row, j) => (j === i ? (k === 0 ? [v, row[1]] : [row[0], v]) : row)));
                }}
                className="h-14 w-16 rounded-2xl bg-zinc-100 text-center font-display text-2xl font-semibold outline-none focus:ring-2 focus:ring-lime-dark"
              />
            ))}
          </FragmentRow>
        ))}
      </div>
      {bo === 3 && show === 2 && <p className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">{t("ชนะ 2 เกมแล้ว เกม 3 ไม่ต้องกรอก")}</p>}
      {bad && <p className="text-sm text-red-600">{t("แต้มไม่ถูกต้อง: เกมจบที่ 21 ถ้า 20-20 ต้องนำ 2 สูงสุด 30")}</p>}
      {note && <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-800">{note}</p>}
      <Button variant="primary" className="w-full py-4 text-base" disabled={bad || !done} onClick={() => onSave(used)}>
        {t("ส่งผล")}
      </Button>
    </Sheet>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ---------- หน้าผู้เล่น ---------- */

function useMyTeam(tr: Tourney | null): TTeam | undefined {
  const { state } = useStore();
  const [me] = useMe();
  const name = state.players.find((p) => p.id === me)?.name;
  return useMemo(() => {
    if (!tr || !me) return undefined;
    return tr.teams.find((x) => x.playerIds.includes(me)) ?? (name ? tr.teams.find((x) => x.names.includes(name)) : undefined);
  }, [tr, me, name]);
}

function myIndex(team: TTeam, me: string | null, name?: string): 0 | 1 {
  if (me && team.playerIds[1] === me) return 1;
  if (name && team.names[1] === name) return 1;
  return 0;
}

function PosterHero({ t: tr }: { t: Tourney }) {
  const days = [...new Set(tr.divisions.map((d) => d.date))].sort();
  const pairs = tr.teams.length;
  return (
    <Hero
      icon={Icon.Trophy}
      label={t("งานแข่ง · {d}", { d: days.map(dayLabel).join(", ") })}
      big={tr.name}
      sub={t("ประเภทคู่ · {n} บาท/คู่ รวมค่าลูก", { n: tr.fee })}
      chips={[t("สมัครแล้ว {n} คู่", { n: pairs }), t("{n} มือ", { n: tr.divisions.length }), t("ปิดรับ {d}", { d: dayLabel(tr.closeDate) })]}
    />
  );
}

function DivisionGrid({ t: tr, highlight }: { t: Tourney; highlight?: string }) {
  const days = [...new Set(tr.divisions.map((d) => d.date))].sort();
  return (
    <Card>
      <SectionTitle right={t("ขั้นต่ำ {n} คู่/มือ", { n: tr.divisions[0]?.minPairs ?? 4 })}>{t("วันแข่ง และมือ")}</SectionTitle>
      <div className="mt-2 space-y-3">
        {days.map((d) => (
          <div key={d}>
            <div className="mb-1.5 text-sm font-semibold text-zinc-500">{dayLabel(d)}</div>
            <div className="grid grid-cols-3 gap-2">
              {tr.divisions
                .filter((x) => x.date === d)
                .map((x) => {
                  const n = divTeams(tr, x.id).length;
                  const full = n >= x.maxPairs;
                  return (
                    <div key={x.id} className={`rounded-2xl px-3 py-2 ${x.id === highlight ? "bg-lime/30" : "bg-zinc-50"}`}>
                      <div className="font-display text-lg font-semibold">{x.code}</div>
                      <div className={`text-sm ${full ? "text-red-600" : n < x.minPairs ? "text-amber-700" : "text-zinc-600"}`}>
                        {full ? t("เต็มแล้ว") : t("{n}/{m} คู่", { n, m: x.maxPairs })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-zinc-500">{t("มือไหนไม่ถึงขั้นต่ำตอนปิดรับ จะไม่เปิดแข่ง")}</p>
    </Card>
  );
}

function SignupSheet({ t: tr, onClose, onDone }: { t: Tourney; onClose: () => void; onDone: (team: TTeam) => void }) {
  const { state } = useStore();
  const [me] = useMe();
  const myName = state.players.find((p) => p.id === me)?.name ?? "";
  const [div, setDiv] = useState<string>(() => tr.divisions.find((d) => divTeams(tr, d.id).length < d.maxPairs && !d.drawn)?.id ?? "");
  const [name, setName] = useState(myName);
  const [q, setQ] = useState("");
  const [partner, setPartner] = useState<{ id?: string; name: string } | null>(null);
  const hits = q.trim()
    ? state.players.filter((p) => p.id !== me && !p.pending && p.name.includes(q.trim())).slice(0, 5)
    : [];
  const d = tr.divisions.find((x) => x.id === div);
  const ok = !!d && !!partner && name.trim() !== "" && partner.name !== name.trim();
  return (
    <Sheet title={<h2 className="font-display text-xl font-semibold">{t("สมัครแข่ง")}</h2>} onClose={onClose} keepOpen>
      <div className="text-sm font-semibold text-zinc-600">{t("มือที่ลง")}</div>
      <div className="flex flex-wrap gap-1.5">
        {tr.divisions.map((x) => {
          const full = divTeams(tr, x.id).length >= x.maxPairs || !!x.drawn;
          return (
            <button
              key={x.id}
              disabled={full}
              onClick={() => setDiv(x.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${x.id === div ? "bg-ink text-white" : full ? "bg-zinc-100 text-zinc-300 line-through" : "bg-zinc-100"}`}
            >
              {x.code}
            </button>
          );
        })}
      </div>
      {d && (
        <p className="text-sm text-zinc-500">
          {t("มือ {c} · {d} · เหลือ {n} คู่", { c: d.code, d: dayLabel(d.date), n: d.maxPairs - divTeams(tr, d.id).length })}
        </p>
      )}
      {!me && (
        <>
          <div className="text-sm font-semibold text-zinc-600">{t("ชื่อของคุณ")}</div>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ชื่อเล่น")} />
        </>
      )}
      <div className="text-sm font-semibold text-zinc-600">{t("คู่ของคุณ (ต้องเป็นมือเดียวกัน)")}</div>
      {partner ? (
        <div className="flex items-center gap-3 rounded-2xl bg-lime/30 px-3 py-2">
          <span className="flex-1 font-semibold">{partner.name}</span>
          {!partner.id && <Tag tone="bg-amber-100 text-amber-800">{t("รับเชิญ")}</Tag>}
          <button onClick={() => setPartner(null)} className="grid size-9 place-items-center rounded-full bg-white" aria-label={t("เปลี่ยน")}>
            <Icon.X width={16} height={16} />
          </button>
        </div>
      ) : (
        <>
          <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("พิมพ์ชื่อเล่นคู่ของคุณ")} />
          {hits.map((p) => (
            <button key={p.id} onClick={() => setPartner({ id: p.id, name: p.name })} className="flex w-full items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2 text-left">
              <span className="flex-1 font-semibold">{p.name}</span>
              <Icon.Plus width={18} height={18} />
            </button>
          ))}
          {q.trim() && (
            <button onClick={() => setPartner({ name: q.trim() })} className="w-full rounded-2xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
              {t("ใช้ชื่อ \"{n}\" เป็นคนนอกก๊วน (รับเชิญ)", { n: q.trim() })}
            </button>
          )}
        </>
      )}
      <p className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">{t("แอพไม่ย้ายมือและไม่เปลี่ยนคู่ให้ใคร")}</p>
      <Button
        variant="primary"
        className="w-full py-4 text-base"
        disabled={!ok}
        onClick={() => {
          if (!d || !partner) return;
          const team: TTeam = {
            id: crypto.randomUUID(),
            divId: d.id,
            names: [name.trim(), partner.name],
            playerIds: [me ?? undefined, partner.id],
            guest: !me || !partner.id,
            pay: "no",
            here: [false, false],
          };
          onDone(team);
        }}
      >
        {t("สมัคร แล้วไปจ่ายเงิน · {n} บาท", { n: tr.fee })}
      </Button>
    </Sheet>
  );
}

function PaySheet({ t: tr, team, onClose, onPaid }: { t: Tourney; team: TTeam; onClose: () => void; onPaid: (slip: string) => void }) {
  const { state } = useStore();
  const [slip, setSlip] = useState<string | null>(null);
  return (
    <Sheet title={<h2 className="font-display text-xl font-semibold">{t("ค่าสมัคร มือ {c}", { c: divOf(tr, team.divId).code })}</h2>} onClose={onClose}>
      <p className="text-[15px] text-zinc-600">{t("{a} & {b} · {n} บาท/คู่ รวมค่าลูกแล้ว", { a: team.names[0], b: team.names[1], n: tr.fee })}</p>
      <PayQr promptPayId={state.settings.promptPayId} amount={tr.fee} />
      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold">
        <Icon.Camera width={20} height={20} />
        {slip ? t("แนบสลิปแล้ว") : t("แนบสลิป")}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {slip && <img src={slip} alt="" className="size-10 rounded-lg object-cover" />}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setSlip(await resizeSlip(f, 900));
          }}
        />
      </label>
      <Button variant="primary" className="w-full py-4 text-base" disabled={!slip} onClick={() => slip && onPaid(slip)}>
        {t("จ่ายแล้ว")}
      </Button>
      <p className="text-sm text-zinc-500">{t("แอดมินตรวจสลิปแล้ว ทีมจะได้เข้าจับสลาก")}</p>
    </Sheet>
  );
}

function MyTeamCard({ t: tr, team, update }: { t: Tourney; team: TTeam; update: (fn: (t: Tourney) => Tourney) => void }) {
  const { state } = useStore();
  const [me] = useMe();
  const name = state.players.find((p) => p.id === me)?.name;
  const idx = myIndex(team, me, name);
  const [sheet, setSheet] = useState<"pay" | "score" | null>(null);
  const div = divOf(tr, team.divId);
  const { match, ahead } = myNext(tr, team.id);
  const opp = match ? (match.a === team.id ? match.b : match.a) : undefined;
  const waitingMe = match?.pendingBy && match.pendingBy !== team.id;
  const partnerHere = team.here[idx === 0 ? 1 : 0];
  const setHere = () => update((x) => ({ ...x, teams: x.teams.map((y) => (y.id === team.id ? { ...y, here: (idx === 0 ? [true, y.here[1]] : [y.here[0], true]) as [boolean, boolean] } : y)) }));
  const eliminated = !match && tr.matches.some((m) => (m.a === team.id || m.b === team.id) && m.winner && m.winner !== team.id && m.bracket !== "R1");
  return (
    <div className="space-y-3">
      {div.drawn && !team.here[idx] && (
        <Button variant="accent" className="flex w-full items-center justify-center gap-2 py-4 text-base" onClick={setHere}>
          <Icon.CheckIn width={22} height={22} />
          {t("มาถึงแล้ว")}
        </Button>
      )}
      <div className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-lime">
          <Icon.Trophy width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white/70">{t("ทีมของคุณ · มือ {c}", { c: div.code })}</div>
          <div className="truncate font-semibold">
            {team.names[0]} & {team.names[1]}
          </div>
          {match ? (
            <div className="text-sm text-lime">
              {match.court
                ? t("ลงสนาม {c} ตอนนี้ · พบ {x}", { c: match.court, x: teamName(tr, opp) })
                : t("อีก {n} แมตช์ · พบ {x}", { n: ahead, x: teamName(tr, opp) })}
            </div>
          ) : (
            div.drawn && <div className="text-sm text-white/70">{eliminated ? t("จบการแข่งขันแล้ว ขอบคุณครับ") : t("รอคู่แข่งจากรอบก่อน")}</div>
          )}
          {div.drawn && team.here[idx] && !partnerHere && <div className="text-sm text-white/70">{t("{n} ยังไม่กดมาถึง", { n: team.names[idx === 0 ? 1 : 0] })}</div>}
        </div>
        {team.pay !== "yes" && <Tag tone={PAY_TONE[team.pay]}>{t(PAY_LABEL[team.pay])}</Tag>}
      </div>
      {team.pay === "no" && (
        <Button variant="primary" className="w-full" onClick={() => setSheet("pay")}>
          {t("จ่ายค่าสมัคร {n} บาท", { n: tr.fee })}
        </Button>
      )}
      {match?.court && !match.pendingBy && (
        <Button variant="primary" className="w-full" onClick={() => setSheet("score")}>
          {t("กรอกผล (ถ้าไม่มีกรรมการ)")}
        </Button>
      )}
      {match?.pendingBy === team.id && !match.disputed && <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-800">{t("ส่งผลแล้ว รอคู่แข่งยืนยัน")}</p>}
      {match?.disputed && <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ผลไม่ตรงกัน แอดมินกำลังตัดสิน")}</p>}
      {waitingMe && !match?.disputed && (
        <Card className="space-y-2">
          <div className="font-semibold">{t("ยืนยันผล: {s}", { s: scoreText(match!) })}</div>
          <div className="text-sm text-zinc-500">{t("{x} ส่งผลมา ตรงไหม", { x: teamName(tr, match!.pendingBy) })}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => update((x) => confirmResult(x, match!.id, false))}>
              {t("ไม่ตรง")}
            </Button>
            <Button variant="accent" onClick={() => update((x) => fillCourts(confirmResult(x, match!.id, true)))}>
              {t("ถูกต้อง")}
            </Button>
          </div>
        </Card>
      )}
      {sheet === "pay" && (
        <PaySheet
          t={tr}
          team={team}
          onClose={() => setSheet(null)}
          onPaid={(img) => {
            update((x) => ({ ...x, teams: x.teams.map((y) => (y.id === team.id ? { ...y, pay: "slip", slip: img } : y)) }));
            setSheet(null);
          }}
        />
      )}
      {sheet === "score" && match && (
        <ScoreSheet
          t={tr}
          m={match}
          note={t("ส่งแล้ว คู่แข่งกดยืนยันผล ถ้าไม่ตรงกัน แอดมินตัดสิน")}
          onClose={() => setSheet(null)}
          onSave={(g) => {
            update((x) => submitResult(x, match.id, team.id, g));
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

/** แท็บ "งานแข่ง" ของผู้เล่น */
export function TourneyHome() {
  const { t: tr, update } = useTourney();
  const team = useMyTeam(tr);
  const [signup, setSignup] = useState(false);
  const [pay, setPay] = useState<TTeam | null>(null);
  const [me] = useMe();
  if (!tr) return null;
  const isRef = !!me && !!tr.referees?.includes(me);
  const anyDrawn = tr.divisions.some((d) => d.drawn);
  return (
    <div className="space-y-4">
      <PosterHero t={tr} />
      {team ? <MyTeamCard t={tr} team={team} update={update} /> : null}
      {!anyDrawn && <DivisionGrid t={tr} highlight={team?.divId} />}
      {!team && !anyDrawn && (
        <Button variant="accent" className="w-full py-4 text-base" onClick={() => setSignup(true)}>
          {t("สมัครแข่ง")}
        </Button>
      )}
      {isRef && (
        <a href={siteUrl("ref")} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
          {t("จอกรรมการ")}
        </a>
      )}
      {tr.mapUrl && (
        <a href={tr.mapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold">
          <Icon.Court width={18} height={18} />
          {t("แผนที่สนาม")}
        </a>
      )}
      {anyDrawn && (
        <Card>
          <Brackets t={tr} initialDiv={team?.divId} mine={team?.id} />
        </Card>
      )}
      {signup && (
        <SignupSheet
          t={tr}
          onClose={() => setSignup(false)}
          onDone={(x) => {
            update((y) => ({ ...y, teams: [...y.teams, x] }));
            setSignup(false);
            setPay(x);
          }}
        />
      )}
      {pay && (
        <PaySheet
          t={tr}
          team={pay}
          onClose={() => setPay(null)}
          onPaid={(img) => {
            update((y) => ({ ...y, teams: y.teams.map((z) => (z.id === pay.id ? { ...z, pay: "slip", slip: img } : z)) }));
            setPay(null);
          }}
        />
      )}
    </div>
  );
}

/** แถบประกาศรับสมัครแข่ง บนหน้าแรกของวันตีก๊วนปกติ */
export function TourneyBanner() {
  const { t: tr, mode, setMode } = useTourney();
  if (!tr || mode || tr.divisions.every((d) => d.drawn)) return null;
  return (
    <button onClick={() => setMode(true)} className="flex w-full items-center gap-3 rounded-3xl bg-amber-100 p-4 text-left text-amber-900">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-300 text-ink">
        <Icon.Trophy width={22} height={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t("เปิดรับสมัครแข่ง {n}", { n: tr.name })}</span>
        <span className="text-sm">{t("ปิดรับ {d} · แตะเพื่อสมัคร", { d: dayLabel(tr.closeDate) })}</span>
      </span>
      <Icon.ChevronRight width={20} height={20} />
    </button>
  );
}

/* ---------- หน้าแอดมิน ---------- */

export function TourneyAdmin({ section = "event" }: { section?: "event" | "courts" | "settings" }) {
  const { t: tr, update, reset, setMode } = useTourney();
  const { auth } = useStore();
  const [div, setDiv] = useState(() => tr?.divisions[0]?.id ?? "");
  const [scoreFor, setScoreFor] = useState<TMatch | null>(null);
  const [qr, setQr] = useState<"watch" | "join" | null>(null);
  const [slipView, setSlipView] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [refQ, setRefQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { state } = useStore();
  // จำลองวันแข่ง: เดินเกมทุก 1.5 วินาที เปิดหน้าผู้ชมอีกแท็บดูแต้มวิ่งได้
  useEffect(() => {
    // หยุดเดินระหว่างแอดมินเปิดหน้ากรอกผล กันผลถูกเขียนทับ
    if (!auto || scoreFor) return;
    const h = setInterval(() => {
      update((x) => {
        const y = finished(x) ? x : simTick(x);
        // ไม่มีอะไรขยับแล้ว (เช่น ไม่มีมือไหนจับสลากได้) หยุดเอง
        if (JSON.stringify(y.matches) === JSON.stringify(x.matches)) setAuto(false);
        return y;
      });
    }, 1500);
    return () => clearInterval(h);
  }, [auto, scoreFor, update]);
  if (!tr) return null;
  const d = tr.divisions.find((x) => x.id === div) ?? tr.divisions[0];
  const teams = divTeams(tr, d.id);
  const paid = teams.filter((x) => x.pay === "yes").length;
  const ready = teams.filter((x) => x.here[0] && x.here[1]).length;
  const disputes = tr.matches.filter((m) => m.disputed);
  const canCall = callable(tr).length > 0 && onCourt(tr).length < tr.courts;
  const setTeam = (id: string, fn: (x: TTeam) => TTeam) => update((y) => ({ ...y, teams: y.teams.map((z) => (z.id === id ? fn(z) : z)) }));
  return (
    <div className="space-y-4">
      {auth.demo && section === "event" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-300 px-3 py-2 text-sm text-ink">
          <span className="flex-1 font-semibold">{t("ทดลองงานแข่ง")}</span>
          <button className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold" onClick={() => setAuto(!auto)} disabled={finished(tr)}>
            {finished(tr) ? t("จบงานแล้ว") : auto ? t("⏸ หยุดจำลอง") : t("▶ จำลองวันแข่ง")}
          </button>
          <button className="min-h-11 rounded-full bg-ink/10 px-4 text-sm font-semibold" onClick={() => confirm(t("ล้างงานแข่งทดลองแล้วเริ่มใหม่?")) && reset()}>
            {t("เริ่มใหม่")}
          </button>
        </div>
      )}
      {section === "event" && <PosterHero t={tr} />}
      {section === "settings" && <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setQr("join")}>
          {t("QR สมัครแข่ง")}
        </Button>
        <Button variant="secondary" onClick={() => setQr("watch")}>
          {t("QR หน้าผู้ชม")}
        </Button>
      </div>}
      {section !== "settings" && disputes.length > 0 && (
        <Card className="space-y-2 ring-2 ring-amber-300">
          <SectionTitle>{t("ผลไม่ตรงกัน รอแอดมินตัดสิน")}</SectionTitle>
          {disputes.map((m) => (
            <button key={m.id} onClick={() => setScoreFor(m)} className="flex w-full items-center justify-between rounded-2xl bg-amber-50 px-3 py-2 text-left text-sm">
              <span className="min-w-0 truncate">
                {teamName(tr, m.a)} {t("พบ")} {teamName(tr, m.b)}
              </span>
              <span className="shrink-0 font-semibold">{scoreText(m)}</span>
            </button>
          ))}
        </Card>
      )}
      {section === "courts" && (
        <>
          <SectionTitle right={<a href={siteUrl("ref")} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 underline">{t("จอกรรมการ")}</a>}>{t("สนาม")}</SectionTitle>
          <CourtsGrid t={tr} onPick={setScoreFor} />
          <Button variant="accent" className="w-full" disabled={!canCall} onClick={() => update(fillCourts)}>
            {t("เรียกคู่ถัดไปลงสนามว่าง")}
          </Button>
          <p className="text-sm text-zinc-500">{t("เรียกเฉพาะคู่ที่มาครบ 2 คน · แตะสนามเพื่อกรอกผล")}</p>
          <Card>
            <SectionTitle>{t("คิวถัดไป")}</SectionTitle>
            <div className="mt-2">
              <MatchList t={tr} only="queue" />
            </div>
          </Card>
        </>
      )}
      {section === "settings" && <><Card className="space-y-2">
        <SectionTitle right={t("{n} คน", { n: (tr.referees ?? []).length })}>{t("กรรมการ")}</SectionTitle>
        <p className="text-sm text-zinc-500">{t("คนที่เลือกจะเห็นปุ่ม \"จอกรรมการ\" ในหน้างานแข่ง แอดมินเข้าได้ทุกคน")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(tr.referees ?? []).map((rid) => (
            <button
              key={rid}
              onClick={() => update((x) => ({ ...x, referees: (x.referees ?? []).filter((y) => y !== rid) }))}
              className="flex min-h-11 items-center gap-1 rounded-full bg-lime/40 px-3 text-sm font-semibold"
            >
              {state.players.find((p) => p.id === rid)?.name ?? "?"}
              <Icon.X width={14} height={14} />
            </button>
          ))}
        </div>
        <input className={inputClass} value={refQ} onChange={(e) => setRefQ(e.target.value)} placeholder={t("พิมพ์ชื่อเพื่อเพิ่มกรรมการ")} />
        {refQ.trim() &&
          state.players
            .filter((p) => !p.pending && p.name.toLowerCase().includes(refQ.trim().toLowerCase()) && !(tr.referees ?? []).includes(p.id))
            .slice(0, 5)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  update((x) => ({ ...x, referees: [...(x.referees ?? []), p.id] }));
                  setRefQ("");
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-zinc-50 px-3 text-left"
              >
                <span className="flex-1 font-semibold">{p.name}</span>
                <Icon.Plus width={18} height={18} />
              </button>
            ))}
      </Card>
      <DivChips t={tr} value={d.id} onChange={setDiv} />
      <Card>
        <SectionTitle right={t("จ่ายแล้ว {p}/{n} · มาครบ {r}", { p: paid, n: teams.length, r: ready })}>{t("มือ {c} · ทีม", { c: d.code })}</SectionTitle>
        {!divOpen(tr, d) && <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{t("ไม่ถึง {n} คู่ มือนี้ไม่เปิดแข่ง", { n: d.minPairs })}</p>}
        <ul className="mt-2 divide-y divide-zinc-100">
          {teams.filter((x) => showAll || x.pay !== "yes" || !x.here[0] || !x.here[1]).map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-1.5 py-1">
              {x.names.map((n, k) => (
                <button
                  key={k}
                  onClick={() => setTeam(x.id, (y) => ({ ...y, here: (k === 0 ? [!y.here[0], y.here[1]] : [y.here[0], !y.here[1]]) as [boolean, boolean] }))}
                  className={`flex min-h-10 items-center gap-1 rounded-full px-2.5 text-sm font-semibold ${x.here[k] ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                  aria-pressed={x.here[k]}
                >
                  {x.here[k] ? <Icon.Check width={14} height={14} /> : <Icon.X width={14} height={14} />}
                  {n}
                </button>
              ))}
              {x.guest && <Tag tone="bg-amber-100 text-amber-800">{t("รับเชิญ")}</Tag>}
              {x.slip && (
                <button onClick={() => setSlipView(x.slip!)} className="min-h-11 text-sm font-semibold text-sky-700 underline">
                  {t("ดูสลิป")}
                </button>
              )}
              <span className="flex-1" />
              <button
                onClick={() => setTeam(x.id, (y) => ({ ...y, pay: y.pay === "yes" ? "no" : "yes" }))}
                className={`min-h-10 rounded-full px-2.5 text-sm font-semibold ${PAY_TONE[x.pay]}`}
                disabled={!!d.drawn}
              >
                {t(PAY_LABEL[x.pay])}
              </button>
            </li>
          ))}
        </ul>
        {teams.length > 0 && (
          <button onClick={() => setShowAll(!showAll)} className="mt-1 min-h-11 w-full text-sm font-semibold text-emerald-700 underline">
            {showAll ? t("ซ่อนทีมที่พร้อมแล้ว") : t("ดูทั้งหมด {n} ทีม", { n: teams.length })}
          </button>
        )}
        {!d.drawn ? (
          <Button variant="accent" className="mt-3 w-full" disabled={!divOpen(tr, d) || paid < 2} onClick={() => update((x) => draw(x, d.id))}>
            {t("จับสลากมือ {c} ({n} ทีมที่จ่ายแล้ว)", { c: d.code, n: paid })}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">{t("จับสลากแล้ว · ทีมที่ยังไม่จ่ายไม่ได้เข้าแข่ง")}</p>
        )}
      </Card>
      <Button variant="ghost" className="w-full" onClick={() => setMode(false)}>
        {t("กลับไปโหมดก๊วนปกติ")}
      </Button></>}
      {section === "event" && (
        <Card>
          <Brackets t={tr} initialDiv={d.id} key={d.id} />
        </Card>
      )}
      {scoreFor && (
        <ScoreSheet
          t={tr}
          m={scoreFor}
          onClose={() => setScoreFor(null)}
          onSave={(g) => {
            update((x) => fillCourts(setResult(x, scoreFor.id, g)));
            setScoreFor(null);
          }}
        />
      )}
      {slipView && (
        <Sheet title={<h2 className="font-display text-xl font-semibold">{t("สลิป")}</h2>} onClose={() => setSlipView(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slipView} alt={t("สลิป")} className="w-full rounded-2xl" />
        </Sheet>
      )}
      {qr && (
        <Sheet title={<h2 className="font-display text-xl font-semibold">{qr === "watch" ? t("QR หน้าผู้ชม") : t("QR สมัครแข่ง")}</h2>} onClose={() => setQr(null)}>
          <LinkQr
            url={siteUrl(qr === "watch" ? "watch" : "join")}
            title={tr.name}
            sub={qr === "watch" ? t("สแกนดูผลสด ไม่ต้องลงแอพ") : t("สแกนเพื่อสมัครแข่ง คนนอกก๊วนสมัครได้")}
          />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- จอกรรมการ ---------- */

export function RefereeView() {
  const { t: tr, update } = useTourney();
  const [court, setCourt] = useState<number | null>(null);
  const [swap, setSwap] = useState(false);
  const [histAll, setHist] = useState<{ id: string; games: [number, number][] }[]>([]);
  const [ending, setEnding] = useState<[number, number][] | null>(null);
  const { auth } = useStore();
  const [me] = useMe();
  if (!tr) return <p className="p-6">{t("ยังไม่มีงานแข่ง")}</p>;
  const exit = (
    <a href={siteUrl("")} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold text-ink">
      ← {t("ออก")}
    </a>
  );
  if (!(auth.canAdmin ?? auth.isAdmin) && !(me && tr.referees?.includes(me)))
    return (
      <div className="min-h-dvh space-y-4 bg-ink p-4 text-white">
        {exit}
        <div className="font-display text-xl font-semibold">{t("จอกรรมการ")}</div>
        <p className="text-white/70">{t("เฉพาะกรรมการที่แอดมินเลือกไว้ ให้แอดมินเพิ่มชื่อคุณในหน้างานแข่ง")}</p>
      </div>
    );
  const m = court ? onCourt(tr).find((x) => x.court === court) : undefined;
  const pickCourt = (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: tr.courts }, (_, i) => i + 1).map((c) => {
        const x = onCourt(tr).find((y) => y.court === c);
        return (
          <button key={c} onClick={() => setCourt(c)} className={`bg-gradient-to-b from-emerald-600 to-emerald-800 flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl p-3 text-white ${c === court ? "ring-4 ring-lime" : ""}`}>
            <span className="rounded-full bg-lime px-3 py-0.5 text-sm font-bold text-ink">{t("สนาม {n}", { n: c })}</span>
            {x ? (
              <>
                <span className="w-full truncate text-center text-sm font-semibold">{teamName(tr, x.a)}</span>
                <span className="w-full truncate text-center text-sm font-semibold">{teamName(tr, x.b)}</span>
              </>
            ) : (
              <span className="text-sm text-white/80">{t("ว่าง")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
  if (!m)
    return (
      <div className="min-h-dvh space-y-4 bg-ink p-4 text-white">
        {exit}
        <div className="font-display text-xl font-semibold">{t("จอกรรมการ")}</div>
        <p className="text-sm text-white/60">{court ? t("สนามนี้ยังว่าง รอแอดมินเรียกคู่") : t("เลือกสนามที่ดูแล")}</p>
        {pickCourt}
      </div>
    );
  const hist = histAll.filter((h) => h.id === m.id);
  const bo = boOf(tr, m);
  const games = m.games.length ? m.games : [[0, 0] as [number, number]];
  const cur = games[games.length - 1];
  const won = [0, 1].map((k) => games.filter((g) => gameWinner(g) === k).length);
  const save = (next: [number, number][]) => {
    const w = matchWinner(next, bo);
    // แต้มสุดท้ายของแมตช์: ถามก่อน กันกดผิดแล้วเรียกคู่ต่อไปลงสนามทันที
    if (w !== null) return setEnding(next);
    setHist((h) => [...h.filter((x) => x.id === m.id), { id: m.id, games: m.games }]);
    update((x) => ({ ...x, matches: x.matches.map((y) => (y.id === m.id ? { ...y, games: next } : y)) }));
  };
  const add = (k: 0 | 1) => {
    const g: [number, number] = k === 0 ? [cur[0] + 1, cur[1]] : [cur[0], cur[1] + 1];
    const next = [...games.slice(0, -1), g];
    // เกมจบแต่แมตช์ยังไม่จบ เปิดเกมใหม่
    if (gameWinner(g) !== null && matchWinner(next, bo) === null) next.push([0, 0]);
    save(next);
  };
  const undo = () => {
    const prev = hist[hist.length - 1];
    if (!prev) return;
    setHist(hist.slice(0, -1));
    update((x) => ({ ...x, matches: x.matches.map((y) => (y.id === m.id ? { ...y, games: prev.games } : y)) }));
  };
  const sides: (0 | 1)[] = swap ? [1, 0] : [0, 1];
  if (ending) {
    const w = matchWinner(ending, bo);
    return (
      <div className="flex h-dvh flex-col justify-center gap-4 bg-ink p-6 text-center text-white">
        <div className="text-sm text-white/60">{t("จบแมตช์?")}</div>
        <div className="font-display text-3xl font-semibold">{t("{x} ชนะ", { x: teamName(tr, w === 0 ? m.a : m.b) })}</div>
        <div className="text-lg text-lime tabular-nums">{ending.map((g) => g.join("-")).join(" · ")}</div>
        <Button
          variant="accent"
          className="py-4 text-base"
          onClick={() => {
            update((x) => fillCourts(setResult(x, m.id, ending)));
            setEnding(null);
            setHist([]);
          }}
        >
          {t("ยืนยันผล")}
        </Button>
        <Button variant="secondary" className="py-4" onClick={() => setEnding(null)}>
          ↶ {t("ย้อน")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex h-dvh flex-col gap-3 bg-ink p-4 pt-[calc(env(safe-area-inset-top)+16px)] text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {exit}
        <button onClick={() => setCourt(null)} className="min-h-11 rounded-full bg-lime px-4 font-bold text-ink">
          {t("สนาม {n}", { n: m.court ?? 0 })} · {divOf(tr, m.divId).code} ▾
        </button>
        <span className="rounded-full bg-white px-3 py-2 font-semibold text-ink">
          {t("เกม {n}", { n: games.length })} · {bo === 3 ? t("ชนะ 2 ใน 3") : t("เกมเดียว")}
        </span>
      </div>
      {games.length > 1 && (
        <div className="flex gap-2 text-sm">
          {games.slice(0, -1).map((g, i) => (
            <span key={i} className="rounded-2xl bg-amber-300 px-3 py-2 font-semibold text-ink">
              {t("เกม {n}", { n: i + 1 })}: {g.join("-")}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-1 gap-3">
        {sides.map((k) => {
          const lead = cur[k] > cur[k === 0 ? 1 : 0];
          return (
            <button
              key={k}
              onClick={() => add(k)}
              className={`bg-gradient-to-b from-emerald-600 to-emerald-800 flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-3 text-white active:scale-[0.98] ${lead ? "ring-4 ring-lime" : ""}`}
            >
              <span className={`rounded-full px-3 py-1 text-center text-sm font-bold text-ink ${k === 0 ? "bg-lime" : "bg-sky-300"}`}>{teamName(tr, k === 0 ? m.a : m.b)}</span>
              <span className="rounded-full bg-black/25 px-3 py-0.5 text-sm">{t("ชนะ {n} เกม", { n: won[k] })}</span>
              <span className="font-display text-8xl font-bold tabular-nums drop-shadow">{cur[k]}</span>
              <span className="rounded-full bg-white px-7 py-3 text-2xl font-bold text-ink shadow">+1</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={undo} disabled={hist.length === 0} className="min-h-12 rounded-2xl bg-amber-300 py-3 font-semibold text-ink disabled:opacity-40">
          ↶ {t("ย้อน")}
        </button>
        <button onClick={() => setSwap(!swap)} className="min-h-12 rounded-2xl bg-white py-3 font-semibold text-ink">
          {t("สลับฝั่ง")}
        </button>
      </div>
      <p className="text-center text-sm text-white/60">{t("ถึง 21 จบเกมเอง · 20-20 ต้องนำ 2 (สูงสุด 30) · แต้มขึ้นหน้าผู้ชมทันที")}</p>
    </div>
  );
}

/* ---------- หน้าผู้ชม / จอทีวี ---------- */

export function WatchView() {
  const { t: tr } = useTourney();
  const [tab, setTab] = useState<"courts" | "sched" | "bracket">("courts");
  if (!tr) return <p className="p-6">{t("ยังไม่มีงานแข่ง")}</p>;
  const head = (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-2xl bg-lime text-ink">
        <Icon.Trophy width={24} height={24} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg font-semibold">{tr.name}</div>
        <div className="text-sm text-white/60">{t("หน้าผู้ชม · ไม่ต้องล็อกอิน")}</div>
      </div>
      {onCourt(tr).length > 0 && <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold">● {t("สด")}</span>}
    </div>
  );
  const tabs: ["courts" | "sched" | "bracket", string][] = [
    ["courts", t("สนาม")],
    ["sched", t("ตาราง")],
    ["bracket", t("สายแข่ง")],
  ];
  return (
    <div className="min-h-dvh bg-ink px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-10 text-white">
      {/* มือถือ: แท็บ / จอใหญ่ (ทีวี): เห็นทุกอย่างพร้อมกัน */}
      <div className="mx-auto max-w-md space-y-4 lg:hidden">
        {head}
        <div className="flex gap-1.5 text-sm">
          {tabs.map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`flex-1 rounded-full py-2 font-semibold ${tab === v ? "bg-lime text-ink" : "bg-white/10"}`}>
              {l}
            </button>
          ))}
        </div>
        {tab === "courts" && (
          <>
            <CourtsGrid t={tr} />
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-sm text-white/60">{t("คู่ต่อไป")}</div>
              <Schedule t={{ ...tr, matches: tr.matches.filter((m) => !m.court) }} dark limit={5} />
            </div>
          </>
        )}
        {tab === "sched" && (
          <div className="rounded-2xl bg-white/10 p-3">
            <Schedule t={tr} dark limit={40} />
          </div>
        )}
        {tab === "bracket" && <Brackets t={tr} dark />}
      </div>
      <div className="hidden gap-6 lg:grid lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {head}
          <CourtsGrid t={tr} cols={1} />
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-sm text-white/60">{t("คู่ต่อไป")}</div>
            <Schedule t={{ ...tr, matches: tr.matches.filter((m) => !m.court) }} dark limit={6} />
          </div>
        </div>
        <div className="min-w-0">
          <Brackets t={tr} dark />
        </div>
      </div>
    </div>
  );
}

/** แท็บสนามของผู้เล่นวันแข่ง */
export function TourneyCourts() {
  const { t: tr } = useTourney();
  const team = useMyTeam(tr);
  if (!tr) return null;
  return (
    <div className="space-y-4">
      <SectionTitle>{t("สนาม")}</SectionTitle>
      <CourtsGrid t={tr} />
      <Card>
        <SectionTitle>{t("คิวถัดไป")}</SectionTitle>
        <div className="mt-2">
          <MatchList t={tr} only="queue" mine={team?.id} />
        </div>
      </Card>
    </div>
  );
}
