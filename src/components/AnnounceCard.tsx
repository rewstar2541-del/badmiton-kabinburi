"use client";

import { eventStyle } from "@/lib/eventKinds";
import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { ClosedBanner } from "./Calendar";
import { AnnouncementBanner, CapLine } from "./TodayTab";
import { Button, Card, Icon, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const DEFAULT_TH = "ลงชื่อกันได้เลย มาถึงสนามแล้วกดเช็คอินเองในแอพ";
const DEFAULT_MESSAGE = () => t(DEFAULT_TH);

/** หัวข้อสำเร็จรูป เก็บเป็นภาษาไทย แสดงตามภาษาที่เลือก (null = จัดก๊วน) */
const PRESETS = [null, "กินเลี้ยง", "ทำความสะอาดสนาม", "แข่งขันในก๊วน"] as const;

/** แอดมินประกาศ/แก้/ยกเลิกประกาศจัดก๊วนวันนี้ */
export function AnnounceCard() {
  const { dispatch, state } = useStore();
  const { date, day } = useToday();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(day.announcement ?? DEFAULT_MESSAGE());
  const [title, setTitle] = useState<string | null>(day.announcementTitle ?? null);
  const [fee, setFee] = useState(day.announcementFee ? String(day.announcementFee) : "");
  const [cap, setCap] = useState(day.announcementCap ? String(day.announcementCap) : "");
  const custom = title !== null && !(PRESETS as readonly (string | null)[]).includes(title);
  const announced = day.announcement !== undefined;

  const closed = state.closed[date];
  if (closed !== undefined && !announced)
    return (
      <div className="space-y-1">
        <ClosedBanner reason={closed} />
        <p className="px-1 text-xs text-zinc-500">{t("ถ้าจะเปิดเล่น ไปที่ ตั้งค่า > ปฏิทินก๊วน แล้วแตะวันนี้")}</p>
      </div>
    );

  if (announced && !editing)
    return (
      <div className="space-y-2">
        <AnnouncementBanner message={day.announcement ?? ""} title={day.announcementTitle} fee={day.announcementFee} date={date} />
        <CapLine />
        <div className="flex justify-end gap-4 px-1 text-xs text-zinc-500">
          <button
            className="underline-offset-2 active:underline"
            onClick={() => {
              setMessage(day.announcement ?? "");
              setTitle(day.announcementTitle ?? null);
              setFee(day.announcementFee ? String(day.announcementFee) : "");
              setCap(day.announcementCap ? String(day.announcementCap) : "");
              setEditing(true);
            }}
          >
            {t("แก้ข้อความ")}
          </button>
          <button
            className="text-red-500 underline-offset-2 active:underline"
            onClick={() => {
              if (confirm(t("ยกเลิกประกาศวันนี้? ผู้เล่นจะลงชื่อและเช็คอินเองไม่ได้"))) dispatch({ type: "setAnnouncement", date, message: null });
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
            {t("อื่นๆ")}
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
      {title !== null && (
        <label className="block text-sm font-medium">
          {t("ค่าใช้จ่ายต่อคน (ไม่ใส่ก็ได้)")}
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
      <label className="block text-sm font-medium">
        {t("รับกี่คน (ไม่ใส่ = ไม่จำกัด)")}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          className={`${inputClass} mt-1`}
          placeholder={t("ไม่จำกัด")}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">{t("ลงชื่อเกินจำนวนจะเข้ารายชื่อสำรอง มีคนยกเลิกจะเลื่อนขึ้นให้เอง")}</span>
      </label>
      <textarea className={`${inputClass} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2">
        <Button
          variant="accent"
          className="flex-1"
          onClick={() => {
            // ข้อความเริ่มต้นเก็บเป็นภาษาไทย ผู้เล่นแต่ละคนจะเห็นตามภาษาที่ตัวเองเลือก
            dispatch({
              type: "setAnnouncement",
              date,
              message: message.trim() === DEFAULT_MESSAGE() ? DEFAULT_TH : message.trim(),
              title: title?.trim() || null,
              fee: title?.trim() && Number(fee) > 0 ? Math.round(Number(fee)) : null,
              cap: Number(cap) >= 1 ? Math.min(500, Math.round(Number(cap))) : null,
            });
            setEditing(false);
          }}
        >
          {announced ? t("บันทึก") : t("ประกาศ")}
        </Button>
        {editing && <Button onClick={() => setEditing(false)}>{t("ยกเลิก")}</Button>}
      </div>
      <p className="text-xs text-zinc-500">{title !== null
          ? t("อีเว้นพิเศษจะขึ้นเป็นกรอบสีส้มแยกจากประกาศจัดก๊วน ผู้เล่นกด \"ลงชื่อไปร่วม\" ได้ ดูรายชื่อได้ที่ช่อง ลงชื่อ ด้านบน")
          : t("เมื่อประกาศแล้ว ผู้เล่นเปิดแอพจะลงชื่อและกดเช็คอินเองได้เมื่อถึงสนาม")}
      </p>
    </Card>
  );
}
