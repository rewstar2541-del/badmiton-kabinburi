"use client";

import { useRef, useState } from "react";
import { FESTIVAL_FRAMES, frameChoices, frameFeeNote, frameName, grantFrame, revokeFrame, type FestivalFrameId, type Frame } from "@/lib/frames";
import { t } from "@/lib/i18n";
import { clubMembers } from "@/lib/promotion";
import { useStore, useToday } from "@/lib/store";
import type { Player } from "@/lib/types";
import { FramedAvatar } from "./AvatarFrame";
import { savedPin } from "./PickMe";
import { Avatar, Button, SearchInput, baht, inputClass } from "./ui";

const asFrame = (p: Player, value: string | null): Frame | null =>
  value === null ? null : value === "level" ? { kind: "level", level: p.level } : { kind: "festival", id: value as FestivalFrameId };

/** ข้อความผิดพลาดจากระบบที่ไม่ใช่ภาษาไทย (เช่น ยังไม่ได้รัน SQL) ให้ผู้เล่นเห็นเป็นข้อความกลางๆ */
const friendly = (err: string) => (/[ก-๙]/.test(err) ? t(err) : t("บันทึกไม่สำเร็จ ลองใหม่"));

/** ผู้เล่นเลือกกรอบรูปเอง: กรอบระดับมือตัวเอง หรือกรอบเทศกาลที่ได้รับแล้ว */
export function FramePicker({ player }: { player: Player }) {
  const { social } = useStore();
  const [busy, setBusy] = useState<string | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = player.frame ?? null;
  const pick = async (value: string | null) => {
    if (busy !== undefined || value === current) return;
    setBusy(value);
    setMsg(null);
    try {
      const err = await social({ kind: "frame", frame: value }, player.id, savedPin.get());
      setMsg(err ? { ok: false, text: friendly(err) } : { ok: true, text: t("บันทึกแล้ว") });
    } catch {
      setMsg({ ok: false, text: t("บันทึกไม่สำเร็จ ลองใหม่") });
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">{t("เลือกกรอบที่จะโชว์ให้เพื่อนเห็น กรอบระดับมือเปลี่ยนตามระดับของเราเอง กรอบเทศกาลรับได้จากแอดมิน")}</p>
      {msg && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
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
              className={`flex flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-2.5 ${on ? "bg-lime/40 ring-2 ring-ink dark:ring-lime" : "bg-zinc-50"} ${c.locked ? "" : "active:scale-[0.98]"}`}
            >
              <span className={c.locked ? "opacity-40 grayscale" : ""}>
                <FramedAvatar player={player} size={60} frame={asFrame(player, c.value)} />
              </span>
              <span className="text-sm font-semibold">{name}</span>
              <span className="px-1 text-center text-sm leading-snug text-zinc-600">
                {c.locked ? `🔒 ${t("มาเล่นช่วงเทศกาล หรือขอซื้อกับแอดมิน")}` : on ? `✓ ${t("ใส่อยู่")}` : busy === c.value ? t("กำลังบันทึก...") : t("แตะเพื่อใส่")}
              </span>
            </button>
          );
        })}
      </div>
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
  // กันกดซ้ำก่อนหน้าจออัปเดต (จะได้ไม่คิดเงินสองรอบ)
  const handled = useRef(new Set<string>());
  const name = t(frameName(fid));
  const note = frameFeeNote(name);
  const members = clubMembers(state.players);
  const here = new Set(day.checkIns.map((c) => c.playerId));
  const hereMembers = members.filter((p) => here.has(p.id));
  const toGive = hereMembers.filter((p) => !p.frames?.includes(fid));
  const amount = Math.max(0, Math.round(Number(price) || 0));
  const shown = members.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => Number(here.has(b.id)) - Number(here.has(a.id)) || a.name.localeCompare(b.name));
  const sample = { name: "?", level: 3 as const, frame: fid, frames: [fid] };
  const key = (p: Player) => `${fid}:${p.id}`;

  const give = (p: Player) => {
    if (handled.current.has(key(p)) || p.frames?.includes(fid)) return;
    let charged = false;
    if (amount > 0) {
      const ci = day.checkIns.find((c) => c.playerId === p.id);
      if (!ci || ci.paidAt) {
        const why = ci ? t("{name} จ่ายเงินวันนี้ไปแล้ว", { name: p.name }) : t("{name} วันนี้ไม่ได้มา", { name: p.name });
        if (!confirm(`${why} ${t("ระบบจะไม่ใส่ค่ากรอบในบิล แจกเลยแล้วเก็บเงินเองใช่ไหม?")}`)) return;
      } else {
        if (!confirm(t("ขายกรอบ{frame} {amount} ให้ {name} ใส่ในบิลวันนี้ใช่ไหม?", { frame: name, amount: baht(amount), name: p.name }))) return;
        charged = true;
      }
    }
    handled.current.add(key(p));
    // ให้กรอบก่อน แล้วค่อยใส่เงิน
    dispatch(grantFrame(p, fid));
    if (charged) dispatch({ type: "addDrink", date, playerId: p.id, amount, note });
    setMsg(charged ? t("ขายกรอบ{frame}ให้ {name} แล้ว ใส่ในบิลวันนี้ {amount}", { frame: name, name: p.name, amount: baht(amount) }) : t("แจกกรอบ{frame}ให้ {name} แล้ว", { frame: name, name: p.name }));
  };
  const giveAll = () => {
    const list = toGive.filter((p) => !handled.current.has(key(p)));
    if (!list.length || !confirm(t("แจกกรอบ{frame}ฟรีให้คนที่มาวันนี้ {n} คนใช่ไหม?", { frame: name, n: list.length }))) return;
    for (const p of list) {
      handled.current.add(key(p));
      dispatch(grantFrame(p, fid));
    }
    setMsg(t("แจกกรอบ{frame}ให้ {n} คนแล้ว", { frame: name, n: list.length }));
  };
  const takeBack = (p: Player) => {
    // ค่ากรอบที่ยังไม่จ่ายในบิลวันนี้ ลบออกไปพร้อมกัน
    const ci = day.checkIns.find((c) => c.playerId === p.id);
    const fee = !ci?.paidAt ? day.drinks.find((d) => d.playerId === p.id && d.note === note) : undefined;
    const ask = fee
      ? t("เอากรอบ{frame}คืนจาก {name} และลบค่ากรอบ {amount} ออกจากบิลวันนี้ใช่ไหม?", { frame: name, name: p.name, amount: baht(fee.amount) })
      : t("เอากรอบ{frame}คืนจาก {name} ใช่ไหม?", { frame: name, name: p.name });
    if (!confirm(ask)) return;
    handled.current.delete(key(p));
    dispatch(revokeFrame(p, fid));
    if (fee) dispatch({ type: "removeDrink", date, drinkId: fee.id });
    setMsg("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FESTIVAL_FRAMES.map((f) => (
          <button
            key={f.id}
            aria-pressed={f.id === fid}
            onClick={() => (setFid(f.id), setMsg(""), setPrice(""))}
            className={`min-h-11 rounded-full px-3.5 text-sm font-semibold ${f.id === fid ? "bg-ink text-white" : "bg-zinc-100"}`}
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
        <span className="block text-sm font-normal text-zinc-600">{t("ใส่ราคาแล้ว ระบบจะเพิ่มค่ากรอบในบิลวันนี้ของคนที่มาเล่น")}</span>
      </label>

      {msg && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}

      <SearchInput value={q} onChange={setQ} placeholder={t("ค้นหาชื่อ")} />
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">{t("ไม่พบสมาชิก")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {shown.map((p) => {
            const has = p.frames?.includes(fid);
            return (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Avatar name={p.name} photo={p.photo} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-sm text-zinc-600">{has ? `✓ ${t("มีกรอบนี้แล้ว")}` : here.has(p.id) ? t("มาวันนี้") : t("วันนี้ไม่ได้มา")}</span>
                </span>
                {has ? (
                  <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-zinc-600 underline" onClick={() => takeBack(p)}>
                    {t("เอาคืน")}
                  </button>
                ) : (
                  <button
                    className={`min-h-11 rounded-xl px-4 text-sm font-semibold active:scale-95 ${amount > 0 ? "bg-amber-400 text-ink" : "bg-ink text-white"}`}
                    onClick={() => give(p)}
                  >
                    {amount > 0 ? t("ขาย {amount}", { amount: baht(amount) }) : t("แจก")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
