"use client";

import { useState } from "react";
import { formToday, FORM_MARK, presence, queuedSpot, skillOf, waitingQueue } from "@/lib/matchmaking";
import { useStore, useToday } from "@/lib/store";
import { shuttlesInGame, strength, withSub, type Game, type Player } from "@/lib/types";
import { Button, LevelBadge, Sheet } from "./ui";
import { FramedAvatar } from "./AvatarFrame";
import { FormMark } from "./MatchBuilder";
import { t } from "@/lib/i18n";

/**
 * เปลี่ยนตัวระหว่างเกม (บาดเจ็บ เหนื่อย): แตะคนที่จะออก แล้วแตะคนที่จะลงแทน
 * คนเข้ายืนตำแหน่ง/ทีมเดิมของคนออก เกมเล่นต่อ (ไม่เริ่มเกมใหม่)
 * ค่าลูก: คนออกจ่ายลูกที่ใช้ไปแล้ว (รวมลูกที่กำลังตี) คนเข้าเริ่มนับจากลูกถัดไป
 * ผลแพ้ชนะ: เป็นของคนที่เล่นจนจบ คนออกไม่นับแพ้ชนะ
 */
export function SubPlayer({ game, onClose }: { game: Game; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  // เก็บเป็น id คน (ไม่ใช่ตำแหน่ง) อีกเครื่องเปลี่ยนตัวระหว่างเปิดแผ่นจะได้ไม่ชี้ผิดคน
  const [pickId, setPickId] = useState<string | null>(null);
  const [lastSwap, setLastSwap] = useState<[string, string] | null>(null);
  const [inId, setIn] = useState<string | null>(null);
  const [restOut, setRestOut] = useState(true);
  // เกมสดจากข้อมูลล่าสุด (อีกเครื่องอาจเปลี่ยนตัว/จบเกมไปแล้ว)
  const liveGame = day.games.find((g) => g.id === game.id && !g.endedAt) ?? game;
  const order = liveGame.playerIds;
  const out = pickId && order.includes(pickId) ? pickId : null;
  // แตะคนในสนามหนึ่งคน แล้วแตะอีกคนในสนาม = สลับที่กันทันที (เกมเล่นต่อ ค่าลูกไม่เปลี่ยน)
  // หรือเลือกคนจากรายชื่อรอ = เปลี่ยนตัว (ยืนยันด้านล่าง)
  const swap = (a: string, b: string) => {
    const live = day.games.find((g) => g.id === game.id && !g.endedAt);
    if (!live) return onClose();
    const i = live.playerIds.indexOf(a);
    const j = live.playerIds.indexOf(b);
    if (i < 0 || j < 0) return;
    const next = [...live.playerIds] as Game["playerIds"];
    [next[i], next[j]] = [next[j], next[i]];
    dispatch({ type: "subPlayer", date, gameId: game.id, prevIds: live.playerIds, playerIds: next, subs: live.subs ?? [] });
  };
  const tapCourt = (id: string) => {
    setIn(null);
    if (!out || out === id) return setPickId(out === id ? null : id);
    swap(out, id);
    setLastSwap([out, id]);
    setPickId(null);
  };

  // คนที่ลงแทนได้: คิวรอก่อน (ตามลำดับคิว) ตามด้วยคนที่จัดคู่รอสนามไว้ แล้วคนที่พักอยู่
  const queued = waitingQueue(day, state.players).map((e) => e.player);
  const seen = new Set(queued.map((p) => p.id));
  const others = day.checkIns
    .filter((c) => !seen.has(c.playerId))
    .map((c) => ({ p: byId.get(c.playerId), status: presence(day, c.playerId) }))
    .filter((x): x is { p: Player; status: "waiting" | "resting" } => !!x.p && (x.status === "waiting" || x.status === "resting"))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "waiting" ? -1 : 1));
  const games = new Map(waitingQueue(day, state.players).map((e) => [e.player.id, e.gamesPlayed]));
  const candidates: { p: Player; note?: string; games?: number }[] = [
    ...queued.map((p) => ({ p, games: games.get(p.id) })),
    ...others.map(({ p, status }) => {
      const spot = queuedSpot(day, p.id);
      return { p, note: status === "resting" ? t("พักอยู่") : spot ? t("รอสนาม {n}", { n: spot.court }) : undefined };
    }),
  ];
  const form = formToday(day, state.players);
  const teamSum = (ids: string[]) => ids.reduce((n, id) => n + (byId.get(id) ? strength(byId.get(id)!.level) : 0), 0);
  const skillSum = (ids: string[]) => ids.reduce((n, id) => n + (byId.get(id) ? skillOf(byId.get(id)!, form) : 0), 0);
  const edge = skillSum(order.slice(0, 2)) - skillSum(order.slice(2));
  const marked = order.some((id) => Math.abs(form.get(id) ?? 0) >= FORM_MARK);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "");
  // ลูกที่คนออกต้องจ่ายในเกมนี้ (คนที่เพิ่งลงแทนมาก่อนหน้า นับเฉพาะช่วงของตัวเอง)
  const outPays = out && inId ? shuttlesInGame({ ...liveGame, ...withSub(liveGame, out, inId, 0) }, out) : 0;
  const inSpot = inId ? queuedSpot(day, inId) : null;

  const apply = () => {
    if (!out || !inId) return;
    // แอดมินอีกเครื่องอาจจบเกม/เปลี่ยนตัวคนนี้ไปแล้ว
    const live = day.games.find((g) => g.id === game.id && !g.endedAt);
    // เกมจบแล้ว คนออกไม่อยู่แล้ว หรือคนลงแทนเพิ่งลงเกมนี้/สนามอื่นไปแล้ว (อีกเครื่องทำไปก่อน)
    if (!live || !live.playerIds.includes(out) || live.playerIds.includes(inId) || !candidates.some((c) => c.p.id === inId)) return onClose();
    // พัก/เลิกพักบันทึกไปพร้อมการเปลี่ยนตัว ถ้าเปลี่ยนตัวไม่สำเร็จจะย้อนกลับทั้งหมด
    const rest = [
      ...(presence(day, inId) === "resting" ? [{ playerId: inId, resting: false }] : []),
      ...(restOut ? [{ playerId: out, resting: true }] : []),
    ];
    dispatch({ type: "subPlayer", date, gameId: game.id, ...withSub(live, out, inId, Date.now()), rest });
    onClose();
  };

  return (
    <Sheet keepOpen onClose={onClose} title={<h3 className="font-display text-lg font-semibold">{t("เปลี่ยนคน สนาม {n}", { n: game.court })}</h3>}>
      {!day.games.some((g) => g.id === game.id && !g.endedAt) && (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{t("เกมนี้จบไปแล้ว ปิดแผ่นนี้ได้เลย")}</p>
      )}
      <div className="court-surface flex gap-1 rounded-2xl px-2 py-3">
        {(["A", "B"] as const).map((team, ti) => (
          <div key={team} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${team === "A" ? "bg-lime text-ink" : "bg-sky-300 text-ink"}`}>
              {t("ทีม {team}", { team })} · {teamSum(order.slice(ti * 2, ti * 2 + 2))}
            </span>
            {order.slice(ti * 2, ti * 2 + 2).map((id) => {
              const p = byId.get(id);
              const on = out === id;
              return (
                <button
                  key={id}
                  onClick={() => tapCourt(id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition ${
                    on ? "bg-white text-ink ring-2 ring-lime" : out ? "bg-black/30 text-white ring-1 ring-white/60" : "bg-black/20 text-white backdrop-blur-sm"
                  }`}
                >
                  <FramedAvatar player={p} size={28} compact ring />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p?.name ?? "?"}</span>
                  {!on && <FormMark value={form.get(id)} />}
                  {p && (on ? <span className="font-bold" aria-hidden>↕</span> : <LevelBadge level={p.level} />)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {t("แตะชื่อในสนาม แล้วแตะอีกคนในสนามเพื่อสลับฝั่ง หรือแตะชื่อจากคิวเพื่อเปลี่ยนตัว ตัวเลขข้างทีม = ผลรวมระดับมือ")}
        {marked && <> {t("▲▼ = ฟอร์มวันนี้ ระบบนับรวมตอนจัดคู่")}</>}
      </p>
      <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${Math.abs(edge) <= 0.5 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        {Math.abs(edge) <= 0.5
          ? t("เกมสูสี ฝีมือสองทีมใกล้กัน")
          : Math.abs(edge) <= 1.5
            ? t("ทีม {team} เหนือกว่าเล็กน้อย", { team: edge > 0 ? "A" : "B" })
            : t("ทีม {team} เหนือกว่ามาก ลองสลับคน", { team: edge > 0 ? "A" : "B" })}
      </p>
      {lastSwap && !out && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          <span className="min-w-0 flex-1">{t("สลับ {a} กับ {b} แล้ว", { a: name(lastSwap[0]), b: name(lastSwap[1]) })}</span>
          <button
            className="min-h-11 shrink-0 rounded-full bg-white px-3 font-semibold ring-1 ring-emerald-300 active:scale-95"
            onClick={() => {
              swap(lastSwap[0], lastSwap[1]);
              setLastSwap(null);
            }}
          >
            {t("ย้อนกลับ")}
          </button>
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="rounded-2xl bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">{t("ไม่มีคนรอให้เปลี่ยนตัว (สลับฝั่งยังทำได้)")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5">
          {candidates.map(({ p, note, games: gp }, i) => {
            const on = inId === p.id;
            return (
              <li key={p.id}>
                <button
                  disabled={!out}
                  onClick={() => setIn(on ? null : p.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left text-sm ${on ? "bg-lime/50 ring-2 ring-lime" : "bg-zinc-100 active:bg-zinc-200"} ${out ? "" : "opacity-70"}`}
                >
                  <span className="w-4 text-center text-[11px] text-zinc-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <FormMark value={form.get(p.id)} dark={false} />
                  <LevelBadge level={p.level} />
                  <span className="text-right text-[10px] leading-tight text-zinc-500">
                    {gp !== undefined && t("{n} เกม", { n: gp })}
                    {note && <span className="block font-semibold text-emerald-700">{note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {out && inId && (
        <>
          <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-zinc-50 px-3 text-sm">
            <input type="checkbox" className="size-5 accent-ink" checked={restOut} onChange={(e) => setRestOut(e.target.checked)} />
            {t("ให้คนออกพักก่อน (ไม่ขึ้นคิว)")}
          </label>
          {/* ติดล่างแผ่น: จอเตี้ยก็กดยืนยันได้โดยไม่ต้องเลื่อน */}
          <div className="sticky -bottom-5 -mx-5 space-y-2 bg-white px-5 pt-2 pb-1">
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("{out} จ่าย {n} ลูกที่ใช้ไปแล้ว {in} เริ่มนับจากลูกถัดไป ผลแพ้ชนะเป็นของคนที่เล่นจนจบ", { out: name(out), in: name(inId), n: outPays })}
            </p>
            {inSpot && (
              <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {t("{name} อยู่ในคู่ที่รอสนาม {n} คู่นั้นจะลงไม่ได้จนกว่าจะแก้คิว", { name: name(inId), n: inSpot.court })}
              </p>
            )}
            <Button variant="accent" className="w-full" onClick={apply}>
              {t("เปลี่ยน {out} เป็น {in}", { out: name(out), in: name(inId) })}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
