"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminsCard } from "./AdminsCard";
import { Button, Card, Icon, SectionTitle, inputClass } from "./ui";

export function LoginTab() {
  const { auth } = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (auth.email)
    return (
      <div className="space-y-4">
        <SectionTitle>บัญชีแอดมิน</SectionTitle>
        <Card className="space-y-3 text-center">
          <p className="text-sm">
            ล็อคอินเป็น <span className="font-semibold">{auth.email}</span>
          </p>
          {!auth.isAdmin && (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              อีเมลนี้ยังไม่ได้เป็นแอดมิน ให้แอดมินเพิ่มอีเมลนี้ก่อน
            </p>
          )}
          <Button className="w-full" onClick={() => auth.signOut()}>
            ออกจากระบบ
          </Button>
        </Card>
        {auth.isAdmin && <AdminsCard />}
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle>เข้าสู่ระบบแอดมิน</SectionTitle>
      <Card>
        {sent ? (
          <div className="space-y-2 py-4 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-lime text-ink">
              <Icon.Check />
            </div>
            <p className="font-semibold">ส่งลิงก์ไปที่ {email} แล้ว</p>
            <p className="text-sm text-zinc-500">เปิดอีเมลบนเครื่องนี้แล้วกดลิงก์เพื่อเข้าสู่ระบบ</p>
            <button className="text-xs text-zinc-500 underline" onClick={() => setSent(false)}>
              ใช้อีเมลอื่น
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("อีเมลไม่ถูกต้อง");
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
              อีเมลแอดมิน
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
              {busy ? "กำลังส่ง..." : "ส่งลิงก์เข้าสู่ระบบ"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
