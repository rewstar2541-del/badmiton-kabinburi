"use client";

import { useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, Icon, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const ME_KEY = "badminton-kabinburi:me";
const PIN_KEY = "badminton-kabinburi:pin";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, v: string | null) {
  try {
    if (v) localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  } catch {
    // ไม่จำก็ได้
  }
}

/** ผู้เล่นที่ใช้เครื่องนี้ (จำไว้ในเครื่อง) */
export function useMe() {
  const [me, setMeState] = useState<string | null>(() => read(ME_KEY));
  const setMe = useCallback((id: string | null) => {
    write(ME_KEY, id);
    if (!id) write(PIN_KEY, null);
    setMeState(id);
  }, []);
  return [me, setMe] as const;
}

/** เลข 4 ตัวท้ายเบอร์โทรที่ใช้ยืนยันตัว (จำไว้ในเครื่องหลังใช้สำเร็จ) */
export const savedPin = {
  get: () => read(PIN_KEY) ?? "",
  set: (v: string) => write(PIN_KEY, v),
};

export function PickMe({ onPick, hint }: { onPick: (id: string) => void; hint: string }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const list = state.players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <SectionTitle>{t("คุณคือใคร?")}</SectionTitle>
      <p className="px-1 text-sm text-zinc-500">{hint}</p>
      <div className="relative">
        <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
        <input className={`${inputClass} pl-11`} placeholder={t("ค้นหาชื่อเล่น")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onPick(p.id)}
              className="flex w-full flex-col items-center gap-1.5 rounded-3xl bg-white p-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.97]"
            >
              <Avatar name={p.name} photo={p.photo} size={44} />
              <span className="w-full truncate text-sm font-semibold">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {state.players.length === 0 && <p className="text-center text-sm text-zinc-500">{t("ยังไม่มีรายชื่อ ให้แอดมินลงทะเบียนให้ก่อน")}</p>}
    </div>
  );
}
