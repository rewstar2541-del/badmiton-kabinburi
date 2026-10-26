"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { drinkStock, shuttleStock } from "@/lib/social";
import { useStore } from "@/lib/store";
import { Button, Card, inputClass } from "./ui";

/** ลูกแบดหนึ่งหลอด */
export const TUBE = 12;

const tubes = (n: number) => {
  const whole = Math.floor(Math.max(0, n) / TUBE);
  const rest = Math.max(0, n) % TUBE;
  return rest ? t("{a} หลอด {b} ลูก", { a: whole, b: rest }) : t("{a} หลอด", { a: whole });
};

type Kind = "shuttle" | "drink";

/** ข้อความของแต่ละสต็อก */
const COPY = {
  shuttle: {
    title: "สต็อกลูกแบด",
    lowAt: "เตือนเมื่อเหลือไม่ถึง {n} ลูก",
    count: "{n} ลูก",
    low: "ลูกใกล้หมดแล้ว ซื้อเพิ่มด้วย",
    empty: "ยังไม่เริ่มนับ กด \"นับลูกจริง\" แล้วใส่จำนวนที่มี ระบบจะหักและบวกให้เอง",
    askLow: "เตือนเมื่อเหลือไม่ถึงกี่ลูก",
    askCount: "มีลูกกี่ลูก (นับจริง)",
    countBtn: "นับลูกจริง",
    howToBuy: "ซื้อลูกเพิ่ม: คิดเงิน > รายเดือน > ลงรายจ่าย \"ค่าลูกแบด\" ใส่จำนวนหลอด",
  },
  drink: {
    title: "สต็อกน้ำ",
    lowAt: "เตือนเมื่อเหลือไม่ถึง {n} ขวด",
    count: "{n} ขวด",
    low: "น้ำใกล้หมดแล้ว ซื้อเพิ่มด้วย",
    empty: "ยังไม่เริ่มนับ กด \"นับน้ำจริง\" แล้วใส่จำนวนขวดที่มี ระบบจะหักตามค่าน้ำที่ลง (1 รายการ = 1 ขวด)",
    askLow: "เตือนเมื่อเหลือไม่ถึงกี่ขวด",
    askCount: "มีน้ำกี่ขวด (นับจริง)",
    countBtn: "นับน้ำจริง",
    howToBuy: "ลงค่าน้ำ 1 รายการ = 1 ขวด · ซื้อน้ำเพิ่ม: คิดเงิน > รายเดือน > ลงรายจ่าย \"ค่าเครื่องดื่ม\" ใส่จำนวนขวด",
  },
} as const;

/** สต็อกลูกแบดหรือน้ำ: เหลือเท่าไร นับจริง และจุดเตือน (แอดมิน) */
export function StockCard({ kind = "shuttle" }: { kind?: Kind }) {
  const { state, dispatch } = useStore();
  const info = kind === "drink" ? drinkStock(state) : shuttleStock(state);
  const c = COPY[kind];
  const [mode, setMode] = useState<"count" | "low" | null>(null);
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value !== "" && Number.isInteger(n) && n >= 0;

  const save = () => {
    if (!valid) return;
    const type = kind === "drink" ? "setDrinkStock" : "setStock";
    dispatch(mode === "low" ? { type, low: n } : { type, base: n });
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
        <h3 className="font-display font-semibold">{t(c.title)}</h3>
        {info && <span className="shrink-0 text-xs text-zinc-500">{t(c.lowAt, { n: info.low })}</span>}
      </div>
      {info ? (
        <div className={`rounded-2xl px-4 py-3 ${low ? "bg-amber-50 text-amber-900" : "bg-zinc-50"}`}>
          <div className="font-display text-3xl font-semibold tabular-nums">
            {t(c.count, { n: Math.max(0, info.left) })}
            {kind === "shuttle" && <span className="ml-2 text-sm font-medium text-zinc-500">({tubes(info.left)})</span>}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {t("ซื้อเพิ่ม {a} · ใช้ไป {b}", { a: info.bought, b: info.used })}
          </div>
          {low && <p className="mt-1 text-sm font-semibold">{t(c.low)}</p>}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{t(c.empty)}</p>
      )}
      {mode ? (
        <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
          <label className="block text-sm font-medium">
            {mode === "low" ? t(c.askLow) : t(c.askCount)}
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
          <Button onClick={() => open("count")}>{t(c.countBtn)}</Button>
          <Button onClick={() => open("low")} disabled={!info}>
            {t("ตั้งจุดเตือน")}
          </Button>
        </div>
      )}
      <p className="text-xs text-zinc-500">{t(c.howToBuy)}</p>
    </Card>
  );
}

/** แถบเตือนลูกหรือน้ำใกล้หมด (แสดงเฉพาะแอดมินเมื่อเหลือน้อย) */
export function StockWarning() {
  const { state, auth } = useStore();
  if (!auth.isAdmin) return null;
  const shuttle = shuttleStock(state);
  const drink = drinkStock(state);
  const lines = [
    shuttle && shuttle.left < shuttle.low && t("ลูกแบดเหลือ {n} ลูก ใกล้หมดแล้ว", { n: Math.max(0, shuttle.left) }),
    drink && drink.left < drink.low && t("น้ำเหลือ {n} ขวด ใกล้หมดแล้ว", { n: Math.max(0, drink.left) }),
  ].filter(Boolean);
  if (!lines.length) return null;
  return (
    <div className="space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
      {lines.map((l) => (
        <p key={l as string}>{l}</p>
      ))}
    </div>
  );
}
