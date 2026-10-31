"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { isAnnualMember, isMonthlyPaid, type Player } from "@/lib/types";
import { splitByHour, type Span } from "@/lib/courtSplit";
import { Avatar, Button, Sheet, baht, inputClass } from "./ui";

const KEY = "court-split";
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 06:00 - 24:00

type Config = { start: number; end: number; perHour: string };

function loadConfig(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (typeof c.start === "number" && typeof c.end === "number" && c.start >= 6 && c.end <= 24 && c.end > c.start)
      return { start: c.start, end: c.end, perHour: c.perHour ? String(c.perHour) : "" };
  } catch {}
  return { start: 19, end: 22, perHour: "" };
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** คิดเงิน > วันนี้: สนามเอกชนเช่ารายชั่วโมง คนมาไม่พร้อมกัน หารค่าสนามตามชั่วโมงที่อยู่จริง */
export function CourtSplit({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { day } = useToday();
  const [cfg, setCfg] = useState(loadConfig);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const people = day.checkIns
    .map((c) => ({ c, p: byId.get(c.playerId) }))
    .filter((x): x is { c: typeof x.c; p: Player } => Boolean(x.p));

  // ค่าเริ่มต้น: ชั่วโมงที่เช็คอิน อยู่ถึงเลิก
  const fit = (h: number) => Math.min(Math.max(h, cfg.start), cfg.end - 1);
  // เวลามา/กลับที่แก้ไว้ จำแยกตามวัน เปิดใหม่แล้วไม่หาย
  const spansKey = `${KEY}:${day.date}`;
  const [spans, setSpansRaw] = useState<Record<string, Span>>(() => {
    try {
      return JSON.parse(localStorage.getItem(spansKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const setSpans = (f: (m: Record<string, Span>) => Record<string, Span>) =>
    setSpansRaw((m) => {
      const next = f(m);
      localStorage.setItem(spansKey, JSON.stringify(next));
      return next;
    });
  const spanOf = (id: string, at: number): Span => (id in spans ? spans[id] : { from: fit(new Date(at).getHours()), to: cfg.end });
  const all = new Map(people.map(({ c }) => [c.playerId, spanOf(c.playerId, c.at)] as const));
  // ปรับช่วงให้อยู่ในเวลาเช่าเสมอ (เผื่อแก้เวลาเริ่ม/เลิกทีหลัง)
  for (const [id, s] of all) if (s) all.set(id, { from: fit(s.from), to: Math.max(fit(s.from) + 1, Math.min(s.to, cfg.end)) });

  const perHour = Number(cfg.perHour) || 0;
  const valid = perHour > 0 && cfg.end > cfg.start;
  const shares = valid ? splitByHour(all, cfg.start, cfg.end, perHour) : new Map<string, number>();
  const rent = perHour * Math.max(cfg.end - cfg.start, 0);
  const collected = [...shares.values()].reduce((a, b) => a + b, 0);
  const empty = valid && [...Array(cfg.end - cfg.start).keys()].some((i) => ![...all.values()].some((s) => s && s.from <= cfg.start + i && cfg.start + i < s.to));

  const set = (next: Partial<Config>) => {
    const c = { ...cfg, ...next };
    setCfg(c);
    localStorage.setItem(KEY, JSON.stringify({ start: c.start, end: c.end, perHour: Number(c.perHour) || 0 }));
  };
  const apply = () => {
    for (const { c } of people) {
      // จ่ายแล้วไม่เปลี่ยนยอด / ไม่หาร = ไม่แตะค่าสนามเดิม (เช่นที่แอดมินแก้ให้โค้ชเป็น 0)
      const share = shares.get(c.playerId);
      if (c.paidAt || share === undefined) continue;
      dispatch({ type: "setBillFees", date: day.date, playerId: c.playerId, courtFee: share, shuttleFee: c.shuttleFee ?? null });
    }
    onClose();
  };
  const hourSelect = (value: number, options: number[], onChange: (h: number) => void, label: string) => (
    <select aria-label={label} className="min-h-10 rounded-xl bg-zinc-100 px-2 text-base" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((h) => (
        <option key={h} value={h}>
          {hh(h)}
        </option>
      ))}
    </select>
  );
  const range = (a: number, b: number) => HOURS.filter((h) => h >= a && h <= b);

  return (
    <Sheet title={t("หารค่าสนามตามชั่วโมง")} onClose={onClose} keepOpen>
      <p className="text-sm text-zinc-500">{t("แต่ละชั่วโมงหารค่าเช่าให้คนที่อยู่ชั่วโมงนั้น คนมาก่อนจ่ายมากกว่า ใส่แล้วกดใช้ยอดนี้ บิลทุกคนจะเปลี่ยนตาม")}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-medium">
          {t("เริ่มเช่า")}
          <div className="mt-1">{hourSelect(cfg.start, range(6, 23), (h) => set({ start: h, end: Math.max(cfg.end, h + 1) }), t("เริ่มเช่า"))}</div>
        </label>
        <label className="block text-sm font-medium">
          {t("เลิก")}
          <div className="mt-1">{hourSelect(cfg.end, range(cfg.start + 1, 24), (h) => set({ end: h }), t("เลิก"))}</div>
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t("ค่าเช่าสนามรวม ต่อชั่วโมง (ทุกคอร์ทรวมกัน)")}
        <input className={`${inputClass} mt-1`} inputMode="numeric" value={cfg.perHour} onChange={(e) => set({ perHour: e.target.value.replace(/\D/g, "") })} />
      </label>
      {valid && (
        <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
          {t("ค่าเช่ารวม {rent} · หารได้ {got}", { rent: baht(rent), got: baht(collected) })}
          {empty && <div className="mt-1 font-semibold text-amber-800">{t("มีชั่วโมงที่ไม่มีใครอยู่ ค่าเช่าชั่วโมงนั้นยังไม่มีคนจ่าย")}</div>}
        </div>
      )}
      <ul className="space-y-2">
        {people.map(({ c, p }) => {
          const s = all.get(c.playerId) ?? null;
          const setSpan = (v: Span) => setSpans((m) => ({ ...m, [c.playerId]: v }));
          return (
            <li key={c.playerId} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-zinc-100">
              <div className="flex items-center gap-2">
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                {(isAnnualMember(p, day.date) || isMonthlyPaid(state.monthly, day.date, p.id)) && (
                  <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">{t("สมาชิก")}</span>
                )}
                {c.paidAt ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>
                ) : (
                  <span className="shrink-0 font-display text-lg font-semibold">{s && valid ? baht(shares.get(c.playerId) ?? 0) : "–"}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {s ? (
                  <>
                    {hourSelect(s.from, range(cfg.start, cfg.end - 1), (h) => setSpan({ from: h, to: Math.max(s.to, h + 1) }), t("มา"))}
                    <span>–</span>
                    {hourSelect(s.to, range(s.from + 1, cfg.end), (h) => setSpan({ from: s.from, to: h }), t("เวลากลับ"))}
                    <button className="min-h-10 rounded-xl bg-zinc-100 px-3 text-zinc-600" onClick={() => setSpan(null)}>
                      {t("ไม่หาร")}
                    </button>
                  </>
                ) : (
                  <button className="min-h-10 rounded-xl bg-zinc-100 px-3 font-semibold" onClick={() => setSpan({ from: fit(new Date(c.at).getHours()), to: cfg.end })}>
                    {t("ไม่หาร (ยอดเดิม) · กดเพื่อหารด้วย")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {people.some(({ c }) => c.paidAt) && <p className="text-xs text-zinc-500">{t("คนที่จ่ายแล้วนับรวมในการหาร แต่ยอดในบิลไม่เปลี่ยน")}</p>}
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!valid || !people.length} onClick={apply}>
          {t("ใช้ยอดนี้")}
        </Button>
        <Button onClick={onClose}>{t("ยกเลิก")}</Button>
      </div>
    </Sheet>
  );
}
