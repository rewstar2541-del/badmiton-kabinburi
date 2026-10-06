"use client";

import { YearSummaryView } from "./YearSummary";
import { Fragment, useEffect, useState, type ComponentType, type SVGProps } from "react";
import { PlayerModeProvider, StoreProvider, useStore, useToday } from "@/lib/store";
import { BillingTab } from "./BillingTab";
import { FirstAdminCard } from "./PickMe";
import { readSession } from "@/lib/session";
import { monthlyDue } from "./Membership";
import { MyBillTab } from "./MyBillTab";
import { CheckInTab } from "./CheckInTab";
import { CourtsTab } from "./CourtsTab";
import { PlayersTab } from "./PlayersTab";
import { SettingsTab } from "./SettingsTab";
import { AdminHome, PlayerHome } from "./Home";
import { ProfileTab } from "./Profile";
import { useMe } from "./PickMe";
import { TvView } from "./TvView";
import { QrOnlyPage } from "./PayQr";
import { appName } from "@/lib/brand";
import { Avatar, Icon } from "./ui";
import { LANGS, setLang, t, useLang } from "@/lib/i18n";
import { setTheme, useTheme } from "@/lib/theme";

type TabId = "home" | "today" | "checkin" | "courts" | "billing" | "players" | "settings" | "mybill" | "profile";
type Tab = { id: TabId; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

const ADMIN_TABS: Tab[] = [
  { id: "home", label: "หน้าแรก", icon: Icon.Home },
  { id: "checkin", label: "เช็คอิน", icon: Icon.CheckIn },
  { id: "courts", label: "สนาม", icon: Icon.Court },
  { id: "billing", label: "คิดเงิน", icon: Icon.Wallet },
  { id: "settings", label: "ตั้งค่า", icon: Icon.Settings },
];
/** หน้าที่แอดมินเปิดได้จากหน้าแรก แต่ไม่มีปุ่มบนแถบล่าง */
const ADMIN_EXTRA: TabId[] = ["players"];

const PLAYER_TABS: Tab[] = [
  { id: "home", label: "หน้าแรก", icon: Icon.Home },
  { id: "courts", label: "สนาม", icon: Icon.Court },
  { id: "mybill", label: "ยอดของฉัน", icon: Icon.Wallet },
  { id: "profile", label: "โปรไฟล์", icon: Icon.User },
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
      className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200"
      aria-label={dark ? t("ธีมสว่าง") : t("ธีมมืด")}
      title={dark ? t("ธีมสว่าง") : t("ธีมมืด")}
    >
      {dark ? (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
      className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-base font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200"
      aria-label={t("คู่มือการใช้งาน")}
      title={t("คู่มือการใช้งาน")}
    >
      ?
    </a>
  );
}

/** ปุ่มภาษาเล็กๆ แตะเพื่อเปลี่ยนไปภาษาถัดไป */
function LangSwitch() {
  const lang = useLang();
  const i = LANGS.findIndex((l) => l.value === lang);
  return (
    <button
      onClick={() => setLang(LANGS[(i + 1) % LANGS.length].value)}
      className="h-10 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200"
      aria-label={t("ภาษา")}
    >
      {LANGS[i]?.label ?? "ไทย"}
    </button>
  );
}

/** แถบโหมดทดลอง สลับดูแบบผู้เล่น/แอดมิน */
function DemoBar() {
  const { auth } = useStore();
  if (!auth.demo) return null;
  const demo = auth.demo;
  return (
    <div className="flex items-center gap-2 bg-amber-300 px-3 py-1.5 text-xs text-ink">
      <span className="min-w-0 flex-1 truncate font-semibold">{t("โหมดทดลอง (ข้อมูลอยู่ในเครื่องนี้)")}</span>
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
    <div className="flex shrink-0 rounded-full bg-zinc-200 p-0.5" role="group" aria-label={t("วันนี้ฉันเป็น")}>
      {[false, true].map((player) => (
        <button
          key={String(player)}
          onClick={() => {
            set(player);
            window.scrollTo({ top: 0 });
          }}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${Boolean(auth.playerMode) === player ? "bg-ink text-white" : "text-zinc-600"}`}
        >
          {player ? t("ผู้เล่น") : t("แอดมิน")}
        </button>
      ))}
    </div>
  );
}

/** แถบบนสุด: ทักทาย ชื่อก๊วน และปุ่มเล็กๆ (ภาษา คู่มือ ธีม) */
function Header() {
  const { state, auth } = useStore();
  const [me] = useMe();
  const player = state.players.find((p) => p.id === me && !p.pending);
  return (
    <header className="mx-auto w-full max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3">
      <div className="flex items-center gap-3">
        {player ? (
          <Avatar name={player.name} photo={player.photo} size={46} />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime text-ink">
            <Icon.Shuttle width={24} height={24} strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`font-display leading-tight font-semibold ${player ? "truncate text-lg" : "text-base"}`}>
            {player ? t("สวัสดี {name}", { name: player.name }) : appName()[0]}
          </h1>
          <p className="truncate text-sm text-zinc-600">{player ? appName()[0] : appName()[1]}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <LangSwitch />
          <GuideButton />
          <ThemeSwitch />
        </div>
      </div>
      {auth.canAdmin && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-zinc-600">
          {t("วันนี้ฉันเป็น")}
          <ModeSwitch />
        </div>
      )}
    </header>
  );
}

function Shell() {
  const { auth, ready, error, clearError, state } = useStore();
  const { date } = useToday();
  const lang = useLang();
  // เข้าด้วย LINE แล้วเป็นแอดมิน เมนูแอดมินจะขึ้นเอง
  const tabs = auth.isAdmin ? ADMIN_TABS : PLAYER_TABS;
  const [picked, setTab] = useState<TabId>(tabs[0].id);
  const allowed = (id: TabId) => tabs.some((t) => t.id === id) || (auth.isAdmin && ADMIN_EXTRA.includes(id));
  const tab = allowed(picked) ? picked : tabs[0].id;
  // ปุ่มในหน้าต่างๆ สั่งเปลี่ยนแท็บได้ (เช่น แจ้งเตือนจ่ายรายเดือน -> ยอดของฉัน)
  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<TabId>).detail;
      setTab(id === "today" ? "home" : id);
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-1 pb-32">
        {error && (
          <div role="alert" className="error-bar sticky top-2 z-30 mb-4 flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button type="button" onClick={clearError} className="-mr-2 min-h-11 min-w-11 shrink-0 rounded-xl px-3 font-semibold underline">
              {t("ปิด")}
            </button>
          </div>
        )}
        {auth.playerMode && auth.online && !readSession() && (
          <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("ต้องผูก LINE กับชื่อก่อน: โหมดแอดมิน > ตั้งค่า > ผูก LINE ของฉัน")}
          </p>
        )}
        {!auth.isAdmin && (
          <div className="mb-4 empty:hidden">
            <FirstAdminCard />
          </div>
        )}
        {tab === "home" && (auth.isAdmin ? <AdminHome /> : <PlayerHome />)}
        {tab === "profile" && <ProfileTab />}
        {tab === "checkin" && <CheckInTab />}
        {tab === "courts" && <CourtsTab />}
        {tab === "billing" && <BillingTab />}
        {tab === "players" && <PlayersTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "mybill" && <MyBillTab />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md gap-1 px-2 py-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  window.scrollTo({ top: 0 });
                }}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-semibold transition ${
                  active ? "bg-lime text-ink" : "text-zinc-600 active:bg-zinc-100"
                }`}
              >
                <span className="relative">
                  <item.icon width={24} height={24} strokeWidth={active ? 2.4 : 2} />
                  {item.id === "mybill" && billDot && (
                    <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-white" aria-label={t("ยังไม่จ่ายค่ารายเดือน")} />
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

function SummaryRoute() {
  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6">
      <YearSummaryView year={new URLSearchParams(location.search).get("summary") ?? undefined} />
    </main>
  );
}

function QrRoute() {
  const { state } = useStore();
  return <QrOnlyPage promptPayId={state.settings.promptPayId} />;
}

export function App() {
  return (
    <StoreProvider>
      <PlayerModeProvider>
        {hasParam("payqr") ? <QrRoute /> : isTv() ? <TvView /> : hasParam("summary") ? <SummaryRoute /> : <Shell />}
      </PlayerModeProvider>
    </StoreProvider>
  );
}
