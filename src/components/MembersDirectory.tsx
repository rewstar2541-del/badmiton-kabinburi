"use client";

import { useMemo, useState } from "react";
import { Auto } from "@/lib/autoTranslate";
import { t } from "@/lib/i18n";
import { PROMOTION_RULE, clubMembers, levelCounts, monthRecord, nextLevel, winRate } from "@/lib/promotion";
import { today, useStore } from "@/lib/store";
import { LEVELS, type Level, type Player } from "@/lib/types";
import { useHistory } from "./Ranking";
import { Avatar, LevelBadge, SearchInput, Sheet, levelCode } from "./ui";

/** สีแถบของแต่ละระดับ (ไล่จากอ่อนไปเข้ม สีเดียว ตามลำดับฝีมือ) */
const BAR = ["bg-emerald-200", "bg-emerald-300", "bg-emerald-400", "bg-emerald-500", "bg-emerald-600", "bg-emerald-800"];
const barOf = (level: Level) => BAR[LEVELS.findIndex((l) => l.value === level)];

/** เมนูก๊วน > สมาชิก: จำนวนสมาชิก แยกตามระดับมือ และดูโปรไฟล์คนอื่น (ไม่แสดงเบอร์โทร) */
export function MembersDirectory() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [picked, setPicked] = useState<Player | null>(null);
  const members = clubMembers(state.players);
  const counts = levelCounts(members);
  const shown = members
    .filter((p) => (level === null || p.level === level) && p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => LEVELS.findIndex((l) => l.value === b.level) - LEVELS.findIndex((l) => l.value === a.level) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-ink p-4 text-white">
        <div className="text-sm text-white/70">{t("สมาชิกก๊วนทั้งหมด")}</div>
        <div className="font-display text-4xl font-semibold tabular-nums">
          {members.length} <span className="text-lg font-medium text-white/80">{t("คน")}</span>
        </div>
        {members.length > 0 && (
          <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {counts
              .filter((c) => c.n)
              .map((c) => (
                <span key={c.value} className={barOf(c.value)} style={{ flexGrow: c.n }} />
              ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {counts.map((c) => (
          <button
            key={c.value}
            onClick={() => setLevel(level === c.value ? null : c.value)}
            aria-pressed={level === c.value}
            className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left ${level === c.value ? "bg-ink text-white" : "bg-zinc-100"}`}
          >
            <span className={`size-3 shrink-0 rounded-full ${barOf(c.value)}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{c.code}</span>
              <span className={`block truncate text-[11px] ${level === c.value ? "text-white/70" : "text-zinc-500"}`}>{t(c.label)}</span>
            </span>
            <span className="font-display text-lg font-semibold tabular-nums">{c.n}</span>
          </button>
        ))}
      </div>

      <SearchInput value={q} onChange={setQ} placeholder={t("ค้นหาชื่อ")} />

      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">{t("ไม่พบสมาชิก")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {shown.map((p) => (
            <li key={p.id}>
              <button className="flex w-full items-center gap-3 py-2.5 text-left active:bg-zinc-50" onClick={() => setPicked(p)}>
                <Avatar name={p.name} photo={p.photo} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-xs text-zinc-500">{t(LEVELS.find((l) => l.value === p.level)?.label ?? "")}</span>
                </span>
                <LevelBadge level={p.level} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <Sheet title={<h3 className="font-display text-lg font-semibold">{t("โปรไฟล์สมาชิก")}</h3>} onClose={() => setPicked(null)}>
          <MemberProfile player={picked} />
        </Sheet>
      )}
    </div>
  );
}

/** โปรไฟล์ของสมาชิกคนอื่น: รูป ระดับมือ แนะนำตัว และผลแพ้ชนะเดือนนี้ */
function MemberProfile({ player }: { player: Player }) {
  const month = today().slice(0, 7);
  const { data, failed } = useHistory(`${month}-01`);
  const rec = useMemo(() => (data ? monthRecord(data.days, month).get(player.id) : undefined), [data, month, player.id]);
  const next = nextLevel(player.level);
  const r = rec ?? { games: 0, decided: 0, wins: 0 };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={player.name} photo={player.photo} size={68} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-2xl font-semibold">{player.name}</span>
            <LevelBadge level={player.level} />
          </div>
          <div className="text-[15px] text-zinc-600">{t(LEVELS.find((l) => l.value === player.level)?.label ?? "")}</div>
        </div>
      </div>
      {player.bio && (
        <p className="text-[15px] whitespace-pre-line text-zinc-700">
          <Auto text={player.bio} />
        </p>
      )}
      {!data ? (
        <p className="text-sm text-zinc-500">{failed ? t("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง") : t("กำลังโหลด...")}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: t("เกมเดือนนี้"), value: String(r.games) },
              { label: t("ชนะ"), value: String(r.wins) },
              { label: t("% ชนะ"), value: r.decided ? `${winRate(r)}%` : "–" },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl bg-zinc-50 px-1 py-2.5">
                <div className="font-display text-xl font-semibold tabular-nums">{x.value}</div>
                <div className="text-[11px] text-zinc-500">{x.label}</div>
              </div>
            ))}
          </div>
          {next !== null && <PromotionProgress wins={r.wins} rate={winRate(r)} next={next} />}
        </>
      )}
    </div>
  );
}

/** ความคืบหน้าเลื่อนขั้นเดือนนี้: ชนะกี่เกมแล้ว และ % ชนะ เทียบเกณฑ์ */
export function PromotionProgress({ wins, rate, next }: { wins: number; rate: number; next: Level }) {
  const rule = PROMOTION_RULE;
  const pct = Math.min(100, Math.round((wins / rule.wins) * 100));
  const ok = wins >= rule.wins && rate >= rule.rate;
  return (
    <div className={`space-y-1.5 rounded-2xl px-3 py-2.5 ${ok ? "bg-lime/40" : "bg-zinc-50"}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{ok ? t("เข้าเกณฑ์เลื่อนเป็น {level} แล้ว", { level: levelCode(next) }) : t("ทางไปขั้น {level}", { level: levelCode(next) })}</span>
        <span className="text-xs text-zinc-600 tabular-nums">
          {t("ชนะ {w}/{n} เกม", { w: wins, n: rule.wins })} · {rate}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-zinc-500">{t("เกณฑ์: ชนะ {w} เกมขึ้นไป และชนะ {r}% ขึ้นไปในเดือนเดียวกัน แอดมินยืนยันตอนสิ้นเดือน", { w: rule.wins, r: rule.rate })}</p>
    </div>
  );
}
