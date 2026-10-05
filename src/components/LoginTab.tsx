"use client";

import { useState } from "react";
import { adminLinkMe, supabase } from "@/lib/remote";
import { nameMatch } from "@/lib/roster";
import { readSession, writeSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { AdminsCard, useAdmins } from "./AdminsCard";
import { Avatar, Button, Card, SearchInput, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";

/** บัญชีของแอดมิน (เข้าด้วย LINE) ในหน้าตั้งค่า: ออกจากระบบ และรายชื่อแอดมิน */
export function LoginTab() {
  const { auth } = useStore();
  if (!auth.email) return null;
  return (
    <div className="space-y-4">
      <SectionTitle>{t("บัญชีแอดมิน")}</SectionTitle>
      <Card className="space-y-3 text-center">
        <p className="text-sm">{t("เข้าสู่ระบบด้วย LINE แล้ว")}</p>
        <Button className="w-full" onClick={() => auth.signOut()}>
          {t("ออกจากระบบ")}
        </Button>
      </Card>
      {auth.isAdmin && <LinkMyLine />}
      {auth.isAdmin && <AdminsCard />}
    </div>
  );
}

/** แอดมินผูก LINE ของตัวเองกับชื่อในก๊วน (แอดมินไม่มีหน้าเลือกชื่อแบบผู้เล่น) */
function LinkMyLine() {
  const { state, auth } = useStore();
  const { enabled, emailOf, reload } = useAdmins();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!enabled) return null;
  const myEmail = auth.email?.toLowerCase();
  const mineId = [...emailOf].find(([, e]) => e.toLowerCase() === myEmail)?.[0];
  const mine = state.players.find((p) => p.id === mineId);


  const free = state.players.filter((p) => !p.pending && !p.guestOf && !emailOf.has(p.id));
  const list = q.trim() ? free.filter((p) => nameMatch(p, q)).slice(0, 8) : [];
  const link = async (playerId: string) => {
    setBusy(true);
    const r = await adminLinkMe(supabase!, playerId);
    setBusy(false);
    if (r.error || !r.token) return setError(t(r.error ?? "ผูกไม่สำเร็จ ลองใหม่อีกครั้ง"));
    writeSession({ playerId, token: r.token });
    setError("");
    setPicked(null);
    await reload();
  };

  if (mine) {
    // เครื่องนี้ยังไม่จำว่าเป็นใคร (เช่น เปิดเครื่องใหม่) กดใช้ชื่อนี้บนเครื่องนี้ได้
    const here = readSession()?.playerId === mine.id;
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-3">
          <Avatar name={mine.name} photo={mine.photo} size={40} />
          <p className="min-w-0 flex-1 text-sm">{t("LINE ของคุณผูกกับชื่อ {name} แล้ว", { name: mine.name })}</p>
          {!here && (
            <Button className="shrink-0 px-3 py-1.5 text-xs" disabled={busy} onClick={() => link(mine.id)}>
              {t("ใช้ชื่อนี้บนเครื่องนี้")}
            </Button>
          )}
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display font-semibold">{t("ผูก LINE ของฉันกับชื่อในก๊วน")}</h2>
        <p className="text-xs text-zinc-500">
          {t("พิมพ์ชื่อเล่นแล้วกดเลือก (ไม่มีชื่อ เพิ่มที่หน้าผู้เล่น)")}
        </p>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder={t("พิมพ์ชื่อเล่นของคุณ")} />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-1.5">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 rounded-2xl bg-zinc-50 px-3 py-2">
            <Avatar name={p.name} photo={p.photo} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
            {picked === p.id ? (
              <Button variant="accent" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => link(p.id)}>
                {t("ยืนยัน นี่คือฉัน")}
              </Button>
            ) : (
              <Button className="px-3 py-1.5 text-xs" onClick={() => setPicked(p.id)}>
                {t("นี่คือฉัน")}
              </Button>
            )}
          </li>
        ))}
        {q.trim() && list.length === 0 && <li className="px-1 text-sm text-zinc-500">{t("ไม่พบชื่อที่ค้นหา")}</li>}
      </ul>
    </Card>
  );
}
