"use client";

import { useMemo, useState } from "react";
import { Auto } from "@/lib/autoTranslate";
import { t } from "@/lib/i18n";
import { PROMOTION_RULE, clubMembers, levelCounts, monthRecord, nextLevel, winRate, type MonthRecord } from "@/lib/promotion";
import { today, useStore } from "@/lib/store";
import { LEVELS, type Level, type Player } from "@/lib/types";
import { useHistory } from "./Ranking";
import { Avatar, LevelBadge, SearchInput, Sheet, levelCode, levelColor } from "./ui";

/** สีของแต่ละระดับ ใช้ชุดเดียวกับป้ายระดับทั้งแอพ */
const barOf = (level: Level) => levelColor(level).split(" ")[0];

/** เมนูก๊วน > สมาชิก: จำนวนสมาชิก แยกตามระดับมือ และดูโปรไฟล์คนอื่น (ไม่แสดงเบอร์โทร) */
export function MembersDirectory() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [picked, setPicked] = useState<Player | null>(null);
  const month = today().slice(0, 7);
  const history = useHistory(`${month}-01`);
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
          {t("{n} คน", { n: members.length })}
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

      <div className="grid grid-cols-2 gap-2">
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
              <span className={`block text-xs leading-tight ${level === c.value ? "text-white/70" : "text-zinc-500"}`}>{t(c.label)}</span>
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
          <MemberProfile player={picked} month={month} history={history} />
        </Sheet>
      )}
    </div>
  );
}

/** โปรไฟล์ของสมาชิกคนอื่น: รูป ระดับมือ แนะนำตัว และผลแพ้ชนะเดือนนี้ */
function MemberProfile({ player, month, history }: { player: Player; month: string; history: ReturnType<typeof useHistory> }) {
  const { data, failed } = history;
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
                <div className="text-xs text-zinc-500">{x.label}</div>
              </div>
            ))}
          </div>
          {next !== null && !player.guestOf && <PromotionProgress rec={r} next={next} />}
        </>
      )}
    </div>
  );
}

/** ความคืบหน้าเลื่อนขั้นเดือนนี้: แยกสองเงื่อนไข จำนวนชนะ และ % ชนะ */
export function PromotionProgress({ rec, next }: { rec: MonthRecord; next: Level }) {
  const rule = PROMOTION_RULE;
  const rate = winRate(rec);
  const winsOk = rec.wins >= rule.wins;
  const rateOk = rec.decided > 0 && rate >= rule.rate;
  const pct = Math.min(100, Math.round((rec.wins / rule.wins) * 100));
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  return (
    <div className={`space-y-1.5 rounded-2xl px-3 py-2.5 ${winsOk && rateOk ? "bg-lime/40" : "bg-zinc-50"}`}>
      <div className="text-sm font-semibold">
        {winsOk && rateOk ? t("เข้าเกณฑ์เลื่อนเป็น {level} แล้ว", { level: levelCode(next) }) : t("ทางไปขั้น {level}", { level: levelCode(next) })}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-sm tabular-nums">
        <span className={winsOk ? "text-emerald-700" : "text-zinc-600"}>
          {mark(winsOk)} {t("ชนะ {w}/{n} เกม", { w: rec.wins, n: rule.wins })}
        </span>
        <span className={rateOk ? "text-emerald-700" : "text-zinc-600"}>
          {mark(rateOk)} {t("% ชนะ {r}/{n}", { r: rec.decided ? rate : "–", n: rule.rate })}
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        {t("เกณฑ์: ชนะ {w} เกมขึ้นไป และชนะ {r}% ขึ้นไปในเดือนเดียวกัน นับเฉพาะเกมที่บันทึกผล แอดมินยืนยันต้นเดือนถัดไป", { w: rule.wins, r: rule.rate })}
      </p>
    </div>
  );
}
