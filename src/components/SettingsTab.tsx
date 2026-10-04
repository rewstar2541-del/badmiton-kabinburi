"use client";

import { useState } from "react";
import { isValidPromptPayId } from "@/lib/promptpay";
import { useStore, type State } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { datesToFreeze } from "@/lib/billing";
import { today } from "@/lib/state";
import { ClubCalendar } from "./Calendar";
import { EventPhotos } from "./EventPhotos";
import { LineCard } from "./LineCard";
import { LoginTab } from "./LoginTab";
import { Button, Card, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const NUMBER_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "courtCount", label: "จำนวนสนาม" },
  { key: "courtFee", label: "ค่าสนามต่อครั้ง (คนที่ไม่ได้จ่ายรายเดือน)" },
  { key: "firstShuttleFee", label: "ค่าลูกแรกของวัน ต่อคน" },
  { key: "nextShuttleFee", label: "ค่าลูกถัดไป ต่อคน ต่อลูก" },
  { key: "monthlyFee", label: "ค่าสมาชิกรายเดือน" },
];

export function SettingsTab() {
  const { state, dispatch, auth } = useStore();
  const [s, setS] = useState(state.settings);
  const [saved, setSaved] = useState(false);
  const ppOk = !s.promptPayId || isValidPromptPayId(s.promptPayId);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `badminton-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as State;
      if (!Array.isArray(data.players) || !Array.isArray(data.days)) throw new Error();
      if (confirm(t("นำเข้าข้อมูล {p} คน {d} วัน? ข้อมูลปัจจุบันจะถูกแทนที่", { p: data.players.length, d: data.days.length }))) {
        dispatch({ type: "replace", state: data });
        setS(data.settings);
      }
    } catch {
      alert(t("ไฟล์ไม่ถูกต้อง"));
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle>{t("ตั้งค่า")}</SectionTitle>
      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ppOk) return;
            const old = state.settings;
            const changed =
              old.courtFee !== s.courtFee || old.firstShuttleFee !== s.firstShuttleFee || old.nextShuttleFee !== s.nextShuttleFee;
            // ราคาใหม่ใช้ตั้งแต่วันนี้ เก็บราคาเดิมไว้กับวันก่อนๆ บิลเก่าจะได้ไม่เปลี่ยน
            const freeze = changed
              ? {
                  dates: datesToFreeze(state.days, today()),
                  prices: { courtFee: old.courtFee, firstShuttleFee: old.firstShuttleFee, nextShuttleFee: old.nextShuttleFee },
                }
              : undefined;
            dispatch({ type: "updateSettings", settings: s, freeze });
            setSaved(true);
          }}
        >
          <h2 className="font-display font-semibold">{t("ราคาและสนาม")}</h2>
          <p className="text-xs text-zinc-500">{t("ราคาใหม่ใช้ตั้งแต่วันนี้ บิลของวันก่อนๆ คงราคาเดิม ถ้าจะแก้ยอดของคนใดคนหนึ่ง ไปที่แท็บคิดเงิน แล้วกดที่ชื่อ")}</p>
          {NUMBER_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              {t(f.label)}
              <input
                className={inputClass}
                inputMode="numeric"
                value={s[f.key]}
                onChange={(e) => {
                  setSaved(false);
                  setS({ ...s, [f.key]: Number(e.target.value.replace(/\D/g, "")) || 0 });
                }}
              />
            </label>
          ))}
          <label className="block space-y-1.5 text-sm font-medium">
            {t("เบอร์ PromptPay ของสนาม (เบอร์มือถือ หรือเลขบัตร 13 หลัก)")}
            <input
              className={inputClass}
              inputMode="numeric"
              value={s.promptPayId}
              onChange={(e) => {
                setSaved(false);
                setS({ ...s, promptPayId: e.target.value });
              }}
            />
            {!ppOk && <span className="text-xs text-red-600">{t("ต้องเป็นตัวเลข 10, 13 หรือ 15 หลัก")}</span>}
          </label>
          <Button variant="primary" type="submit" className="w-full">
            {saved ? t("บันทึกแล้ว ✓") : t("บันทึก")}
          </Button>
        </form>
      </Card>
      <ClubCalendar />
      <EventPhotos />
      <LineCard />
      <Card className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold">{t("จอสนาม")}</h2>
          <p className="text-xs text-zinc-500">{t("เปิดบนแท็บเล็ตหรือทีวีที่สนาม แสดงสนามและคิวถัดไป อัปเดตเอง")}</p>
        </div>
        <a
          href={`?tv${auth.demo ? "&demo" : ""}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
        >
          {t("เปิดจอสนาม")}
        </a>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display font-semibold">{t("สำรองข้อมูล")}</h2>
        <p className="text-sm text-zinc-500">
          {auth.online
            ? t("ข้อมูลเก็บออนไลน์แล้ว ดาวน์โหลดไฟล์สำรองเก็บไว้เป็นครั้งคราวได้ นำเข้าไฟล์จะเพิ่มข้อมูลเข้าไป ไม่ลบของเดิม")
            : t("ตอนนี้ข้อมูลเก็บในเครื่องนี้เครื่องเดียว ควรกดสำรองไว้หลังเลิกเล่นทุกครั้ง")}
        </p>
        <div className="flex gap-2">
          <Button onClick={exportData} className="flex-1">
            {t("ดาวน์โหลดไฟล์สำรอง")}
          </Button>
          <label className="flex-1 cursor-pointer rounded-2xl bg-zinc-100 px-4 py-3 text-center text-sm font-semibold">
            {t("นำเข้าไฟล์")}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
            />
          </label>
        </div>
      </Card>

      <ClearHistory />

      {auth.online && <LoginTab />}
    </div>
  );
}

const CONFIRM_WORD = "ล้างข้อมูล";

/** ล้างประวัติทั้งหมด ใช้ตอนทดลองใช้เสร็จ ก่อนเริ่มใช้จริง */
function ClearHistory() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Card className="space-y-3 border border-red-200">
      <h2 className="font-display font-semibold text-red-600">{t("ล้างประวัติทั้งหมด")}</h2>
      <p className="text-sm text-zinc-500">
        {t("ใช้ตอนทดลองใช้เสร็จ ก่อนเริ่มใช้จริง ลบ: การลงชื่อ เช็คอิน เกมและคิว ค่าลูก ค่าน้ำ การจ่ายเงิน ค่ารายเดือน สลิป แขก และประกาศจัดก๊วนถึงวันนี้")}
      </p>
      <p className="text-sm text-zinc-500">
        {t("เก็บไว้: รายชื่อผู้เล่น (ระดับมือ รูป และ LINE ที่ผูกไว้) แอดมิน ราคาและตั้งค่า วันงดเล่น วันจัดก๊วนหลังวันนี้ และรูปกิจกรรม")}
      </p>
      {done ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t("ล้างประวัติแล้ว")}</p>
      ) : !open ? (
        <Button className="w-full !text-red-600" onClick={() => setOpen(true)}>
          {t("ล้างประวัติทั้งหมด")}
        </Button>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (word.trim() !== CONFIRM_WORD) return;
            dispatch({ type: "clearHistory", today: today() });
            setDone(true);
          }}
        >
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("ลบแล้วกู้คืนไม่ได้ ควรกด \"ดาวน์โหลดไฟล์สำรอง\" ด้านบนเก็บไว้ก่อน พิมพ์คำว่า {word} เพื่อยืนยัน", { word: CONFIRM_WORD })}
          </p>
          <input className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} placeholder={CONFIRM_WORD} aria-label={t("คำยืนยัน")} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1 !bg-red-600 !text-white" disabled={word.trim() !== CONFIRM_WORD}>
              {t("ยืนยันล้างประวัติ")}
            </Button>
            <Button type="button" onClick={() => { setOpen(false); setWord(""); }}>
              {t("ยกเลิก")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
