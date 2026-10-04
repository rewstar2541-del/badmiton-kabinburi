"use client";

import { billFor, shuttleFormula } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid, monthOf } from "@/lib/types";
import { PayQr } from "./PayQr";
import { PendingNotice, PickMe, useMe } from "./PickMe";
import { BadgesCard, MonthCard, PartnerPrefs } from "./MyExtras";
import { SelfPay } from "./SelfPay";
import { SlipUpload } from "./Slips";
import { MonthlyDueCard, PlanChoice, PlanSwitch } from "./Membership";
import { Avatar, Card, Icon, LevelBadge, baht } from "./ui";
import { t } from "@/lib/i18n";

/** หน้าสำหรับผู้เล่น: เลือกชื่อตัวเอง แล้วดูยอดที่ต้องจ่ายวันนี้ */
export function MyBillTab() {
  const { state } = useStore();
  const { date, day } = useToday();
  const [me, setMe] = useMe();
  const player = state.players.find((p) => p.id === me);

  if (!player) return <PickMe onPick={setMe} hint={t("เข้าสู่ระบบครั้งเดียว เครื่องนี้จะจำไว้ แล้วลงชื่อ เช็คอิน และดูยอดของตัวเองได้")} />;
  if (player.pending) return <PendingNotice name={player.name} onNotMe={() => setMe(null)} />;

  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);
  const bill = billFor(state.days, day, player, state.settings, state.monthly, state.players);
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
            {monthly ? t("สมาชิกรายเดือน {month}", { month: monthOf(date) }) : t("จ่ายรายวัน")} ·{" "}
            {t("เล่นวันนี้ {n} เกม", { n: played.length })}
          </div>
        </div>
        <button
          className="text-xs text-zinc-500 underline"
          onClick={() => {
            setMe(null);
          }}
        >
          {t("ออกจากระบบ")}
        </button>
      </Card>

      <PlanChoice player={player} />
      <MonthlyDueCard player={player} />

      {!checkedIn && bill.total === 0 ? (
        <Card className="py-8 text-center text-sm text-zinc-500">{t("วันนี้ยังไม่ได้เช็คอิน")}</Card>
      ) : (
        <>
          <div className="rounded-3xl bg-ink p-5 text-white">
            <div className="text-xs text-white/60">{t("ยอดที่ต้องจ่าย")}</div>
            <div className="font-display text-4xl font-semibold">{baht(bill.total)}</div>
            <div className="mt-4 space-y-1.5 text-sm">
              {[
                [(monthly ? t("ค่าสนาม (จ่ายรายเดือนแล้ว)") : t("ค่าสนาม")) + (bill.courtAdjusted ? ` (${t("แอดมินแก้ยอด")})` : ""), bill.courtFee],
                [
                  t("ค่าลูก {n} ลูก", { n: bill.shuttleCount }) +
                    shuttleFormula(bill) +
            (bill.shuttleAdjusted ? ` (${t("แอดมินแก้ยอด")})` : ""),
                  bill.shuttleFee,
                ],
                [t("ค่าน้ำ"), bill.drinkFee],
                ...(bill.carriedOver > 0 ? [[t("ค้างจ่ายครั้งก่อน"), bill.carriedOver] as const] : []),
                ...bill.guests.map((g) => [t("แขก: {name}", { name: g.name }), g.amount] as const),
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
              <Icon.Check width={18} height={18} /> {t("จ่ายแล้ว ขอบคุณครับ")}
            </Card>
          ) : (
            bill.total > 0 && (
              <Card className="flex flex-col items-center gap-2">
                <PayQr promptPayId={s.promptPayId} amount={bill.total} />
                <p className="text-center text-xs text-zinc-500">{t("สแกนจ่ายหรือจ่ายเงินสด แล้วกดปุ่มด้านล่าง นับว่าจ่ายทันที")}</p>
                <SelfPay playerId={player.id} amount={bill.total} action="pay" />
                <SlipUpload playerId={player.id} amount={bill.total} />
              </Card>
            )
          )}
        </>
      )}

      <MonthCard player={player} />
      <BadgesCard player={player} />
      <PartnerPrefs key={(player.prefer ?? []).join() + "|" + (player.avoid ?? []).join()} player={player} />
      <PlanSwitch player={player} />
    </div>
  );
}
