"use client";

import { useRef, useState } from "react";
import { resizeSlip } from "@/lib/image";
import type { SelfAction } from "@/lib/state";
import { locale, t } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { savedPin } from "./PickMe";
import { Button, Icon, baht } from "./ui";

function time(at: number) {
  return new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

/** ผู้เล่นแนบรูปสลิปหลังโอน ให้แอดมินตรวจ ส่งสำเร็จแล้วนับว่าจ่ายทันที (เหมือนกด "ฉันจ่ายแล้ว") ไม่ให้ยอดค้างจนจ่ายซ้ำ */
export function SlipUpload({ playerId, amount, action }: { playerId: string; amount: number; action: Extract<SelfAction, "pay" | "payMonth"> }) {
  const { sendSlip, removeSlip, self } = useStore();
  const { day } = useToday();
  const pin = savedPin.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = (day.slips ?? []).filter((s) => s.playerId === playerId);

  return (
    <div className="w-full space-y-3 border-t border-dashed border-zinc-200 pt-3">
      {mine.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
          <Icon.Check width={16} height={16} className="shrink-0" />
          <span>
            {t("ส่งสลิปแล้ว {n} รูป ({time}) รอตรวจ", { n: mine.length, time: time(mine[mine.length - 1].at) })}
          </span>
        </div>
      )}
      {mine.map((x, i) => (
        <div key={x.id} className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {t("สลิปที่ {n}", { n: i + 1 })} · {time(x.at)}
          </span>
          {removing === x.id ? (
            <>
              <button
                className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const err = await removeSlip(playerId, pin, x.id);
                  setError(err ? t(err) : "");
                  setRemoving(null);
                  setBusy(false);
                }}
              >
                {t("ยืนยันลบ")}
              </button>
              <button className="text-xs text-zinc-500" onClick={() => setRemoving(null)}>
                {t("ไม่ลบ")}
              </button>
            </>
          ) : (
            <button className="text-xs font-semibold text-red-500" onClick={() => setRemoving(x.id)}>
              {t("ลบสลิปนี้ (แนบผิด)")}
            </button>
          )}
        </div>
      ))}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button
        variant={mine.length ? "secondary" : "primary"}
        className="flex w-full items-center justify-center gap-1.5"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon.Camera width={18} height={18} />
        {busy ? t("กำลังส่ง...") : mine.length ? t("ส่งสลิปอีกรูป") : t("โอนแล้ว แนบสลิป")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t("เลือกรูปสลิป")}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const err = (await sendSlip(playerId, pin, amount, await resizeSlip(f))) ?? (await self(action, playerId, pin));
            setError(err ? t(err) : "");
          } catch {
            setError(t("อ่านรูปไม่ได้ ลองเลือกรูปใหม่"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** แอดมินดูสลิปที่ผู้เล่นส่งมาวันนี้ */
export function SlipReview({ playerId, month }: { playerId: string; month?: string }) {
  const { state, slipImage, dispatch } = useStore();
  const { day } = useToday();
  const [removing, setRemoving] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [error, setError] = useState("");
  // ไม่ส่ง month = สลิปวันนี้ ส่ง month = สลิปทั้งเดือน (ค่ารายเดือน)
  const days = month ? state.days.filter((d) => d.date.startsWith(month)) : [day];
  const slips = days.flatMap((d) => (d.slips ?? []).filter((s) => s.playerId === playerId).map((s) => ({ ...s, date: d.date })));
  if (!slips.length) return null;

  const show = async (id: string) => {
    if (id in images) return;
    try {
      const img = await slipImage(id);
      setImages((m) => ({ ...m, [id]: img }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{t("สลิปที่ส่งมา")}</div>
      {slips.map((s) => (
        <div key={s.id} className="space-y-2 rounded-2xl bg-sky-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {time(s.at)} · {t("ยอดตอนส่ง {amount}", { amount: baht(s.amount) })}
            </span>
            <span className="flex items-center gap-3">
              {!(s.id in images) && (
                <button className="font-semibold text-sky-700 underline" onClick={() => show(s.id)}>
                  {t("ดูสลิป")}
                </button>
              )}
              {removing === s.id ? (
                <button
                  className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => {
                    dispatch({ type: "removeSlip", date: s.date, slipId: s.id });
                    setRemoving(null);
                  }}
                >
                  {t("ยืนยันลบ")}
                </button>
              ) : (
                <button className="text-xs font-semibold text-red-500" onClick={() => setRemoving(s.id)}>
                  {t("ลบ")}
                </button>
              )}
            </span>
          </div>
          {images[s.id] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[s.id]!} alt={t("สลิปโอนเงิน")} className="w-full rounded-xl" />
          )}
          {s.id in images && !images[s.id] && <p className="text-xs text-zinc-500">{t("ไม่พบรูป")}</p>}
        </div>
      ))}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">{t("เช็คยอดให้ตรงสลิป ไม่ตรงกดยกเลิกจ่าย")}</p>
    </div>
  );
}
