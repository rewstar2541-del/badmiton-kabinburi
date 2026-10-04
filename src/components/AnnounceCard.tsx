"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { AnnouncementBanner } from "./TodayTab";
import { Button, Card, Icon, inputClass } from "./ui";

const DEFAULT_MESSAGE = "ลงชื่อกันได้เลย มาถึงสนามแล้วกดเช็คอินเองในแอพ";

/** แอดมินประกาศ/แก้/ยกเลิกประกาศจัดก๊วนวันนี้ */
export function AnnounceCard() {
  const { dispatch } = useStore();
  const { date, day } = useToday();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(day.announcement ?? DEFAULT_MESSAGE);
  const announced = day.announcement !== undefined;

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
            แก้ข้อความ
          </button>
          <button
            className="text-red-500 underline-offset-2 active:underline"
            onClick={() => {
              if (confirm("ยกเลิกประกาศวันนี้? ผู้เล่นจะลงชื่อและเช็คอินเองไม่ได้")) dispatch({ type: "setAnnouncement", date, message: null });
            }}
          >
            ยกเลิกประกาศ
          </button>
        </div>
      </div>
    );

  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 font-display font-semibold">
        <Icon.Megaphone width={20} height={20} /> ประกาศจัดก๊วนวันนี้
      </h3>
      <textarea className={`${inputClass} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2">
        <Button
          variant="accent"
          className="flex-1"
          onClick={() => {
            dispatch({ type: "setAnnouncement", date, message: message.trim() });
            setEditing(false);
          }}
        >
          {announced ? "บันทึก" : "ประกาศ"}
        </Button>
        {editing && <Button onClick={() => setEditing(false)}>ยกเลิก</Button>}
      </div>
      <p className="text-xs text-zinc-500">เมื่อประกาศแล้ว ผู้เล่นเปิดแอพจะลงชื่อและกดเช็คอินเองได้เมื่อถึงสนาม</p>
    </Card>
  );
}
