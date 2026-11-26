"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { DRINK_MENU_MAX, DRINK_PRICE_MAX, drinkMenuOf, type DrinkItem } from "@/lib/types";
import { Auto } from "@/lib/autoTranslate";
import { Button, Card, baht, inputClass } from "./ui";

/** ปุ่มน้ำตามรายการที่แอดมินตั้งไว้ กดแล้วเพิ่มในบิลเลย (ชื่อ + ราคา) */
export function DrinkMenuButtons({ menu, disabled, onPick }: { menu: DrinkItem[]; disabled?: boolean; onPick: (item: DrinkItem) => void }) {
  if (!menu.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {menu.map((d, i) => (
        <button
          key={`${d.name}-${i}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(d)}
          className="flex min-h-12 flex-col items-start justify-center rounded-2xl bg-zinc-100 px-3 py-2 text-left text-sm font-semibold text-ink active:scale-95 disabled:opacity-50"
        >
          <span className="w-full break-words leading-tight">
            + <Auto text={d.name} />
          </span>
          <span className="text-sm font-medium tabular-nums text-zinc-600">{baht(d.price)}</span>
        </button>
      ))}
    </div>
  );
}

/** แอดมินตั้งรายการน้ำกับราคาไว้ครั้งเดียว (เช่น น้ำเปล่า 10, เกลือแร่ 20) */
export function DrinkMenuEditor() {
  const { state, dispatch, auth } = useStore();
  const menu = state.settings.drinkMenu ?? [];
  // ออนไลน์: ใช้ได้หลังรัน SQL drink_menu.sql (โหลดมาแล้วมีค่า) ออฟไลน์เก็บในเครื่องได้เลย
  const ready = !auth.online || state.settings.drinkMenu !== undefined;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const save = (next: DrinkItem[]) => dispatch({ type: "updateSettings", settings: { ...state.settings, drinkMenu: drinkMenuOf(next) } });
  const full = menu.length >= DRINK_MENU_MAX;

  return (
    <Card className="space-y-3">
      <p className="text-xs text-zinc-500">{t("ตั้งชื่อกับราคาไว้ครั้งเดียว แอดมินและผู้เล่นกดเพิ่มในบิลได้เลย")}</p>
      {!ready ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ยังเปิดใช้ไม่ได้ ต้องอัปเดตฐานข้อมูลก่อน (SQL drink_menu.sql)")}</p>
      ) : (
        <>
          {menu.length === 0 && <p className="text-sm text-zinc-500">{t("ยังไม่มีรายการน้ำ ผู้เล่นจะเห็นปุ่ม +10 +15 +20 +25 บาทแทน")}</p>}
          <ul className="space-y-1.5">
            {menu.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 break-words font-medium">{d.name}</span>
                <span className="shrink-0 tabular-nums">{baht(d.price)}</span>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-600"
                  onClick={() => {
                    if (confirm(t("ลบ {name} ออกจากรายการน้ำ?", { name: d.name }))) save(menu.filter((_, j) => j !== i));
                  }}
                >
                  {t("ลบ")}
                </button>
              </li>
            ))}
          </ul>
          {full ? (
            <p className="text-xs text-zinc-500">{t("ตั้งได้สูงสุด {n} รายการ", { n: DRINK_MENU_MAX })}</p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Math.round(Number(price));
                if (!name.trim()) return setError(t("ใส่ชื่อน้ำก่อน"));
                if (!n || n < 1 || n > DRINK_PRICE_MAX) return setError(t("ราคาต้องอยู่ระหว่าง 1-{max} บาท", { max: DRINK_PRICE_MAX }));
                save([...menu, { name: name.trim(), price: n }]);
                setName("");
                setPrice("");
                setError("");
              }}
            >
              <input className={`${inputClass} min-w-0 flex-[2]`} placeholder={t("ชื่อน้ำ")} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              <input className={`${inputClass} min-w-0 flex-1`} inputMode="numeric" placeholder={t("บาท")} value={price} onChange={(e) => setPrice(e.target.value)} />
              <Button type="submit">{t("เพิ่ม")}</Button>
            </form>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
        </>
      )}
    </Card>
  );
}
