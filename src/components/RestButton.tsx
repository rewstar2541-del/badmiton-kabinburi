"use client";

import { useState } from "react";
import { presence } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { t } from "@/lib/i18n";
import { savedPin, useMe } from "./PickMe";
import { Button, Card, Icon } from "./ui";

/** ปุ่มขอพักของผู้เล่นที่เช็คอินแล้ว กดได้ทั้งตอนรอคิวและตอนกำลังเล่น (พักหลังจบเกม) */
export function RestButton() {
  const { day } = useToday();
  const { self } = useStore();
  const [me] = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ci = me ? day.checkIns.find((c) => c.playerId === me) : undefined;
  if (!me || !ci || ci.paidAt) return null;
  const playing = presence(day, me) === "playing";

  const toggle = async () => {
    setBusy(true);
    const err = await self(ci.resting ? "unrest" : "rest", me, savedPin.get());
    setBusy(false);
    setError(err ? t(err) : "");
  };

  return (
    <div className="grid gap-2">
      {ci.resting ? (
        <>
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900">
            {playing ? t("จะพักหลังจบเกมนี้ ระบบจะข้ามคิวให้") : t("พักอยู่ ระบบข้ามคิวให้")}
          </p>
          <Button variant="warn" disabled={busy} onClick={toggle} className="flex items-center justify-center gap-1.5">
            {playing ? t("ยกเลิกพัก") : t("พักพอแล้ว กลับเข้าคิว")}
          </Button>
        </>
      ) : (
        <Button variant="warn" disabled={busy} onClick={toggle} className="flex items-center justify-center gap-1.5">
          <Icon.Clock width={18} height={18} /> {playing ? t("ขอพักหลังจบเกมนี้") : t("ขอพัก (ข้ามคิวไปก่อน)")}
        </Button>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** แถบสถานะของฉันบนหน้าสนาม ให้กดพักได้โดยไม่ต้องสลับหน้า */
export function MyRestCard() {
  const { auth } = useStore();
  const { day } = useToday();
  const [me] = useMe();
  if (auth.isAdmin || !me || !day.checkIns.some((c) => c.playerId === me && !c.paidAt)) return null;
  return (
    <Card className="py-3">
      <RestButton />
    </Card>
  );
}
