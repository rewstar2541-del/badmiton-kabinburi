"use client";

import { useState } from "react";
import { billFor } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid, monthOf } from "@/lib/types";
import { PayQr } from "./PayQr";
import { Avatar, Card, Icon, LevelBadge, SectionTitle, baht, inputClass } from "./ui";

const ME_KEY = "badminton-kabinburi:me";

function readMe(): string | null {
  try {
    return localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
}

function saveMe(id: string | null) {
  try {
    if (id) localStorage.setItem(ME_KEY, id);
    else localStorage.removeItem(ME_KEY);
  } catch {
    // ไม่จำก็ได้
  }
}

/** หน้าสำหรับผู้เล่น: เลือกชื่อตัวเอง แล้วดูยอดที่ต้องจ่ายวันนี้ */
export function MyBillTab() {
  const { state } = useStore();
  const { date, day } = useToday();
  const [me, setMe] = useState<string | null>(readMe);
  const [q, setQ] = useState("");
  const player = state.players.find((p) => p.id === me);

  if (!player) {
    const list = state.players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <div className="space-y-4">
        <SectionTitle>คุณคือใคร?</SectionTitle>
        <p className="px-1 text-sm text-zinc-500">เลือกชื่อของคุณเพื่อดูยอดที่ต้องจ่าย เครื่องนี้จะจำไว้ให้</p>
        <div className="relative">
          <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
          <input className={`${inputClass} pl-11`} placeholder="ค้นหาชื่อเล่น" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {list.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  saveMe(p.id);
                  setMe(p.id);
                }}
                className="flex w-full flex-col items-center gap-1.5 rounded-3xl bg-white p-3 shadow-[0_8px_24px_-14px_rgba(11,18,32,0.25)] active:scale-[0.97]"
              >
                <Avatar name={p.name} photo={p.photo} size={44} />
                <span className="w-full truncate text-sm font-semibold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);
  const bill = billFor(state.days, day, player, state.settings, state.monthly);
  const s = state.settings;
  const monthly = isMonthlyPaid(state.monthly, date, player.id);
  const played = day.games.filter((g) => g.playerIds.includes(player.id));

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <Avatar name={player.name} photo={player.photo} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-lg font-semibold">{player.name}</span>
            <LevelBadge level={player.level} />
          </div>
          <div className="text-xs text-zinc-500">
            {monthly ? `สมาชิกรายเดือน ${monthOf(date)}` : "จ่ายรายวัน"} · เล่นวันนี้ {played.length} เกม
          </div>
        </div>
        <button
          className="text-xs text-zinc-500 underline"
          onClick={() => {
            saveMe(null);
            setMe(null);
          }}
        >
          ไม่ใช่ฉัน
        </button>
      </Card>

      {!checkedIn && bill.carriedOver === 0 ? (
        <Card className="py-8 text-center text-sm text-zinc-500">วันนี้ยังไม่ได้เช็คอิน</Card>
      ) : (
        <>
          <div className="rounded-3xl bg-ink p-5 text-white">
            <div className="text-xs text-white/60">ยอดที่ต้องจ่าย</div>
            <div className="font-display text-4xl font-semibold">{baht(bill.total)}</div>
            <div className="mt-4 space-y-1.5 text-sm">
              {[
                [monthly ? "ค่าสนาม (จ่ายรายเดือนแล้ว)" : "ค่าสนาม", bill.courtFee],
                [
                  `ค่าลูก ${bill.shuttleCount} ลูก${bill.shuttleCount > 0 ? ` (${s.firstShuttleFee} + ${s.nextShuttleFee}×${bill.shuttleCount - 1})` : ""}`,
                  bill.shuttleFee,
                ],
                ["ค่าน้ำ", bill.drinkFee],
                ...(bill.carriedOver > 0 ? [["ค้างจ่ายครั้งก่อน", bill.carriedOver] as const] : []),
              ].map(([label, v]) => (
                <div key={label} className="flex justify-between text-white/80">
                  <span>{label}</span>
                  <span>{baht(Number(v))}</span>
                </div>
              ))}
            </div>
          </div>
          {bill.paid ? (
            <Card className="flex items-center justify-center gap-1.5 py-6 font-semibold text-emerald-700">
              <Icon.Check width={18} height={18} /> จ่ายแล้ว ขอบคุณครับ
            </Card>
          ) : (
            bill.total > 0 && (
              <Card className="flex flex-col items-center gap-2">
                <PayQr promptPayId={s.promptPayId} amount={bill.total} />
                <p className="text-center text-xs text-zinc-500">สแกนจ่ายแล้วแจ้งแอดมินที่สนามนะครับ</p>
              </Card>
            )
          )}
        </>
      )}
    </div>
  );
}
