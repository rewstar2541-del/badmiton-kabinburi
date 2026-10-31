"use client";

import { t } from "@/lib/i18n";
import type { FESTIVALS } from "@/lib/festival";

type Info = (typeof FESTIVALS)[number];

/** แบนเนอร์เทศกาลใต้หัวแอพ: ไล่สี ของตกแต่งรอบๆ และคำอวยพร */
export function FestivalBanner({ f }: { f: Info }) {
  // ตำแหน่งของตกแต่งรอบแบนเนอร์ (คงที่ ไม่สุ่ม หน้าตาเหมือนกันทุกครั้ง)
  const spots = ["right-3 top-1 rotate-12 text-2xl", "right-12 bottom-1 -rotate-12 text-xl", "right-14 top-2 rotate-6 text-base opacity-80", "right-3 bottom-1 rotate-12 text-lg opacity-80", "right-20 top-8 -rotate-6 text-sm opacity-70"];
  return (
    <div
      className="festival-banner relative mt-3 overflow-hidden rounded-3xl px-4 py-3 text-white shadow-[0_10px_24px_-14px_rgba(11,18,32,0.5)]"
      style={{ backgroundImage: `linear-gradient(120deg, ${f.colors[0]}, ${f.colors[1]})` }}
    >
      {f.decor.map((e, i) => (
        <span key={i} aria-hidden className={`festival-float pointer-events-none absolute select-none ${spots[i % spots.length]}`} style={{ animationDelay: `${i * 0.6}s` }}>
          {e}
        </span>
      ))}
      <div className="relative flex items-center gap-3 pr-20">
        <span aria-hidden className="festival-wiggle grid size-12 shrink-0 place-items-center rounded-2xl bg-white/25 text-3xl">
          {f.emoji}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg leading-tight font-semibold drop-shadow-sm">{t(f.greeting)}</span>
          <span className="block text-sm text-white/90">{t(f.wish)}</span>
        </span>
      </div>
    </div>
  );
}

/** ของลอยลงมาบนจอเบาๆ (ไม่บังการกด ปิดเองถ้าเครื่องตั้งลดการเคลื่อนไหว) */
export function FestivalFalling({ f }: { f: Info }) {
  const items = Array.from({ length: 10 }, (_, i) => ({
    e: f.falling[i % f.falling.length],
    left: (i * 37 + 7) % 100,
    delay: (i * 1.7) % 9,
    dur: 9 + ((i * 3) % 6),
    size: 14 + ((i * 5) % 10),
  }));
  return (
    <div aria-hidden className="festival-falling pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {items.map((x, i) => (
        <span
          key={i}
          className="festival-drop absolute -top-8 select-none"
          style={{ left: `${x.left}%`, fontSize: x.size, animationDelay: `${x.delay}s`, animationDuration: `${x.dur}s` }}
        >
          {x.e}
        </span>
      ))}
    </div>
  );
}
