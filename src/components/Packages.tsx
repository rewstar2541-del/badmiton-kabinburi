"use client";

import { useState } from "react";
import { locale, t } from "@/lib/i18n";
import type { Intent, State } from "@/lib/state";
import { useStore, useToday } from "@/lib/store";
import { annualStatus, isMonthlyPaid, monthOf, type Package, type Player } from "@/lib/types";
import { datesToFreeze } from "@/lib/billing";
import { today } from "@/lib/state";
import { PayQr } from "./PayQr";
import { SlipUpload } from "./Slips";
import { Button, Card, baht, inputClass } from "./ui";

export function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

/** วันสุดท้ายที่แพ็กนี้ใช้ได้ ถ้าจ่ายวันที่ date (รายเดือน = สิ้นเดือนนั้น) */
export function packageUntil(pkg: Package, date: string): string {
  if (pkg.kind === "term") return pkg.until ?? date;
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** แพ็กที่ส่งสลิปวันที่ date ถูกยืนยันแล้วหรือยัง (รายเดือน = จ่ายเดือนนั้นแล้ว, ระยะยาว = สมาชิกถึงวันหมดอายุแพ็กแล้ว) */
export function packageDone(state: State, player: Player | undefined, pkg: Package, date: string): boolean {
  if (!player) return false;
  if (pkg.kind === "monthly") return isMonthlyPaid(state.monthly, date, player.id);
  // ดูจากรายการจ่ายรายปีที่บันทึกหลังส่งสลิป (แก้วันที่ของแพ็กทีหลัง สลิปเก่าไม่กลับมาค้าง)
  return (state.annualPayments ?? []).some((a) => a.playerId === player.id && a.paidOn >= date);
}

/** แอดมินรับเงินแพ็กแล้ว: รายเดือน = จ่ายเดือนของ date + เปลี่ยนเป็นแบบรายเดือน, ระยะยาว = สมาชิกถึงวันหมดอายุแพ็ก */
export function applyPackage(dispatch: (a: Intent) => void, player: Player, pkg: Package, date: string, paidOn: string) {
  if (pkg.kind === "monthly") {
    dispatch({ type: "setMonthlyPaid", month: monthOf(date), playerId: player.id, paid: true, amount: pkg.price });
    if (player.plan !== "monthly") dispatch({ type: "updatePlayer", player: { ...player, plan: "monthly" } });
    return;
  }
  const prev = player.annualFrom && player.annualUntil ? { from: player.annualFrom, until: player.annualUntil } : undefined;
  // ต่ออายุก่อนหมด: นับต่อจากช่วงเดิม ไม่ตัดวันที่จ่ายไว้แล้ว
  const active = prev && prev.until >= date;
  const from = active ? prev.from : date;
  // แพ็กที่สั้นกว่าช่วงเดิมไม่ตัดวันหมดอายุให้สั้นลง
  const until = active && prev.until > packageUntil(pkg, date) ? prev.until : packageUntil(pkg, date);
  dispatch({ type: "recordAnnual", playerId: player.id, paidOn, from, until, amount: pkg.price, prev });
}

/** เรียงแพ็กให้เหมือนกันทุกหน้า */
export const sorted = (list: Package[] | undefined) => [...(list ?? [])].sort((a, b) => a.sort - b.sort || a.price - b.price);

/** ค่าสมาชิกรายเดือนใน settings = ราคาแพ็กรายเดือนแรก (ส่วนอื่นของแอพยังใช้ค่านี้) */
function monthlyFeeOf(list: Package[]) {
  return sorted(list).find((p) => p.kind === "monthly")?.price ?? 0;
}

/** แอดมิน: ตั้งแพ็กเกจสมาชิก ชื่อ ราคา วันหมดอายุ */
export function PackageAdmin() {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const list = sorted(state.packages);
  const [edit, setEdit] = useState<Package | null>(null);
  // แก้ราคารายวัน (= ค่าสนามต่อครั้ง)
  const [daily, setDaily] = useState<string | null>(null);
  const saveDaily = () => {
    const fee = Number(daily);
    const old = state.settings;
    if (daily === null || !daily || fee === old.courtFee) return setDaily(null);
    // ราคาใหม่ใช้ตั้งแต่วันนี้ เก็บราคาเดิมไว้กับวันก่อนๆ บิลเก่าจะได้ไม่เปลี่ยน (เหมือนหน้า ราคาและสนาม)
    const freeze = {
      dates: datesToFreeze(state.days, today()),
      prices: { courtFee: old.courtFee, firstShuttleFee: old.firstShuttleFee, nextShuttleFee: old.nextShuttleFee },
    };
    dispatch({ type: "updateSettings", settings: { ...old, courtFee: fee }, freeze });
    setDaily(null);
  };

  const syncFee = (next: Package[]) => {
    const fee = monthlyFeeOf(next);
    if (fee !== state.settings.monthlyFee) dispatch({ type: "updateSettings", settings: { ...state.settings, monthlyFee: fee } });
  };
  const save = (p: Package) => {
    dispatch({ type: "savePackage", pkg: p });
    syncFee([...list.filter((x) => x.id !== p.id), p]);
    setEdit(null);
  };
  const remove = (p: Package) => {
    if (!confirm(t("ลบแพ็กเกจ {name}? คนที่เป็นสมาชิกอยู่แล้วไม่กระทบ", { name: p.name }))) return;
    dispatch({ type: "removePackage", id: p.id });
    syncFee(list.filter((x) => x.id !== p.id));
    setEdit(null);
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-display font-semibold">{t("แพ็กเกจสมาชิก")}</h2>
      <p className="text-sm text-zinc-500">{t("ผู้เล่นเลือกแพ็กเกจ โอน แล้วแนบสลิป แอดมินกดยืนยันในประวัติโอน ระบบตั้งวันหมดอายุให้เอง")}</p>
      {daily === null ? (
        <button className="flex w-full items-center gap-3 rounded-2xl bg-zinc-100 p-3 text-left active:scale-[0.99]" onClick={() => setDaily(String(state.settings.courtFee))}>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold">{t("รายวัน")}</span>
            <span className="block text-sm text-zinc-500">{t("ค่าสนามต่อครั้ง จ่ายทุกครั้งที่มา")}</span>
          </span>
          <span className="shrink-0 font-display text-lg font-semibold">{baht(state.settings.courtFee)}</span>
          <span className="shrink-0 text-sm text-zinc-500">{t("แก้")}</span>
        </button>
      ) : (
        <form
          className="space-y-3 rounded-3xl bg-zinc-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveDaily();
          }}
        >
          <label className="block text-sm font-medium">
            {t("ค่าสนามต่อครั้ง (รายวัน)")}
            <input className={`${inputClass} mt-1`} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, ""))} />
          </label>
          <p className="text-xs text-zinc-500">{t("ราคาใหม่ใช้ตั้งแต่วันนี้ (มีคนจ่ายแล้วเริ่มพรุ่งนี้) บิลเก่าไม่เปลี่ยน แก้ยอดรายคนที่ คิดเงิน > กดชื่อ")}</p>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={!daily}>
              {t("บันทึก")}
            </Button>
            <Button type="button" onClick={() => setDaily(null)}>
              {t("ยกเลิก")}
            </Button>
          </div>
        </form>
      )}
      {list.map((p) => (
        <button key={p.id} className="flex w-full items-center gap-3 rounded-2xl bg-zinc-100 p-3 text-left active:scale-[0.99]" onClick={() => setEdit(p)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display font-semibold">{p.name}</span>
            <span className="block text-sm text-zinc-500">
              {p.kind === "monthly" ? t("ใช้ได้ถึงสิ้นเดือนที่จ่าย") : t("ใช้ได้ถึง {date}", { date: fmtDate(p.until ?? "") })}
            </span>
          </span>
          <span className="shrink-0 font-display text-lg font-semibold">{baht(p.price)}</span>
          <span className="shrink-0 text-sm text-zinc-500">{t("แก้")}</span>
        </button>
      ))}
      {edit ? (
        <PackageForm key={edit.id} pkg={edit} isNew={!list.some((p) => p.id === edit.id)} today={date} onSave={save} onRemove={remove} onCancel={() => setEdit(null)} />
      ) : (
        <Button
          className="w-full"
          onClick={() =>
            setEdit({ id: crypto.randomUUID(), name: "", price: 0, kind: "term", until: packageUntil({ id: "", name: "", price: 0, kind: "monthly", sort: 0 }, date), sort: list.length ? Math.max(...list.map((p) => p.sort)) + 1 : 0 })
          }
        >
          {t("+ เพิ่มแพ็กเกจ")}
        </Button>
      )}
    </Card>
  );
}

function PackageForm({
  pkg,
  isNew,
  today,
  onSave,
  onRemove,
  onCancel,
}: {
  pkg: Package;
  isNew: boolean;
  today: string;
  onSave: (p: Package) => void;
  onRemove: (p: Package) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(pkg.name);
  const [price, setPrice] = useState(pkg.price ? String(pkg.price) : "");
  const [kind, setKind] = useState(pkg.kind);
  const [until, setUntil] = useState(pkg.until ?? "");
  const valid = name.trim() && Number(price) > 0 && (kind === "monthly" || until >= today);

  return (
    <form
      className="space-y-3 rounded-3xl bg-zinc-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({ id: pkg.id, name: name.trim(), price: Number(price), kind, ...(kind === "term" ? { until } : {}), sort: pkg.sort });
      }}
    >
      <div className="font-display font-semibold">{isNew ? t("เพิ่มแพ็กเกจ") : t("แก้แพ็กเกจ")}</div>
      <label className="block text-sm font-medium">
        {t("ชื่อแพ็กเกจ")}
        <input className={`${inputClass} mt-1`} value={name} maxLength={60} placeholder={t("เช่น รายปี")} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        {t("ราคา (บาท)")}
        <input className={`${inputClass} mt-1`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
      </label>
      <div className="space-y-1 text-sm font-medium">
        {t("หมดอายุ")}
        <div className="flex rounded-full bg-zinc-200/70 p-0.5">
          {(["monthly", "term"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${kind === k ? "bg-ink text-white" : "text-zinc-600"}`}
            >
              {k === "monthly" ? t("สิ้นเดือนที่จ่าย") : t("วันที่กำหนด")}
            </button>
          ))}
        </div>
      </div>
      {kind === "term" && (
        <label className="block text-sm font-medium">
          {t("ใช้ได้ถึงวันที่")}
          <input type="date" className={`${inputClass} mt-1`} value={until} min={today} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          {t("บันทึก")}
        </Button>
        {!isNew && (
          <Button type="button" className="!text-red-600" onClick={() => onRemove(pkg)}>
            {t("ลบ")}
          </Button>
        )}
        <Button type="button" onClick={onCancel}>
          {t("ยกเลิก")}
        </Button>
      </div>
    </form>
  );
}

/** ผู้เล่น: สถานะสมาชิกตอนนี้ + เลือกแพ็กเกจ โอน แนบสลิป */
export function PackagePicker({ player }: { player: Player }) {
  const { state } = useStore();
  const { date } = useToday();
  // แพ็กที่หมดอายุไปแล้วไม่ให้เลือก (แอดมินลืมเปลี่ยนวันที่)
  const all = sorted(state.packages);
  const list = all.filter((p) => p.kind === "monthly" || (p.until ?? "") >= date);
  const [picked, setPicked] = useState<string | null>(null);
  if (!list.length || player.guestOf) return null;

  const annual = annualStatus(player, date);
  const monthly = isMonthlyPaid(state.monthly, date, player.id);
  const status =
    annual && annual.kind !== "expired"
      ? t("สมาชิกถึง {date}", { date: fmtDate(annual.until) })
      : monthly
        ? t("สมาชิกรายเดือน ถึง {date}", { date: fmtDate(packageUntil({ id: "", name: "", price: 0, kind: "monthly", sort: 0 }, date)) })
        : t("รายวัน จ่ายค่าสนามทุกครั้งที่มา");
  // สลิปแพ็กที่ส่งไว้แล้วยังไม่ถูกยืนยัน
  const pending = state.days
    .flatMap((d) => (d.slips ?? []).filter((s) => s.playerId === player.id && s.packageId).map((s) => ({ ...s, date: d.date })))
    .map((s) => ({ ...s, pkg: all.find((p) => p.id === s.packageId) }))
    .filter((s) => s.pkg && !packageDone(state, player, s.pkg, s.date));
  const pkg = list.find((p) => p.id === picked);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display font-semibold">{t("แบบสมาชิก")}</h2>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{status}</span>
      </div>
      {pending.map((s) => (
        <div key={s.id} className="space-y-0.5 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <div className="font-semibold">
            {t("ส่งสลิปสมัคร {name} แล้ว ({date}) รอแอดมินตรวจ", { name: s.pkg!.name, date: fmtDate(s.date) })}
          </div>
          <div>{t("แอดมินยืนยันแล้ว สถานะจะเปลี่ยนเอง ไม่ต้องโอนซ้ำ")}</div>
        </div>
      ))}
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setPicked(picked === p.id ? null : p.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left active:scale-[0.99] ${picked === p.id ? "bg-lime text-ink" : "bg-zinc-100"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-semibold">{p.name}</span>
                <span className={`block text-sm ${picked === p.id ? "text-ink/70" : "text-zinc-500"}`}>
                  {t("ใช้ได้ถึง {date}", { date: fmtDate(packageUntil(p, date)) })}
                </span>
              </span>
              <span className="shrink-0 font-display text-lg font-semibold">{baht(p.price)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-500">{t("สมาชิกไม่ต้องจ่ายค่าสนาม ค่าลูกและค่าน้ำคิดตามปกติ")}</p>
      {pkg && (
        <div className="flex flex-col items-center gap-3 border-t border-dashed border-zinc-200 pt-3">
          <div className="font-display font-semibold">{t("โอน {amount} ({name})", { amount: baht(pkg.price), name: pkg.name })}</div>
          <PayQr promptPayId={state.settings.promptPayId} amount={pkg.price} />
          <SlipUpload playerId={player.id} amount={pkg.price} packageId={pkg.id} />
        </div>
      )}
    </Card>
  );
}

/** แพ็กของสลิปนี้ (ถ้ามี) */
export function slipPackage(state: State, packageId: string | undefined) {
  return packageId ? state.packages?.find((p) => p.id === packageId) : undefined;
}

/** แอดมิน (หน้ารายชื่อ): เปลี่ยนเป็นรายวัน หรือให้สมัครแพ็กที่รับเงินสดไว้แล้ว */
export function PlanPanel({ player, onDone }: { player: Player; onDone: () => void }) {
  const { state, dispatch } = useStore();
  const { date } = useToday();
  const list = sorted(state.packages).filter((p) => p.kind === "monthly" || (p.until ?? "") >= date);
  // จ่ายแพ็กนี้ไปแล้ว (กันกดซ้ำแล้วนับเงินสองรอบ)
  const paid = (pkg: Package) =>
    pkg.kind === "monthly" ? isMonthlyPaid(state.monthly, date, player.id) : Boolean(player.annualUntil && player.annualUntil >= packageUntil(pkg, date));
  const pick = (pkg: Package) => {
    if (paid(pkg)) return;
    const msg = t("รับเงิน {pkg} {amount} จาก {name} แล้ว? (สมาชิกถึง {date})", {
      pkg: pkg.name,
      amount: baht(pkg.price),
      name: player.name,
      date: fmtDate(packageUntil(pkg, date)),
    });
    if (!confirm(msg)) return;
    applyPackage(dispatch, player, pkg, date, date);
    onDone();
  };
  return (
    <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
      <div className="text-sm font-semibold">{t("เลือกแพ็กของ {name}", { name: player.name })}</div>
      <button
        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${player.plan === "daily" ? "bg-ink text-white" : "bg-white"}`}
        onClick={() => {
          if (player.plan !== "daily") dispatch({ type: "updatePlayer", player: { ...player, plan: "daily" } });
          onDone();
        }}
      >
        <span className="min-w-0 flex-1 font-semibold">{t("รายวัน")}</span>
        <span className="shrink-0 text-sm">{t("{amount}/ครั้ง", { amount: baht(state.settings.courtFee) })}</span>
      </button>
      {list.map((p) => (
        <button key={p.id} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left disabled:opacity-60" disabled={paid(p)} onClick={() => pick(p)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{p.name}</span>
            <span className="block text-xs text-zinc-500">{t("ใช้ได้ถึง {date}", { date: fmtDate(packageUntil(p, date)) })}</span>
          </span>
          {paid(p) ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("จ่ายแล้ว")}</span>
          ) : (
            <span className="shrink-0 font-semibold">{baht(p.price)}</span>
          )}
        </button>
      ))}
      <p className="text-xs text-zinc-500">{t("กดแพ็ก = รับเงินแล้ว ระบบตั้งวันหมดอายุให้ ถ้าเขาโอนมา กดยืนยันที่ประวัติโอนแทน")}</p>
      <Button className="w-full" onClick={onDone}>
        {t("ปิด")}
      </Button>
    </div>
  );
}
