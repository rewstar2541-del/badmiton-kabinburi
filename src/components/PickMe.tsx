"use client";

import { useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, SectionTitle, inputClass } from "./ui";
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
  const [registering, setRegistering] = useState(false);
  const list = state.players.filter((p) => !p.guestOf && !p.pending && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  if (registering) return <Register onDone={onPick} onCancel={() => setRegistering(false)} />;

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
      <Button variant="primary" className="w-full" onClick={() => setRegistering(true)}>
        {t("มาครั้งแรก ยังไม่มีชื่อ? สมัครเลย")}
      </Button>
    </div>
  );
}

/** ผู้เล่นสมัครเองครั้งแรก แอดมินต้องกดอนุมัติก่อนจึงลงชื่อ/เช็คอินได้ */
function Register({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const { register } = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <SectionTitle>{t("สมัครสมาชิกก๊วน")}</SectionTitle>
      <p className="px-1 text-sm text-zinc-500">{t("กรอกข้อมูลของคุณ แอดมินจะตรวจและกดอนุมัติ จากนั้นลงชื่อและเช็คอินได้ เลข 4 ตัวท้ายเบอร์โทรใช้ยืนยันตัวตน")}</p>
      <Card>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <PlayerForm
          requirePhone
          submitLabel={busy ? t("กำลังส่ง...") : t("ส่งใบสมัคร")}
          onCancel={onCancel}
          onSave={async (p) => {
            if (busy) return;
            setBusy(true);
            const r = await register(p);
            setBusy(false);
            if (r.id) {
              if (p.phone) savedPin.set(p.phone.slice(-4));
              onDone(r.id);
            } else setError(t(r.error ?? "บันทึกไม่สำเร็จ"));
          }}
        />
      </Card>
    </div>
  );
}

/** แสดงแทนหน้าของผู้เล่นที่ยังรออนุมัติ */
export function PendingNotice({ name, onNotMe }: { name: string; onNotMe: () => void }) {
  return (
    <Card className="space-y-2 py-8 text-center">
      <Icon.Clock className="mx-auto text-amber-500" width={32} height={32} />
      <p className="font-semibold">{t("{name} สมัครแล้ว รอแอดมินอนุมัติ", { name })}</p>
      <p className="text-sm text-zinc-500">{t("เมื่ออนุมัติแล้ว หน้านี้จะลงชื่อและเช็คอินได้เอง")}</p>
      <button className="text-xs text-zinc-500 underline" onClick={onNotMe}>
        {t("ไม่ใช่ฉัน")}
      </button>
    </Card>
  );
}
