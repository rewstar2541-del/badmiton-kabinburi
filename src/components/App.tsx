"use client";

import { useState, type ComponentType, type SVGProps } from "react";
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
import { Icon } from "./ui";

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

function Header() {
  const { state } = useStore();
  const { day } = useToday();
  const playing = day.games.filter((g) => !g.endedAt).length * 4;
  const waiting = waitingQueue(day, state.players).length;

  const stats = [
    { label: "มาแล้ว", value: day.checkIns.length },
    { label: "กำลังเล่น", value: playing },
    { label: "รอคิว", value: waiting },
  ];

  return (
    <header className="relative overflow-hidden bg-ink px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-6 text-white">
      <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-lime/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 size-56 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-lime text-ink">
            <Icon.Shuttle width={22} height={22} strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="font-display text-lg leading-tight font-semibold">ก๊วนแบดกบินทร์บุรี</h1>
            <p className="text-xs text-white/60">
              {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
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
          <span className="text-sm text-white/60">กำลังโหลด...</span>
        </div>
      </div>
    );

  return (
    <>
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
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-medium transition ${
                  active ? "bg-lime text-ink" : "text-white/60 active:text-white"
                }`}
              >
                <t.icon width={20} height={20} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
