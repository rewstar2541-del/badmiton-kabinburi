"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import { presence } from "@/lib/matchmaking";
import { BringGuest } from "./Guests";
import type { SelfAction } from "@/lib/state";
import { ClosedBanner, ClubCalendar } from "./Calendar";
import { PendingNotice, PickMe, savedPin, useMe } from "./PickMe";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";
import { RestButton } from "./RestButton";

/** ประกาศจัดก๊วนวันนี้ (ใช้ทั้งหน้าผู้เล่นและแอดมิน) */
export function AnnouncementBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-3xl bg-lime p-4 text-ink">
      <Icon.Megaphone className="shrink-0" />
      <div className="min-w-0">
        <div className="font-display font-semibold">{t("วันนี้มีจัดก๊วน")}</div>
        {message && <p className="mt-0.5 text-sm whitespace-pre-line">{message}</p>}
      </div>
    </div>
  );
}

/** ยอดคนลงชื่อวันนี้ แสดงเป็นตัวเลข ไม่แสดงชื่อคนอื่น */
function SignupCount() {
  const { day } = useToday();
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const signups = day.signups ?? [];
  const arrived = signups.filter((s) => checked.has(s.playerId)).length;
  return (
    <Card className="grid grid-cols-2 gap-2 text-center">
      <div>
        <div className="font-display text-2xl font-semibold">{signups.length}</div>
        <div className="text-xs text-zinc-500">{t("ลงชื่อวันนี้")}</div>
      </div>
      <div>
        <div className="font-display text-2xl font-semibold">{arrived}</div>
        <div className="text-xs text-zinc-500">{t("มาแล้ว")}</div>
      </div>
    </Card>
  );
}

/** หน้าแรกของผู้เล่น: ดูประกาศ ลงชื่อ และเช็คอินเองเมื่อถึงสนาม */
export function TodayTab() {
  const { state, self } = useStore();
  const { date, day } = useToday();
  const [me, setMe] = useMe();
  const closed = state.closed[date];
  const pin = savedPin.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const player = state.players.find((p) => p.id === me);
  const announced = day.announcement !== undefined;
  const hereToday = Boolean(player && day.checkIns.some((c) => c.playerId === player.id));

  if (!player)
    return (
      <div className="space-y-4">
        {announced && <AnnouncementBanner message={day.announcement ?? ""} />}
        <PickMe onPick={setMe} hint={t("เข้าสู่ระบบครั้งเดียว เครื่องนี้จะจำไว้ แล้วลงชื่อ เช็คอิน และดูยอดของตัวเองได้")} />
      </div>
    );

  if (player.pending)
    return (
      <div className="space-y-4">
        {announced && <AnnouncementBanner message={day.announcement ?? ""} />}
        <PendingNotice name={player.name} onNotMe={() => setMe(null)} />
      </div>
    );

  if (!announced && !hereToday)
    return (
      <div className="space-y-4">
        {closed !== undefined ? (
          <ClosedBanner reason={closed} />
        ) : (
          <Card className="space-y-1 py-10 text-center">
            <Icon.Megaphone className="mx-auto text-zinc-300" width={32} height={32} />
            <p className="font-semibold">{t("วันนี้ยังไม่มีประกาศจัดก๊วน")}</p>
            <p className="text-sm text-zinc-500">{t("เมื่อแอดมินประกาศ จะลงชื่อและเช็คอินได้ที่หน้านี้")}</p>
          </Card>
        )}
        <ClubCalendar />
      </div>
    );

  const signedUp = day.signups?.some((s) => s.playerId === player.id) ?? false;
  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);
  const status = presence(day, player.id);
  const statusText = {
    playing: t("กำลังเล่นอยู่"),
    resting: t("พักอยู่ ระบบข้ามคิวให้"),
    home: t("จ่ายแล้ว ถือว่ากลับบ้านแล้ว"),
    waiting: t("เช็คอินแล้ว รอคิวลงสนามได้เลย"),
    absent: signedUp ? t("ลงชื่อแล้ว มาถึงสนามแล้วกดเช็คอิน") : t("ยังไม่ได้ลงชื่อ"),
  }[status];

  const act = async (action: SelfAction) => {
    setBusy(true);
    const err = await self(action, player.id, pin);
    setBusy(false);
    setError(err ? t(err) : "");
  };

  return (
    <div className="space-y-4">
      <AnnouncementBanner message={day.announcement ?? ""} />

      <Card className="space-y-4">
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

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {checkedIn ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-3 font-semibold text-emerald-700">
              <Icon.Check width={18} height={18} /> {status === "home" ? t("จ่ายแล้ว ถือว่ากลับบ้านแล้ว") : t("มาถึงสนามแล้ว")}
            </div>
            {status !== "home" && <RestButton />}
          </div>
        ) : (
          <div className="grid gap-2">
            <Button variant="accent" disabled={busy} onClick={() => act("checkIn")} className="flex items-center justify-center gap-1.5">
              <Icon.CheckIn width={18} height={18} /> {t("ถึงสนามแล้ว เช็คอิน")}
            </Button>
            {signedUp ? (
              <Button variant="ghost" disabled={busy} onClick={() => act("cancelSignUp")}>
                {t("ยกเลิกลงชื่อ")}
              </Button>
            ) : (
              <Button variant="primary" disabled={busy} onClick={() => act("signUp")}>
                {t("ลงชื่อว่าจะมา")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {checkedIn && status !== "home" && !player.guestOf && <BringGuest player={player} pin={pin} />}
      <SignupCount />
      <ClubCalendar />
    </div>
  );
}
