"use client";

import { useRef, useState } from "react";
import { resizeSlip } from "@/lib/image";
import { slipImage, supabase } from "@/lib/remote";
import { useStore, useToday } from "@/lib/store";
import { savedPin } from "./PickMe";
import { Button, Icon, baht, inputClass } from "./ui";

function time(at: number) {
  return new Date(at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/** ผู้เล่นแนบรูปสลิปหลังโอน ให้แอดมินตรวจ */
export function SlipUpload({ playerId, amount }: { playerId: string; amount: number }) {
  const { sendSlip } = useStore();
  const { day } = useToday();
  const [pin, setPin] = useState(savedPin.get);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = (day.slips ?? []).filter((s) => s.playerId === playerId);

  return (
    <div className="w-full space-y-3 border-t border-dashed border-zinc-200 pt-3">
      {mine.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
          <Icon.Check width={16} height={16} className="shrink-0" />
          <span>
            ส่งสลิปแล้ว {mine.length > 1 && `${mine.length} รูป `}(ล่าสุด {time(mine[mine.length - 1].at)}) รอแอดมินตรวจ
          </span>
        </div>
      )}
      <label className="block space-y-1.5 text-sm font-medium">
        เลข 4 ตัวท้ายเบอร์โทรของคุณ
        <input
          className={inputClass}
          inputMode="numeric"
          maxLength={4}
          placeholder="ถ้าไม่ได้ลงเบอร์ไว้ ปล่อยว่างได้"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button
        variant={mine.length ? "secondary" : "primary"}
        className="flex w-full items-center justify-center gap-1.5"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon.Camera width={18} height={18} />
        {busy ? "กำลังส่ง..." : mine.length ? "ส่งสลิปอีกรูป" : "โอนแล้ว แนบสลิป"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="เลือกรูปสลิป"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const err = await sendSlip(playerId, pin, amount, await resizeSlip(f));
            setError(err ?? "");
            if (!err) savedPin.set(pin);
          } catch {
            setError("อ่านรูปไม่ได้ ลองเลือกรูปใหม่");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** แอดมินดูสลิปที่ผู้เล่นส่งมาวันนี้ */
export function SlipReview({ playerId }: { playerId: string }) {
  const { day } = useToday();
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [error, setError] = useState("");
  const slips = (day.slips ?? []).filter((s) => s.playerId === playerId);
  if (!slips.length) return null;

  const show = async (id: string) => {
    if (!supabase || id in images) return;
    try {
      const img = await slipImage(supabase, id);
      setImages((m) => ({ ...m, [id]: img }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">สลิปที่ส่งมา</div>
      {slips.map((s) => (
        <div key={s.id} className="space-y-2 rounded-2xl bg-sky-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {time(s.at)} · ยอดตอนส่ง {baht(s.amount)}
            </span>
            {!(s.id in images) && (
              <button className="font-semibold text-sky-700 underline" onClick={() => show(s.id)}>
                ดูสลิป
              </button>
            )}
          </div>
          {images[s.id] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[s.id]!} alt="สลิปโอนเงิน" className="w-full rounded-xl" />
          )}
          {s.id in images && !images[s.id] && <p className="text-xs text-zinc-500">ไม่พบรูป</p>}
        </div>
      ))}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">ตรวจยอดเข้าบัญชีให้ตรงก่อนกด &quot;ได้รับเงินแล้ว&quot;</p>
    </div>
  );
}
