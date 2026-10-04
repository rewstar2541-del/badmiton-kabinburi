"use client";

import { InstallApp } from "./InstallApp";
import { Fragment, useEffect, useState, type ComponentType, type SVGProps } from "react";
import { waitingQueue } from "@/lib/matchmaking";
import { PlayerModeProvider, StoreProvider, useStore, useToday } from "@/lib/store";
import { BillingTab } from "./BillingTab";
import { FirstAdminCard } from "./PickMe";
import { readSession } from "@/lib/session";
import { monthlyDue } from "./Membership";
import { MyBillTab } from "./MyBillTab";
import { CheckInTab, SignupList } from "./CheckInTab";
import { CourtsTab } from "./CourtsTab";
import { PlayersTab } from "./PlayersTab";
import { SettingsTab } from "./SettingsTab";
import { TodayTab } from "./TodayTab";
import { TvView } from "./TvView";
import { QrOnlyPage } from "./PayQr";
import { appName } from "@/lib/brand";
import { Icon, Sheet } from "./ui";
import { LANGS, locale, setLang, t, useLang } from "@/lib/i18n";
import { setTheme, useTheme } from "@/lib/theme";

type TabId = "today" | "checkin" | "courts" | "billing" | "players" | "settings" | "mybill";
type Tab = { id: TabId; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

const ADMIN_TABS: Tab[] = [
  { id: "checkin", label: "เช็คอิน", icon: Icon.CheckIn },
  { id: "courts", label: "สนาม", icon: Icon.Court },
  { id: "billing", label: "คิดเงิน", icon: Icon.Wallet },
  { id: "players", label: "ผู้เล่น", icon: Icon.Users },
  { id: "settings", label: "ตั้งค่า", icon: Icon.Settings },
];

/** ผู้เล่นทั่วไปที่เปิดลิงก์ ดูได้อย่างเดียว */
const PLAYER_TABS: Tab[] = [
  { id: "today", label: "วันนี้", icon: Icon.Megaphone },
  { id: "courts", label: "สนาม", icon: Icon.Court },
  { id: "mybill", label: "ยอดของฉัน", icon: Icon.Wallet },
];

function hasParam(name: string) {
  try {
    return new URLSearchParams(window.location.search).has(name);
  } catch {
    return false;
  }
}

/** สลับธีมสว่าง/มืด (มืดอ่านง่ายในสนามที่ไฟสลัว) */
function ThemeSwitch() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/10"
      aria-label={dark ? t("ธีมสว่าง") : t("ธีมมืด")}
      title={dark ? t("ธีมสว่าง") : t("ธีมมืด")}
    >
      {dark ? (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

/** เปิดคู่มือการใช้งาน (หน้าเว็บแยกใน public/guide) ตามภาษาที่เลือก */
function GuideButton() {
  const lang = useLang();
  const { auth } = useStore();
  // โหมดผู้เล่นเห็นคู่มือฝั่งผู้เล่น โหมดแอดมินเห็นฝั่งแอดมิน
  const mode = auth.isAdmin ? "admin" : "player";
  return (
    <a
      href={`/guide/index.html?lang=${lang}&mode=${mode}`}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white/80 ring-1 ring-white/10"
      aria-label={t("คู่มือการใช้งาน")}
      title={t("คู่มือการใช้งาน")}
    >
      ?
    </a>
  );
}

function LangSwitch() {
  const lang = useLang();
  return (
    <div className="flex shrink-0 rounded-full bg-white/10 p-0.5 ring-1 ring-white/10">
      {LANGS.map((l) => (
        <button
          key={l.value}
          onClick={() => setLang(l.value)}
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${lang === l.value ? "bg-lime text-ink" : "text-white/70"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** แถบโหมดทดลอง สลับดูแบบผู้เล่น/แอดมิน */
function DemoBar() {
  const { auth } = useStore();
  if (!auth.demo) return null;
  const demo = auth.demo;
  return (
    <div className="flex items-center gap-2 bg-amber-300 px-3 py-1.5 text-xs text-ink">
      <span className="min-w-0 flex-1 truncate font-semibold">{t("โหมดทดลอง ข้อมูลเก็บในเครื่องนี้เท่านั้น")}</span>
      <div className="flex shrink-0 rounded-full bg-ink/10 p-0.5">
        {[false, true].map((admin) => (
          <button
            key={String(admin)}
            onClick={() => demo.setAdmin(admin)}
            className={`rounded-full px-2.5 py-1 font-semibold ${(auth.canAdmin ?? auth.isAdmin) === admin ? "bg-ink text-white" : ""}`}
          >
            {admin ? t("แอดมิน") : t("ผู้เล่น")}
          </button>
        ))}
      </div>
      <button
        className="shrink-0 underline"
        onClick={() => {
          if (confirm(t("ล้างข้อมูลทดลองแล้วเริ่มใหม่?"))) demo.reset();
        }}
      >
        {t("เริ่มใหม่")}
      </button>
    </div>
  );
}

/** แอดมินสลับ วันนี้เป็นแอดมิน หรือเป็นผู้เล่นธรรมดา */
function ModeSwitch() {
  const { auth } = useStore();
  if (!auth.canAdmin || !auth.setPlayerMode) return null;
  const set = auth.setPlayerMode;
  return (
    <div className="flex shrink-0 rounded-full bg-white/10 p-0.5 ring-1 ring-white/10" role="group" aria-label={t("วันนี้ฉันเป็น")}>
      {[false, true].map((player) => (
        <button
          key={String(player)}
          onClick={() => {
            set(player);
            window.scrollTo({ top: 0 });
          }}
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${Boolean(auth.playerMode) === player ? "bg-lime text-ink" : "text-white/70"}`}
        >
          {player ? t("ผู้เล่น") : t("แอดมิน")}
        </button>
      ))}
    </div>
  );
}

function Header() {
  const { state, auth } = useStore();
  const [showSignups, setShowSignups] = useState(false);
  const { day } = useToday();
  const playing = day.games.filter((g) => !g.endedAt).length * 4;
  const waiting = waitingQueue(day, state.players).length;

  const stats = [
    { label: t("ลงชื่อ"), value: day.signups?.length ?? 0 },
    { label: t("มาแล้ว"), value: day.checkIns.length },
    { label: t("กำลังเล่น"), value: playing },
    { label: t("รอคิว"), value: waiting },
  ];

  return (
    <header className="relative overflow-hidden bg-ink px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-6 text-white">
      <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-lime/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 size-56 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime text-ink">
            <Icon.Shuttle width={22} height={22} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base leading-tight font-semibold">
              {appName()[0]}
              <span className="block text-sm font-medium text-lime">{appName()[1]}</span>
            </h1>
            <p className="text-xs text-white/60">
              {new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {/* ปุ่มซ้อนกันทางขวา เรียงตามความสำคัญจากบนลงล่าง: โหมดแอดมิน/ผู้เล่น ภาษา คู่มือกับธีม */}
          <div className="flex shrink-0 flex-col items-end gap-1.5 self-start">
            <ModeSwitch />
            <LangSwitch />
            <div className="flex gap-1.5">
              <GuideButton />
              <ThemeSwitch />
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {stats.map((s, i) => {
            // แอดมินแตะช่อง "ลงชื่อ" เพื่อดูว่าใครลงชื่อไว้บ้าง
            const tap = i === 0 && auth.isAdmin;
            const Box = tap ? "button" : "div";
            return (
              <Box
                key={s.label}
                {...(tap ? { onClick: () => setShowSignups(true) } : {})}
                className={`rounded-2xl bg-white/[0.07] px-3 py-2.5 text-left ring-1 ring-white/10 ${tap ? "ring-lime/40 active:scale-[0.97]" : ""}`}
              >
                <div className="font-display text-2xl leading-none font-semibold">{s.value}</div>
                <div className="mt-1 text-[11px] text-white/60">
                  {s.label}
                  {tap && " ›"}
                </div>
              </Box>
            );
          })}
        </div>
        {showSignups && (
          <Sheet title={<h3 className="font-display text-lg font-semibold text-ink">{t("คนที่ลงชื่อวันนี้")}</h3>} onClose={() => setShowSignups(false)}>
            <div className="text-ink">
              <SignupList bare />
            </div>
          </Sheet>
        )}
      </div>
    </header>
  );
}

function Shell() {
  const { auth, ready, error, state } = useStore();
  const { date } = useToday();
  const lang = useLang();
  // เข้าด้วย LINE แล้วเป็นแอดมิน เมนูแอดมินจะขึ้นเอง
  const tabs = auth.isAdmin ? ADMIN_TABS : PLAYER_TABS;
  const [picked, setTab] = useState<TabId>(tabs[0].id);
  const tab = tabs.some((t) => t.id === picked) ? picked : tabs[0].id;
  // ปุ่มในหน้าต่างๆ สั่งเปลี่ยนแท็บได้ (เช่น แจ้งเตือนจ่ายรายเดือน -> ยอดของฉัน)
  useEffect(() => {
    const go = (e: Event) => {
      setTab((e as CustomEvent<TabId>).detail);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("goto-tab", go);
    return () => window.removeEventListener("goto-tab", go);
  }, []);
  // จุดแดงที่ "ยอดของฉัน" เมื่อยังไม่จ่ายค่ารายเดือน
  const billDot = !auth.isAdmin && monthlyDue(state, state.players.find((p) => p.id === readSession()?.playerId), date);

  if (!ready)
    return (
      <div className="grid flex-1 place-items-center bg-ink text-white">
        <div className="flex flex-col items-center gap-3">
          <span className="grid size-14 animate-pulse place-items-center rounded-3xl bg-lime text-ink">
            <Icon.Shuttle width={28} height={28} />
          </span>
          <span className="text-sm text-white/60">{t("กำลังโหลด...")}</span>
        </div>
      </div>
    );

  return (
    <Fragment key={lang}>
      <DemoBar />
      <Header />
      <main className="mx-auto -mt-2 w-full max-w-3xl flex-1 rounded-t-[28px] bg-background px-4 pt-5 pb-32">
        {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {auth.playerMode && auth.online && !readSession() && (
          <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("โหมดผู้เล่นต้องผูก LINE กับชื่อของคุณก่อน: สลับเป็นแอดมิน แล้วไปที่ ตั้งค่า > ผูก LINE ของฉันกับชื่อในก๊วน")}
          </p>
        )}
        {!auth.isAdmin && (
          <div className="mb-4 empty:hidden">
            <FirstAdminCard />
          </div>
        )}
        {(tab === "today" || tab === "checkin") && (
          <div className="mb-4 empty:hidden">
            <InstallApp />
          </div>
        )}
        {tab === "today" && <TodayTab />}
        {tab === "checkin" && <CheckInTab />}
        {tab === "courts" && <CourtsTab />}
        {tab === "billing" && <BillingTab />}
        {tab === "players" && <PlayersTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "mybill" && <MyBillTab />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div
          className="mx-auto grid max-w-md rounded-[26px] bg-ink/95 p-1.5 shadow-xl shadow-ink/30 backdrop-blur"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-medium transition ${
                  active ? "bg-lime text-ink" : "text-white/60 active:text-white"
                }`}
              >
                <span className="relative">
                  <item.icon width={20} height={20} strokeWidth={active ? 2.4 : 2} />
                  {item.id === "mybill" && billDot && (
                    <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-ink" aria-label={t("ยังไม่จ่ายค่ารายเดือน")} />
                  )}
                </span>
                {t(item.label)}
              </button>
            );
          })}
        </div>
      </nav>
    </Fragment>
  );
}

function isTv() {
  return hasParam("tv");
}

function QrRoute() {
  const { state } = useStore();
  return <QrOnlyPage promptPayId={state.settings.promptPayId} />;
}

export function App() {
  return (
    <StoreProvider>
      <PlayerModeProvider>{hasParam("payqr") ? <QrRoute /> : isTv() ? <TvView /> : <Shell />}</PlayerModeProvider>
    </StoreProvider>
  );
}
