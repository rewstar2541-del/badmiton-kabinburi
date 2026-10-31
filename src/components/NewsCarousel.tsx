"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMe } from "./PickMe";
import { t } from "@/lib/i18n";
import { today, useStore } from "@/lib/store";
import { birthdays } from "@/lib/club";
import { activeFestival, festivalInfo } from "@/lib/festival";
import { useTourney } from "@/lib/tourneyStore";
import { Auto } from "@/lib/autoTranslate";
import { BirthdayBanner } from "./Birthday";
import { FestivalBanner } from "./FestivalDecor";
import { NoticeBanners, activeNotices } from "./Notices";
import { dayLabel } from "./Tourney";
import { Avatar, Icon, Sheet } from "./ui";

type Item = { key: string; emoji: ReactNode; title: string; sub?: string; tone: string; onClick: () => void; auto?: boolean };

/** หน้าแรกผู้เล่น: ข่าวทั้งหมด (เทศกาล สมัครแข่ง ข่าวสาร วันเกิด) ขึ้นทีละเรื่องในแถวเดียว เปลี่ยนเองทุก 5 วินาที ปัดเองได้ */
export function NewsCarousel() {
  const { state } = useStore();
  const { t: tr, mode, setPeek } = useTourney();
  const [all, setAll] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  // ผู้ใช้เพิ่งแตะ/ปัด: หยุดเลื่อนเองสักพัก
  const touched = useRef(0);
  const date = today();
  const fest = festivalInfo(activeFestival(state.settings.festival, date, birthdays(state.players, date).length > 0));
  const bdays = birthdays(state.players, date);
  const notices = activeNotices(state.notices).filter((n) => n.kind !== "urgent");
  const open = () => setAll(true);
  const [me] = useMe();
  const mine = bdays.find((p) => p.id === me);
  // วันเกิด: ขึ้นก่อน เอารูปเจ้าของวันเกิดมาโชว์
  const bdayItem: Item[] = bdays.length
    ? [
        {
          key: "bday",
          emoji: (
            <span className="flex -space-x-3">
              {bdays.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.name} photo={p.photo} size={48} ring />
              ))}
            </span>
          ),
          title: mine ? t("สุขสันต์วันเกิดนะ {name} 🎉", { name: mine.name }) : `🎂 ${t("สุขสันต์วันเกิด {name}", { name: bdays.map((p) => p.name).join(", ") })}`,
          sub: mine ? t("ทั้งก๊วนขออวยพรให้ ตีสนุก ชนะทุกเกม") : t("ตีสนุก แข็งแรง ชนะทุกเกม"),
          tone: "bg-violet-50 ring-pink-200 text-ink",
          onClick: open,
        },
      ]
    : [];
  const items: Item[] = [
    ...bdayItem,
    ...(tr && !mode && !tr.divisions.every((d) => d.drawn)
      ? [{ key: "tourney", emoji: "🏆", title: t("เปิดรับสมัครแข่ง {n}", { n: tr.name }), sub: t("ปิดรับ {d} · แตะเพื่อสมัคร", { d: dayLabel(tr.closeDate) }), tone: "bg-amber-50 ring-amber-200 text-amber-950", onClick: () => setPeek(true) }]
      : []),
    ...notices.map((n) => ({ key: n.id, emoji: "📢", title: n.title, sub: n.body, tone: "bg-sky-50 ring-sky-200 text-sky-950", onClick: open, auto: true })),
    ...(fest && fest.id !== "birthday" ? [{ key: "fest", emoji: fest.emoji, title: t(fest.greeting), sub: t(fest.wish), tone: "bg-white ring-zinc-200 text-ink", onClick: open }] : []),
  ];
  const n = items.length;
  const cur = Math.min(idx, Math.max(n - 1, 0));

  // เลื่อนเองทุก 5 วินาที (ไม่เลื่อนถ้าผู้ใช้ตั้งลดการเคลื่อนไหว)
  useEffect(() => {
    if (n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = box.current;
      if (!el || Date.now() - touched.current < 10000) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % n;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(id);
  }, [n]);

  if (!n) return null;
  return (
    <div>
      <div
        ref={box}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={() => (touched.current = Date.now())}
        onTouchStart={() => (touched.current = Date.now())}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {items.map((it) => (
          <button key={it.key} onClick={it.onClick} className={`flex w-full shrink-0 snap-center items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${it.tone}`}>
            <span className="text-2xl" aria-hidden>
              {it.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{it.auto ? <Auto text={it.title} /> : it.title}</span>
              {it.sub && <span className="block truncate text-sm opacity-75">{it.auto ? <Auto text={it.sub} /> : it.sub}</span>}
            </span>
            <Icon.ChevronRight className="shrink-0 opacity-50" />
          </button>
        ))}
      </div>
      {n > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {items.map((it, i) => (
            <span key={it.key} className={`h-1.5 rounded-full transition-all ${i === cur ? "w-5 bg-ink" : "w-1.5 bg-zinc-300"}`} />
          ))}
        </div>
      )}
      {all && (
        <Sheet title={<h3 className="font-display text-lg font-semibold">{t("ข่าววันนี้")}</h3>} onClose={() => setAll(false)}>
          <BirthdayBanner />
          {fest && fest.id !== "birthday" && <FestivalBanner f={fest} />}
          <NoticeBanners />
        </Sheet>
      )}
    </div>
  );
}
