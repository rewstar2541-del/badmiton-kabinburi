"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { attendees } from "@/lib/promotion";
import { useStore } from "@/lib/store";
import type { Day } from "@/lib/types";
import { FramedAvatar } from "./AvatarFrame";
import { Avatar, Icon, LevelBadge, Sheet } from "./ui";

/** แถวรูปคนที่มา/ลงชื่อวันนี้ แตะเพื่อดูรายชื่อทั้งหมดพร้อมระดับมือ */
export function AttendeeStrip({ day, dark }: { day: Day; dark?: boolean }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const a = attendees(day);
  if (a.total === 0 && a.waiting.length === 0) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const faces = [...a.here, ...a.coming].slice(0, 4);
  const more = a.total - faces.length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left active:scale-[0.99] ${dark ? "bg-white/10" : "bg-zinc-50"}`}
      >
        <span className="flex shrink-0 -space-x-2.5">
          {faces.map((id) => (
            <Avatar key={id} name={byId.get(id)?.name ?? "?"} photo={byId.get(id)?.photo} size={28} ring />
          ))}
          {more > 0 && (
            <span className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white ${dark ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"}`}>
              +{more}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className={`block font-semibold ${dark ? "text-white" : "text-ink"}`}>{t("มาเล่นวันนี้ {n} คน", { n: a.total })}</span>
          <span className={`block truncate text-xs ${dark ? "text-white/70" : "text-zinc-500"}`}>
            {t("มาแล้ว {a} · ยังไม่มา {b}", { a: a.here.length, b: a.coming.length })}
            {a.waiting.length > 0 && ` · ${t("สำรอง {n} คน", { n: a.waiting.length })}`}
          </span>
        </span>
        <Icon.ChevronRight width={18} height={18} className={`shrink-0 ${dark ? "text-white/60" : "text-zinc-400"}`} aria-label={t("ดูรายชื่อ")} />
      </button>
      {open && (
        <Sheet title={<h3 className="font-display text-lg font-semibold">{t("ใครมาบ้างวันนี้")}</h3>} onClose={() => setOpen(false)}>
          <AttendeeList day={day} />
        </Sheet>
      )}
    </>
  );
}

/** รายชื่อแบ่งกลุ่ม: มาถึงแล้ว / ลงชื่อแล้วยังไม่มา / สำรอง */
export function AttendeeList({ day }: { day: Day }) {
  const { state } = useStore();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const a = attendees(day);
  const groups = [
    { title: t("มาถึงสนามแล้ว"), ids: a.here, tone: "bg-emerald-50 text-emerald-900" },
    { title: t("ลงชื่อแล้ว ยังไม่มา"), ids: a.coming, tone: "bg-sky-50 text-sky-900" },
    { title: t("สำรอง"), ids: a.waiting, tone: "bg-amber-50 text-amber-900" },
  ].filter((g) => g.ids.length);
  if (!groups.length) return <p className="text-sm text-zinc-500">{t("ยังไม่มีใครลงชื่อ")}</p>;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-600">
            {g.title} <span className="tabular-nums">({g.ids.length})</span>
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {g.ids.map((id) => {
              const p = byId.get(id);
              return (
                <li key={id} className={`flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium ${g.tone}`}>
                  {p ? <FramedAvatar player={p} size={24} compact /> : <Avatar name="?" size={24} />}
                  {p?.name ?? "?"}
                  {p && <LevelBadge level={p.level} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
