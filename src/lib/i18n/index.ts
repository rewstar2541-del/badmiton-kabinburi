import { useSyncExternalStore } from "react";
import { en } from "./en";
import { zh } from "./zh";

export type Lang = "th" | "en" | "zh";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

const DICT: Record<Exclude<Lang, "th">, Record<string, string>> = { en, zh };
const LOCALES: Record<Lang, string> = { th: "th-TH", en: "en-GB", zh: "zh-CN" };
const KEY = "badminton-kabinburi:lang";

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "th" || v === "en" || v === "zh") return v;
  } catch {
    // ใช้ภาษาไทย
  }
  return "th";
}

let current: Lang = typeof window === "undefined" ? "th" : initial();
if (typeof document !== "undefined") document.documentElement.lang = current;
const listeners = new Set<() => void>();

/**
 * แปลข้อความ ใช้ข้อความภาษาไทยเป็นคีย์ ถ้าไม่มีคำแปลจะแสดงภาษาไทย
 * ตัวแปรเขียนเป็น {ชื่อ} เช่น t("เล่น {n} เกม", { n: 3 })
 */
export function t(th: string, vars?: Record<string, string | number>): string {
  const s = current === "th" ? th : (DICT[current][th] ?? th);
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : s;
}

/** locale สำหรับวันที่และตัวเลข */
export function locale(): string {
  return LOCALES[current];
}

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // ไม่จำก็ได้
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => current,
    () => "th" as Lang,
  );
}
