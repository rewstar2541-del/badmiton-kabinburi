"use client";

import { useEffect, useState } from "react";
import {
  getLineSettings,
  lineFriend,
  lineStatus,
  myLine,
  setLinePrefs,
  supabase,
  testLine,
  updateLineSettings,
  type LineSettings,
  type LineStatus,
  type MyLine,
} from "@/lib/remote";
import { useStore } from "@/lib/store";
import { savedPin } from "./PickMe";
import { Button, Card, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const addFriendUrl = (oa: string) => `https://line.me/R/ti/p/${encodeURIComponent(oa.startsWith("@") ? oa : "@" + oa)}`;

function Row({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      <input type="checkbox" className="size-5 shrink-0 accent-lime" checked={checked} onChange={onChange} />
    </label>
  );
}

/** แอดมิน: แจ้งเตือนเข้า LINE ส่วนตัวของผู้เล่น ผ่าน LINE OA ของก๊วน พร้อมตัวนับโควตาฟรี */
export function LineCard() {
  const { auth } = useStore();
  const [s, setS] = useState<LineSettings | null>(null);
  const [st, setSt] = useState<LineStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !auth.isAdmin) return;
    const db = supabase;
    let live = true;
    getLineSettings(db)
      .then((v) => live && setS(v))
      .catch((e) => live && setMsg(String(e instanceof Error ? e.message : e)));
    lineStatus(db)
      .then((v) => live && setSt(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [auth.isAdmin]);

  if (!auth.online) return null;

  const save = async (patch: Partial<LineSettings>) => {
    if (!supabase || !s) return;
    setS({ ...s, ...patch });
    await updateLineSettings(supabase, patch);
  };

  const limit = s?.monthly_limit ?? 300;
  const used = Math.max(st?.usage.sent ?? 0, st?.lineUsed ?? 0);
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const ready = !!st?.tokenOk;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display font-semibold">{t("แจ้งเตือน LINE")}</h2>
        <p className="text-xs text-zinc-500">{t("ส่งเข้า LINE ส่วนตัวของผู้เล่นที่เพิ่มเพื่อน LINE ก๊วนแล้ว")}</p>
      </div>

      <p className={`rounded-2xl px-3 py-2.5 text-sm font-medium ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-900"}`}>
        {!st
          ? t("กำลังเช็ค...")
          : ready
            ? t("เชื่อม LINE OA แล้ว: {name} ({id})", { name: st.name ?? "", id: st.basicId ?? "" })
            : st.token
              ? t("token ไม่ถูกต้อง ลองออก token ใหม่")
              : t("ยังไม่ได้ใส่ token ของ LINE OA (ดูขั้นตอนในคู่มือ)")}
      </p>

      {s && (
        <>
          <div className="space-y-1.5 rounded-2xl bg-zinc-50 p-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{t("โควตาเดือนนี้")}</span>
              <span className="font-display font-semibold tabular-nums">
                {used} / {limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-lime"}`} style={{ width: pct + "%" }} />
            </div>
            {st && (
              <p className="text-xs text-zinc-500">
                {t("ถึงคิว {a} · ประกาศ {b} · ไม่ได้ส่ง {c}", { a: st.usage.turn, b: st.usage.announce, c: st.usage.skipped })}
              </p>
            )}
            <p className="text-xs text-zinc-500">{t("ครบแล้วหยุดส่งเอง แพ็กเกจฟรีไม่เสียเงิน")}</p>
          </div>

          <Row
            label={t("แจ้ง \"ถึงคิวคุณ\"")}
            hint={t("1 ข้อความต่อคนต่อเกม (ส่งก่อนเสมอ)")}
            checked={s.notify_turn_personal}
            onChange={() => save({ notify_turn_personal: !s.notify_turn_personal })}
          />
          <Row
            label={t("แจ้งเมื่อเปิดลงชื่อ")}
            hint={t("1 ข้อความต่อคน ส่งเฉพาะคนที่มาใน 60 วัน")}
            checked={s.notify_announce}
            onChange={() => save({ notify_announce: !s.notify_announce })}
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">
              {t("โควตาต่อเดือน")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputClass} mt-1`}
                value={s.monthly_limit}
                onChange={(e) => setS({ ...s, monthly_limit: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                onBlur={() => save({ monthly_limit: s.monthly_limit })}
              />
            </label>
            <label className="text-xs text-zinc-500">
              {t("กันไว้ให้ถึงคิว")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputClass} mt-1`}
                value={s.turn_reserve}
                onChange={(e) => setS({ ...s, turn_reserve: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                onBlur={() => save({ turn_reserve: s.turn_reserve })}
              />
            </label>
          </div>
          <p className="text-xs text-zinc-500">{t("ถ้าโควตาเหลือน้อยกว่าที่กันไว้ จะไม่ส่งแจ้งประกาศ")}</p>

          {s.last_error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {t("ปัญหาล่าสุด")}: {s.last_error}
            </p>
          )}
        </>
      )}
      {msg && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{t(msg)}</p>}
      <Button
        className="w-full"
        disabled={busy || !ready}
        onClick={async () => {
          if (!supabase) return;
          setBusy(true);
          const err = await testLine(supabase);
          setBusy(false);
          setMsg(err ?? "");
          if (!err) alert(t("ส่งข้อความทดสอบแล้ว ดูใน LINE ของคุณ"));
        }}
      >
        {t("ส่งข้อความทดสอบหาฉัน")}
      </Button>
    </Card>
  );
}

const DEMO: MyLine = { linked: true, turn: true, announce: true, oa: "@kabinburi", turn_on: true, announce_on: true };

/** ผู้เล่น: เปิด/ปิดแจ้งเตือนของตัวเอง และปุ่มเพิ่มเพื่อน LINE ก๊วน */
export function PlayerLineAlerts({ playerId }: { playerId: string }) {
  const [info, setInfo] = useState<MyLine | null>(supabase ? null : DEMO);
  const [friend, setFriend] = useState<boolean | null>(supabase ? null : false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let live = true;
    const token = savedPin.get();
    myLine(db, playerId, token)
      .then((v) => live && (v.error ? setError(v.error) : setInfo(v)))
      .catch(() => {});
    lineFriend(db, playerId, token).then((v) => live && setFriend(v));
    return () => {
      live = false;
    };
  }, [playerId]);

  if (!info || !info.linked || (!info.turn_on && !info.announce_on)) return null;

  const save = async (turn: boolean, announce: boolean) => {
    setInfo({ ...info, turn, announce });
    if (!supabase) return;
    const err = await setLinePrefs(supabase, playerId, savedPin.get(), turn, announce);
    setError(err ? t(err) : "");
  };

  return (
    <Card className="space-y-3">
      <h3 className="font-display font-semibold">{t("แจ้งเตือน LINE")}</h3>
      {friend === false && info.oa && (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          <p>{t("เพิ่มเพื่อน LINE ก๊วนก่อน ถึงจะได้รับแจ้งเตือน")}</p>
          <a href={addFriendUrl(info.oa)} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-2xl bg-[#06C755] font-semibold text-white">
            {t("เพิ่มเพื่อน LINE ก๊วน")}
          </a>
        </div>
      )}
      {friend && <p className="text-xs text-emerald-700">✓ {t("เป็นเพื่อนกับ LINE ก๊วนแล้ว")}</p>}
      {info.turn_on && <Row label={t("ถึงคิวฉันแล้ว")} checked={info.turn} onChange={() => save(!info.turn, info.announce)} />}
      {info.announce_on && <Row label={t("เปิดลงชื่อ / อีเว้นใหม่")} checked={info.announce} onChange={() => save(info.turn, !info.announce)} />}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
