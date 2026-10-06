"use client";

import { useState } from "react";
import { billFor } from "@/lib/billing";
import { LANGS, t, useLang } from "@/lib/i18n";
import { useStore, useToday } from "@/lib/store";
import { setTheme, useTheme } from "@/lib/theme";
import { isMonthlyPaid, monthOf } from "@/lib/types";
import { Auto } from "@/lib/autoTranslate";
import { BirthdayEdit } from "./Birthday";
import { Hero, LangChoices, Rows, guideHref, useSheets } from "./Home";
import { PlayerLineAlerts } from "./LineCard";
import { PlanSwitch, goToTab } from "./Membership";
import { BadgesCard, MonthCard, PartnerPrefs } from "./MyExtras";
import { PartnerStats } from "./PartnerStats";
import { PendingNotice, PickMe, savedPin, useMe } from "./PickMe";
import { PlayerForm } from "./PlayersTab";
import { Avatar, Icon, LevelBadge, baht, levelCode } from "./ui";

/** โปรไฟล์ของผู้เล่น: ข้อมูลส่วนตัว สถิติ ภาษา และออกจากระบบ */
export function ProfileTab() {
  const { state, updateProfile } = useStore();
  const { date, day } = useToday();
  const lang = useLang();
  const theme = useTheme();
  const [me, setMe] = useMe();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { open, sheet } = useSheets<"edit" | "plan" | "month" | "badges" | "partners" | "prefs" | "lang">();
  const player = state.players.find((p) => p.id === me);

  if (!player) return <PickMe onPick={setMe} hint={t("เข้าครั้งเดียว เครื่องจะจำไว้")} />;
  if (player.pending) return <PendingNotice name={player.name} onNotMe={() => setMe(null)} />;

  const monthly = isMonthlyPaid(state.monthly, date, player.id);
  const bill = billFor(state.days, day, player, state.settings, state.monthly, state.players);
  const dark = theme === "dark";
  const checkedIn = day.checkIns.some((c) => c.playerId === player.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 px-1">
        <Avatar name={player.name} photo={player.photo} size={68} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-2xl font-semibold">{player.name}</span>
            <LevelBadge level={player.level} />
          </div>
          <div className="text-[15px] text-zinc-600">{monthly ? t("สมาชิกรายเดือน {month}", { month: monthOf(date) }) : t("จ่ายรายวัน")}</div>
        </div>
      </div>
      {player.bio && (
        <p className="px-1 text-[15px] whitespace-pre-line text-zinc-700">
          <Auto text={player.bio} />
        </p>
      )}
      {player.levelRequest && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("ขอเปลี่ยนเป็น {level} รออนุมัติ", { level: levelCode(player.levelRequest) })}</p>
      )}

      <Hero
        label={bill.paid ? t("วันนี้จ่ายแล้ว") : t("ยอดที่ต้องจ่ายวันนี้")}
        big={!checkedIn && bill.total === 0 ? t("ยังไม่มียอด") : baht(bill.total)}
        sub={t("แตะเพื่อดูรายละเอียดและจ่ายเงิน")}
        icon={Icon.Wallet}
        onClick={() => goToTab("mybill")}
      />

      <Rows
        items={[
          {
            icon: Icon.Edit,
            title: t("แก้ไขข้อมูล"),
            sub: t("ชื่อเล่น รูป วันเกิด ระดับมือ"),
            onClick: () => {
              setError("");
              open("edit");
            },
          },
          ...(player.plan && !player.guestOf
            ? [{ icon: Icon.Receipt, title: t("แบบสมาชิก"), sub: player.plan === "monthly" ? t("รายเดือน") : t("รายวัน"), onClick: () => open("plan") }]
            : []),
          { icon: Icon.Calendar, title: t("สรุปเดือนนี้"), sub: t("มากี่วัน เล่นกี่เกม ชนะเท่าไร"), onClick: () => open("month") },
          { icon: Icon.Trophy, title: t("เหรียญของฉัน"), sub: t("เหรียญที่ได้จากการมาเล่น"), onClick: () => open("badges") },
          { icon: Icon.Chart, title: t("สถิติกับคู่"), sub: t("เล่นกับใครบ่อย ชนะกับใคร"), onClick: () => open("partners") },
          { icon: Icon.Heart, title: t("คู่ที่อยากเล่นด้วย"), sub: t("เลือกคนที่อยากจับคู่หรือไม่อยากเจอ"), onClick: () => open("prefs") },
        ]}
      />
      <Rows
        items={[
          { icon: Icon.Globe, title: t("ภาษา"), sub: LANGS.find((l) => l.value === lang)?.label, onClick: () => open("lang") },
          { icon: Icon.Moon, title: dark ? t("ธีมสว่าง") : t("ธีมมืด"), sub: t("ธีมมืดอ่านง่ายในที่แสงน้อย"), onClick: () => setTheme(dark ? "light" : "dark") },
          { icon: Icon.Book, title: t("คู่มือการใช้งาน"), href: guideHref(lang, false) },
        ]}
      />
      <PlayerLineAlerts playerId={player.id} />
      <button onClick={() => confirm(t("ออกจากระบบใช่ไหม?")) && setMe(null)} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-semibold text-red-600">
        <Icon.LogOut width={20} height={20} /> {t("ออกจากระบบ")}
      </button>

      {sheet(
        "edit",
        t("แก้ไขข้อมูล"),
        <div className="space-y-4">
          <BirthdayEdit player={player} />
          <PlayerForm
            self
            initial={player}
            onCancel={() => open(null)}
            onSave={async (v) => {
              if (busy) return;
              setBusy(true);
              try {
                const err = await updateProfile(player.id, savedPin.get(), { name: v.name, photo: v.photo, gender: v.gender, bio: v.bio, level: v.level });
                setError(err ? t(err) : "");
                if (!err) open(null);
              } catch {
                setError(t("บันทึกไม่สำเร็จ ลองใหม่"));
              } finally {
                setBusy(false);
              }
            }}
          />
          {busy && <p className="text-center text-sm text-zinc-600">{t("กำลังบันทึก...")}</p>}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>,
        true,
      )}
      {sheet("plan", t("แบบสมาชิก"), <PlanSwitch player={player} bare />)}
      {sheet("month", t("สรุปเดือนนี้"), <MonthCard player={player} />)}
      {sheet("badges", t("เหรียญของฉัน"), <BadgesCard player={player} />)}
      {sheet("partners", t("สถิติกับคู่"), <PartnerStats player={player} />)}
      {sheet("prefs", t("คู่ที่อยากเล่นด้วย"), <PartnerPrefs key={(player.prefer ?? []).join() + "|" + (player.avoid ?? []).join()} player={player} />)}
      {sheet("lang", t("ภาษา"), <LangChoices onDone={() => open(null)} />)}
    </div>
  );
}
