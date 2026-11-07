"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/remote";
import { useStore, useToday } from "@/lib/store";
import { myTurn } from "@/lib/pushQueue";
import { buzz, playChime, setTurnAlertOn, syncTurnAlertPref, turnAlertOn, unlockTurnSound } from "@/lib/turnAlert";
import { t } from "@/lib/i18n";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  pushOwner,
  pushOptedOut,
  sendTestPush,
  setPushOptOut,
  savePushOwner,
  getPushEnabled,
  pushCount,
  pushServerInfo,
  pushSupport,
  setPushEnabled,
  type PushSupport,
} from "@/lib/push";
import { externalAppUrl, inLineApp } from "@/lib/download";
import { savedPin, useMe } from "./PickMe";
import { Button, Card, Sheet } from "./ui";

/** แจ้งเตือนเด้งในมือถือ (Web Push): สถานะของเครื่องนี้ */
interface PushState {
  /** เซิร์ฟเวอร์ตั้งกุญแจครบ และรัน SQL แล้ว (ไม่พร้อม = ซ่อนทุกอย่าง) */
  ready: boolean;
  support: PushSupport;
  /** แอดมินเปิดไว้ */
  adminOn: boolean;
  on: boolean;
  denied: boolean;
}

export function usePush(playerId: string | null) {
  const { auth } = useStore();
  const demo = !!auth.demo;
  const [s, setS] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || demo) return setS(null);
    const [info, adminOn] = await Promise.all([pushServerInfo(), getPushEnabled(supabase)]);
    const sub = await currentSubscription(info.publicKey);
    // ยืนยันกับเซิร์ฟเวอร์ทุกครั้งที่เปิด: เครื่องนี้เคยเปิดรับให้คนอื่น (เปลี่ยนคนบนเครื่องเดียวกัน) ย้ายมาเป็นของคนที่เข้าอยู่ตอนนี้
    // และสมัครใหม่ถ้าเซิร์ฟเวอร์ลบไปแล้ว (เช่น เปลี่ยนกุญแจ)
    let on = !!sub && pushOwner() === playerId;
    if (sub && playerId && info.ready) {
      const err = await savePushOwner(supabase, sub, playerId, savedPin.get());
      on = !err || (on && err === "เชื่อมต่อไม่ได้ ลองใหม่");
      // เข้าสู่ระบบไม่ผ่านแล้ว: หยุดรับแจ้งเตือนของคนเดิมบนเครื่องนี้
      if (err && err !== "เชื่อมต่อไม่ได้ ลองใหม่") await disablePush(supabase).catch(() => {});
    }
    setS({
      ready: info.ready && adminOn !== null,
      support: pushSupport(),
      adminOn: adminOn !== false,
      on,
      denied: typeof Notification !== "undefined" && Notification.permission === "denied",
    });
  }, [demo, playerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- อ่านสถานะจากเครื่องและเซิร์ฟเวอร์ตอนเปิด
    void refresh();
  }, [refresh, playerId]);

  const turnOn = async () => {
    if (!supabase || !playerId || busy) return;
    setBusy(true);
    setError("");
    const err = await enablePush(supabase, playerId, savedPin.get());
    // กดเปิดเอง = เลิกเป็น "ปิดเอง" (ถ้าไม่ได้สิทธิ์ ก็ไม่ถือว่าปิดเอง)
    if (!err) setPushOptOut(false);
    setBusy(false);
    if (err && err !== "denied") setError(t(err));
    await refresh();
  };
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setPushOptOut(true);
    await disablePush(supabase).catch(() => {});
    setBusy(false);
    await refresh();
  };
  return { s, busy, error, turnOn, turnOff };
}

/** วิธีเพิ่มแอพลงหน้าจอโฮมบน iPhone (iOS ส่งแจ้งเตือนได้เฉพาะแอพที่เพิ่มลงหน้าจอโฮม) */
function IosSteps() {
  return (
    <div className="space-y-1.5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">{t("iPhone / iPad ต้องเพิ่มแอพลงหน้าจอโฮมก่อน (iOS 16.4 ขึ้นไป)")}</p>
      <ol className="list-decimal space-y-0.5 pl-5">
        <li>{t("เปิดเว็บนี้ใน Safari")}</li>
        <li>{t("กดปุ่มแชร์ □↑ (หรือปุ่ม ••• แล้วเลือกแชร์)")}</li>
        <li>{t("เลื่อนลง เลือก \"เพิ่มไปยังหน้าจอโฮม\"")}</li>
        <li>{t("เปิดแอพจากไอคอนบนหน้าจอโฮม เข้าสู่ระบบด้วย LINE อีกครั้ง")}</li>
        <li>{t("ไปที่ โปรไฟล์ > แจ้งเตือนเด้งในมือถือ แล้วติ๊กเปิด")}</li>
      </ol>
    </div>
  );
}

/** เครื่องนี้ยังเปิดแจ้งเตือนไม่ได้: บอกเหตุผลและวิธีแก้ */
function NotSupported({ support }: { support: PushSupport }) {
  if (support === "ios-install") return <IosSteps />;
  if (support === "in-app")
    return (
      <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        <p>{t("เปิดในแอพ LINE รับแจ้งเตือนเด้งไม่ได้ เปิดใน Chrome / Safari แล้วเพิ่มแอพลงหน้าจอโฮม")}</p>
        {inLineApp() && (
          <a href={externalAppUrl()} className="block min-h-11 w-full rounded-2xl bg-lime px-4 py-3 text-center font-semibold text-ink">
            {t("เปิดใน Chrome / Safari")}
          </a>
        )}
      </div>
    );
  return (
    <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      {support === "ios-old" ? t("ต้องอัปเดต iOS เป็น 16.4 ขึ้นไปก่อน ถึงจะรับแจ้งเตือนเด้งได้") : t("เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเด้ง ลองเปิดด้วย Chrome หรือ Safari")}
    </p>
  );
}

const Denied = () => (
  <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
    {isIos()
      ? t("มือถือปิดการแจ้งเตือนของแอพนี้ไว้ เปิดได้ที่ ตั้งค่าของมือถือ > การแจ้งเตือน แล้วกลับมากดอีกครั้ง")
      : t("ปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่ ไอคอนแม่กุญแจข้างชื่อเว็บ > สิทธิ์ > การแจ้งเตือน (หรือ ตั้งค่ามือถือ > แอพ > การแจ้งเตือน) แล้วกลับมากดอีกครั้ง")}
  </p>
);

/** หน้าโปรไฟล์: เปิด/ปิดแจ้งเตือนเด้งบนเครื่องนี้ */
export function PushToggle({ playerId }: { playerId: string }) {
  const { s, busy, error, turnOn, turnOff } = usePush(playerId);
  // ยังไม่ได้ตั้งแจ้งเตือนเด้ง: ยังเปิด/ปิดเสียงในแอพได้
  if (!s?.ready)
    return (
      <Card>
        <SoundToggle />
      </Card>
    );
  const can = s.support === "ok" && s.adminOn;
  return (
    <Card className="space-y-3">
      <h3 className="font-display font-semibold">{t("แจ้งเตือนเด้งในมือถือ")}</h3>
      <label className={`flex items-center justify-between gap-3 text-sm ${can ? "" : "opacity-60"}`}>
        <span className="min-w-0">
          <span className="block font-medium">{t("อีก 1 เกมถึงคิว")}</span>
          <span className="block text-sm text-zinc-500">{busy ? t("กำลังเปิด…") : t("เด้งบอกเบอร์สนามแม้ปิดแอพอยู่ ต้องเปิดในมือถือทุกเครื่องที่ใช้")}</span>
        </span>
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-lime"
          checked={s.on && s.adminOn}
          disabled={!can || busy}
          onChange={() => (s.on ? turnOff() : turnOn())}
        />
      </label>
      {!s.adminOn && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{t("แอดมินปิดแจ้งเตือนเด้งไว้ชั่วคราว")}</p>}
      {s.support !== "ok" && <NotSupported support={s.support} />}
      {s.support === "ok" && s.denied && !s.on && <Denied />}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="border-t border-zinc-100 pt-3">
        <SoundToggle />
      </div>
      {s.on && s.adminOn && s.support === "ok" && <TestPush />}
    </Card>
  );
}

/** เปิด/ปิด เสียงและสั่นตอนถึงคิว (เครื่องนี้) */
function SoundToggle() {
  const [on, setOn] = useState(turnAlertOn);
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="block font-medium">{t("เสียงและสั่นเมื่อถึงคิว")}</span>
        <span className="block text-sm text-zinc-500">{isIos() ? t("iPhone มีเสียงตอนเปิดแอพอยู่ (ไม่ได้ปิดเสียงเครื่อง) แจ้งเตือนเด้งใช้เสียงของเครื่อง") : t("สั่นและมีเสียงตอนถึงคิว และตอนอีก 1 เกมถึงคิว")}</span>
      </span>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-lime"
        checked={on}
        onChange={() => {
          setTurnAlertOn(!on);
          setOn(!on);
          // ลองให้ได้ยิน/รู้สึกทันทีตอนเปิด
          if (!on) {
            playChime("soon");
            buzz();
          }
        }}
      />
    </label>
  );
}

/**
 * ตอนเปิดแอพอยู่: ถึงคิวลงสนาม / อีก 1 เกมถึงคิว ให้มีเสียงสั้นๆ และสั่น (ครั้งเดียวต่อเรื่อง)
 * ตอนปิดแอพ แจ้งเตือนเด้ง (sw.js) สั่นแทน ไม่เตือนเรื่องที่ค้างอยู่ตั้งแต่ก่อนเปิดแอพ
 */
export function TurnAlert() {
  const [me] = useMe();
  const { state, auth } = useStore();
  const { day } = useToday();
  const seen = useRef<{ me: string | null; keys: Set<string> } | null>(null);

  useEffect(() => {
    syncTurnAlertPref();
    return unlockTurnSound();
  }, []);

  const mine = me && !auth.isAdmin ? myTurn(day, state.players, state.settings, me) : null;
  const key = mine?.key ?? null;
  const kind = mine?.kind;
  useEffect(() => {
    if (!seen.current || seen.current.me !== me) {
      // เปิดแอพ / เปลี่ยนคน: เรื่องที่มีอยู่แล้วไม่ต้องเตือน
      seen.current = { me, keys: new Set(key ? [key] : []) };
      return;
    }
    if (!key || !kind || seen.current.keys.has(key)) return;
    seen.current.keys.add(key);
    if (!turnAlertOn() || document.visibilityState !== "visible") return;
    playChime(kind);
    buzz();
  }, [me, key, kind]);
  return null;
}

/** ปุ่มส่งแจ้งเตือนทดสอบ: ส่งใน 6 วินาที ให้สลับไปหน้าจอโฮมรอดู */
function TestPush() {
  const [state, setState] = useState<"idle" | "wait" | { ok: boolean; text: string }>("idle");
  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      <Button
        className="min-h-11 w-full"
        disabled={state === "wait"}
        onClick={async () => {
          setState("wait");
          setState(await sendTestPush());
        }}
      >
        {state === "wait" ? t("จะส่งในอีก 6 วินาที ออกไปหน้าจอโฮมรอดูได้เลย") : t("ส่งแจ้งเตือนทดสอบ")}
      </Button>
      {typeof state === "object" && <p className={`rounded-xl px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{state.text}</p>}
    </div>
  );
}

const DISMISS = "badminton-kabinburi:push-prompt";

/** หน้าแรกผู้เล่น (เช็คอินแล้ว): ชวนเปิดแจ้งเตือนเด้งครั้งเดียว กด "ไม่ต้อง" แล้วไม่ถามอีก */
export function PushPrompt({ playerId }: { playerId: string }) {
  const { s, error } = usePush(playerId);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS) === "1";
    } catch {
      return false;
    }
  });
  const [steps, setSteps] = useState(false);
  if (hidden || !s?.ready || !s.adminOn || s.on || s.denied) return null;
  // เครื่องที่รับได้เลย (ติดตั้งแล้ว/Android) ใช้หน้าต่างขอสิทธิ์อัตโนมัติ (PushAuto) แทน การ์ดนี้ไว้ชวนเฉพาะคนที่ยังต้องติดตั้งหรือเปิดในเบราว์เซอร์อื่น
  if (s.support !== "ios-install" && s.support !== "in-app") return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS, "1");
    } catch {}
  };
  return (
    <Card className="space-y-3 border-lime ring-[1.5px] ring-lime">
      <div className="flex gap-3">
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{t("ให้มือถือเด้งเตือนตอนใกล้ถึงคิวไหม?")}</h3>
          <p className="text-sm text-zinc-600">{t("อีก 1 เกมถึงคิว มือถือจะเด้งบอกพร้อมเบอร์สนาม ไม่ต้องเฝ้าจอ")}</p>
        </div>
      </div>
      {s.support === "ios-install" && steps && <IosSteps />}
      {s.support === "in-app" && <NotSupported support="in-app" />}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className={s.support === "in-app" ? "" : "grid grid-cols-2 gap-2"}>
        <Button className="min-h-11 w-full" onClick={dismiss}>
          {t("ไม่ต้อง")}
        </Button>
        {s.support === "ios-install" && (
          <Button variant="primary" className="min-h-11" onClick={() => setSteps(!steps)}>
            {steps ? t("ซ่อนวิธี") : t("ดูวิธีเปิดบน iPhone")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** ตั้งค่าแอดมิน: เปิด/ปิดแจ้งเตือนเด้งทั้งก๊วน */
export function PushAdminCard() {
  const { auth } = useStore();
  const [on, setOn] = useState<boolean | null | undefined>(undefined);
  const [ready, setReady] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || !auth.isAdmin) return;
    const db = supabase;
    let live = true;
    getPushEnabled(db).then((v) => live && setOn(v));
    pushServerInfo().then((v) => live && setReady(v.ready));
    pushCount(db).then((v) => live && setCount(v));
    return () => {
      live = false;
    };
  }, [auth.isAdmin]);

  if (!supabase || auth.demo) return null;
  const toggle = async () => {
    if (!supabase || on === null || on === undefined) return;
    const next = !on;
    setOn(next);
    const err = await setPushEnabled(supabase, next);
    if (err) {
      setOn(!next);
      setError(t("บันทึกไม่สำเร็จ ลองใหม่"));
    } else setError("");
  };

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm text-zinc-600">{t("ส่งฟรี ไม่ใช้โควตา LINE ผู้เล่นเปิดรับเองในหน้าโปรไฟล์ (iPhone ต้องเพิ่มแอพลงหน้าจอโฮมก่อน)")}</p>
      </div>
      {on === null ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ต้องรัน SQL web_push.sql ก่อน")}</p>
      ) : (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            <span className="block font-medium">{t("เด้งเตือนเมื่ออีก 1 เกมถึงคิว")}</span>
            <span className="block text-sm text-zinc-500">{t("ส่งครั้งเดียวต่อตา บอกเบอร์สนามที่จะได้ลง")}</span>
          </span>
          <input type="checkbox" className="size-5 shrink-0 accent-lime" checked={!!on} disabled={on === undefined} onChange={toggle} />
        </label>
      )}
      {ready === false && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ยังไม่ได้ตั้งกุญแจแจ้งเตือนบนเซิร์ฟเวอร์ (Vercel) ผู้เล่นจะยังไม่เห็นปุ่มเปิดรับ")}</p>}
      {count !== null && <p className="text-sm text-zinc-600">{t("ผู้เล่นเปิดรับแล้ว {n} คน", { n: count })}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

const SNOOZE = "badminton-kabinburi:push-snooze";

/**
 * เปิดแอพหลังเข้าสู่ระบบ: ขอเปิดแจ้งเตือนให้เลย (เปิดเป็นค่าเริ่มต้น ผู้เล่นปิดเองได้ที่โปรไฟล์)
 * - เคยอนุญาตแล้วแต่ยังไม่ได้สมัคร: สมัครให้เงียบๆ
 * - ยังไม่เคยถาม: ขึ้นหน้าต่างปุ่มเดียว "เปิดแจ้งเตือน" (มือถือบังคับให้ผู้ใช้กดเอง เปิดโดยไม่ถามไม่ได้)
 * - ผู้เล่นปิดเองไว้ หรือมือถือบล็อกไว้: ไม่ถามซ้ำ
 */
export function PushAuto() {
  const [me] = useMe();
  const { auth } = useStore();
  const online = auth.online && !auth.demo;
  const push = usePush(online ? me : null);
  const { s, busy, error, turnOn } = push;
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem(SNOOZE) === "1";
    } catch {
      return false;
    }
  });
  const [asked, setAsked] = useState(false);
  const silent = useRef(false);

  // เคยอนุญาตสิทธิ์แล้ว (เช่น เปิดไว้แล้วเครื่องถูกลบข้อมูลการสมัคร): สมัครให้เองโดยไม่ต้องถามอีก
  useEffect(() => {
    if (!s?.ready || !s.adminOn || s.on || s.support !== "ok" || !me || silent.current) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || pushOptedOut()) return;
    silent.current = true;
    void turnOn();
  }, [s, me, turnOn]);

  if (!online || !me || !s?.ready || !s.adminOn || s.support !== "ok") return null;
  if (pushOptedOut() || s.denied) return null;
  if (s.on && !asked) return null;
  if (later && !asked) return null;
  if (typeof Notification !== "undefined" && Notification.permission === "granted" && !asked) return null;

  const close = () => {
    setLater(true);
    setAsked(false);
    try {
      sessionStorage.setItem(SNOOZE, "1");
    } catch {}
  };
  return (
    <Sheet
      keepOpen
      onClose={close}
      title={
        <div>
          <h3 className="font-display text-xl font-semibold">{s.on ? t("เปิดแล้ว") : t("เปิดแจ้งเตือนในมือถือ")}</h3>
        </div>
      }
    >
      <div className="space-y-4">
        {s.on ? (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">✓ {t("เปิดแล้ว มือถือจะเด้งเตือนเมื่อเปิดลงชื่อ อีก 1 เกมถึงคิว และถึงคิวลงสนาม ปิดได้ที่หน้าโปรไฟล์")}</p>
        ) : (
          <>
            <p className="text-[15px]">{t("ให้มือถือเด้งเตือนเมื่อเปิดลงชื่อก๊วน อีก 1 เกมถึงคิว และถึงคิวลงสนาม ไม่ต้องเฝ้าจอ")}</p>
            <p className="text-sm text-zinc-600">{t("กดปุ่มด้านล่าง แล้วเลือก \"อนุญาต\" เมื่อมือถือถาม")}</p>
          </>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {s.denied && <Denied />}
        {s.on || s.denied ? (
          <Button className="min-h-12 w-full" variant="primary" onClick={() => setAsked(false)}>
            {t("ตกลง")}
          </Button>
        ) : (
          <div className="grid gap-2">
            <Button
              variant="primary"
              className="min-h-12 w-full"
              disabled={busy}
              onClick={async () => {
                setAsked(true);
                await turnOn();
              }}
            >
              {busy ? t("กำลังเปิด…") : t("เปิดแจ้งเตือน")}
            </Button>
            <Button className="min-h-11 w-full" onClick={close}>
              {t("ไว้ทีหลัง")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
