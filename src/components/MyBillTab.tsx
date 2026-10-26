"use client";

import { billFor, shuttleFormula } from "@/lib/billing";
import { useStore, useToday } from "@/lib/store";
import { isMonthlyPaid } from "@/lib/types";
import { PayQr } from "./PayQr";
import { PendingNotice, PickMe, useMe } from "./PickMe";
import { SelfPay } from "./SelfPay";
import { SlipUpload } from "./Slips";
import { AnnualInfo } from "./Annual";
import { MyPoints } from "./Loyalty";
import { MonthlyDueCard, PlanChoice } from "./Membership";
import { useState } from "react";
import { savedPin } from "./PickMe";
import { Auto } from "@/lib/autoTranslate";
import { Button, Card, Icon, baht, inputClass } from "./ui";
import { t } from "@/lib/i18n";

/** หน้าสำหรับผู้เล่น: เลือกชื่อตัวเอง แล้วดูยอดที่ต้องจ่ายวันนี้ */
export function MyBillTab() {
  const { state } = useStore();
  const { date, day } = useToday();
  const [me, setMe] = useMe();
  const player = state.players.find((p) => p.id === me);

  if (!player) return <PickMe onPick={setMe} hint={t("เข้าครั้งเดียว เครื่องจะจำไว้")} />;
  if (player.pending) return <PendingNotice name={player.name} onNotMe={() => setMe(null)} />;

  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);
  const bill = billFor(state.days, day, player, state.settings, state.monthly, state.players);
  const s = state.settings;
  const monthly = isMonthlyPaid(state.monthly, date, player.id);

  return (
    <div className="space-y-4">
      <PlanChoice player={player} />
      <AnnualInfo player={player} />
      <MonthlyDueCard player={player} />
      <MyPoints player={player} />

      {!checkedIn && bill.total === 0 ? (
        <Card className="py-8 text-center text-sm text-zinc-500">{t("วันนี้ยังไม่ได้เช็คอิน")}</Card>
      ) : (
        <>
          <div className="rounded-3xl bg-ink p-5 text-white">
            <div className="text-xs text-white/60">{t("ยอดที่ต้องจ่าย")}</div>
            <div className="font-display text-4xl font-semibold">{baht(bill.total)}</div>
            <div className="mt-4 space-y-1.5 text-sm">
              {[
                [
                  (bill.annualMember ? t("ค่าสนาม (สมาชิกรายปี)") : monthly ? t("ค่าสนาม (จ่ายรายเดือนแล้ว)") : t("ค่าสนาม")) + (bill.courtAdjusted ? ` (${t("แอดมินแก้ยอด")})` : ""),
                  bill.courtFee,
                ],
                [
                  t("ค่าลูก {n} ลูก", { n: bill.shuttleCount }) +
                    shuttleFormula(bill) +
                    (bill.shuttleAdjusted ? ` (${t("แอดมินแก้ยอด")})` : ""),
                  bill.shuttleFee,
                ],
                [t("ค่าน้ำ"), bill.drinkFee],
                ...(bill.discount > 0 ? [[t("ส่วนลดจากแต้ม"), -bill.discount] as const] : []),
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
          {checkedIn && <MyDrinks playerId={player.id} drinks={day.drinks.filter((d) => d.playerId === player.id)} />}
          {bill.paid ? (
            <Card className="flex items-center justify-center gap-1.5 py-6 font-semibold text-emerald-700">
              <Icon.Check width={18} height={18} /> {t("จ่ายแล้ว ขอบคุณครับ")}
            </Card>
          ) : (
            bill.total > 0 && (
              <Card className="flex flex-col items-center gap-2">
                <PayQr promptPayId={s.promptPayId} amount={bill.total} />
                <p className="text-center text-xs text-zinc-500">{t("สแกนจ่ายหรือจ่ายสด แล้วกดปุ่มด้านล่าง")}</p>
                <SelfPay playerId={player.id} amount={bill.total} action="pay" />
                <SlipUpload playerId={player.id} amount={bill.total} />
              </Card>
            )
          )}
        </>
      )}

    </div>
  );
}

/** ผู้เล่นเพิ่มค่าน้ำเอง (แก้/ลบได้เฉพาะแอดมิน) */
function MyDrinks({ playerId, drinks }: { playerId: string; drinks: { id: string; amount: number; note: string }[] }) {
  const { addMyDrink } = useStore();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (n: number) => {
    if (!n || n <= 0) return;
    setBusy(true);
    const err = await addMyDrink(playerId, savedPin.get(), n, "");
    setBusy(false);
    setError(err ? t(err) : "");
    if (!err) setAmount("");
  };
  return (
    <Card className="space-y-2">
      <div className="text-sm font-semibold">{t("ค่าน้ำ")}</div>
      {drinks.map((d) => (
        <div key={d.id} className="flex justify-between text-sm text-zinc-600">
          <Auto text={d.note} />
          <span>{baht(d.amount)}</span>
        </div>
      ))}
      <div className="grid grid-cols-4 gap-2">
        {[10, 15, 20, 25].map((n) => (
          <Button key={n} disabled={busy} onClick={() => void add(n)}>
            +{n}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add(Number(amount));
        }}
      >
        <input className={`${inputClass} min-w-0 flex-1`} inputMode="numeric" placeholder={t("บาท")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button type="submit" disabled={busy}>
          {t("เพิ่ม")}
        </Button>
      </form>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">{t("เพิ่มผิด บอกแอดมินให้ลบได้")}</p>
    </Card>
  );
}
