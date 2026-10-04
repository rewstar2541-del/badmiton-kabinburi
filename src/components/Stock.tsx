"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { shuttleStock } from "@/lib/social";
import { useStore } from "@/lib/store";
import { Button, Card, inputClass } from "./ui";

/** ลูกแบดหนึ่งหลอด */
export const TUBE = 12;

const tubes = (n: number) => {
  const whole = Math.floor(Math.max(0, n) / TUBE);
  const rest = Math.max(0, n) % TUBE;
  return rest ? t("{a} หลอด {b} ลูก", { a: whole, b: rest }) : t("{a} หลอด", { a: whole });
};

/** สต็อกลูกแบด: เหลือกี่ลูก นับจริง และจุดเตือน (แอดมิน) */
export function StockCard() {
  const { state, dispatch } = useStore();
  const info = shuttleStock(state);
  const [mode, setMode] = useState<"count" | "low" | null>(null);
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value !== "" && Number.isInteger(n) && n >= 0;

  const save = () => {
    if (!valid) return;
    dispatch(mode === "low" ? { type: "setStock", low: n } : { type: "setStock", base: n });
    setMode(null);
    setValue("");
  };
  const open = (m: "count" | "low") => {
    setMode(m);
    setValue(m === "low" ? String(info?.low ?? TUBE) : "");
  };

  const low = info && info.left < info.low;
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("สต็อกลูกแบด")}</h3>
        {info && <span className="shrink-0 text-xs text-zinc-500">{t("เตือนเมื่อเหลือไม่ถึง {n} ลูก", { n: info.low })}</span>}
      </div>
      {info ? (
        <div className={`rounded-2xl px-4 py-3 ${low ? "bg-amber-50 text-amber-900" : "bg-zinc-50"}`}>
          <div className="font-display text-3xl font-semibold tabular-nums">
            {t("{n} ลูก", { n: info.left })}
            <span className="ml-2 text-sm font-medium text-zinc-500">({tubes(info.left)})</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {t("ซื้อเพิ่ม {a} · ใช้ไป {b} ตั้งแต่นับครั้งล่าสุด", { a: info.bought, b: info.used })}
          </div>
          {low && <p className="mt-1 text-sm font-semibold">{t("ลูกใกล้หมดแล้ว ซื้อเพิ่มด้วย")}</p>}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{t("ยังไม่ได้เริ่มนับ กด \"นับลูกจริง\" แล้วใส่จำนวนลูกที่มีตอนนี้ หลังจากนั้นระบบหักตามลูกที่ใช้ในเกม และบวกเมื่อลงรายจ่ายซื้อลูกแบด")}</p>
      )}
      {mode ? (
        <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <label className="block text-sm font-medium">
            {mode === "low" ? t("เตือนเมื่อเหลือไม่ถึงกี่ลูก") : t("ตอนนี้มีลูกทั้งหมดกี่ลูก (นับจริง)")}
            <input type="number" inputMode="numeric" min={0} className={`${inputClass} mt-1`} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setMode(null)}>{t("ยกเลิก")}</Button>
            <Button variant="accent" disabled={!valid} onClick={save}>
              {t("บันทึก")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => open("count")}>{t("นับลูกจริง")}</Button>
          <Button onClick={() => open("low")} disabled={!info}>
            {t("ตั้งจุดเตือน")}
          </Button>
        </div>
      )}
      <p className="text-xs text-zinc-500">{t("ซื้อลูกเพิ่ม: ลงรายจ่าย \"ซื้อลูกแบด\" ใน คิดเงิน > รายเดือน แล้วใส่จำนวนหลอด สต็อกจะเพิ่มให้เอง")}</p>
    </Card>
  );
}

/** แถบเตือนลูกใกล้หมด (แสดงเฉพาะแอดมินเมื่อเหลือน้อย) */
export function StockWarning() {
  const { state, auth } = useStore();
  const info = shuttleStock(state);
  if (!auth.isAdmin || !info || info.left >= info.low) return null;
  return (
    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
      {t("ลูกแบดเหลือ {n} ลูก ใกล้หมดแล้ว", { n: Math.max(0, info.left) })}
    </p>
  );
}
