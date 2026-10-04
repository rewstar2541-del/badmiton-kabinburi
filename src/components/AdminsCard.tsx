"use client";

import { useCallback, useEffect, useState } from "react";
import { addAdmin, listAdmins, playerLineEmails, removeAdmin, supabase } from "@/lib/remote";
import { useStore } from "@/lib/store";
import { Button, Card, Icon, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";

/**
 * แอดมินคือบัญชี LINE ที่อยู่ในตาราง admins (อีเมลประจำบัญชี LINE)
 * ตั้ง/ถอดแอดมินจากชื่อผู้เล่นที่ผูก LINE แล้ว
 */
export function useAdmins() {
  const { auth } = useStore();
  const [admins, setAdmins] = useState<string[]>([]);
  const [emailOf, setEmailOf] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = auth.online && auth.isAdmin && Boolean(supabase);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [a, e] = await Promise.all([listAdmins(supabase), playerLineEmails(supabase)]);
    setAdmins(a);
    setEmailOf(e);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    Promise.all([listAdmins(supabase!), playerLineEmails(supabase!)])
      .then(([a, e]) => {
        if (!live) return;
        setAdmins(a);
        setEmailOf(e);
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [enabled]);

  const setAdmin = useCallback(
    async (email: string, on: boolean) => {
      if (!supabase) return;
      setBusy(true);
      try {
        await (on ? addAdmin(supabase, email) : removeAdmin(supabase, email));
        await load();
        setError("");
      } catch (e) {
        setError(t(e instanceof Error ? e.message : String(e)));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return { enabled, admins, emailOf, setAdmin, error, busy };
}

/** รายชื่อแอดมินในหน้าตั้งค่า */
export function AdminsCard() {
  const { state, auth } = useStore();
  const { admins, emailOf, setAdmin, error, busy } = useAdmins();
  const nameOf = new Map([...emailOf].map(([playerId, email]) => [email, state.players.find((p) => p.id === playerId)?.name]));

  return (
    <div className="space-y-4">
      <SectionTitle right={t("{n} คน", { n: admins.length })}>{t("แอดมิน")}</SectionTitle>
      <Card className="space-y-3">
        <ul className="space-y-1">
          {admins.map((a) => {
            const name = nameOf.get(a) ?? t("บัญชี LINE ที่ยังไม่ได้สมัครเป็นผู้เล่น");
            return (
              <li key={a} className="flex items-center gap-2 rounded-2xl px-1 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                {a === auth.email?.toLowerCase() ? (
                  <span className="text-xs text-zinc-400">{t("คุณ")}</span>
                ) : (
                  <Button
                    variant="ghost"
                    className="px-2 text-red-500"
                    aria-label={t("ลบแอดมิน {email}", { email: name })}
                    disabled={busy}
                    onClick={() => {
                      if (confirm(t("เอา {email} ออกจากแอดมิน?", { email: name }))) setAdmin(a, false);
                    }}
                  >
                    <Icon.X width={18} height={18} />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="text-xs text-zinc-500">{t("ตั้งแอดมินเพิ่มได้ที่หน้าผู้เล่น กด \"ตั้งเป็นแอดมิน\" ที่ชื่อคนนั้น (ต้องเคยเข้าด้วย LINE แล้ว) ลบตัวเองไม่ได้")}</p>
      </Card>
    </div>
  );
}
