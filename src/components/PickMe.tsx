"use client";

import { useCallback, useState } from "react";
import { readSession, writeSession } from "@/lib/session";
import { lineLoginEnabled, readLineTicket, startLineLogin } from "@/lib/lineLogin";
import type { Player } from "@/lib/types";
import { useStore } from "@/lib/store";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Button, Card, Icon, SearchInput, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";
import { visibleRoster } from "@/lib/roster";

/** ผู้เล่นที่ล็อกอินบนเครื่องนี้ (ต้องล็อกอินด้วย PIN ก่อน คนอื่นจึงเปิดดูบัญชีเราไม่ได้) */
export function useMe() {
  const { auth } = useStore();
  const [me, setMeState] = useState<string | null>(() => readSession()?.playerId ?? null);
  const setMe = useCallback(
    (id: string | null) => {
      // ออกจากระบบ: ล้างทั้งบัญชีผู้เล่นและตัวตน LINE บนเครื่องนี้
      if (!id) {
        writeSession(null);
        void auth.signOut();
      }
      setMeState(id);
    },
    [auth],
  );
  return [me, setMe] as const;
}

/** token ของการล็อกอิน ใช้แทน PIN เวลาเรียกคำสั่งของผู้เล่น */
export const savedPin = {
  get: () => readSession()?.token ?? "",
};

/**
 * หน้าเข้าสู่ระบบ ใช้ทุกเมนู เข้าด้วย LINE ทางเดียว (ทั้งผู้เล่นและแอดมิน)
 * - LINE นี้ยังไม่มีชื่อในก๊วน: สมัครครั้งแรก หรือผูกกับชื่อเดิม (ยืนยัน 4 ตัวท้ายเบอร์โทรครั้งเดียว)
 * - โหมดทดลองไม่มี LINE: พิมพ์ชื่อแล้วใส่รหัสแทน
 */
export function PickMe({ onPick, hint }: { onPick: (id: string) => void; hint: string }) {
  const { state, auth } = useStore();
  const [ticket] = useState(readLineTicket);
  const [q, setQ] = useState("");
  const [registering, setRegistering] = useState(false);
  const [linking, setLinking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const members = state.players.filter((p) => !p.guestOf && !p.pending);
  // ไม่แสดงชื่อคนอื่นจนกว่าจะพิมพ์ชื่อตัวเอง
  const list = q.trim() ? visibleRoster(members, q, () => false).slice(0, 6) : [];
  if (registering) return <Register onCancel={() => setRegistering(false)} />;
  const pickedPlayer = state.players.find((p) => p.id === picked);
  if (pickedPlayer) return <Login player={pickedPlayer} onDone={() => onPick(pickedPlayer.id)} onCancel={() => setPicked(null)} />;

  const search = (
    <div className="space-y-2">
      <SearchInput value={q} onChange={setQ} placeholder={t("พิมพ์ชื่อเล่นของคุณ")} />
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setPicked(p.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.99]"
              >
                <Avatar name={p.name} photo={p.photo} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-xs text-zinc-400">{t("นี่คือฉัน")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && list.length === 0 && <p className="px-1 text-center text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</p>}
    </div>
  );

  // กลับมาจาก LINE แล้ว แต่บัญชี LINE นี้ยังไม่ได้ผูกกับชื่อในก๊วน
  if (ticket)
    return (
      <div className="space-y-4">
        <SectionTitle>{t("สวัสดีคุณ {name}", { name: ticket.name })}</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-zinc-600">{t("บัญชี LINE นี้ยังไม่มีชื่อในก๊วน ถ้ามาครั้งแรกให้สมัครก่อน (ทำครั้งเดียว)")}</p>
          <Button variant="accent" className="w-full" onClick={() => setRegistering(true)}>
            {t("สมัครครั้งแรก")}
          </Button>
          {!linking ? (
            <button className="w-full text-center text-sm text-zinc-500 underline" onClick={() => setLinking(true)}>
              {t("แอดมินเคยลงชื่อให้แล้ว? ผูกกับชื่อเดิม")}
            </button>
          ) : (
            <>
              <p className="text-xs text-zinc-500">{t("พิมพ์ชื่อของคุณ แล้วยืนยันด้วย 4 ตัวท้ายเบอร์โทรครั้งเดียว")}</p>
              {search}
            </>
          )}
        </Card>
      </div>
    );

  // โหมดทดลอง (ไม่มี LINE จริง): เลือกชื่อด้วยการพิมพ์ค้นหา
  if (!auth.online)
    return (
      <div className="space-y-4">
        <SectionTitle>{t("เข้าสู่ระบบ")}</SectionTitle>
        <p className="px-1 text-sm text-zinc-500">{hint}</p>
        <Card className="space-y-3">
          <p className="text-xs text-amber-700">{t("โหมดทดลอง: ของจริงกดเข้าสู่ระบบด้วย LINE ตรงนี้แทน")}</p>
          {search}
          <Button variant="primary" className="w-full" onClick={() => setRegistering(true)}>
            {t("มาครั้งแรก ยังไม่มีชื่อ? สมัครเลย")}
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle>{t("เข้าสู่ระบบ")}</SectionTitle>
      <p className="px-1 text-sm text-zinc-500">{hint}</p>
      <Card className="space-y-3">
        {lineLoginEnabled ? (
          <>
            <button
              onClick={startLineLogin}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 py-3.5 font-semibold text-white"
            >
              {t("เข้าสู่ระบบด้วย LINE")}
            </button>
            <p className="text-center text-xs text-zinc-500">{t("มาครั้งแรกก็กดปุ่มนี้ แล้วสมัครต่อได้เลย")}</p>
          </>
        ) : (
          <p className="rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">{t("ยังไม่ได้ตั้งค่า LINE Login ให้แอพ")}</p>
        )}
      </Card>
    </div>
  );
}

/** ยังไม่มีแอดมินเลย: คนแรกที่เข้าด้วย LINE กดตั้งตัวเองเป็นแอดมินได้ (ครั้งเดียว) */
export function FirstAdminCard() {
  const { auth } = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!auth.online || auth.isAdmin || !auth.noAdmins || !auth.email) return null;
  return (
    <Card className="space-y-2 bg-lime/30">
      <p className="text-sm">{t("ระบบยังไม่มีแอดมินเลย ตั้งตัวเองเป็นแอดมินคนแรกได้ (ทำได้ครั้งเดียว)")}</p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button
        variant="primary"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const err = await auth.claimFirstAdmin();
          setBusy(false);
          setError(err ? t(err) : "");
        }}
      >
        {t("ตั้งฉันเป็นแอดมินคนแรก")}
      </Button>
    </Card>
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
            <div className="text-xs text-zinc-500">{t("ยืนยันตัวตนครั้งเดียว เครื่องนี้จะจำไว้")}</div>
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
              {t("4 ตัวท้ายเบอร์โทรของคุณ")}
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
      <p className="px-1 text-center text-xs text-zinc-500">{t("ไม่มีเบอร์ในระบบหรือจำไม่ได้ ให้แอดมินแก้เบอร์ให้")}</p>
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
        {t("ออกจากระบบ")}
      </button>
    </Card>
  );
}
