"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { ClosedBanner } from "./Calendar";
import { AnnouncementBanner } from "./TodayTab";
import { Button, Card, Icon, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const DEFAULT_TH = "ลงชื่อกันได้เลย มาถึงสนามแล้วกดเช็คอินเองในแอพ";
const DEFAULT_MESSAGE = () => t(DEFAULT_TH);

/** แอดมินประกาศ/แก้/ยกเลิกประกาศจัดก๊วนวันนี้ */
export function AnnounceCard() {
  const { dispatch, state } = useStore();
  const { date, day } = useToday();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(day.announcement ?? DEFAULT_MESSAGE());
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
        <AnnouncementBanner message={day.announcement ?? ""} />
        <div className="flex justify-end gap-4 px-1 text-xs text-zinc-500">
          <button
            className="underline-offset-2 active:underline"
            onClick={() => {
              setMessage(day.announcement ?? "");
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
        <Icon.Megaphone width={20} height={20} /> {t("ประกาศจัดก๊วนวันนี้")}
      </h3>
      <textarea className={`${inputClass} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2">
        <Button
          variant="accent"
          className="flex-1"
          onClick={() => {
            // ข้อความเริ่มต้นเก็บเป็นภาษาไทย ผู้เล่นแต่ละคนจะเห็นตามภาษาที่ตัวเองเลือก
            dispatch({ type: "setAnnouncement", date, message: message.trim() === DEFAULT_MESSAGE() ? DEFAULT_TH : message.trim() });
            setEditing(false);
          }}
        >
          {announced ? t("บันทึก") : t("ประกาศ")}
        </Button>
        {editing && <Button onClick={() => setEditing(false)}>{t("ยกเลิก")}</Button>}
      </div>
      <p className="text-xs text-zinc-500">{t("เมื่อประกาศแล้ว ผู้เล่นเปิดแอพจะลงชื่อและกดเช็คอินเองได้เมื่อถึงสนาม")}</p>
    </Card>
  );
}
