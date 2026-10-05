"use client";

import { useState } from "react";
import { CLEAR_KINDS, clearCount, type ClearKind } from "@/lib/clear";
import { t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import { Button, Card, inputClass } from "./ui";

const CONFIRM_WORD = "ล้างข้อมูล";

/** ล้างข้อมูลแยกประเภท เลือกช่วงวันที่ได้ (ไม่แตะรายชื่อผู้เล่น แอดมิน และตั้งค่า) */
export function ClearData() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<ClearKind[]>([]);
  const first = state.days[0]?.date ?? today();
  const [from, setFrom] = useState(first < today() ? first : today());
  const [to, setTo] = useState(today());
  const [word, setWord] = useState("");
  const [done, setDone] = useState("");
  const valid = kinds.length > 0 && from <= to && word.trim() === CONFIRM_WORD;
  const toggle = (k: ClearKind) => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);

  return (
    <Card className="space-y-3 border border-red-200">
      <h2 className="font-display font-semibold text-red-600">{t("ล้างข้อมูลแยกประเภท")}</h2>
      <p className="text-sm text-zinc-500">{t("เลือกประเภทและช่วงวันที่ที่จะลบ รายชื่อผู้เล่น แอดมิน ราคาและตั้งค่าจะไม่ถูกลบ")}</p>
      {done && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>}
      {!open ? (
        <Button className="w-full !text-red-600" onClick={() => { setOpen(true); setDone(""); }}>
          {t("เลือกข้อมูลที่จะล้าง")}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            dispatch({ type: "clearData", kinds, from, to });
            setDone(t("ล้างข้อมูลที่เลือกแล้ว"));
            setOpen(false);
            setKinds([]);
            setWord("");
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">
              {t("ตั้งแต่วันที่")}
              <input type="date" className={`${inputClass} mt-1`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-sm font-medium">
              {t("ถึงวันที่")}
              <input type="date" className={`${inputClass} mt-1`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <ul className="space-y-1.5">
            {CLEAR_KINDS.map((k) => {
              const n = clearCount(state, k.value, from, to);
              const on = kinds.includes(k.value);
              return (
                <li key={k.value}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ${on ? "bg-red-50" : "bg-zinc-50"}`}>
                    <input type="checkbox" className="mt-1 size-4 accent-red-600" checked={on} onChange={() => toggle(k.value)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(k.label)}</span>
                      <span className="block text-xs text-zinc-500">
                        {t(k.hint)}
                        {!k.dated && ` · ${t("ไม่ขึ้นกับวันที่")}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-500 tabular-nums">{n === null ? "" : t("{n} รายการ", { n })}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("ลบแล้วกู้คืนไม่ได้ ควรกด \"ดาวน์โหลดไฟล์สำรอง\" ด้านบนเก็บไว้ก่อน พิมพ์คำว่า {word} เพื่อยืนยัน", { word: CONFIRM_WORD })}
          </p>
          <input className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} placeholder={CONFIRM_WORD} aria-label={t("คำยืนยัน")} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1 !bg-red-600 !text-white" disabled={!valid}>
              {t("ลบข้อมูลที่เลือก")}
            </Button>
            <Button type="button" onClick={() => { setOpen(false); setWord(""); }}>
              {t("ยกเลิก")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
