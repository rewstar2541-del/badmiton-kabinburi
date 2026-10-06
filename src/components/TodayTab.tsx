"use client";

import { eventStyle } from "@/lib/eventKinds";
import { NoticeBanners } from "./Notices";
import { canSelfCheckIn, signupQueue, waitingPosition } from "@/lib/social";
import { BoardCard } from "./Board";
import { BirthdayBanner } from "./Birthday";
import { PollVote } from "./Polls";
import { PairCard } from "./Pairs";
import { useState } from "react";
import { today, useStore, useToday } from "@/lib/store";
import { presence } from "@/lib/matchmaking";
import { BringGuest } from "./Guests";
import type { SelfAction } from "@/lib/state";
import { ClosedBanner, ClubCalendar } from "./Calendar";
import { PendingNotice, PickMe, savedPin, useMe } from "./PickMe";
import { Avatar, Button, Card, Icon, LevelBadge, baht } from "./ui";
import { locale, t } from "@/lib/i18n";
import { RestButton } from "./RestButton";
import { Auto } from "@/lib/autoTranslate";
import { EventPhotos } from "./EventPhotos";
import { MonthlyReminder, PlanChoice, goToTab } from "./Membership";

/** ประกาศวันนี้ (ใช้ทั้งหน้าผู้เล่นและแอดมิน) สีและไอคอนตามประเภท จัดก๊วน / อีเว้นพิเศษแต่ละแบบ */
export function AnnouncementBanner({ message, title, fee, date }: { message: string; title?: string; fee?: number; date?: string }) {
  const st = eventStyle(title);
  const when = new Date((date ?? today()) + "T00:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className={`overflow-hidden rounded-3xl p-4 shadow-sm ${st.box}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/70 text-3xl shadow-sm" aria-hidden>
          {st.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${st.badge}`}>{title ? t("อีเว้นพิเศษ") : t("ประกาศ")}</span>
            <span className="text-xs font-medium opacity-70">{when}</span>
          </div>
          <div className="mt-1 font-display text-xl leading-tight font-semibold">{title ? <Auto text={title} /> : t("วันนี้มีจัดก๊วน")}</div>
          {!!fee && <div className="mt-1 inline-block rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-semibold">{t("ค่าใช้จ่ายคนละ {amount}", { amount: baht(fee) })}</div>}
        </div>
      </div>
      {message && (
        <p className="mt-3 rounded-2xl bg-white/60 px-3 py-2 text-[15px] leading-snug font-medium whitespace-pre-line">
          <Auto text={message} />
        </p>
      )}
    </div>
  );
}

/** หน้าแรกของผู้เล่น: ดูประกาศ ลงชื่อ และเช็คอินเองเมื่อถึงสนาม */
/** home: ใช้ในหน้าแรกแบบใหม่ ซ่อนส่วนที่ย้ายไปอยู่ในเมนูก๊วนและปุ่มลัดแล้ว */
export function TodayTab({ home }: { home?: boolean } = {}) {
  const { state, self } = useStore();
  const { date, day } = useToday();
  const [me, setMe] = useMe();
  const closed = state.closed[date];
  const pin = savedPin.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState(false);
  const player = state.players.find((p) => p.id === me);
  const announced = day.announcement !== undefined;
  const hereToday = Boolean(player && day.checkIns.some((c) => c.playerId === player.id));

  if (!player)
    return (
      <div className="space-y-4">
        <NoticeBanners />
        <BirthdayBanner />
        {announced && <AnnouncementBanner message={day.announcement ?? ""} title={day.announcementTitle} fee={day.announcementFee} />}
        <PickMe onPick={setMe} hint={t("เข้าครั้งเดียว เครื่องจะจำไว้")} />
      </div>
    );

  if (player.pending)
    return (
      <div className="space-y-4">
        <NoticeBanners />
        <BirthdayBanner />
        {announced && <AnnouncementBanner message={day.announcement ?? ""} title={day.announcementTitle} fee={day.announcementFee} />}
        <PendingNotice name={player.name} onNotMe={() => setMe(null)} />
      </div>
    );

  if (!announced && !hereToday)
    return (
      <div className="space-y-4">
        <NoticeBanners />
        <BirthdayBanner />
        <PlanChoice player={player} />
        <MonthlyReminder player={player} />
        {closed !== undefined ? (
          <ClosedBanner reason={closed} />
        ) : (
          <Card className="space-y-1 py-10 text-center">
            <Icon.Megaphone className="mx-auto text-zinc-300" width={32} height={32} />
            <p className="font-semibold">{t("วันนี้ยังไม่มีประกาศจัดก๊วน")}</p>
            <p className="text-sm text-zinc-500">{t("แอดมินประกาศแล้ว จะลงชื่อได้ที่นี่")}</p>
          </Card>
        )}
        <PollVote />
        {!home && (
          <>
            <BoardCard />
            <ClubCalendar />
            <EventPhotos />
          </>
        )}
      </div>
    );

  const signedUp = day.signups?.some((s) => s.playerId === player.id) ?? false;
  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);
  const status = presence(day, player.id);
  const played = day.games.some((g) => g.playerIds.includes(player.id));
  const statusText = {
    playing: t("กำลังเล่นอยู่"),
    resting: t("พักอยู่ ระบบข้ามคิวให้"),
    home: t("จ่ายแล้ว ถือว่ากลับบ้านแล้ว"),
    waiting: t("เช็คอินแล้ว รอคิวได้เลย"),
    absent: signedUp ? t("ลงชื่อแล้ว ถึงสนามแล้วกดเช็คอิน") : t("ยังไม่ได้ลงชื่อ"),
  }[status];

  const act = async (action: SelfAction) => {
    setBusy(true);
    const err = await self(action, player.id, pin);
    setBusy(false);
    setError(err ? t(err) : "");
  };

  const q = signupQueue(day);
  const waitPos = waitingPosition(day, player.id);
  const full = !!q.cap && q.confirmed.length >= q.cap;
  const selfIn = canSelfCheckIn(day, player.id);

  return (
    <div className="space-y-4">
      <NoticeBanners />
      <BirthdayBanner />
      <PlanChoice player={player} />
      <MonthlyReminder player={player} />
      <AnnouncementBanner message={day.announcement ?? ""} title={day.announcementTitle} fee={day.announcementFee} />
      <CapLine />

      <Card className="space-y-4">
        {!home && (
        <div className="flex items-center gap-3">
          <Avatar name={player.name} photo={player.photo} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-lg font-semibold">{player.name}</span>
              <LevelBadge level={player.level} />
            </div>
            <div className="text-xs text-zinc-500">
              {statusText}
            </div>
          </div>
          <button className="text-xs text-zinc-500 underline" onClick={() => setMe(null)}>
            {t("ออกจากระบบ")}
          </button>
        </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {checkedIn ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-3 font-semibold text-emerald-700">
              <Icon.Check width={18} height={18} /> {status === "home" ? t("จ่ายแล้ว ถือว่ากลับบ้านแล้ว") : t("มาถึงสนามแล้ว")}
            </div>
            {status !== "home" && (
              <>
                {!home && <RestButton />}
                <Button
                  variant="accent"
                  disabled={busy}
                  onClick={async () => {
                    // เลิกเล่น: พักไว้ไม่ให้ถูกจัดลงสนามอีก แล้วไปหน้าจ่ายเงิน
                    if (status === "waiting") await act("rest");
                    goToTab("mybill");
                  }}
                >
                  {t("เลิกเล่นแล้ว ไปจ่ายเงิน")}
                </Button>
                {played ? (
                  <p className="text-center text-xs text-zinc-500">{t("เล่นแล้ว เช็คอินผิดให้แอดมินยกเลิก")}</p>
                ) : undo ? (
                  <div className="space-y-2 rounded-2xl bg-red-50 p-3">
                    <p className="text-center text-sm font-medium text-red-700">{t("กดเช็คอินผิดใช่ไหม?")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button disabled={busy} onClick={() => act("undoCheckIn").then(() => setUndo(false))}>
                        {t("ยกเลิกเช็คอิน ยังจะมา")}
                      </Button>
                      <Button disabled={busy} className="!bg-red-600 !text-white" onClick={() => act("notComing").then(() => setUndo(false))}>
                        {t("ไม่มาแล้ว")}
                      </Button>
                    </div>
                    <button className="w-full text-xs text-zinc-500 underline" onClick={() => setUndo(false)}>
                      {t("ไม่ยกเลิก")}
                    </button>
                  </div>
                ) : (
                  <button className="text-sm font-semibold text-red-600" onClick={() => setUndo(true)}>
                    {t("กดเช็คอินผิด / ยกเลิก")}
                  </button>
                )}
              </>
            )}
          </div>
        ) : signedUp ? (
          <div className="grid gap-2">
            {waitPos > 0 ? (
              <div className="rounded-2xl bg-amber-50 px-3 py-3 text-center text-amber-900">
                <div className="font-semibold">{t("คุณอยู่รายชื่อสำรองลำดับที่ {n}", { n: waitPos })}</div>
                <div className="text-xs">{t("มีคนยกเลิกจะเลื่อนขึ้นเอง หรือให้แอดมินเช็คอินให้")}</div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-sky-50 py-3 font-semibold text-sky-700">
                <Icon.Check width={18} height={18} /> {t("ลงชื่อแล้ว")}
              </div>
            )}
            <Button variant="accent" disabled={busy || !selfIn} onClick={() => act("checkIn")} className="flex items-center justify-center gap-1.5">
              <Icon.CheckIn width={18} height={18} /> {t("ถึงสนามแล้ว เช็คอิน")}
            </Button>
            <Button variant="ghost" disabled={busy} className="!text-red-600" onClick={() => act("cancelSignUp")}>
              {t("ยกเลิกลงชื่อ")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Button variant="primary" disabled={busy} onClick={() => act("signUp")}>
              {full ? t("เต็มแล้ว ลงชื่อสำรอง") : day.announcementTitle ? t("ลงชื่อไปร่วม") : t("ลงชื่อว่าจะมา")}
            </Button>
            <Button variant="accent" disabled={busy || !selfIn} onClick={() => act("checkIn")} className="flex items-center justify-center gap-1.5">
              <Icon.CheckIn width={18} height={18} /> {t("ถึงสนามแล้ว เช็คอิน")}
            </Button>
            {!selfIn && <p className="text-center text-xs text-zinc-500">{t("เต็มแล้ว ลงชื่อสำรองได้")}</p>}
          </div>
        )}
      </Card>

      {!home && checkedIn && status !== "home" && !player.guestOf && <PairCard />}
      {!home && checkedIn && status !== "home" && !player.guestOf && <BringGuest player={player} pin={pin} />}
      <PollVote />
      {!home && (
        <>
          <BoardCard />
          <ClubCalendar />
          <EventPhotos />
        </>
      )}
    </div>
  );
}

/** รับกี่คน ลงชื่อแล้วกี่คน สำรองกี่คน (แสดงเมื่อแอดมินจำกัดจำนวน) */
export function CapLine() {
  const { day } = useToday();
  const q = signupQueue(day);
  if (!q.cap) return null;
  const left = Math.max(0, q.cap - q.confirmed.length);
  return (
    <p className={`-mt-2 rounded-2xl px-4 py-2 text-sm font-medium ${left ? "bg-zinc-100 text-zinc-700" : "bg-amber-50 text-amber-900"}`}>
      {t("รับ {cap} คน · ลงชื่อแล้ว {n}", { cap: q.cap, n: q.confirmed.length })}
      {left ? ` · ${t("ว่าง {n} ที่", { n: left })}` : ` · ${t("เต็มแล้ว")}`}
      {q.waiting.length > 0 && ` · ${t("สำรอง {n} คน", { n: q.waiting.length })}`}
    </p>
  );
}
