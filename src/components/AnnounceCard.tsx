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
              if (confirm(t("ยกเลิกประกาศวันนี้? คนที่ลงชื่อไว้จะถูกล้างออก และผู้เล่นจะลงชื่อเองไม่ได้"))) dispatch({ type: "setAnnouncement", date, message: null });
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
export function EventForm({ date, dates, onDone, onCancel }: { date?: string; dates?: string[]; onDone: () => void; onCancel?: () => void }) {
  const { dispatch, state } = useStore();
  const targets = dates ?? (date ? [date] : []);
  const day = state.days.find((d) => d.date === targets[0]);
  const announced = day?.announcement !== undefined;
  const [message, setMessage] = useState(day?.announcement ?? DEFAULT_MESSAGE());
  const [title, setTitle] = useState<string | null>(day?.announcementTitle ?? null);
  const [fee, setFee] = useState(day?.announcementFee ? String(day.announcementFee) : "");
  const [cap, setCap] = useState(day?.announcementCap ? String(day.announcementCap) : "");
  // สนามเช่า: หารค่าเช่าตามชั่วโมงที่แต่ละคนอยู่
  const [rentOn, setRentOn] = useState(Boolean(day?.rent));
  const [rentStart, setRentStart] = useState(day?.rent?.start ?? 19);
  const [rentEnd, setRentEnd] = useState(day?.rent?.end ?? 22);
  const [perHour, setPerHour] = useState(day?.rent ? String(day.rent.perHour) : "");
  const rentOk = !rentOn || (Number(perHour) > 0 && rentEnd > rentStart);
  const hourOptions = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => (
      <option key={h} value={h}>
        {String(h).padStart(2, "0")}:00
      </option>
    ));
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
      <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-ink" checked={rentOn} onChange={(e) => setRentOn(e.target.checked)} />
          {t("สนามเช่า (หารค่าเช่าตามชั่วโมงที่อยู่)")}
        </label>
        {rentOn && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium">
                {t("เริ่มเช่า")}
                <select className={`${inputClass} mt-1`} value={rentStart} onChange={(e) => { const h = Number(e.target.value); setRentStart(h); setRentEnd((x) => Math.max(x, h + 1)); }}>
                  {hourOptions(6, 23)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                {t("เลิก")}
                <select className={`${inputClass} mt-1`} value={rentEnd} onChange={(e) => setRentEnd(Number(e.target.value))}>
                  {hourOptions(rentStart + 1, 24)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              {t("ค่าเช่าสนามรวม ต่อชั่วโมง (ทุกคอร์ทรวมกัน)")}
              <input className={`${inputClass} mt-1`} inputMode="numeric" value={perHour} onChange={(e) => setPerHour(e.target.value.replace(/\D/g, ""))} />
            </label>
            {!rentOk && <p className="text-xs font-semibold text-amber-800">{t("ใส่ค่าเช่าต่อชั่วโมงก่อน")}</p>}
            <p className="text-xs text-zinc-500">{t("ผู้เล่นเลือกเวลาที่มาเองได้ ค่าเริ่มต้นตามเวลาเช็คอิน สมาชิกก็หารด้วย")}</p>
          </>
        )}
      </div>
      <textarea className={`${inputClass} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t("ข้อความ")} />
      <div className="flex gap-2">
        <Button
          variant="accent"
          className="flex-1"
          disabled={!targets.length || !rentOk}
          onClick={() => {
            for (const d of targets) {
              if (d in state.closed) dispatch({ type: "setClosed", date: d, reason: null });
              // ข้อความเริ่มต้นเก็บเป็นภาษาไทย ผู้เล่นแต่ละคนจะเห็นตามภาษาที่ตัวเองเลือก
              dispatch({
                type: "setAnnouncement",
                date: d,
                message: message.trim() === DEFAULT_MESSAGE() ? DEFAULT_TH : message.trim(),
                title: title?.trim() || null,
                fee: title?.trim() && Number(fee) > 0 ? Math.round(Number(fee)) : null,
                cap: Number(cap) >= 1 ? Math.min(500, Math.round(Number(cap))) : null,
                // ไม่ได้ใช้สนามเช่า ไม่ส่งค่า (ใช้ได้แม้ยังไม่รัน SQL สนามเช่า)
                rent: rentOn ? { start: rentStart, end: rentEnd, perHour: Number(perHour) } : state.days.find((x) => x.date === d)?.rent ? null : undefined,
              });
            }
            onDone();
          }}
        >
          {targets.length > 1 ? t("ประกาศ {n} วัน", { n: targets.length }) : announced ? t("บันทึก") : t("ประกาศ")}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t("ยกเลิก")}</Button>}
      </div>
      {cap && <p className="text-xs text-zinc-500">{t("เกินจำนวนจะเป็นสำรอง มีคนยกเลิกจะเลื่อนขึ้นเอง")}</p>}
    </div>
  );
}
