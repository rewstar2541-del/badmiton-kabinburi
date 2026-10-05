"use client";

import { downloadBlob, inAppBrowser } from "@/lib/download";
import { OpenOutside } from "./OpenOutside";
import { BoardCard } from "./Board";
import { ClearData } from "./ClearData";
import { PollAdmin } from "./Polls";
import { useState, type ReactNode } from "react";
import { isValidPromptPayId } from "@/lib/promptpay";
import { useStore } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { datesToFreeze } from "@/lib/billing";
import { normalizeBackup, today } from "@/lib/state";
import { ClubCalendar } from "./Calendar";
import { EventPhotos } from "./EventPhotos";
import { LoginTab } from "./LoginTab";
import { Button, Card, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const NUMBER_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "courtCount", label: "จำนวนสนาม" },
  { key: "courtFee", label: "ค่าสนามต่อครั้ง (คนไม่จ่ายรายเดือน)" },
  { key: "firstShuttleFee", label: "ค่าลูกแรกของวัน ต่อคน" },
  { key: "nextShuttleFee", label: "ค่าลูกถัดไป ต่อคน ต่อลูก" },
  { key: "monthlyFee", label: "ค่าสมาชิกรายเดือน" },
];

export function SettingsTab() {
  const { state, dispatch, auth } = useStore();
  const [s, setS] = useState(state.settings);
  const [saved, setSaved] = useState(false);
  const ppOk = !s.promptPayId || isValidPromptPayId(s.promptPayId);

  const [inLine, setInLine] = useState(false);
  const exportData = () => {
    // ข้อมูลแบบออฟไลน์อยู่ในเครื่องนี้เท่านั้น เปิดเบราว์เซอร์อื่นจะไม่เห็นข้อมูลชุดนี้ จึงลองโหลดตรงๆ
    if (auth.online && inAppBrowser()) return setInLine(true);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, `badminton-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const importData = async (file: File) => {
    try {
      const data = normalizeBackup(JSON.parse(await file.text()));
      if (confirm(t("นำเข้า {p} คน {d} วัน? (แทนที่ข้อมูลเดิม)", { p: data.players.length, d: data.days.length }))) {
        dispatch({ type: "replace", state: data });
        setS(data.settings);
      }
    } catch {
      alert(t("ไฟล์ไม่ถูกต้อง"));
    }
  };

  return (
    <div className="space-y-3">
      <SectionTitle>{t("ตั้งค่า")}</SectionTitle>
      <Section id="calendar" icon="📅" title={t("ปฏิทินและอีเว้น")} hint={t("สร้างอีเว้น วันงดเล่น โหวตวันตี")} defaultOpen>
        <ClubCalendar bare />
        <PollAdmin />
      </Section>
      <Section id="prices" icon="💰" title={t("ราคาและสนาม")} hint={t("ค่าสนาม ค่าลูก รายเดือน PromptPay จอทีวี")}>
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
              <p className="text-xs text-zinc-500">{t("ราคาใหม่ใช้ตั้งแต่วันนี้ (มีคนจ่ายแล้วเริ่มพรุ่งนี้) บิลเก่าไม่เปลี่ยน แก้ยอดรายคนที่ คิดเงิน > กดชื่อ")}</p>
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
                {t("PromptPay ของก๊วน (เบอร์มือถือ / เลขบัตร 13 หลัก)")}
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
          <Card className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold">{t("จอสนาม")}</h2>
              <p className="text-xs text-zinc-500">{t("เปิดบนทีวีที่สนาม ดูสนามและคิว อัปเดตเอง")}</p>
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
      </Section>
      <Section id="board" icon="📸" title={t("บอร์ดและรูปกิจกรรม")} hint={t("ของหาย ขายของ รูปภาพ")}>
        <BoardCard />
        <EventPhotos bare />
      </Section>
      {auth.online && (
        <Section id="admins" icon="👤" title={t("แอดมินและบัญชีของฉัน")} hint={t("ผูก LINE ตั้ง/ถอดแอดมิน ออกจากระบบ")}>
          <LoginTab bare />
        </Section>
      )}
      <Section id="data" icon="🗂️" title={t("ข้อมูลและล้างประวัติ")} hint={t("สำรองไฟล์ ล้างข้อมูล")} danger>
          <Card className="space-y-3">
            <h2 className="font-display font-semibold">{t("สำรองข้อมูล")}</h2>
            <p className="text-sm text-zinc-500">
              {auth.online
                ? t("ข้อมูลอยู่ออนไลน์แล้ว โหลดไฟล์สำรองเก็บไว้บ้าง นำเข้าไฟล์จะเพิ่มข้อมูล ไม่ลบของเดิม")
                : t("ข้อมูลอยู่ในเครื่องนี้เท่านั้น สำรองไว้หลังเลิกเล่นทุกครั้ง")}
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
            {inLine && <OpenOutside menu={t("ตั้งค่า")} />}
          </Card>
        <ClearData />
        <ClearHistory />
      </Section>
    </div>
  );
}

/** หมวดในหน้าตั้งค่า กดเปิด/ปิดได้ จำสถานะไว้ในเครื่อง */
function Section({
  id,
  icon,
  title,
  hint,
  defaultOpen,
  danger,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const key = "badminton-kabinburi:settings:" + id;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? !!defaultOpen : v === "1";
    } catch {
      return !!defaultOpen;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(key, open ? "0" : "1");
    } catch {}
  };
  return (
    <section className={`rounded-3xl ${open ? "bg-zinc-100 p-2" : ""}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ${danger ? "ring-1 ring-red-200" : ""}`}
      >
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-display font-semibold ${danger ? "text-red-600" : ""}`}>{title}</span>
          <span className="block truncate text-xs text-zinc-500">{hint}</span>
        </span>
        <span className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="space-y-4 pt-3">{children}</div>}
    </section>
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
        {t("ใช้หลังทดลองเสร็จ ลบ: ลงชื่อ เช็คอิน เกม ค่าลูก ค่าน้ำ การจ่าย รายเดือน สลิป แขก ประกาศถึงวันนี้")}
      </p>
      <p className="text-sm text-zinc-500">
        {t("ไม่ลบ: ผู้เล่น แอดมิน ราคา ตั้งค่า วันงดเล่น วันจัดก๊วนข้างหน้า รูปกิจกรรม")}
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
            {t("ลบแล้วกู้ไม่ได้ โหลดไฟล์สำรองก่อน พิมพ์ {word} เพื่อยืนยัน", { word: CONFIRM_WORD })}
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
