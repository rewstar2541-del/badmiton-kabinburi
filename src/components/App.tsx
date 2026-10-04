"use client";

import { useState } from "react";
import { StoreProvider } from "@/lib/store";
import { BillingTab } from "./BillingTab";
import { CheckInTab } from "./CheckInTab";
import { CourtsTab } from "./CourtsTab";
import { PlayersTab } from "./PlayersTab";
import { SettingsTab } from "./SettingsTab";

const TABS = [
  { id: "checkin", label: "เช็คอิน", icon: "✓", el: <CheckInTab /> },
  { id: "courts", label: "สนาม", icon: "🏸", el: <CourtsTab /> },
  { id: "billing", label: "คิดเงิน", icon: "฿", el: <BillingTab /> },
  { id: "players", label: "ผู้เล่น", icon: "👥", el: <PlayersTab /> },
  { id: "settings", label: "ตั้งค่า", icon: "⚙", el: <SettingsTab /> },
] as const;

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("checkin");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <StoreProvider>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <h1 className="text-base font-semibold">ก๊วนแบดกบินทร์บุรี</h1>
        <p className="text-xs text-zinc-500">
          {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">{current.el}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                tab === t.id ? "text-emerald-600" : "text-zinc-500"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </StoreProvider>
  );
}
