"use client";

import { useEffect, useState } from "react";
import { CLEAR_KINDS, clearCount, type ClearKind } from "@/lib/clear";
import { t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import { clearTourneyHistory, pastTourneyCount } from "@/lib/tourneyStore";
import { Button, Card, inputClass } from "./ui";

const CONFIRM_WORD = "ล้างข้อมูล";

/** ล้างข้อมูลแยกประเภท เลือกช่วงวันที่ได้ (ไม่แตะรายชื่อผู้เล่น แอดมิน และตั้งค่า) รวมประวัติงานแข่งไว้ที่นี่ด้วย */
export function ClearData() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<ClearKind[]>([]);
  const first = state.days[0]?.date ?? today();
  const [from, setFrom] = useState(first < today() ? first : today());
  const [to, setTo] = useState(today());
  const [word, setWord] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // งานแข่งเก็บแยกตาราง นับจากฐานข้อมูลตอนเปิดฟอร์ม
  const [tourneys, setTourneys] = useState<number | null>(null);
  useEffect(() => {
    if (open) void pastTourneyCount().then(setTourneys);
  }, [open]);
  const valid = kinds.length > 0 && from <= to && word.trim() === CONFIRM_WORD && !busy;
  const toggle = (k: ClearKind) => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);

  return (
    <Card className="space-y-3 border border-red-200">
      <h2 className="font-display font-semibold text-red-600">{t("ล้างข้อมูลแยกประเภท")}</h2>
      <p className="text-sm text-zinc-500">{t("เลือกประเภทและช่วงวันที่ (ผู้เล่น แอดมิน ตั้งค่า ไม่ถูกลบ)")}</p>
      {done && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!open ? (
        <Button className="w-full !text-red-600" onClick={() => { setOpen(true); setDone(""); setError(""); }}>
          {t("เลือกข้อมูลที่จะล้าง")}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            const rest = kinds.filter((k) => k !== "tourneys");
            if (rest.length) dispatch({ type: "clearData", kinds: rest, from, to });
            if (kinds.includes("tourneys")) {
              setBusy(true);
              const err = await clearTourneyHistory();
              setBusy(false);
              if (err) setError(t("ลบประวัติงานแข่งไม่สำเร็จ: {err}", { err }));
            }
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
              const n = k.value === "tourneys" ? tourneys : clearCount(state, k.value, from, to);
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
            {t("ลบแล้วกู้ไม่ได้ โหลดไฟล์สำรองก่อน พิมพ์ {word} เพื่อยืนยัน", { word: CONFIRM_WORD })}
          </p>
          <input className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} placeholder={CONFIRM_WORD} aria-label={t("คำยืนยัน")} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1 !bg-red-600 !text-white" disabled={!valid}>
              {busy ? t("กำลังลบ...") : t("ลบข้อมูลที่เลือก")}
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
