"use client";

import { useState } from "react";
import { Auto } from "@/lib/autoTranslate";
import { locale, t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import type { Notice } from "@/lib/types";
import { Button, Card, Icon, inputClass } from "./ui";

const active = (list: Notice[] | undefined) => {
  const d = today();
  return (list ?? []).filter((n) => !n.until || n.until >= d).sort((a, b) => (a.kind === b.kind ? b.at - a.at : a.kind === "urgent" ? -1 : 1));
};
const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });

/** ข่าวประกาศทั่วไปที่ยังไม่หมดอายุ แสดงบนสุด (ด่วน = สีแดง ข่าว = สีฟ้า) แอดมินกดลบได้ */
export function NoticeBanners({ tv }: { tv?: boolean }) {
  const { state, auth, dispatch } = useStore();
  const list = active(state.notices);
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      {list.map((n) => {
        const urgent = n.kind === "urgent";
        return (
          <div
            key={n.id}
            className={`flex gap-3 rounded-3xl p-4 shadow-sm ${urgent ? "bg-red-600 text-white" : "border-2 border-sky-300 bg-sky-50 text-sky-950"} ${tv ? "text-xl" : ""}`}
          >
            <span className={`grid shrink-0 place-items-center rounded-2xl ${tv ? "size-14 text-3xl" : "size-11 text-2xl"} ${urgent ? "bg-white/20" : "bg-white"}`} aria-hidden>
              {urgent ? "🚨" : "📢"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${urgent ? "bg-white text-red-700" : "bg-sky-500 text-white"}`}>
                  {urgent ? t("ประกาศด่วน") : t("ข่าวสาร")}
                </span>
                {n.until && <span className="text-xs opacity-75">{t("ถึง {day}", { day: dateLabel(n.until) })}</span>}
              </div>
              <div className="mt-1 font-display text-lg leading-tight font-semibold">
                <Auto text={n.title} />
              </div>
              {n.body && (
                <p className="mt-1 text-sm whitespace-pre-line">
                  <Auto text={n.body} />
                </p>
              )}
            </div>
            {auth.isAdmin && !tv && (
              <button
                className="h-fit shrink-0 rounded-full p-1 opacity-70"
                aria-label={t("ลบประกาศนี้")}
                onClick={() => confirm(t("ลบประกาศนี้?")) && dispatch({ type: "removeNotice", id: n.id })}
              >
                <Icon.X width={18} height={18} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** แอดมินลงข่าวประกาศทั่วไป เช่น สนามเปลี่ยนเวลา เก็บเงินค่าเสื้อ (ไม่ใช่วันเล่น) */
export function NoticeComposer() {
  const { dispatch, auth } = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Notice["kind"]>("news");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [until, setUntil] = useState("");
  if (!auth.isAdmin) return null;
  const save = () => {
    if (!title.trim()) return;
    dispatch({ type: "addNotice", notice: { kind, title: title.trim(), ...(body.trim() ? { body: body.trim() } : {}), ...(until ? { until } : {}) } });
    setOpen(false);
    setTitle("");
    setBody("");
    setUntil("");
  };
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("ข่าวประกาศทั่วไป")}</h3>
        <p className="text-sm text-zinc-500">{t("ข่าวทั่วไป เช่น เก็บเงินค่าเสื้อ ขึ้นบนสุดของแอพและทีวี")}</p>
      </div>
      {open ? (
        <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <div className="flex gap-1.5">
            {(["news", "urgent"] as const).map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === k ? (k === "urgent" ? "bg-red-600 text-white" : "bg-sky-500 text-white") : "bg-zinc-100 text-zinc-600"}`}
              >
                {k === "urgent" ? `🚨 ${t("ประกาศด่วน")}` : `📢 ${t("ข่าวสาร")}`}
              </button>
            ))}
          </div>
          <input className={inputClass} maxLength={80} placeholder={t("หัวข้อข่าว")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className={`${inputClass} min-h-16`} maxLength={500} placeholder={t("รายละเอียด (ไม่ใส่ก็ได้)")} value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="block text-sm font-medium">
            {t("แสดงถึงวันที่ (ว่าง = จนกว่าจะลบ)")}
            <input type="date" min={today()} className={`${inputClass} mt-1`} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setOpen(false)}>{t("ยกเลิก")}</Button>
            <Button variant="accent" disabled={!title.trim()} onClick={save}>
              {t("ประกาศ")}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="flex w-full items-center justify-center gap-1.5" onClick={() => setOpen(true)}>
          <Icon.Plus width={18} height={18} /> {t("ลงข่าวประกาศ")}
        </Button>
      )}
    </Card>
  );
}
