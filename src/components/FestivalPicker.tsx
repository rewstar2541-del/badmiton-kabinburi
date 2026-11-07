"use client";

import { t } from "@/lib/i18n";
import { FESTIVALS, activeFestival, festivalInfo, type FestivalSetting } from "@/lib/festival";
import { useStore, useToday } from "@/lib/store";
import { birthdays } from "@/lib/club";
import { Card } from "./ui";

/** แอดมิน: เลือกธีมเทศกาล ทุกเครื่องเปลี่ยนตาม */
export function FestivalPicker() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const value = state.settings.festival;
  const ready = value !== undefined;
  const now = festivalInfo(activeFestival(value, date, birthdays(state.players, date).length > 0));
  const options: { id: FestivalSetting; label: string; emoji: string }[] = [
    { id: "auto", label: "อัตโนมัติตามวันที่", emoji: "📅" },
    { id: "off", label: "ปิด (ธีมปกติ)", emoji: "🏸" },
    ...FESTIVALS.flatMap((f) => (f.id === "birthday" ? [] : [{ id: f.id as FestivalSetting, label: f.name, emoji: f.emoji }])),
  ];
  return (
    <Card className="space-y-3">
      <h2 className="font-display font-semibold">{t("ธีมเทศกาล")}</h2>
      <p className="text-sm text-zinc-500">
        {t("เปลี่ยนสีแอพและคำทักทายให้ทุกคนเห็น อัตโนมัติ: ฮาโลวีน 20-31 ต.ค. คริสต์มาส 15-26 ธ.ค. ปีใหม่ 27 ธ.ค.-5 ม.ค. สงกรานต์ 8-16 เม.ย.")}{" "}
        {t("วันอื่นที่มีสมาชิกวันเกิด เป็นธีมวันเกิดเอง (ไม่อยากได้ กดปิด)")}
      </p>
      <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
        {now ? t("ตอนนี้: {name}", { name: `${now.emoji} ${t(now.name)}` }) : t("ตอนนี้: ธีมปกติ")}
      </div>
      {!ready && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ต้องรัน SQL ธีมเทศกาลก่อน จึงจะเลือกเองได้ (ตอนนี้ใช้อัตโนมัติ)")}</p>}
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = (value ?? "auto") === o.id;
          return (
            <button
              key={o.id}
              disabled={!ready}
              onClick={() => dispatch({ type: "updateSettings", settings: { ...state.settings, festival: o.id } })}
              className={`min-h-12 rounded-2xl px-3 py-2 text-left text-sm font-semibold disabled:opacity-50 ${on ? "bg-ink text-white" : "bg-zinc-100 text-zinc-700"}`}
            >
              <span className="mr-1.5">{o.emoji}</span>
              {t(o.label)}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
