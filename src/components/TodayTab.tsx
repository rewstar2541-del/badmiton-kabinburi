"use client";

import { useState } from "react";
import { useStore, useToday } from "@/lib/store";
import type { SelfAction } from "@/lib/state";
import { PickMe, savedPin, useMe } from "./PickMe";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle, inputClass } from "./ui";

/** ประกาศจัดก๊วนวันนี้ (ใช้ทั้งหน้าผู้เล่นและแอดมิน) */
export function AnnouncementBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-3xl bg-lime p-4 text-ink">
      <Icon.Megaphone className="shrink-0" />
      <div className="min-w-0">
        <div className="font-display font-semibold">วันนี้มีจัดก๊วน</div>
        {message && <p className="mt-0.5 text-sm whitespace-pre-line">{message}</p>}
      </div>
    </div>
  );
}

/** รายชื่อคนลงชื่อวันนี้ พร้อมสถานะมาถึงแล้ว */
export function SignupList() {
  const { state } = useStore();
  const { day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const checked = new Set(day.checkIns.map((c) => c.playerId));
  const signups = (day.signups ?? []).filter((s) => byId.has(s.playerId));
  const arrived = signups.filter((s) => checked.has(s.playerId)).length;

  return (
    <>
      <SectionTitle right={`${signups.length} คน · มาแล้ว ${arrived}`}>ลงชื่อวันนี้</SectionTitle>
      <Card className="p-2">
        <ol>
          {signups.map((s, i) => {
            const p = byId.get(s.playerId)!;
            const here = checked.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <span className="w-5 text-center text-xs text-zinc-400">{i + 1}</span>
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <LevelBadge level={p.level} />
                <span
                  className={`w-16 rounded-full py-0.5 text-center text-[11px] font-medium ${
                    here ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {here ? "มาแล้ว" : "ยังไม่มา"}
                </span>
              </li>
            );
          })}
          {signups.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">ยังไม่มีคนลงชื่อ</li>}
        </ol>
      </Card>
    </>
  );
}

/** หน้าแรกของผู้เล่น: ดูประกาศ ลงชื่อ และเช็คอินเองเมื่อถึงสนาม */
export function TodayTab() {
  const { state, self, auth } = useStore();
  const { day } = useToday();
  const [me, setMe] = useMe();
  const [pin, setPin] = useState(savedPin.get);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const player = state.players.find((p) => p.id === me);
  const announced = day.announcement !== undefined;

  if (!announced)
    return (
      <div className="space-y-4">
        <Card className="space-y-1 py-10 text-center">
          <Icon.Megaphone className="mx-auto text-zinc-300" width={32} height={32} />
          <p className="font-semibold">วันนี้ยังไม่มีประกาศจัดก๊วน</p>
          <p className="text-sm text-zinc-500">เมื่อแอดมินประกาศ จะลงชื่อและเช็คอินได้ที่หน้านี้</p>
        </Card>
      </div>
    );

  if (!player)
    return (
      <div className="space-y-4">
        <AnnouncementBanner message={day.announcement ?? ""} />
        <PickMe onPick={setMe} hint="เลือกชื่อของคุณเพื่อลงชื่อและเช็คอิน เครื่องนี้จะจำไว้ให้" />
      </div>
    );

  const signedUp = day.signups?.some((s) => s.playerId === player.id) ?? false;
  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);

  const act = async (action: SelfAction) => {
    setBusy(true);
    const err = await self(action, player.id, pin);
    setBusy(false);
    setError(err ?? "");
    if (!err) savedPin.set(pin);
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
              {checkedIn ? "เช็คอินแล้ว รอคิวลงสนามได้เลย" : signedUp ? "ลงชื่อแล้ว มาถึงสนามแล้วกดเช็คอิน" : "ยังไม่ได้ลงชื่อ"}
            </div>
          </div>
          <button className="text-xs text-zinc-500 underline" onClick={() => setMe(null)}>
            ไม่ใช่ฉัน
          </button>
        </div>

        {!checkedIn && auth.online && (
          <label className="block space-y-1.5 text-sm font-medium">
            เลข 4 ตัวท้ายเบอร์โทรของคุณ
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={4}
              placeholder="ถ้าไม่ได้ลงเบอร์ไว้ ปล่อยว่างได้"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {checkedIn ? (
          <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-3 font-semibold text-emerald-700">
            <Icon.Check width={18} height={18} /> มาถึงสนามแล้ว
          </div>
        ) : (
          <div className="grid gap-2">
            <Button variant="accent" disabled={busy} onClick={() => act("checkIn")} className="flex items-center justify-center gap-1.5">
              <Icon.CheckIn width={18} height={18} /> ถึงสนามแล้ว เช็คอิน
            </Button>
            {signedUp ? (
              <Button variant="ghost" disabled={busy} onClick={() => act("cancelSignUp")}>
                ยกเลิกลงชื่อ
              </Button>
            ) : (
              <Button variant="primary" disabled={busy} onClick={() => act("signUp")}>
                ลงชื่อว่าจะมา
              </Button>
            )}
          </div>
        )}
      </Card>

      <SignupList />
    </div>
  );
}
