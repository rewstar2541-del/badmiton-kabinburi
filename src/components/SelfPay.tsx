"use client";

import { useState } from "react";
import type { SelfAction } from "@/lib/state";
import { useStore } from "@/lib/store";
import { savedPin } from "./PickMe";
import { Button, baht } from "./ui";
import { t } from "@/lib/i18n";

/** ผู้เล่นกดเองว่าจ่ายแล้ว นับว่าจ่ายทันที แอดมินไม่ต้องกดรับ (แอดมินยกเลิกได้ถ้าผิด) */
export function SelfPay({ playerId, amount, action }: { playerId: string; amount: number; action: Extract<SelfAction, "pay" | "payMonth"> }) {
  const { self } = useStore();
  const pin = savedPin.get();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setBusy(true);
    const err = await self(action, playerId, pin);
    setBusy(false);
    setError(err ? t(err) : "");
    if (err) setConfirming(false);
  };

  return (
    <div className="w-full space-y-2">
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {confirming ? (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-3">
          <p className="text-center text-sm font-medium text-amber-900">{t("ยืนยันว่าจ่าย {amount} แล้ว?", { amount: baht(amount) })}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="accent" disabled={busy} onClick={pay}>
              {t("ยืนยัน")}
            </Button>
            <Button disabled={busy} onClick={() => setConfirming(false)}>
              {t("ยกเลิก")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="accent" className="w-full" onClick={() => setConfirming(true)}>
          {action === "pay" ? t("ฉันจ่ายแล้ว {amount}", { amount: baht(amount) }) : t("จ่ายค่ารายเดือนแล้ว {amount}", { amount: baht(amount) })}
        </Button>
      )}
    </div>
  );
}
