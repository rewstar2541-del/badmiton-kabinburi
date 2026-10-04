"use client";

import { useCallback, useState } from "react";
import { readSession, writeSession } from "@/lib/session";
import { lineLoginEnabled, readLineTicket, startLineLogin } from "@/lib/lineLogin";
import type { Player } from "@/lib/types";
import { useStore } from "@/lib/store";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";
import { visibleRoster } from "@/lib/roster";

/** ผู้เล่นที่ล็อกอินบนเครื่องนี้ (ต้องล็อกอินด้วย PIN ก่อน คนอื่นจึงเปิดดูบัญชีเราไม่ได้) */
export function useMe() {
  const [me, setMeState] = useState<string | null>(() => readSession()?.playerId ?? null);
  const setMe = useCallback((id: string | null) => {
    if (!id) writeSession(null);
    setMeState(id);
  }, []);
  return [me, setMe] as const;
}

/** token ของการล็อกอิน ใช้แทน PIN เวลาเรียกคำสั่งของผู้เล่น */
export const savedPin = {
  get: () => readSession()?.token ?? "",
};

export function PickMe({ onPick, hint }: { onPick: (id: string) => void; hint: string }) {
  const { state, auth } = useStore();
  const [ticket] = useState(readLineTicket);
  const [q, setQ] = useState("");
  const [registering, setRegistering] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const members = state.players.filter((p) => !p.guestOf && !p.pending);
  // ก๊วนใหญ่ไม่แสดงรายชื่อทั้งหมด ให้พิมพ์ชื่อตัวเองค้นหา
  const list = visibleRoster(members, q, () => false);
  const mustSearch = !q.trim() && list.length < members.length;
  if (registering) return <Register onCancel={() => setRegistering(false)} />;
  const pickedPlayer = state.players.find((p) => p.id === picked);
  if (pickedPlayer) return <Login player={pickedPlayer} onDone={() => onPick(pickedPlayer.id)} onCancel={() => setPicked(null)} />;

  return (
    <div className="space-y-4">
      <SectionTitle>{t("คุณคือใคร?")}</SectionTitle>
      {ticket ? (
        <p className="rounded-2xl bg-[#06C755]/10 px-4 py-3 text-sm text-emerald-900">
          {t("สวัสดีคุณ {name} เลือกชื่อของคุณในก๊วนเพื่อผูกกับ LINE (ทำครั้งเดียว) ถ้ามาครั้งแรกให้กดสมัครด้านล่าง", { name: ticket.name })}
        </p>
      ) : (
        lineLoginEnabled &&
        auth.online && (
          <button
            onClick={startLineLogin}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 py-3 text-sm font-semibold text-white"
          >
            {t("เข้าสู่ระบบด้วย LINE")}
          </button>
        )
      )}
      <p className="px-1 text-sm text-zinc-500">{hint}</p>
      <div className="relative">
        <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
        <input className={`${inputClass} pl-11`} placeholder={t("ค้นหาชื่อเล่น")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setPicked(p.id)}
              className="flex w-full flex-col items-center gap-1.5 rounded-3xl bg-white p-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.97]"
            >
              <Avatar name={p.name} photo={p.photo} size={44} />
              <span className="w-full truncate text-sm font-semibold">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {mustSearch && <p className="px-1 text-center text-sm text-zinc-500">{t("พิมพ์ชื่อของคุณเพื่อค้นหา")}</p>}
      {!mustSearch && list.length === 0 && <p className="px-1 text-center text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</p>}
      <Button variant="primary" className="w-full" onClick={() => setRegistering(true)}>
        {t("มาครั้งแรก ยังไม่มีชื่อ? สมัครเลย")}
      </Button>
    </div>
  );
}

/** ล็อกอินด้วย PIN ครั้งเดียวต่อเครื่อง ครั้งแรกใช้ 4 ตัวท้ายเบอร์โทร แล้วตั้ง PIN ของตัวเอง */
function Login({ player, onDone, onCancel }: { player: Player; onDone: () => void; onCancel: () => void }) {
  const { login, auth } = useStore();
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (needPin && !/^\d{4,6}$/.test(newPin)) return setError(t("PIN ต้องเป็นตัวเลข 4-6 หลัก"));
    setBusy(true);
    const r = await login(player.id, pin, needPin ? newPin : undefined);
    setBusy(false);
    if (r.need_pin) {
      setNeedPin(true);
      setError("");
    } else if (r.token) onDone();
    else setError(t(r.error ?? "บันทึกไม่สำเร็จ"));
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={player.name} photo={player.photo} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-semibold">{player.name}</div>
            <div className="text-xs text-zinc-500">{t("เข้าสู่ระบบครั้งเดียว เครื่องนี้จะจำไว้ คนอื่นเปิดดูบัญชีคุณไม่ได้")}</div>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {!needPin ? (
            <label className="block space-y-1.5 text-sm font-medium">
              {t("PIN ของคุณ (ครั้งแรกใช้ 4 ตัวท้ายเบอร์โทร)")}
              <input className={inputClass} type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
            </label>
          ) : (
            <label className="block space-y-1.5 text-sm font-medium">
              {t("ตั้ง PIN ใหม่ของคุณ (ตัวเลข 4-6 หลัก ใช้ครั้งต่อไป)")}
              <input className={inputClass} type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} />
            </label>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" type="submit" className="flex-1" disabled={busy}>
              {needPin ? t("ตั้ง PIN และเข้าสู่ระบบ") : t("เข้าสู่ระบบ")}
            </Button>
            <Button type="button" onClick={onCancel}>
              {t("ยกเลิก")}
            </Button>
          </div>
        </form>
      </Card>
      <p className="px-1 text-center text-xs text-zinc-500">{t("ลืม PIN? ให้แอดมินรีเซ็ตให้")}</p>
      {auth.demo && player.phone && (
        <p className="px-1 text-center text-xs text-amber-700">{t("โหมดทดลอง: 4 ตัวท้ายเบอร์ของ {name} คือ {pin}", { name: player.name, pin: player.phone.slice(-4) })}</p>
      )}
    </div>
  );
}

/** ผู้เล่นสมัครเองครั้งแรก แอดมินต้องกดอนุมัติก่อน แล้วจึงเข้าสู่ระบบได้ */
function Register({ onCancel }: { onCancel: () => void }) {
  const { register } = useStore();
  const [ticket] = useState(readLineTicket);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  if (sent)
    return (
      <Card className="space-y-2 py-8 text-center">
        <Icon.Clock className="mx-auto text-amber-500" width={32} height={32} />
        <p className="font-semibold">{t("{name} สมัครแล้ว รอแอดมินอนุมัติ", { name: sent })}</p>
        <p className="text-sm text-zinc-500">
          {ticket ? t("อนุมัติแล้วกดเข้าสู่ระบบด้วย LINE ได้เลย") : t("อนุมัติแล้วให้เลือกชื่อของคุณ แล้วเข้าสู่ระบบด้วย 4 ตัวท้ายเบอร์โทร")}
        </p>
        <Button className="mx-auto" onClick={onCancel}>
          {t("กลับ")}
        </Button>
      </Card>
    );
  return (
    <div className="space-y-4">
      <SectionTitle>{t("สมัครสมาชิกก๊วน")}</SectionTitle>
      <p className="px-1 text-sm text-zinc-500">{t("กรอกข้อมูลของคุณ แอดมินจะตรวจและกดอนุมัติ จากนั้นลงชื่อและเช็คอินได้ เลข 4 ตัวท้ายเบอร์โทรใช้ยืนยันตัวตน")}</p>
      <Card>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <PlayerForm
          requirePhone
          defaultName={ticket?.name}
          submitLabel={busy ? t("กำลังส่ง...") : t("ส่งใบสมัคร")}
          onCancel={onCancel}
          onSave={async (p) => {
            if (busy) return;
            setBusy(true);
            const r = await register(p);
            setBusy(false);
            if (r.id) setSent(p.name);
            else setError(t(r.error ?? "บันทึกไม่สำเร็จ"));
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
