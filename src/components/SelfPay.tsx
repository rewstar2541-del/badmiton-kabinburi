"use client";

import { useState } from "react";
import type { SelfAction } from "@/lib/state";
import { useStore } from "@/lib/store";
import { savedPin } from "./PickMe";
import { Button, baht, inputClass } from "./ui";
import { t } from "@/lib/i18n";

/** ผู้เล่นกดเองว่าจ่ายแล้ว นับว่าจ่ายทันที แอดมินไม่ต้องกดรับ (แอดมินยกเลิกได้ถ้าผิด) */
export function SelfPay({ playerId, amount, action }: { playerId: string; amount: number; action: Extract<SelfAction, "pay" | "payMonth"> }) {
  const { self, auth } = useStore();
  const [pin, setPin] = useState(savedPin.get);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setBusy(true);
    const err = await self(action, playerId, pin);
    setBusy(false);
    setError(err ? t(err) : "");
    if (err) setConfirming(false);
    else savedPin.set(pin);
  };

  return (
    <div className="w-full space-y-2">
      {auth.online && (
        <label className="block space-y-1.5 text-sm font-medium">
          {t("เลข 4 ตัวท้ายเบอร์โทรของคุณ")}
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={4}
            placeholder={t("ถ้าไม่ได้ลงเบอร์ไว้ ปล่อยว่างได้")}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      )}
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
