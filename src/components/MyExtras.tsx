"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { badgesFor, monthSummary } from "@/lib/stats";
import { monthOf, type Player } from "@/lib/types";
import { savedPin } from "./PickMe";
import { Avatar, Button, Card, Icon, SearchInput, SectionTitle, baht } from "./ui";
import { cameSince, daysBefore, visibleRoster } from "@/lib/roster";

const MAX = 5;
type Pref = "prefer" | "avoid" | null;

/** ผู้เล่นเลือกคนที่อยากจับคู่ด้วย และคนที่ไม่อยากเจอในเกมเดียวกัน */
export function PartnerPrefs({ player }: { player: Player }) {
  const { state, setPrefs } = useStore();
  const [editing, setEditing] = useState(false);
  const [prefer, setPrefer] = useState<string[]>(player.prefer ?? []);
  const [avoid, setAvoid] = useState<string[]>(player.avoid ?? []);
  const pin = savedPin.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const [q, setQ] = useState("");
  const { date } = useToday();
  // แสดงคนที่เลือกไว้และคนที่มาเล่นช่วง 30 วันล่าสุด คนอื่นค้นหาชื่อ
  const recent = cameSince(state.days, daysBefore(date, 30));
  const others = visibleRoster(
    state.players.filter((p) => p.id !== player.id && !p.pending && !p.guestOf),
    q,
    (p) => recent.has(p.id) || prefer.includes(p.id) || avoid.includes(p.id),
  ).sort((a, b) => a.name.localeCompare(b.name, "th"));
  const prefOf = (id: string): Pref => (prefer.includes(id) ? "prefer" : avoid.includes(id) ? "avoid" : null);

  // แตะวนสามสถานะ: ไม่ระบุ → อยากจับคู่ → ไม่อยากเจอ → ไม่ระบุ
  const cycle = (id: string) => {
    const now = prefOf(id);
    setPrefer((l) => l.filter((x) => x !== id));
    setAvoid((l) => l.filter((x) => x !== id));
    if (now === null) {
      if (prefer.length >= MAX) return setError(t("เลือกได้ไม่เกิน 5 คน"));
      setPrefer((l) => [...l, id]);
    } else if (now === "prefer") {
      if (avoid.length >= MAX) return setError(t("เลือกได้ไม่เกิน 5 คน"));
      setAvoid((l) => [...l, id]);
    }
    setError("");
  };

  const chips = (ids: string[], tone: string) =>
    ids.length ? (
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {byId.get(id)?.name ?? "?"}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-xs text-zinc-400">{t("ยังไม่ได้เลือก")}</span>
    );

  return (
    <>
      <SectionTitle>{t("คู่ที่อยากเล่นด้วย")}</SectionTitle>
      <Card className="space-y-3">
        {!editing ? (
          <>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-emerald-700">{t("อยากจับคู่ด้วย")}</div>
              {chips(player.prefer ?? [], "bg-emerald-50 text-emerald-700")}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-red-600">{t("ไม่อยากเจอในเกมเดียวกัน")}</div>
              {chips(player.avoid ?? [], "bg-red-50 text-red-600")}
            </div>
            <p className="text-xs text-zinc-500">{t("ระบบจัดคู่จะพยายามทำตาม แต่ถ้าคนรอไม่พอ อาจต้องจัดรวมกัน")}</p>
            <Button
              className="w-full"
              onClick={() => {
                setPrefer(player.prefer ?? []);
                setAvoid(player.avoid ?? []);
                setEditing(true);
              }}
            >
              {t("แก้ไข")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-500">{t("แตะชื่อเพื่อเปลี่ยน: ไม่ระบุ → อยากจับคู่ → ไม่อยากเจอ (สูงสุดอย่างละ 5 คน)")}</p>
            <SearchInput value={q} onChange={setQ} />
            <ul className="grid grid-cols-2 gap-1.5">
              {others.map((p) => {
                const pref = prefOf(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => cycle(p.id)}
                      className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left text-sm ${
                        pref === "prefer"
                          ? "bg-emerald-100 text-emerald-800"
                          : pref === "avoid"
                            ? "bg-red-100 text-red-700"
                            : "bg-zinc-100"
                      }`}
                    >
                      <Avatar name={p.name} photo={p.photo} size={24} />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-[10px] font-semibold">
                        {pref === "prefer" ? t("คู่") : pref === "avoid" ? t("เลี่ยง") : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const err = await setPrefs(player.id, pin, prefer, avoid);
                  setBusy(false);
                  if (err) return setError(t(err));
                  setEditing(false);
                }}
              >
                {t("บันทึก")}
              </Button>
              <Button onClick={() => setEditing(false)}>{t("ยกเลิก")}</Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/** สรุปส่วนตัวรายเดือน แชร์หรือคัดลอกได้ */
export function MonthCard({ player }: { player: Player }) {
  const { state } = useStore();
  const { date } = useToday();
  const [copied, setCopied] = useState(false);
  const month = monthOf(date);
  const s = monthSummary(state, player, month);
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
  const partner = s.topPartner && state.players.find((p) => p.id === s.topPartner!.id);

  const stats = [
    { label: t("มาเล่น"), value: t("{n} วัน", { n: s.days }) },
    { label: t("เกม"), value: String(s.games) },
    { label: t("ชนะ"), value: s.winRate === null ? "–" : `${s.winRate}%` },
    { label: t("ลูกที่ใช้"), value: String(s.shuttles) },
  ];

  const text = [
    t("สรุปแบดเดือน {month} ของ {name}", { month: label, name: player.name }),
    ...stats.map((x) => `${x.label}: ${x.value}`),
    `${t("ค่าใช้จ่าย")}: ${baht(s.spent)}`,
    ...(partner ? [`${t("คู่ประจำ")}: ${partner.name}`] : []),
    APP_NAME.join("-"),
  ].join("\n");

  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ text });
    } catch {
      // ผู้ใช้ปิดหน้าต่างแชร์ หรือแชร์ไม่ได้ ใช้คัดลอกแทน
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <SectionTitle right={label}>{t("สรุปเดือนนี้")}</SectionTitle>
      <Card className="space-y-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {stats.map((x) => (
            <div key={x.label} className="rounded-2xl bg-zinc-50 px-1 py-2.5">
              <div className="font-display text-xl font-semibold tabular-nums">{x.value}</div>
              <div className="text-[11px] text-zinc-500">{x.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">{t("ค่าใช้จ่าย")}</span>
            <span className="font-semibold">{baht(s.spent)}</span>
          </div>
          {s.decided > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("ผลแพ้ชนะ")}</span>
              <span className="font-semibold">{t("ชนะ {w} แพ้ {l}", { w: s.wins, l: s.decided - s.wins })}</span>
            </div>
          )}
          {partner && (
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("คู่ประจำ")}</span>
              <span className="font-semibold">{t("{name} ({n} เกม)", { name: partner.name, n: s.topPartner!.games })}</span>
            </div>
          )}
        </div>
        <Button variant="accent" className="w-full" onClick={share}>
          {copied ? t("คัดลอกแล้ว ไปวางในไลน์ได้เลย") : t("แชร์สรุป")}
        </Button>
      </Card>
    </>
  );
}

/** ป้ายรางวัลของผู้เล่น ได้แล้วเป็นสี ยังไม่ได้แสดงความคืบหน้า */
export function BadgesCard({ player }: { player: Player }) {
  const { state } = useStore();
  const badges = badgesFor(state, player.id);
  const earned = badges.filter((b) => b.earned).length;
  return (
    <>
      <SectionTitle right={t("{n}/{m} ป้าย", { n: earned, m: badges.length })}>{t("ป้ายรางวัล")}</SectionTitle>
      <Card className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${b.earned ? "bg-lime/30" : "bg-zinc-50"}`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${
                b.earned ? "bg-ink text-lime" : "bg-zinc-200 text-zinc-400"
              }`}
            >
              <Icon.Trophy width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-semibold ${b.earned ? "" : "text-zinc-500"}`}>{t(b.name)}</div>
              <div className="text-[11px] leading-tight text-zinc-500">{t(b.how, { n: b.target })}</div>
              {!b.earned && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-ink/60" style={{ width: `${(b.progress / b.target) * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
