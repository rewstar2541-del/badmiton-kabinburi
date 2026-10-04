"use client";

import { Fragment, useState, type ComponentType, type SVGProps } from "react";
import { waitingQueue } from "@/lib/matchmaking";
import { StoreProvider, useStore, useToday } from "@/lib/store";
import { BillingTab } from "./BillingTab";
import { LoginTab } from "./LoginTab";
import { MyBillTab } from "./MyBillTab";
import { CheckInTab } from "./CheckInTab";
import { CourtsTab } from "./CourtsTab";
import { PlayersTab } from "./PlayersTab";
import { SettingsTab } from "./SettingsTab";
import { TodayTab } from "./TodayTab";
import { TvView } from "./TvView";
import { APP_NAME } from "@/lib/brand";
import { Icon } from "./ui";
import { LANGS, locale, setLang, t, useLang } from "@/lib/i18n";

type TabId = "today" | "checkin" | "courts" | "billing" | "players" | "settings" | "mybill" | "login";
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
  { id: "login", label: "แอดมิน", icon: Icon.Settings },
];

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
            className={`rounded-full px-2.5 py-1 font-semibold ${auth.isAdmin === admin ? "bg-ink text-white" : ""}`}
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

function Header() {
  const { state } = useStore();
  const { day } = useToday();
  const playing = day.games.filter((g) => !g.endedAt).length * 4;
  const waiting = waitingQueue(day, state.players).length;

  const stats = [
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
              {APP_NAME[0]}
              <span className="block text-sm font-medium text-lime">{APP_NAME[1]}</span>
            </h1>
            <p className="text-xs text-white/60">
              {new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <LangSwitch />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10">
              <div className="font-display text-2xl leading-none font-semibold">{s.value}</div>
              <div className="mt-1 text-[11px] text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function Shell() {
  const { auth, ready, error } = useStore();
  const lang = useLang();
  const tabs = auth.isAdmin ? ADMIN_TABS : PLAYER_TABS;
  const [picked, setTab] = useState<TabId>(tabs[0].id);
  const tab = tabs.some((t) => t.id === picked) ? picked : tabs[0].id;

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
        {tab === "today" && <TodayTab />}
        {tab === "checkin" && <CheckInTab />}
        {tab === "courts" && <CourtsTab />}
        {tab === "billing" && <BillingTab />}
        {tab === "players" && <PlayersTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "mybill" && <MyBillTab />}
        {tab === "login" && <LoginTab />}
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
                <item.icon width={20} height={20} strokeWidth={active ? 2.4 : 2} />
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
  try {
    return new URLSearchParams(window.location.search).has("tv");
  } catch {
    return false;
  }
}

export function App() {
  return <StoreProvider>{isTv() ? <TvView /> : <Shell />}</StoreProvider>;
}
