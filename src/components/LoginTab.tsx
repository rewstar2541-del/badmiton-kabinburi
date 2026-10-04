"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminsCard } from "./AdminsCard";
import { Button, Card, Icon, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";

export function LoginTab() {
  const { auth } = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (auth.email)
    return (
      <div className="space-y-4">
        <SectionTitle>{t("บัญชีแอดมิน")}</SectionTitle>
        <Card className="space-y-3 text-center">
          <p className="text-sm">
            {t("ล็อคอินเป็น")} <span className="font-semibold">{auth.email}</span>
          </p>
          {!auth.isAdmin && !auth.noAdmins && (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("อีเมลนี้ยังไม่ได้เป็นแอดมิน ให้แอดมินเพิ่มอีเมลนี้ในหน้าตั้งค่า")}
            </p>
          )}
          {!auth.isAdmin && auth.noAdmins && (
            <div className="space-y-2 rounded-2xl bg-lime/30 p-3 text-sm">
              <p>{t("ระบบยังไม่มีแอดมินเลย ตั้งอีเมลนี้เป็นแอดมินคนแรกได้ (ทำได้ครั้งเดียว)")}</p>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-red-600">{error}</p>}
              <Button
                variant="primary"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const err = await auth.claimFirstAdmin();
                  setError(err ? t(err) : "");
                  setBusy(false);
                }}
              >
                {t("ตั้งฉันเป็นแอดมินคนแรก")}
              </Button>
            </div>
          )}
          <Button className="w-full" onClick={() => auth.signOut()}>
            {t("ออกจากระบบ")}
          </Button>
        </Card>
        {auth.isAdmin && <AdminsCard />}
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle>{t("เข้าสู่ระบบแอดมิน")}</SectionTitle>
      <Card>
        {sent ? (
          <div className="space-y-2 py-4 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-lime text-ink">
              <Icon.Check />
            </div>
            <p className="font-semibold">{t("ส่งลิงก์ไปที่ {email} แล้ว", { email })}</p>
            <p className="text-sm text-zinc-500">{t("เปิดอีเมลบนเครื่องนี้แล้วกดลิงก์เพื่อเข้าสู่ระบบ")}</p>
            <button className="text-xs text-zinc-500 underline" onClick={() => setSent(false)}>
              {t("ใช้อีเมลอื่น")}
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t("อีเมลไม่ถูกต้อง"));
              setBusy(true);
              const err = await auth.signIn(email);
              setBusy(false);
              if (err) setError(err);
              else {
                setError("");
                setSent(true);
              }
            }}
          >
            <label className="block space-y-1.5 text-sm font-medium">
              {t("อีเมลแอดมิน")}
              <input
                className={inputClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button variant="primary" type="submit" className="w-full" disabled={busy}>
              {busy ? t("กำลังส่ง...") : t("ส่งลิงก์เข้าสู่ระบบ")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
