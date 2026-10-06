"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { activePairs, myPair } from "@/lib/social";
import { useStore, useToday } from "@/lib/store";
import { savedPin, useMe } from "./PickMe";
import { Avatar, Button, Card } from "./ui";

/** ผู้เล่นขอคู่กับเพื่อนที่เช็คอินวันนี้ในเกมถัดไป เพื่อนต้องกดตอบรับ */
export function PairCard() {
  const { state, social } = useStore();
  const { day } = useToday();
  const [me] = useMe();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ci = me ? day.checkIns.find((c) => c.playerId === me) : undefined;
  if (!me || !ci || ci.paidAt) return null;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const r = myPair(day, me);
  const run = async (req: Parameters<typeof social>[0]) => {
    setBusy(true);
    const err = await social(req, me, savedPin.get());
    setBusy(false);
    setError(err ? t(err) : "");
    if (!err) setPicking(false);
  };
  // เลือกได้เฉพาะสมาชิกที่เช็คอินวันนี้และยังไม่กลับบ้าน (แขกไม่มีบัญชีให้ตอบรับ)
  const friends = day.checkIns
    .filter((c) => c.playerId !== me && !c.paidAt)
    .map((c) => byId.get(c.playerId))
    .filter((p) => p && !p.guestOf)
    .sort((a, b) => a!.name.localeCompare(b!.name, "th"));

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("ขอคู่กับเพื่อนเกมถัดไป")}</h3>
        <p className="text-sm text-zinc-500">{t("เพื่อนตอบรับแล้วจะได้ลงทีมเดียวกันเกมถัดไป")}</p>
      </div>
      {r ? (
        <div className="space-y-2 rounded-2xl bg-sky-50 p-3">
          {r.status === "accepted" ? (
            <p className="text-sm font-medium text-sky-800">{t("คุณกับ {name} ได้ลงทีมเดียวกันเกมหน้า", { name: name(r.from === me ? r.to : r.from) })}</p>
          ) : r.from === me ? (
            <p className="text-sm font-medium text-sky-800">{t("รอ {name} ตอบรับ", { name: name(r.to) })}</p>
          ) : (
            <p className="text-sm font-medium text-sky-800">{t("{name} ขอคู่กับคุณเกมถัดไป", { name: name(r.from) })}</p>
          )}
          {r.status === "pending" && r.to === me ? (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => run({ kind: "respondPair", id: r.id, accept: false })}>
                {t("ไม่สะดวก")}
              </Button>
              <Button variant="accent" disabled={busy} onClick={() => run({ kind: "respondPair", id: r.id, accept: true })}>
                {t("รับคู่")}
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => run({ kind: "cancelPair", id: r.id })}>
              {t("ยกเลิกคำขอ")}
            </Button>
          )}
        </div>
      ) : picking ? (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("ยังไม่มีเพื่อนเช็คอินวันนี้")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {friends.map((p) => (
                <li key={p!.id}>
                  <button
                    disabled={busy}
                    onClick={() => run({ kind: "requestPair", to: p!.id })}
                    className="flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pr-3 pl-1 text-sm font-semibold"
                  >
                    <Avatar name={p!.name} photo={p!.photo} size={26} />
                    {p!.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button className="w-full" onClick={() => setPicking(false)}>
            {t("ยกเลิก")}
          </Button>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setPicking(true)}>
          {t("เลือกเพื่อนที่จะขอคู่")}
        </Button>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

/** แอดมินเห็นคำขอจับคู่ของวันนี้ และกดยกเลิกได้ */
export function PairRequests() {
  const { state, auth, dispatch } = useStore();
  const { date, day } = useToday();
  if (!auth.isAdmin) return null;
  const active = new Set(activePairs(day).map((r) => r.id));
  const list = (day.pairs ?? []).filter((r) => r.status === "pending" || active.has(r.id));
  if (!list.length) return null;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  return (
    <Card className="space-y-2">
      <h3 className="font-display font-semibold">{t("คำขอจับคู่วันนี้")}</h3>
      <ul className="space-y-1.5">
        {list.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">
              {name(r.from)} + {name(r.to)}
            </span>
            <span className={`shrink-0 text-xs ${r.status === "accepted" ? "text-emerald-700" : "text-zinc-500"}`}>
              {r.status === "accepted" ? t("ตอบรับแล้ว") : t("รอตอบรับ")}
            </span>
            <button
              className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600"
              onClick={() => dispatch({ type: "setPairStatus", date, id: r.id, status: "cancelled" })}
            >
              {t("ยกเลิก")}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">{t("จัดคู่แล้วสองคนนี้จะอยู่ทีมเดียวกัน 1 เกม")}</p>
    </Card>
  );
}
