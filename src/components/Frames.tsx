"use client";

import { useState } from "react";
import { FESTIVAL_FRAMES, frameChoices, frameName, grantFrame, revokeFrame, type FestivalFrameId, type Frame } from "@/lib/frames";
import { t } from "@/lib/i18n";
import { clubMembers } from "@/lib/promotion";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { FramedAvatar } from "./AvatarFrame";
import { savedPin } from "./PickMe";
import { Avatar, Button, SearchInput, baht, inputClass } from "./ui";

const asFrame = (p: Player, value: string | null): Frame | null =>
  value === null ? null : value === "level" ? { kind: "level", level: p.level } : { kind: "festival", id: value as FestivalFrameId };

/** ผู้เล่นเลือกกรอบรูปเอง: กรอบระดับมือตัวเอง หรือกรอบเทศกาลที่ได้รับแล้ว */
export function FramePicker({ player }: { player: Player }) {
  const { social } = useStore();
  const [busy, setBusy] = useState<string | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const current = player.frame ?? null;
  const pick = async (value: string | null) => {
    if (busy !== undefined || value === current) return;
    setBusy(value);
    setMsg("");
    try {
      const err = await social({ kind: "frame", frame: value }, player.id, savedPin.get());
      setMsg(err ? t(err) : t("บันทึกแล้ว"));
    } catch {
      setMsg(t("บันทึกไม่สำเร็จ ลองใหม่"));
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">{t("เลือกกรอบที่จะโชว์ให้เพื่อนเห็น กรอบระดับมือเปลี่ยนตามระดับของเราเอง กรอบเทศกาลรับได้จากแอดมิน")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {frameChoices(player).map((c) => {
          const on = c.value === current;
          const name = c.value === null ? t("ไม่ใส่กรอบ") : c.value === "level" ? t("กรอบระดับมือ") : t(frameName(c.value as FestivalFrameId));
          return (
            <button
              key={c.value ?? "none"}
              disabled={c.locked || busy !== undefined}
              aria-pressed={on}
              onClick={() => pick(c.value)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-2.5 ${on ? "bg-lime/40 ring-2 ring-ink" : "bg-zinc-50"} ${c.locked ? "opacity-45" : "active:scale-[0.98]"}`}
            >
              <span className={c.locked ? "grayscale" : ""}>
                <FramedAvatar player={player} size={56} frame={asFrame(player, c.value)} />
              </span>
              <span className="text-sm font-semibold">{name}</span>
              <span className="text-xs text-zinc-500">{c.locked ? `🔒 ${t("รับจากแอดมิน")}` : on ? `✓ ${t("ใส่อยู่")}` : busy === c.value ? t("กำลังบันทึก...") : t("แตะเพื่อใส่")}</span>
            </button>
          );
        })}
      </div>
      {msg && <p className="text-center text-sm text-zinc-600">{msg}</p>}
    </div>
  );
}

/** แอดมินแจกกรอบเทศกาล: แจกคนที่มาวันนี้ทั้งหมด หรือแจก/ขายรายคน (ขาย = ใส่ในบิลวันนี้) */
export function FrameGrant() {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const [fid, setFid] = useState<FestivalFrameId>(FESTIVAL_FRAMES[0].id);
  const [price, setPrice] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const name = t(frameName(fid));
  const members = clubMembers(state.players);
  const here = new Set(day.checkIns.map((c) => c.playerId));
  const hereMembers = members.filter((p) => here.has(p.id));
  const toGive = hereMembers.filter((p) => !p.frames?.includes(fid));
  const amount = Math.max(0, Math.round(Number(price) || 0));
  const shown = members.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => Number(here.has(b.id)) - Number(here.has(a.id)) || a.name.localeCompare(b.name));
  const sample = { name: "?", level: 3 as const, frame: fid, frames: [fid] };

  const give = (p: Player) => {
    if (amount > 0) {
      const ci = day.checkIns.find((c) => c.playerId === p.id);
      if (!ci || ci.paidAt) {
        if (!confirm(t("{name} ไม่ได้อยู่ในบิลวันนี้ ระบบจะไม่เก็บเงินให้ แจกเลยแล้วเก็บเงินเองใช่ไหม?", { name: p.name }))) return;
      } else {
        dispatch({ type: "addDrink", date, playerId: p.id, amount, note: t("กรอบ{name}", { name }) });
      }
    }
    dispatch({ type: "updatePlayer", player: grantFrame(p, fid) });
    setMsg(amount > 0 && here.has(p.id) ? t("ขายกรอบ{frame}ให้ {name} แล้ว ใส่ในบิลวันนี้ {amount}", { frame: name, name: p.name, amount: baht(amount) }) : t("แจกกรอบ{frame}ให้ {name} แล้ว", { frame: name, name: p.name }));
  };
  const giveAll = () => {
    if (!toGive.length || !confirm(t("แจกกรอบ{frame}ฟรีให้คนที่มาวันนี้ {n} คนใช่ไหม?", { frame: name, n: toGive.length }))) return;
    for (const p of toGive) dispatch({ type: "updatePlayer", player: grantFrame(p, fid) });
    setMsg(t("แจกกรอบ{frame}ให้ {n} คนแล้ว", { frame: name, n: toGive.length }));
  };
  const takeBack = (p: Player) => {
    if (!confirm(t("เอากรอบ{frame}คืนจาก {name} ใช่ไหม?", { frame: name, name: p.name }))) return;
    dispatch({ type: "updatePlayer", player: revokeFrame(p, fid) });
    setMsg("");
  };

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FESTIVAL_FRAMES.map((f) => (
          <button
            key={f.id}
            aria-pressed={f.id === fid}
            onClick={() => (setFid(f.id), setMsg(""))}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${f.id === fid ? "bg-ink text-white" : "bg-zinc-100"}`}
          >
            {f.emoji} {t(f.name)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3">
        <FramedAvatar player={sample} size={64} />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="font-semibold">{t("กรอบ{name}", { name })}</div>
          <div className="text-zinc-600">{t("มีแล้ว {n} คน", { n: members.filter((p) => p.frames?.includes(fid)).length })}</div>
        </div>
      </div>

      <Button variant="primary" className="w-full" disabled={!toGive.length} onClick={giveAll}>
        {toGive.length ? t("แจกฟรีให้คนที่มาวันนี้ ({n} คน)", { n: toGive.length }) : hereMembers.length ? t("คนที่มาวันนี้ได้กรอบนี้ครบแล้ว") : t("วันนี้ยังไม่มีคนเช็คอิน")}
      </Button>

      <label className="block space-y-1 text-sm font-medium">
        {t("ราคาเมื่อแจกรายคน (เว้นว่าง = แจกฟรี)")}
        <input className={inputClass} inputMode="numeric" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <span className="block text-xs font-normal text-zinc-500">{t("ใส่ราคาแล้ว ระบบจะเพิ่มค่ากรอบในบิลวันนี้ของคนที่มาเล่น")}</span>
      </label>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <SearchInput value={q} onChange={setQ} placeholder={t("ค้นหาชื่อ")} />
      <ul className="divide-y divide-zinc-100">
        {shown.map((p) => {
          const has = p.frames?.includes(fid);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.name} photo={p.photo} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-zinc-500">{has ? `✓ ${t("มีกรอบนี้แล้ว")}` : here.has(p.id) ? t("มาวันนี้") : t("วันนี้ไม่ได้มา")}</span>
              </span>
              {has ? (
                <button className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 underline" onClick={() => takeBack(p)}>
                  {t("เอาคืน")}
                </button>
              ) : (
                <button className="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white active:scale-95" onClick={() => give(p)}>
                  {amount > 0 ? t("ขาย {amount}", { amount: baht(amount) }) : t("แจก")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
