"use client";

import { useEffect, useState } from "react";
import { getLineSettings, supabase, testLine, updateLineSettings, type LineSettings } from "@/lib/remote";
import { useStore } from "@/lib/store";
import { Button, Card } from "./ui";
import { t } from "@/lib/i18n";

/** แจ้งเตือนเข้ากลุ่ม LINE ของก๊วน: มีคนลงชื่อ และถึงคิวลงสนาม */
export function LineCard() {
  const { auth } = useStore();
  const [s, setS] = useState<LineSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !auth.isAdmin) return;
    let live = true;
    getLineSettings(supabase)
      .then((v) => live && setS(v))
      .catch((e) => live && setMsg(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [auth.isAdmin]);

  const toggle = async (key: "notify_signup" | "notify_turn") => {
    if (!supabase || !s) return;
    const next = { ...s, [key]: !s[key] };
    setS(next);
    await updateLineSettings(supabase, { [key]: next[key] });
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display font-semibold">{t("แจ้งเตือนกลุ่ม LINE")}</h2>
        <p className="text-xs text-zinc-500">{t("ส่งข้อความเข้ากลุ่ม LINE ของก๊วนเมื่อมีคนลงชื่อ และเมื่อถึงคิวลงสนาม")}</p>
      </div>
      {!auth.online ? (
        <p className="rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500">{t("ใช้ได้เมื่อแอพเชื่อมฐานข้อมูลออนไลน์แล้ว")}</p>
      ) : (
        <>
          <p className={`rounded-2xl px-3 py-2.5 text-sm font-medium ${s?.group_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-900"}`}>
            {s?.group_id ? t("เชื่อมกลุ่ม LINE แล้ว") : t("ยังไม่ได้เชื่อมกลุ่ม: เชิญบอทของก๊วนเข้ากลุ่ม LINE แล้วพิมพ์ \"เชื่อมแอพก๊วน\"")}
          </p>
          {s &&
            (
              [
                ["notify_signup", t("แจ้งเมื่อมีคนลงชื่อ")],
                ["notify_turn", t("แจ้งเมื่อถึงคิวลงสนาม")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-sm">
                {label}
                <input type="checkbox" className="size-5 accent-lime" checked={s[key]} onChange={() => toggle(key)} />
              </label>
            ))}
          {msg && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{t(msg)}</p>}
          <Button
            className="w-full"
            disabled={busy || !s?.group_id}
            onClick={async () => {
              if (!supabase) return;
              setBusy(true);
              const err = await testLine(supabase);
              setBusy(false);
              setMsg(err ?? "");
              if (!err) alert(t("ส่งข้อความทดสอบแล้ว ดูในกลุ่ม LINE"));
            }}
          >
            {t("ส่งข้อความทดสอบ")}
          </Button>
        </>
      )}
    </Card>
  );
}
