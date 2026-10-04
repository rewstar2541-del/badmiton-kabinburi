"use client";

import { useEffect, useState } from "react";
import { t, useLang, type Lang } from "./i18n";
import { supabase } from "./remote";

/**
 * แปลข้อความที่แอดมินพิมพ์เอง (ประกาศ วันงดเล่น โน้ตค่าน้ำ) ตามภาษาที่เลือก
 * Rew อนุญาตให้ส่งข้อความเหล่านี้ไปแปลกับบริการแปลฟรีภายนอก (2026-10-04)
 * เรียก edge function `translate` (แปลและเก็บแคชบนเซิร์ฟเวอร์) รวมหลายข้อความในครั้งเดียว
 * ระหว่างรอ หรือแปลไม่ได้ (เช่นโหมดทดลอง) แสดงต้นฉบับ
 */
// v2: รุ่นก่อนเก็บผลที่แปลไม่สำเร็จ (ได้ภาษาไทยกลับมา) ไว้ถาวร เลยไม่แปลอีกเลย
const CACHE_KEY = "badminton-kabinburi:auto-tr2";
/** แปลไม่สำเร็จในรอบนี้ ไม่ขอซ้ำจนกว่าจะเปิดแอพใหม่ และไม่บันทึกลงเครื่อง */
const failed = new Set<string>();
const THAI = /[฀-๿]/;
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let pending: { lang: Exclude<Lang, "th">; texts: Set<string> } | null = null;
let loaded = false;

const keyOf = (lang: string, text: string) => `${lang}\u0000${text}`;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
    for (const [k, v] of Object.entries(saved)) cache.set(k, v);
  } catch {
    // ไม่มีแคชก็ได้
  }
}

function save() {
  try {
    // เก็บไว้ไม่เกิน 300 ข้อความล่าสุด
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries([...cache].slice(-300))));
  } catch {
    // เก็บไม่ได้ก็ไม่เป็นไร
  }
}

async function flush() {
  const job = pending;
  pending = null;
  if (!job || !supabase) return;
  const texts = [...job.texts];
  for (let i = 0; i < texts.length; i += 20) {
    const chunk = texts.slice(i, i + 20);
    try {
      const { data } = await supabase.functions.invoke("translate", { body: { texts: chunk, lang: job.lang } });
      const out = (data as { translations?: string[] } | null)?.translations ?? [];
      chunk.forEach((s, j) => {
        if (out[j] && out[j] !== s) cache.set(keyOf(job.lang, s), out[j]);
        else failed.add(keyOf(job.lang, s));
      });
    } catch {
      chunk.forEach((s) => failed.add(keyOf(job.lang, s)));
    }
  }
  save();
  listeners.forEach((f) => f());
}

function request(lang: Exclude<Lang, "th">, text: string) {
  if (pending && pending.lang !== lang) void flush();
  if (!pending) {
    pending = { lang, texts: new Set() };
    setTimeout(flush, 30);
  }
  pending.texts.add(text);
}

/** คำแปลที่มีอยู่แล้ว (null = ยังไม่ได้แปล) */
export function autoTranslate(text: string, lang: Lang): string | null {
  if (lang === "th" || !text.trim() || !THAI.test(text)) return text;
  load();
  const k = keyOf(lang, text);
  return cache.get(k) ?? (failed.has(k) ? text : null);
}

/** คืนข้อความที่แปลแล้วตามภาษาปัจจุบัน (ระหว่างรอคืนต้นฉบับ) */
export function useAuto(text: string): string {
  const lang = useLang();
  const [, bump] = useState(0);
  // ข้อความสำเร็จรูปของแอพ (เช่นประกาศเริ่มต้น) มีคำแปลอยู่แล้ว ไม่ต้องส่งไปแปล
  const known = lang === "th" ? text : t(text);
  const hit = known !== text ? known : autoTranslate(text, lang);
  useEffect(() => {
    if (hit !== null || lang === "th" || !supabase) return;
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    request(lang, text);
    return () => {
      listeners.delete(f);
    };
  }, [hit, lang, text]);
  return hit ?? text;
}

/** แสดงข้อความที่แอดมินพิมพ์ แปลตามภาษาที่เลือก */
export function Auto({ text }: { text: string }) {
  return <>{useAuto(text)}</>;
}
