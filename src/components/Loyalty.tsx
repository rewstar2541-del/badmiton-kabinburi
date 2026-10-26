"use client";

import { useState } from "react";
import type { Bill } from "@/lib/billing";
import { t } from "@/lib/i18n";
import { daysCame, loyaltyOn, monthQualifiers, pointsBalance } from "@/lib/loyalty";
import { useStore, useToday } from "@/lib/store";
import { DEFAULT_LOYALTY, monthOf, type Loyalty, type Player, type RewardKind } from "@/lib/types";
import { Avatar, Button, Card, Icon, baht, inputClass } from "./ui";

const FIELDS: { key: Exclude<keyof Loyalty, "enabled">; label: string }[] = [
  { key: "days", label: "มาเล่นกี่วันต่อเดือน ถึงได้แต้ม" },
  { key: "points", label: "ได้กี่แต้มต่อเดือนที่มาครบ" },
  { key: "shuttleCost", label: "ส่วนลดค่าลูก ใช้กี่แต้ม" },
  { key: "shuttleValue", label: "ส่วนลดค่าลูก ลดกี่บาท" },
  { key: "drinkCost", label: "น้ำฟรี ใช้กี่แต้ม" },
  { key: "drinkValue", label: "น้ำฟรี ไม่เกินกี่บาท" },
];

/** ตั้งค่า: เปิด/ปิด และกติกาคะแนนสะสม */
export function LoyaltySettings() {
  const { state, dispatch } = useStore();
  const [l, setL] = useState<Loyalty>(() => state.settings.loyalty ?? { ...DEFAULT_LOYALTY, enabled: false });
  const [saved, setSaved] = useState(false);
  const save = (next: Loyalty) => {
    dispatch({ type: "updateSettings", settings: { ...state.settings, loyalty: next } });
    setSaved(true);
  };
  return (
    <Card className="space-y-3">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-display font-semibold">{t("คะแนนสะสมความขยัน")}</span>
          <span className="block text-xs text-zinc-500">{t("มาเล่นครบเดือนได้แต้ม แลกส่วนลดค่าลูกหรือน้ำฟรี")}</span>
        </span>
        <input
          type="checkbox"
          className="size-6 shrink-0 accent-lime-600"
          checked={l.enabled}
          onChange={(e) => {
            const next = { ...l, enabled: e.target.checked };
            setL(next);
            save(next);
          }}
        />
      </label>
      {l.enabled && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(l);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs text-zinc-500">
                {t(f.label)}
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={l[f.key]}
                  onChange={(e) => {
                    setSaved(false);
                    setL({ ...l, [f.key]: Number(e.target.value.replace(/\D/g, "")) || 0 });
                  }}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{t("สิ้นเดือนแจกแต้มที่ คิดเงิน > รายเดือน แลกแต้มตอนคิดเงิน (กดชื่อในบิลวันนี้)")}</p>
          <Button variant="primary" type="submit" className="w-full" disabled={!l.days || !l.points || !l.shuttleCost || !l.drinkCost}>
            {saved ? t("บันทึกแล้ว ✓") : t("บันทึก")}
          </Button>
        </form>
      )}
    </Card>
  );
}

/** คิดเงิน > รายเดือน: ใครมาครบเดือนนี้ และแจกแต้ม (เดือนที่จบแล้วเท่านั้น) */
export function LoyaltyAward({ month }: { month: string }) {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const rule = loyaltyOn(state.settings);
  if (!rule) return null;
  const list = monthQualifiers(state, month, rule);
  const ended = month < monthOf(date);
  const todo = list.filter((x) => !x.awarded);
  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("คะแนนสะสมความขยัน")}</h3>
        <span className="shrink-0 text-xs text-zinc-500">{t("มาครบ {n} วัน ได้ {p} แต้ม", { n: rule.days, p: rule.points })}</span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("ยังไม่มีใครมาครบเดือนนี้")}</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map(({ player, days, awarded }) => (
            <li key={player.id} className="flex items-center gap-2.5 rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
              <Avatar name={player.name} photo={player.photo} size={28} />
              <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{t("{n} วัน", { n: days })}</span>
              {awarded && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <Icon.Check width={12} height={12} strokeWidth={3} /> {t("ได้แต้มแล้ว")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!ended ? (
        <p className="text-xs text-zinc-500">{t("แจกแต้มได้เมื่อจบเดือน")}</p>
      ) : (
        todo.length > 0 && (
          <Button
            variant="accent"
            className="w-full"
            onClick={() => {
              if (confirm(t("แจก {p} แต้มให้ {n} คนที่มาครบเดือนนี้?", { p: rule.points, n: todo.length })))
                dispatch({ type: "awardPoints", month, playerIds: todo.map((x) => x.player.id), points: rule.points });
            }}
          >
            {t("แจกแต้ม {n} คน", { n: todo.length })}
          </Button>
        )
      )}
    </Card>
  );
}

/** ในบิลของผู้เล่น (แอดมิน): แลกแต้มเป็นส่วนลดวันนี้ */
export function LoyaltyRedeem({ player, bill }: { player: Player; bill: Bill }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const rule = loyaltyOn(state.settings);
  const ci = day.checkIns.find((c) => c.playerId === player.id);
  if (!ci || player.guestOf) return null;
  const used = (day.rewards ?? []).filter((r) => r.playerId === player.id);
  if (!rule && !used.length) return null;
  const balance = pointsBalance(state, player.id);
  const paid = Boolean(ci.paidAt);
  const usedOn = (kind: RewardKind) => used.filter((r) => r.kind === kind).reduce((n, r) => n + r.amount, 0);
  const options = rule
    ? ([
        ["shuttle", t("ลดค่าลูก {amount}", { amount: baht(rule.shuttleValue) }), rule.shuttleCost, rule.shuttleValue, bill.shuttleFee - usedOn("shuttle")],
        ["drink", t("น้ำฟรี (ไม่เกิน {amount})", { amount: baht(rule.drinkValue) }), rule.drinkCost, rule.drinkValue, bill.drinkFee - usedOn("drink")],
      ] as const)
    : [];
  return (
    <div className="space-y-2 rounded-3xl bg-lime/15 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{t("แต้มความขยัน")}</span>
        <span className="text-sm">{t("เหลือ {n} แต้ม", { n: balance })}</span>
      </div>
      {used.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {r.kind === "shuttle" ? t("ส่วนลดค่าลูก") : t("น้ำฟรี")} · {t("{n} แต้ม", { n: r.points })}
          </span>
          {!paid && (
            <button className="text-xs text-red-500" onClick={() => dispatch({ type: "removeReward", date, id: r.id })}>
              {t("คืนแต้ม")}
            </button>
          )}
        </div>
      ))}
      {!paid && (
        <div className="grid grid-cols-2 gap-2">
          {options.map(([kind, label, cost, value, room]) => (
            <Button
              key={kind}
              disabled={balance < cost || room <= 0}
              className="px-2 text-xs"
              onClick={() => dispatch({ type: "redeemPoints", date, playerId: player.id, kind, points: cost, amount: Math.min(value, room) })}
            >
              {label}
              <span className="block font-normal text-zinc-500">{t("ใช้ {n} แต้ม", { n: cost })}</span>
            </Button>
          ))}
        </div>
      )}
      {!paid && rule && bill.drinkFee - usedOn("drink") <= 0 && <p className="text-xs text-zinc-500">{t("เพิ่มค่าน้ำก่อน แล้วค่อยแลกน้ำฟรี")}</p>}
    </div>
  );
}

/** ผู้เล่นดูแต้มของตัวเอง และเดือนนี้มาแล้วกี่วัน */
export function MyPoints({ player }: { player: Player }) {
  const { state } = useStore();
  const { date } = useToday();
  const rule = loyaltyOn(state.settings);
  if (!rule || player.guestOf) return null;
  const balance = pointsBalance(state, player.id);
  const came = daysCame(state.days, monthOf(date), player.id);
  const pct = Math.min(100, (came / Math.max(1, rule.days)) * 100);
  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display font-semibold">{t("แต้มความขยัน")}</span>
        <span className="font-display text-2xl font-semibold">{t("{n} แต้ม", { n: balance })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-zinc-600">
        {came >= rule.days
          ? t("เดือนนี้มาครบแล้ว รับ {p} แต้มตอนสิ้นเดือน", { p: rule.points })
          : t("เดือนนี้มาแล้ว {n}/{d} วัน มาครบได้ {p} แต้ม", { n: came, d: rule.days, p: rule.points })}
      </p>
      <p className="text-xs text-zinc-500">
        {t("{a} แต้ม = ลดค่าลูก {x} · {b} แต้ม = น้ำฟรี (ไม่เกิน {y}) บอกแอดมินตอนจ่ายเงิน", {
          a: rule.shuttleCost,
          x: baht(rule.shuttleValue),
          b: rule.drinkCost,
          y: baht(rule.drinkValue),
        })}
      </p>
    </Card>
  );
}
