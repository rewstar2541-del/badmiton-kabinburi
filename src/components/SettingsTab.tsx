"use client";

import { downloadBlob, inAppBrowser } from "@/lib/download";
import { OpenOutside } from "./OpenOutside";
import { BoardCard } from "./Board";
import { ClearData } from "./ClearData";
import { PackageAdmin } from "./Packages";
import { FestivalPicker } from "./FestivalPicker";
import { PollAdmin } from "./Polls";
import { useState, type ReactNode } from "react";
import { isValidPromptPayId } from "@/lib/promptpay";
import { useStore, useToday } from "@/lib/store";
import { datesToFreeze } from "@/lib/billing";
import { normalizeBackup, today } from "@/lib/state";
import { ClubCalendar } from "./Calendar";
import { RentTodayCard } from "./RentHours";
import { EventPhotos } from "./EventPhotos";
import { LoginTab } from "./LoginTab";
import { Button, Card, SectionTitle, inputClass } from "./ui";
import { courtList } from "@/lib/types";
import { TourneySetup } from "./Tourney";
import { t } from "@/lib/i18n";

const NUMBER_FIELDS: { key: "courtFee" | "firstShuttleFee" | "nextShuttleFee" | "monthlyFee"; label: string }[] = [
  { key: "courtFee", label: "ค่าสนามต่อครั้ง (คนไม่จ่ายรายเดือน)" },
  { key: "firstShuttleFee", label: "ค่าลูกแรกของวัน ต่อคน" },
  { key: "nextShuttleFee", label: "ค่าลูกถัดไป ต่อคน ต่อลูก" },
];

export function SettingsTab() {
  const { state, dispatch, auth } = useStore();
  // ยังไม่มีตารางแพ็กเกจ: ใช้ช่องค่ารายเดือนเดิมไปก่อน
  const packagesReady = state.packages !== undefined;
  // มีแพ็กเกจแล้ว ค่าสนามรายวันกับค่ารายเดือนแก้ที่ แพ็กเกจสมาชิก
  const numberFields = packagesReady
    ? NUMBER_FIELDS.filter((f) => f.key !== "courtFee")
    : [...NUMBER_FIELDS, { key: "monthlyFee" as const, label: "ค่าสมาชิกรายเดือน" }];
  const [s, setS] = useState(state.settings);
  const [saved, setSaved] = useState(false);
  const ppOk = !s.promptPayId || isValidPromptPayId(s.promptPayId);
  // มีคอลัมน์สวิตช์แล้ว (รัน SQL แล้ว)
  const switches = state.settings.promptPayOn !== undefined;
  const shown = [
    ...(s.promptPayOn !== false && isValidPromptPayId(s.promptPayId) ? [t("QR PromptPay")] : []),
    ...(s.bankOn !== false && s.bankAccount.trim() ? [t("บัญชี {bank}", { bank: s.bankName.trim() || s.bankAccount.trim() })] : []),
  ];

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
      <div className="px-1 pt-2 text-sm font-semibold text-zinc-500">{t("ใช้บ่อย")}</div>
      <Section id="calendar" icon="📅" title={t("ปฏิทินและอีเว้น")} hint={t("สร้างอีเว้น วันงดเล่น โหวตวันตี")} defaultOpen>
        <ClubCalendar bare />
        <PollAdmin />
      </Section>
      <Section id="court" icon="🏸" title={t("สนามวันนี้")} hint={t("สนามเช่า เบอร์สนาม จอทีวี")}>
          <RentTodayCard />
          <CourtCountCard />
          <Card className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold">{t("จอสนาม")}</h2>
              <p className="text-xs text-zinc-500">{t("เปิดบนทีวีที่สนาม ดูสนามและคิว อัปเดตเอง")}</p>
            </div>
            <a
              href={`?tv${auth.demo ? "&demo" : ""}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-2xl bg-lime px-4 py-3 text-sm font-semibold text-ink"
            >
              {t("เปิดจอสนาม")}
            </a>
          </Card>
      </Section>
      <Section id="board" icon="📸" title={t("บอร์ดและรูปกิจกรรม")} hint={t("ของหาย ขายของ รูปภาพ")}>
        <BoardCard />
        <EventPhotos bare />
      </Section>
      <Section id="tourney" icon="🏆" title={t("งานแข่ง")} hint={t("สร้างงาน เปิดวันแข่ง จบงาน")}>
        <TourneySetup />
      </Section>
      <div className="px-1 pt-2 text-sm font-semibold text-zinc-500">{t("ตั้งครั้งเดียว นานๆ แก้")}</div>
      <Section id="prices" icon="💰" title={t("ราคาและการรับเงิน")} hint={packagesReady ? t("ค่าลูก PromptPay บัญชีธนาคาร") : t("ค่าสนาม ค่าลูก PromptPay บัญชีธนาคาร")}>
          <Card>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ppOk && s.promptPayOn !== false) return;
                const old = state.settings;
                // ค่ารายเดือนและค่าสนามรายวันมาจากแพ็กเกจ ไม่ทับด้วยค่าในฟอร์มนี้
                const next = { ...(packagesReady ? { ...s, monthlyFee: old.monthlyFee, courtFee: old.courtFee } : s), festival: old.festival, courtCount: old.courtCount, courtNumbers: old.courtNumbers };
                const changed =
                  old.courtFee !== next.courtFee || old.firstShuttleFee !== next.firstShuttleFee || old.nextShuttleFee !== next.nextShuttleFee;
                // ราคาใหม่ใช้ตั้งแต่วันนี้ เก็บราคาเดิมไว้กับวันก่อนๆ บิลเก่าจะได้ไม่เปลี่ยน
                const freeze = changed
                  ? {
                      dates: datesToFreeze(state.days, today()),
                      prices: { courtFee: old.courtFee, firstShuttleFee: old.firstShuttleFee, nextShuttleFee: old.nextShuttleFee },
                    }
                  : undefined;
                dispatch({ type: "updateSettings", settings: next, freeze });
                setSaved(true);
              }}
            >
              <h2 className="font-display font-semibold">{t("ราคา")}</h2>
              <p className="text-xs text-zinc-500">{t("ราคาใหม่ใช้ตั้งแต่วันนี้ (มีคนจ่ายแล้วเริ่มพรุ่งนี้) บิลเก่าไม่เปลี่ยน แก้ยอดรายคนที่ คิดเงิน > กดชื่อ")}</p>
              {numberFields.map((f) => (
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
              <div className="space-y-2 border-t border-zinc-100 pt-3">
                <h2 className="font-display font-semibold">{t("ช่องทางรับเงิน")}</h2>
                <p className="text-xs text-zinc-500">{t("เปิดได้ทั้ง 2 ทาง หรือทางเดียว ผู้เล่นจะเห็นทุกทางที่เปิดไว้ตอนจ่ายเงิน")}</p>
                <PayChannel
                  icon="📱"
                  title={t("PromptPay")}
                  on={s.promptPayOn !== false}
                  canToggle={switches}
                  onToggle={(v) => {
                    setSaved(false);
                    setS({ ...s, promptPayOn: v });
                  }}
                >
                  <label className="block space-y-1.5 text-sm font-medium">
                    {t("เบอร์มือถือ / เลขบัตร 13 หลัก")}
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
                </PayChannel>
                <PayChannel
                  icon="🏦"
                  title={t("บัญชีธนาคาร")}
                  on={s.bankOn !== false}
                  canToggle={switches}
                  onToggle={(v) => {
                    setSaved(false);
                    setS({ ...s, bankOn: v });
                  }}
                >
                  {(
                    [
                      ["bankName", t("ชื่อธนาคาร เช่น กสิกรไทย")],
                      ["bankAccount", t("เลขบัญชี")],
                      ["bankHolder", t("ชื่อบัญชี")],
                    ] as const
                  ).map(([k, ph]) => (
                    <input
                      key={k}
                      className={inputClass}
                      placeholder={ph}
                      aria-label={ph}
                      maxLength={60}
                      inputMode={k === "bankAccount" ? "numeric" : "text"}
                      value={s[k]}
                      onChange={(e) => {
                        setSaved(false);
                        setS({ ...s, [k]: e.target.value });
                      }}
                    />
                  ))}
                </PayChannel>
                <p className={`rounded-xl px-3 py-2 text-sm ${shown.length ? "bg-zinc-50" : "bg-red-50 font-semibold text-red-600"}`}>
                  {shown.length ? t("ผู้เล่นจะเห็น: {list}", { list: shown.join(" + ") }) : t("ไม่มีช่องทางรับเงิน ผู้เล่นจะโอนเงินไม่ได้")}
                </p>
                {!switches && <p className="text-xs text-zinc-500">{t("สวิตช์เปิด/ปิดใช้ได้หลังรัน SQL payment_switches.sql")}</p>}
              </div>
              <Button variant="primary" type="submit" className="w-full">
                {saved ? t("บันทึกแล้ว ✓") : t("บันทึก")}
              </Button>
            </form>
          </Card>
      </Section>
      {packagesReady && (
        <Section id="packages" icon="🎫" title={t("แพ็กเกจสมาชิก")} hint={t("รายวัน รายเดือน รายปี ตั้งชื่อ ราคา วันหมดอายุ")}>
          <PackageAdmin />
        </Section>
      )}
      <Section id="festival" icon="🎉" title={t("ธีมเทศกาล")} hint={t("ฮาโลวีน คริสต์มาส ปีใหม่ สงกรานต์")}>
        <FestivalPicker />
      </Section>
      {auth.online && (
        <Section id="admins" icon="👤" title={t("แอดมินและบัญชีของฉัน")} hint={t("ผูก LINE ตั้ง/ถอดแอดมิน ออกจากระบบ")}>
          <LoginTab bare />
        </Section>
      )}
      <div className="px-1 pt-2 text-sm font-semibold text-zinc-500">{t("ระวัง")}</div>
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
/** ช่องทางรับเงินหนึ่งทาง มีสวิตช์เปิด/ปิด (ปิดแล้วเลขเดิมยังเก็บไว้) */
function PayChannel({ icon, title, on, canToggle, onToggle, children }: { icon: string; title: string; on: boolean; canToggle: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className={`space-y-2 rounded-2xl p-3 ring-1 ${on ? "bg-emerald-50 ring-emerald-300" : "bg-zinc-50 ring-zinc-200"}`}>
      <div className="flex min-h-11 items-center gap-2">
        <span aria-hidden>{icon}</span>
        <span className={`min-w-0 flex-1 font-semibold ${on ? "" : "text-zinc-500"}`}>{title}</span>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={title}
            onClick={() => onToggle(!on)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-600" : "bg-zinc-300"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        )}
      </div>
      {on ? children : <p className="text-xs text-zinc-500">{t("ปิดไว้ เลขเดิมยังจำไว้ เปิดกลับได้ทันที")}</p>}
    </div>
  );
}

/** ตั้งค่า > สนามวันนี้: สนามในก๊วนและเบอร์สนาม (ใช้ตอนจัดคู่และจอทีวี) หน้าสนามเรียงตามเบอร์ */
function CourtCountCard() {
  const { state } = useStore();
  // ยังไม่รัน SQL court_numbers.sql = ตั้งได้แค่จำนวนสนาม (เบอร์ 1..n)
  return state.settings.courtNumbers === undefined ? <CourtCountOnly /> : <CourtNumbersEditor />;
}

function CourtCountOnly() {
  const { state, dispatch } = useStore();
  const [n, setN] = useState(String(state.settings.courtCount));
  const [saved, setSaved] = useState(false);
  const v = Math.round(Number(n));
  const ok = v >= 1 && v <= 30;
  return (
    <Card className="space-y-2">
      <h2 className="font-display font-semibold">{t("จำนวนสนามในก๊วน")}</h2>
      <p className="text-xs text-zinc-500">{t("ใช้ตอนจัดคู่และบนจอทีวี")}</p>
      <div className="flex gap-2">
        <input
          className={inputClass}
          inputMode="numeric"
          aria-label={t("จำนวนสนามในก๊วน")}
          value={n}
          onChange={(e) => {
            setSaved(false);
            setN(e.target.value.replace(/\D/g, ""));
          }}
        />
        <Button
          variant="primary"
          className="shrink-0"
          disabled={!ok || v === state.settings.courtCount}
          onClick={() => {
            dispatch({ type: "updateSettings", settings: { ...state.settings, courtCount: v } });
            setSaved(true);
          }}
        >
          {saved ? t("บันทึกแล้ว ✓") : t("บันทึก")}
        </Button>
      </div>
      <p className="text-xs text-amber-700">{t("ตั้งเบอร์สนามเอง (เช่น 3, 5, 7) ได้หลังผู้ดูแลระบบอัปเดตฐานข้อมูล")}</p>
    </Card>
  );
}

function CourtNumbersEditor() {
  const { state, dispatch } = useStore();
  const { day } = useToday();
  const current = courtList(state.settings);
  const [rows, setRows] = useState(() => current.map(String));
  const [saved, setSaved] = useState(false);
  // ยังไม่ได้แก้ แล้วข้อมูลเปลี่ยน (แอดมินอีกคนแก้ / บันทึกไม่สำเร็จ) ให้ช่องตามค่าล่าสุด
  const [base, setBase] = useState(current.join());
  if (base !== current.join()) {
    setBase(current.join());
    if (rows.join() === base) setRows(current.map(String));
  }
  const nums = rows.map((r) => Number(r));
  const bad = (i: number) => !(nums[i] >= 1 && nums[i] <= 99) || nums.indexOf(nums[i]) !== i;
  const sorted = [...new Set(nums.filter((x) => x >= 1 && x <= 99))].sort((a, b) => a - b);
  const ok = rows.length >= 1 && rows.every((_, i) => !bad(i));
  const same = ok && sorted.join() === current.join();
  // สนามที่ยังมีเกม/คิวค้าง แต่จะไม่อยู่ในรายการใหม่: ยังโชว์จนจบเกม/เอาคิวออก
  // สนามที่มีเกมหรือคิวอยู่ แก้/เอาออกไม่ได้จนจบเกมหรือเอาคิวออก (ไม่งั้นสนามเดียวจะโชว์สองเบอร์)
  const busy = new Set([...day.games.filter((g) => !g.endedAt).map((g) => g.court), ...(day.queued ?? []).map((q) => q.court)]);
  const locked = (i: number) => current.includes(nums[i]) && busy.has(nums[i]);
  const lockedNow = current.filter((c) => busy.has(c));
  const edit = (i: number, v: string) => {
    setSaved(false);
    setRows(rows.map((r, k) => (k === i ? v.replace(/\D/g, "").slice(0, 2) : r)));
  };
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display font-semibold">{t("สนามในก๊วน")}</h2>
        <p className="text-xs text-zinc-500">{t("ใส่เบอร์ตามสนามจริง หน้าสนามและจอทีวีจะเรียงตามเบอร์")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {rows.map((r, i) => (
          <div key={i} className={`rounded-xl border-2 bg-white p-1.5 ${bad(i) && rows[i] !== "" ? "border-red-400" : "border-zinc-200"}`}>
            <div className="flex min-h-11 items-center justify-between pl-1">
              <span className="whitespace-nowrap text-sm text-zinc-500">{locked(i) ? "🔒 " : ""}{t("สนาม")}</span>
              {!locked(i) && (
              <button
                type="button"
                aria-label={t("เอาสนาม {n} ออก", { n: r || "?" })}
                disabled={rows.length <= 1}
                onClick={() => {
                  setSaved(false);
                  setRows(rows.filter((_, k) => k !== i));
                }}
                className="-m-1.5 flex size-11 items-center justify-center rounded-lg text-xl text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                ×
              </button>
              )}
            </div>
            <input
              className="h-11 w-full rounded-lg bg-zinc-100 text-center font-display text-xl font-bold outline-none focus:ring-2 focus:ring-lime-dark read-only:text-zinc-500"
              inputMode="numeric"
              aria-label={t("เบอร์สนามช่องที่ {n}", { n: i + 1 })}
              value={r}
              readOnly={locked(i)}
              autoFocus={i === rows.length - 1 && r === "" && i > 0}
              onChange={(e) => edit(i, e.target.value)}
            />
          </div>
        ))}
        {rows.length < 30 && (
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setRows([...rows, ""]);
            }}
            className="flex min-h-20 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-sm font-semibold text-emerald-700"
          >
            {t("+ เพิ่มสนาม")}
          </button>
        )}
      </div>
      {!ok ? (
        <p className="text-sm text-red-600" role="alert">
          {rows.some((r, i) => r !== "" && nums[i] >= 1 && nums.indexOf(nums[i]) !== i) ? t("มีเบอร์สนามซ้ำกัน") : t("ใส่เบอร์สนาม 1-99 ให้ครบทุกช่อง")}
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          {t("หน้าสนามจะเรียง")}: <b>{sorted.map((n) => t("สนาม {n}", { n })).join(" · ")}</b>
        </p>
      )}
      {lockedNow.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          {t("🔒 สนาม {n} มีเกมหรือคิวอยู่ แก้เบอร์ได้หลังจบเกมและไม่มีคิวค้าง", { n: lockedNow.join(", ") })}
        </p>
      )}
      {ok && !same && day.checkIns.length > 0 && <p className="text-xs text-zinc-500">{t("คนที่รอคิวอยู่จะเห็นเบอร์สนามใหม่ทันทีที่บันทึก")}</p>}
      <Button
        variant="primary"
        className="w-full"
        disabled={!ok || same}
        onClick={() => {
          // เบอร์ 1..n ตามลำดับ = ไม่ได้ตั้งเบอร์เอง เก็บเป็นค่าว่าง
          const plain = sorted.every((n, i) => n === i + 1);
          dispatch({ type: "updateSettings", settings: { ...state.settings, courtCount: sorted.length, courtNumbers: plain ? [] : sorted } });
          setRows(sorted.map(String));
          setSaved(true);
        }}
      >
        {saved && same ? t("บันทึกแล้ว ✓") : t("บันทึก")}
      </Button>
    </Card>
  );
}

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
        className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left ${danger ? "border-red-200" : "border-zinc-200"}`}
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
