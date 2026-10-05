"use client";

import { eventStyle } from "@/lib/eventKinds";
import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { ClosedBanner } from "./Calendar";
import { AnnouncementBanner, CapLine } from "./TodayTab";
import { Button, Card, Icon, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const DEFAULT_TH = "ลงชื่อได้เลย ถึงสนามแล้วกดเช็คอิน";
const DEFAULT_MESSAGE = () => t(DEFAULT_TH);

/** หัวข้อสำเร็จรูป เก็บเป็นภาษาไทย แสดงตามภาษาที่เลือก (null = จัดก๊วน) */
const PRESETS = [null, "กินเลี้ยง", "ทำความสะอาดสนาม", "แข่งขันในก๊วน"] as const;

/** แอดมินประกาศ/แก้/ยกเลิกประกาศวันนี้ (ข้อมูลเดียวกับปฏิทินก๊วน) */
export function AnnounceCard() {
  const { dispatch, state } = useStore();
  const { date, day } = useToday();
  const [editing, setEditing] = useState(false);
  const announced = day.announcement !== undefined;

  const closed = state.closed[date];
  if (closed !== undefined && !announced && !editing)
    return (
      <div className="space-y-1">
        <ClosedBanner reason={closed} />
        <p className="px-1 text-xs text-zinc-500">{t("จะเปิดเล่น: ตั้งค่า > ปฏิทินก๊วน แตะวันนี้")}</p>
      </div>
    );

  if (announced && !editing)
    return (
      <div className="space-y-2">
        <AnnouncementBanner message={day.announcement ?? ""} title={day.announcementTitle} fee={day.announcementFee} date={date} />
        <CapLine />
        <div className="flex justify-end gap-4 px-1 text-xs text-zinc-500">
          <button className="underline-offset-2 active:underline" onClick={() => setEditing(true)}>
            {t("แก้ข้อความ")}
          </button>
          <button
            className="text-red-500 underline-offset-2 active:underline"
            onClick={() => {
              if (confirm(t("ยกเลิกประกาศวันนี้? ผู้เล่นจะลงชื่อเองไม่ได้"))) dispatch({ type: "setAnnouncement", date, message: null });
            }}
          >
            {t("ยกเลิกประกาศ")}
          </button>
        </div>
      </div>
    );

  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 font-display font-semibold">
        <Icon.Megaphone width={20} height={20} /> {t("ประกาศวันนี้")}
      </h3>
      <EventForm date={date} onDone={() => setEditing(false)} onCancel={editing ? () => setEditing(false) : undefined} />
      <p className="text-xs text-zinc-500">{t("วันอื่นตั้งล่วงหน้าได้ที่ ตั้งค่า > ปฏิทินก๊วน")}</p>
    </Card>
  );
}

/** ฟอร์มสร้าง/แก้อีเว้นของวันหนึ่ง ใช้ทั้งหน้าเช็คอิน (วันนี้) และปฏิทินก๊วน (วันไหนก็ได้) */
export function EventForm({ date, onDone, onCancel }: { date: string; onDone: () => void; onCancel?: () => void }) {
  const { dispatch, state } = useStore();
  const day = state.days.find((d) => d.date === date);
  const announced = day?.announcement !== undefined;
  const [message, setMessage] = useState(day?.announcement ?? DEFAULT_MESSAGE());
  const [title, setTitle] = useState<string | null>(day?.announcementTitle ?? null);
  const [fee, setFee] = useState(day?.announcementFee ? String(day.announcementFee) : "");
  const [cap, setCap] = useState(day?.announcementCap ? String(day.announcementCap) : "");
  const custom = title !== null && !(PRESETS as readonly (string | null)[]).includes(title);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 text-sm font-medium">
        {t("หัวข้อ")}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p ?? "session"}
              type="button"
              onClick={() => setTitle(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${title === p ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
            >
              {eventStyle(p).emoji} {p ? t(p) : t("จัดก๊วน")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTitle(custom ? title : "")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${custom ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {eventStyle("อื่นๆ").emoji} {t("อื่นๆ")}
          </button>
        </div>
        {custom && (
          <input
            className={inputClass}
            maxLength={60}
            placeholder={t("พิมพ์หัวข้อ เช่น ทำบุญสนาม")}
            value={title ?? ""}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {title !== null && (
          <label className="block text-sm font-medium">
            {t("ค่าใช้จ่ายต่อคน")}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={`${inputClass} mt-1`}
              placeholder="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </label>
        )}
        <label className={`block text-sm font-medium ${title === null ? "col-span-2" : ""}`}>
          {t("รับกี่คน")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className={`${inputClass} mt-1`}
            placeholder={t("ไม่จำกัด")}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
      </div>
      <textarea className={`${inputClass} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t("ข้อความ")} />
      <div className="flex gap-2">
        <Button
          variant="accent"
          className="flex-1"
          onClick={() => {
            if (date in state.closed) dispatch({ type: "setClosed", date, reason: null });
            // ข้อความเริ่มต้นเก็บเป็นภาษาไทย ผู้เล่นแต่ละคนจะเห็นตามภาษาที่ตัวเองเลือก
            dispatch({
              type: "setAnnouncement",
              date,
              message: message.trim() === DEFAULT_MESSAGE() ? DEFAULT_TH : message.trim(),
              title: title?.trim() || null,
              fee: title?.trim() && Number(fee) > 0 ? Math.round(Number(fee)) : null,
              cap: Number(cap) >= 1 ? Math.min(500, Math.round(Number(cap))) : null,
            });
            onDone();
          }}
        >
          {announced ? t("บันทึก") : t("ประกาศ")}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t("ยกเลิก")}</Button>}
      </div>
      {cap && <p className="text-xs text-zinc-500">{t("เกินจำนวนจะเป็นสำรอง มีคนยกเลิกจะเลื่อนขึ้นเอง")}</p>}
    </div>
  );
}
