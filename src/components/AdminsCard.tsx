"use client";

import { useCallback, useEffect, useState } from "react";
import { addAdmin, listAdmins, removeAdmin, supabase } from "@/lib/remote";
import { useStore } from "@/lib/store";
import { Button, Card, Icon, SectionTitle, inputClass } from "./ui";

/** เพิ่ม/ลบแอดมินด้วยอีเมล */
export function AdminsCard() {
  const { auth } = useStore();
  const [admins, setAdmins] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (job?: () => Promise<void>) => {
    if (!supabase) return;
    setBusy(true);
    try {
      await job?.();
      setAdmins(await listAdmins(supabase));
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    listAdmins(supabase)
      .then((a) => live && setAdmins(a))
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <SectionTitle right={`${admins.length} คน`}>แอดมิน</SectionTitle>
      <Card className="space-y-3">
        <ul className="space-y-1">
          {admins.map((a) => (
            <li key={a} className="flex items-center gap-2 rounded-2xl px-1 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{a}</span>
              {a === auth.email?.toLowerCase() ? (
                <span className="text-xs text-zinc-400">คุณ</span>
              ) : (
                <Button
                  variant="ghost"
                  className="px-2 text-red-500"
                  aria-label={`ลบแอดมิน ${a}`}
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`เอา ${a} ออกจากแอดมิน?`)) run(() => removeAdmin(supabase!, a));
                  }}
                >
                  <Icon.X width={18} height={18} />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("อีเมลไม่ถูกต้อง");
            if (await run(() => addAdmin(supabase!, email))) setEmail("");
          }}
        >
          <input
            className={`${inputClass} min-w-0 flex-1`}
            type="email"
            inputMode="email"
            placeholder="อีเมลแอดมินใหม่"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={busy}>
            เพิ่ม
          </Button>
        </form>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="text-xs text-zinc-500">แอดมินใหม่ล็อคอินด้วยอีเมลนี้ได้ทันที ลบตัวเองไม่ได้ ให้แอดมินคนอื่นลบให้</p>
      </Card>
    </div>
  );
}
