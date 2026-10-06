"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { presence, waitingQueue } from "@/lib/matchmaking";
import { signupQueue } from "@/lib/social";
import { useStore, useToday } from "@/lib/store";
import { LANGS, locale, setLang, t, useLang } from "@/lib/i18n";
import { AnnounceCard } from "./AnnounceCard";
import { BirthdayBanner } from "./Birthday";
import { BoardCard } from "./Board";
import { ClubCalendar } from "./Calendar";
import { SignupList } from "./CheckInTab";
import { ClubCorner } from "./ClubCorner";
import { EventPhotos } from "./EventPhotos";
import { BringGuest } from "./Guests";
import { goToTab } from "./Membership";
import { NoticeBanners, NoticeComposer } from "./Notices";
import { PairCard } from "./Pairs";
import { useMe, savedPin } from "./PickMe";
import { PollAdmin } from "./Polls";
import { RestButton } from "./RestButton";
import { StockWarning } from "./Stock";
import { TodayTab } from "./TodayTab";
import { Card, Icon, SectionTitle, Sheet } from "./ui";

type IconC = ComponentType<SVGProps<SVGSVGElement>>;

/** สีพื้น/สีไอคอนของช่องเมนู วนตามลำดับ (มีสีโหมดมืดใน globals.css) */
const TONES = [
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
  "bg-amber-50 text-amber-700",
  "bg-violet-50 text-violet-700",
  "bg-zinc-100 text-zinc-600",
  "bg-red-50 text-red-600",
];

export function shortDate() {
  return new Date().toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
}

/** การ์ดสรุปใหญ่ด้านบนของหน้าแรก */
export function Hero({
  label,
  big,
  small,
  sub,
  chips = [],
  icon: I,
  onClick,
}: {
  label: string;
  big: ReactNode;
  small?: string;
  sub?: string;
  chips?: string[];
  icon: IconC;
  onClick?: () => void;
}) {
  const Box = onClick ? "button" : "div";
  return (
    <Box onClick={onClick} className="relative block w-full overflow-hidden rounded-3xl bg-ink p-5 text-left text-white shadow-lg shadow-ink/20 active:scale-[0.99]">
      <div className="pointer-events-none absolute -top-20 -right-12 size-48 rounded-full bg-lime/20 blur-3xl" />
      <span className="absolute top-4 right-4 grid size-11 place-items-center rounded-2xl bg-white/10 text-lime">
        <I width={24} height={24} />
      </span>
      <div className="relative pr-14 text-sm text-white/70">{label}</div>
      <div className="relative pr-14 font-display text-4xl leading-tight font-semibold">
        {big}
        {small && <span className="ml-1.5 text-lg font-medium text-white/80">{small}</span>}
      </div>
      {sub && <div className="relative text-[15px] text-white/80">{sub}</div>}
      {chips.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-semibold text-lime">
              {c}
            </span>
          ))}
        </div>
      )}
      {onClick && <Icon.ChevronRight className="absolute right-4 bottom-4 text-white/60" />}
    </Box>
  );
}

export type Shortcut = { icon: IconC; label: string; onClick?: () => void; href?: string; disabled?: string };

/** ปุ่มลัดกลม 4 ปุ่มใต้การ์ดสรุป */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  // ปุ่มที่ยังใช้ไม่ได้ กดแล้วบอกเหตุผล (disabled = ข้อความเหตุผล)
  const [why, setWhy] = useState("");
  return (
    <div className="space-y-2">
    <div className="grid grid-cols-4 gap-2">
      {items.map((s) => {
        const inner = (
          <>
            <span className="grid size-14 place-items-center rounded-2xl bg-lime/30 text-ink">
              <s.icon width={26} height={26} />
            </span>
            <span className="text-sm font-medium text-zinc-700">{s.label}</span>
          </>
        );
        const cls = `flex flex-col items-center gap-1.5 py-1 active:scale-95 ${s.disabled ? "opacity-40" : ""}`;
        return s.href ? (
          <a key={s.label} href={s.href} className={cls}>
            {inner}
          </a>
        ) : (
          <button key={s.label} onClick={s.disabled ? () => setWhy(s.disabled!) : s.onClick} aria-disabled={!!s.disabled} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
    {why && (
      <button onClick={() => setWhy("")} className="w-full rounded-2xl bg-amber-50 px-4 py-3 text-left text-[15px] font-medium text-amber-900">
        {why}
      </button>
    )}
    </div>
  );
}

export type Tile = { icon: IconC; label: string; onClick: () => void; badge?: number };

/** ช่องเมนูสีๆ 3 คอลัมน์ */
export function Tiles({ items }: { items: Tile[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((it, i) => (
        <button
          key={it.label}
          onClick={it.onClick}
          className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1 pt-4 pb-3 text-center active:scale-95 ${TONES[i % TONES.length]}`}
        >
          <it.icon width={28} height={28} />
          <span className="text-sm leading-tight font-semibold break-words text-ink">{it.label}</span>
          {!!it.badge && (
            <span className="absolute top-2 right-2 grid min-w-7 place-items-center rounded-full bg-red-500 px-1.5 text-sm font-bold text-white">{it.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export type Row = { icon: IconC; title: string; sub?: string; right?: ReactNode; onClick?: () => void; href?: string; danger?: boolean };

/** รายการแถวในการ์ดเดียว มีไอคอน คำอธิบาย และลูกศร */
export function Rows({ items }: { items: Row[] }) {
  return (
    <Card className="divide-y divide-zinc-100 !p-0">
      {items.map((r, i) => {
        const inner = (
          <>
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${TONES[i % TONES.length]}`}>
              <r.icon width={22} height={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-semibold ${r.danger ? "text-red-600" : ""}`}>{r.title}</span>
              {r.sub && <span className="block truncate text-sm text-zinc-600">{r.sub}</span>}
            </span>
            {r.right}
            <Icon.ChevronRight className="shrink-0 text-zinc-400" width={20} height={20} />
          </>
        );
        const cls = "flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-50";
        return r.href ? (
          <a key={r.title} href={r.href} className={cls}>
            {inner}
          </a>
        ) : (
          <button key={r.title} onClick={r.onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </Card>
  );
}

export function CountBadge({ n, tone }: { n: number; tone: string }) {
  return <span className={`grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-sm font-bold ${tone}`}>{n}</span>;
}

/** แผ่นเลื่อนขึ้นจากด้านล่าง ใช้เปิดเมนูย่อยโดยไม่ต้องเปลี่ยนหน้า */
export function useSheets<K extends string>() {
  const [open, setOpen] = useState<K | null>(null);
  const sheet = (key: K, title: string, body: ReactNode, keepOpen?: boolean) =>
    open === key ? (
      <Sheet title={<h3 className="font-display text-lg font-semibold">{title}</h3>} onClose={() => setOpen(null)} keepOpen={keepOpen}>
        {body}
      </Sheet>
    ) : null;
  return { open: setOpen, sheet };
}

/** ปุ่มเลือกภาษาใหญ่ๆ (ใช้ในแถบบนและหน้าโปรไฟล์) */
export function LangChoices({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  return (
    <div className="grid gap-2">
      {LANGS.map((l) => (
        <button
          key={l.value}
          onClick={() => {
            setLang(l.value);
            onDone();
          }}
          className={`h-14 rounded-2xl text-lg font-semibold ${lang === l.value ? "bg-lime text-ink" : "bg-zinc-100"}`}
        >
          {{ th: "ไทย", en: "English", zh: "中文" }[l.value]}
        </button>
      ))}
    </div>
  );
}

export function guideHref(lang: string, admin: boolean) {
  return `/guide/index.html?lang=${lang}&mode=${admin ? "admin" : "player"}`;
}

/** หน้าแรกของผู้เล่น */
export function PlayerHome() {
  const { state } = useStore();
  const { day, date } = useToday();
  const lang = useLang();
  const [me] = useMe();
  const { open, sheet } = useSheets<"rest" | "pair" | "calendar" | "rank" | "board" | "photos">();
  const player = state.players.find((p) => p.id === me);
  if (!player || player.pending) return <TodayTab />;

  const status = presence(day, player.id);
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  const signedUp = day.signups?.some((s) => s.playerId === player.id) ?? false;
  const announced = day.announcement !== undefined;
  const played = day.games.filter((g) => g.endedAt && g.playerIds.includes(player.id)).length;
  const queue = waitingQueue(day, state.players);
  const pos = queue.findIndex((e) => e.player.id === player.id) + 1;
  const court = day.games.find((g) => !g.endedAt && g.playerIds.includes(player.id))?.court;
  const closed = state.closed[date];

  const hero: { big: string; sub: string } =
    status === "playing"
      ? { big: t("สนาม {n}", { n: court ?? "" }), sub: t("กำลังเล่นอยู่") }
      : status === "waiting"
        ? { big: t("คิวที่ {n}", { n: pos }), sub: pos <= 4 ? t("ใกล้ถึงคิวแล้ว เตรียมตัวได้เลย") : t("รอคิวอยู่ {n} คน", { n: queue.length }) }
        : status === "resting"
          ? { big: t("พักอยู่"), sub: t("ระบบข้ามคิวให้") }
          : status === "home"
            ? { big: t("จ่ายแล้ว"), sub: t("ขอบคุณที่มาเล่นวันนี้") }
            : signedUp
              ? { big: t("ลงชื่อแล้ว"), sub: t("ถึงสนามแล้วกดเช็คอินด้านล่าง") }
              : announced
                ? { big: t("ยังไม่ได้ลงชื่อ"), sub: t("ลงชื่อได้ด้านล่าง") }
                : closed !== undefined
                  ? { big: t("วันนี้งดเล่น"), sub: closed || t("ดูรายละเอียดด้านล่าง") }
                  : { big: t("วันนี้ไม่มีก๊วน"), sub: t("รอแอดมินประกาศ") };
  const chips = [...(ci ? [t("เช็คอินแล้ว ✓")] : []), ...(played ? [t("เล่นแล้ว {n} เกม", { n: played })] : [])];
  const here = !!ci && !ci.paidAt;

  return (
    <div className="space-y-5">
      <Hero label={t("วันนี้ของฉัน · {date}", { date: shortDate() })} big={hero.big} sub={hero.sub} chips={chips} icon={Icon.Shuttle} />
      <Shortcuts
        items={[
          { icon: Icon.Pause, label: t("ขอพัก"), onClick: () => open("rest"), disabled: here ? undefined : t("เช็คอินที่สนามก่อน ถึงจะขอพักได้") },
          { icon: Icon.Wallet, label: t("จ่ายเงิน"), onClick: () => goToTab("mybill") },
          {
            icon: Icon.Hand,
            label: t("ขอคู่"),
            onClick: () => open("pair"),
            disabled: player.guestOf ? t("แขกขอคู่ไม่ได้") : here ? undefined : t("เช็คอินที่สนามก่อน ถึงจะขอคู่หรือพาเพื่อนได้"),
          },
          { icon: Icon.Book, label: t("คู่มือ"), href: guideHref(lang, false) },
        ]}
      />
      <TodayTab home />
      <SectionTitle>{t("เมนูก๊วน")}</SectionTitle>
      <Tiles
        items={[
          { icon: Icon.Calendar, label: t("ปฏิทินก๊วน"), onClick: () => open("calendar") },
          { icon: Icon.Trophy, label: t("อันดับ"), onClick: () => open("rank") },
          { icon: Icon.Box, label: t("ของหาย/ฝากขาย"), onClick: () => open("board") },
          { icon: Icon.Camera, label: t("รูปกิจกรรม"), onClick: () => open("photos") },
          { icon: Icon.Court, label: t("สนามตอนนี้"), onClick: () => goToTab("courts") },
          { icon: Icon.User, label: t("โปรไฟล์"), onClick: () => goToTab("profile") },
        ]}
      />
      {sheet("rest", t("ขอพัก"), here ? <RestButton /> : <p className="text-zinc-600">{t("จ่ายแล้ว ไม่ต้องขอพัก")}</p>)}
      {sheet(
        "pair",
        t("ขอคู่ / พาเพื่อน"),
        <div className="space-y-4">
          <PairCard />
          <BringGuest player={player} pin={savedPin.get()} />
        </div>,
      )}
      {sheet("calendar", t("ปฏิทินก๊วน"), <ClubCalendar bare />)}
      {sheet("rank", t("อันดับ"), <ClubCorner />)}
      {sheet("board", t("ของหาย/ฝากขาย"), <BoardCard />)}
      {sheet("photos", t("รูปกิจกรรม"), <EventPhotos bare />)}
    </div>
  );
}

/** หน้าแรกของแอดมิน: วันนี้เป็นอย่างไร และมีอะไรต้องจัดการ */
export function AdminHome() {
  const { state } = useStore();
  const { day, date } = useToday();
  const { open, sheet } = useSheets<"signups" | "announce" | "calendar" | "poll" | "board" | "photos" | "rank">();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const names = (ids: string[]) =>
    ids
      .map((id) => byId.get(id)?.name ?? "?")
      .slice(0, 4)
      .join(", ") + (ids.length > 4 ? " …" : "");
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const q = signupQueue(day);
  const notArrived = q.confirmed.filter((id) => !checked.has(id));
  // ค้างจ่าย: เลิกเล่นแล้ว (พัก ไม่ได้อยู่ในสนาม) แต่ยังไม่จ่าย ไม่นับคนที่ยังเล่นหรือรอคิว
  const unpaid = day.checkIns.filter((c) => !c.paidAt && presence(day, c.playerId) === "resting").map((c) => c.playerId);
  const pending = state.players.filter((p) => p.pending);
  const playing = day.games.filter((g) => !g.endedAt).length * 4;
  const waiting = waitingQueue(day, state.players).length;
  const announced = day.announcement !== undefined;
  const closed = state.closed[date] !== undefined;

  const todo: Row[] = [
    ...(!announced && !closed ? [{ icon: Icon.Megaphone, title: t("ยังไม่ได้ประกาศวันนี้"), sub: t("แตะเพื่อประกาศจัดก๊วน"), onClick: () => open("announce") }] : []),
    ...(notArrived.length
      ? [{ icon: Icon.CheckIn, title: t("ลงชื่อแล้ว ยังไม่มา"), sub: names(notArrived), right: <CountBadge n={notArrived.length} tone="bg-amber-50 text-amber-700" />, onClick: () => goToTab("checkin") }]
      : []),
    ...(unpaid.length
      ? [{ icon: Icon.Receipt, title: t("เลิกเล่นแล้ว ยังไม่จ่าย"), sub: names(unpaid), right: <CountBadge n={unpaid.length} tone="bg-red-50 text-red-600" />, onClick: () => goToTab("billing") }]
      : []),
    ...(pending.length
      ? [{ icon: Icon.User, title: t("สมัครใหม่รออนุมัติ"), sub: names(pending.map((p) => p.id)), right: <CountBadge n={pending.length} tone="bg-sky-50 text-sky-700" />, onClick: () => goToTab("players") }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <Hero
        label={t("วันนี้มาแล้ว · {date}", { date: shortDate() })}
        big={String(day.checkIns.length)}
        small={t("คน · ลงชื่อ {n}", { n: day.signups?.length ?? 0 })}
        chips={[t("กำลังเล่น {n}", { n: playing }), t("รอคิว {n}", { n: waiting }), ...(q.waiting.length ? [t("สำรอง {n}", { n: q.waiting.length })] : [])]}
        icon={Icon.Users}
        onClick={() => open("signups")}
      />
      <Shortcuts
        items={[
          { icon: Icon.CheckIn, label: t("เช็คอิน"), onClick: () => goToTab("checkin") },
          { icon: Icon.Shuffle, label: t("จัดคู่"), onClick: () => goToTab("courts") },
          { icon: Icon.Wallet, label: t("คิดเงิน"), onClick: () => goToTab("billing") },
          { icon: Icon.Megaphone, label: t("ประกาศ"), onClick: () => open("announce") },
        ]}
      />
      <StockWarning />
      <NoticeBanners />
      <BirthdayBanner />
      <SectionTitle right={todo.length ? t("{n} เรื่อง", { n: todo.length }) : undefined}>{t("ต้องจัดการ")}</SectionTitle>
      {todo.length ? (
        <Rows items={todo} />
      ) : (
        <Card className="flex items-center justify-center gap-2 py-6 font-semibold text-emerald-700">
          <Icon.Check width={20} height={20} /> {t("เรียบร้อย ไม่มีงานค้าง")}
        </Card>
      )}
      <SectionTitle>{t("จัดการก๊วน")}</SectionTitle>
      <Tiles
        items={[
          { icon: Icon.Users, label: t("ผู้เล่น"), onClick: () => goToTab("players"), badge: pending.length },
          { icon: Icon.Calendar, label: t("ปฏิทิน"), onClick: () => open("calendar") },
          { icon: Icon.Vote, label: t("โหวตวันตี"), onClick: () => open("poll") },
          { icon: Icon.Box, label: t("ของหาย/ฝากขาย"), onClick: () => open("board") },
          { icon: Icon.Camera, label: t("รูปกิจกรรม"), onClick: () => open("photos") },
          { icon: Icon.Trophy, label: t("อันดับ"), onClick: () => open("rank") },
        ]}
      />
      {sheet("signups", t("คนที่ลงชื่อวันนี้"), <SignupList bare />)}
      {sheet(
        "announce",
        t("ประกาศ"),
        <div className="space-y-4">
          <AnnounceCard />
          <NoticeComposer />
        </div>,
      )}
      {sheet("calendar", t("ปฏิทินก๊วน"), <ClubCalendar bare />)}
      {sheet("poll", t("โหวตวันตี"), <PollAdmin />)}
      {sheet("board", t("ของหาย/ฝากขาย"), <BoardCard />)}
      {sheet("photos", t("รูปกิจกรรม"), <EventPhotos bare />)}
      {sheet("rank", t("อันดับ"), <ClubCorner />)}
    </div>
  );
}
