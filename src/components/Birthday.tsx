"use client";

import { useState } from "react";
import { birthdays } from "@/lib/club";
import { locale, t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { savedPin } from "./PickMe";
import { Avatar } from "./ui";

/** แถบอวยพรวันเกิดของคนที่เกิดวันนี้ (ทุกคนเห็น) */
export function BirthdayBanner({ tv }: { tv?: boolean }) {
  const { state } = useStore();
  const list = birthdays(state.players, today());
  if (!list.length) return null;
  const names = list.map((p) => p.name).join(", ");
  return (
    <div className={`flex items-center gap-3 rounded-3xl bg-gradient-to-r from-pink-200 via-amber-100 to-lime-200 text-ink ${tv ? "px-5 py-3 text-xl" : "p-4"}`}>
      <span className={tv ? "text-4xl" : "text-3xl"} aria-hidden>
        🎂
      </span>
      <div className="flex shrink-0 -space-x-2">
        {list.slice(0, 3).map((p) => (
          <Avatar key={p.id} name={p.name} photo={p.photo} size={tv ? 44 : 34} ring />
        ))}
      </div>
      <div className="min-w-0">
        <div className="font-display font-semibold">{t("สุขสันต์วันเกิด {name}", { name: names })}</div>
        <div className={tv ? "text-base" : "text-sm"}>{t("ขอให้ตีแบดสนุก สุขภาพแข็งแรง ชนะทุกเกม")}</div>
      </div>
    </div>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(locale(), { month: "long" });

/** ผู้เล่นใส่วันเกิด (วัน + เดือน ไม่ต้องใส่ปี) บันทึกทันทีเมื่อเลือก */
export function BirthdayEdit({ player }: { player: Player }) {
  const { social } = useStore();
  const [m0, d0] = player.birthday ? player.birthday.split("-").map(Number) : [0, 0];
  const [month, setMonth] = useState(m0);
  const [day, setDay] = useState(d0);
  const [msg, setMsg] = useState("");
  const save = async (m: number, d: number) => {
    setMonth(m);
    setDay(d);
    if ((m && !d) || (!m && d)) return;
    const bday = m && d ? `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
    const err = await social({ kind: "birthday", bday }, player.id, savedPin.get());
    setMsg(err ? t(err) : t("บันทึกแล้ว"));
  };
  const days = month ? new Date(2000, month, 0).getDate() : 31;
  const sel = "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-1.5 text-sm font-medium">
      {t("วันเกิด (ไม่ใส่ก็ได้ ใส่แล้ววันนั้นแอพจะอวยพรให้)")}
      <div className="flex gap-2">
        <select className={sel} aria-label={t("วัน")} value={day} onChange={(e) => save(month, Number(e.target.value))}>
          <option value={0}>{t("วัน")}</option>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select className={`${sel} flex-1`} aria-label={t("เดือน")} value={month} onChange={(e) => save(Number(e.target.value), Math.min(day, new Date(2000, Number(e.target.value), 0).getDate()))}>
          <option value={0}>{t("เดือน")}</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        {(month > 0 || day > 0) && (
          <button className="text-xs text-zinc-500 underline" onClick={() => save(0, 0)}>
            {t("ลบ")}
          </button>
        )}
      </div>
      {msg && <p className="text-xs font-normal text-zinc-500">{msg}</p>}
    </div>
  );
}
