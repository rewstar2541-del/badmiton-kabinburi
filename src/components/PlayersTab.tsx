"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listClaims, resolveClaim, supabase, type LineClaim } from "@/lib/remote";
import { resizeToSquare } from "@/lib/image";
import { today, useStore } from "@/lib/store";
import { DEFAULT_LEVEL, LEVELS, isMonthlyPaid, type Gender, type Level, type Player } from "@/lib/types";
import { Avatar, Button, Card, Icon, LevelBadge, SearchInput, SectionTitle, inputClass } from "./ui";
import { cameSince, daysBefore, visibleRoster } from "@/lib/roster";
import { t } from "@/lib/i18n";
import { useAdmins } from "./AdminsCard";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "ชาย" },
  { value: "female", label: "หญิง" },
  { value: "other", label: "ไม่ระบุ" },
];

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  cols,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  cols: number;
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-zinc-100 p-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-1 py-2 text-sm font-semibold transition ${
            value === o.value ? "bg-ink text-white shadow-sm" : "text-zinc-600"
          }`}
        >
          {t(o.label)}
          {o.sub && (
            <div className={`truncate text-[10px] font-normal ${value === o.value ? "text-white/70" : "text-zinc-400"}`}>{t(o.sub)}</div>
          )}
        </button>
      ))}
    </div>
  );
}

export type PlayerInput = Omit<Player, "id">;

/** ฟอร์มลงทะเบียนครั้งแรก และแก้ไขโปรไฟล์ */
export function PlayerForm({
  initial,
  onSave,
  onCancel,
  submitLabel,
  defaultName,
  defaultPhoto,
  self,
}: {
  /** ผู้เล่นแก้ข้อมูลตัวเอง: มีช่องแนะนำตัว และเปลี่ยนระดับมือต้องรอแอดมินอนุมัติ */
  self?: boolean;
  /** ค่าตั้งต้นตอนสมัคร (ชื่อและรูปจาก LINE) */
  defaultName?: string;
  defaultPhoto?: string;
  submitLabel?: string;
  initial?: Player;
  onSave: (p: PlayerInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? defaultName ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? defaultPhoto);
  const [gender, setGender] = useState<Gender | undefined>(initial?.gender);
  const [level, setLevel] = useState<Level>((self ? initial?.levelRequest : undefined) ?? initial?.level ?? DEFAULT_LEVEL);
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setPhoto(undefined);
    setGender(undefined);
    setLevel(DEFAULT_LEVEL);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError(t("กรุณาใส่ชื่อเล่น"));
        if (!gender) return setError(t("กรุณาเลือกเพศ"));
        setError("");
        onSave({ name: name.trim(), photo, gender, level, ...(self ? { bio: bio.trim() || undefined } : {}) });
        if (!initial) reset();
      }}
    >
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label={t("เลือกรูป")}>
          {photo || name ? (
            <Avatar name={name} photo={photo} size={76} />
          ) : (
            <span className="grid size-[76px] place-items-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400">
              <Icon.Camera />
            </span>
          )}
          <span className="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full bg-lime text-ink ring-2 ring-white">
            <Icon.Camera width={14} height={14} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setPhoto(await resizeToSquare(f));
            e.target.value = "";
          }}
        />
        <label className="flex-1 space-y-1.5 text-sm font-medium">
          {t("ชื่อเล่น")}
          <input className={inputClass} placeholder={t("เช่น ต้น")} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      <div className="space-y-1.5 text-sm font-medium">
        {t("เพศ")}
        <Segmented options={GENDERS} value={gender} onChange={setGender} cols={3} />
      </div>

      {self && photo?.startsWith("data:") && (
        <button type="button" className="text-xs font-semibold text-sky-700 underline" onClick={() => setPhoto(undefined)}>
          {t("ใช้รูปจาก LINE แทน (อัปเดตตอนเข้าสู่ระบบครั้งถัดไป)")}
        </button>
      )}

      {self && (
        <label className="block space-y-1.5 text-sm font-medium">
          {t("แนะนำตัว (ไม่ใส่ก็ได้)")}
          <textarea
            className={`${inputClass} min-h-20`}
            maxLength={200}
            placeholder={t("เช่น ตีมา 2 ปี ชอบเล่นหน้าเน็ต")}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
      )}

      <div className="space-y-1.5 text-sm font-medium">
        {t("ระดับมือ")}
        {self && <p className="text-xs font-normal text-zinc-500">{t("เปลี่ยนระดับมือแล้วต้องรอแอดมินอนุมัติก่อน")}</p>}
        <Segmented
          options={LEVELS.map((l) => ({ value: l.value, label: l.code, sub: l.label }))}
          value={level}
          onChange={setLevel}
          cols={3}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" type="submit" className="flex-1">
          {submitLabel ?? (initial ? t("บันทึก") : t("ลงทะเบียน"))}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            {t("ยกเลิก")}
          </Button>
        )}
      </div>
    </form>
  );
}

export function PlayersTab() {
  const { state, dispatch, auth } = useStore();
  const admin = useAdmins();
  const [editing, setEditing] = useState<string | null>(null);
  const date = today();
  const pending = state.players.filter((p) => p.pending);
  const all = state.players.filter((p) => !p.pending);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  // ปกติแสดงคนที่มาเล่นใน 60 วันล่าสุด คนที่หายไปนานซ่อนไว้ ค้นหาหรือกดแสดงทั้งหมดได้
  const recent = cameSince(state.days, daysBefore(date, 60));
  const players = visibleRoster(all, q, (p) => showAll || recent.has(p.id) || editing === p.id).sort((a, b) =>
    a.name.localeCompare(b.name, "th"),
  );
  const hidden = q.trim() ? 0 : all.length - players.length;

  return (
    <div className="space-y-4">
      <LineClaims />
      <LevelRequests />
      {pending.length > 0 && <PendingList players={pending} />}
      <SectionTitle>{t("ลงทะเบียนผู้เล่นใหม่")}</SectionTitle>
      <Card>
        <PlayerForm onSave={(player) => dispatch({ type: "addPlayer", player })} />
      </Card>

      <SectionTitle right={t("{n} คน", { n: all.length })}>{t("ผู้เล่นทั้งหมด")}</SectionTitle>
      {admin.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{admin.error}</p>}
      <SearchInput value={q} onChange={setQ} />
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            <Card className="py-3">
              {editing === p.id ? (
                <PlayerForm
                  initial={p}
                  onCancel={() => setEditing(null)}
                  onSave={(v) => {
                    dispatch({ type: "updatePlayer", player: { ...p, ...v } });
                    setEditing(null);
                  }}
                />
              ) : (
                // ชื่ออยู่แถวบน ปุ่มอยู่แถวล่าง จอมือถือแคบจะได้ไม่บีบชื่อจนหาย
                <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} photo={p.photo} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate font-semibold">{p.name}</span>
                      <span className="shrink-0">
                        <LevelBadge level={p.level} />
                      </span>
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {[
                        p.guestOf && t("แขกของ {name}", { name: state.players.find((h) => h.id === p.guestOf)?.name ?? "?" }),
                        admin.enabled && !admin.emailOf.has(p.id) && !p.guestOf && t("ยังไม่ได้ผูก LINE"),
                        isMonthlyPaid(state.monthly, date, p.id) && t("รายเดือนเดือนนี้"),
                      ].filter(Boolean).join(" · ") ||
                        " "}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    className="shrink-0 px-2 text-red-500"
                    aria-label={t("ลบ {name}", { name: p.name })}
                    onClick={() => {
                      if (confirm(t("ลบ {name}?", { name: p.name }))) dispatch({ type: "removePlayer", playerId: p.id });
                    }}
                  >
                    <Icon.X width={18} height={18} />
                  </Button>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {!p.guestOf && (
                    <Button
                      variant="ghost"
                      className={`px-3 py-2 text-xs ${p.plan === "monthly" ? "text-emerald-700" : "text-zinc-500"}`}
                      title={t("กดเพื่อสลับรายวัน/รายเดือน")}
                      onClick={() => dispatch({ type: "updatePlayer", player: { ...p, plan: p.plan === "monthly" ? "daily" : "monthly" } })}
                    >
                      {p.plan === "monthly" ? t("รายเดือน") : p.plan === "daily" ? t("รายวัน") : t("ยังไม่เลือกแบบสมาชิก")}
                    </Button>
                  )}
                  {p.guestOf && (
                    <Button
                      variant="ghost"
                      className="px-3 py-2 text-xs text-emerald-700"
                      onClick={() => {
                        const member = { ...p, guestOf: undefined };
                        dispatch({ type: "updatePlayer", player: member });
                        setEditing(p.id);
                      }}
                    >
                      {t("เป็นสมาชิก")}
                    </Button>
                  )}
                  {admin.enabled && admin.emailOf.has(p.id) && (() => {
                    const email = admin.emailOf.get(p.id)!;
                    const on = admin.admins.includes(email);
                    const self = email === auth.email?.toLowerCase();
                    return (
                      <Button
                        variant="ghost"
                        className={`px-3 py-2 text-xs ${on ? "text-ink" : "text-zinc-500"}`}
                        disabled={admin.busy || self}
                        onClick={() => {
                          const msg = on ? t("เอา {name} ออกจากแอดมิน?", { name: p.name }) : t("ตั้ง {name} เป็นแอดมิน?", { name: p.name });
                          if (confirm(msg)) admin.setAdmin(email, !on);
                        }}
                      >
                        {on ? t("แอดมิน ✓") : t("ตั้งเป็นแอดมิน")}
                      </Button>
                    );
                  })()}
                  <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setEditing(p.id)}>
                    {t("แก้ไข")}
                  </Button>
                </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button className="w-full text-center text-sm font-semibold text-zinc-600 underline" onClick={() => setShowAll(true)}>
          {t("แสดงคนที่ไม่ได้มาเกิน 60 วัน ({n} คน)", { n: hidden })}
        </button>
      )}
    </div>
  );
}

const GENDER_LABEL: Record<Gender, string> = { male: "ชาย", female: "หญิง", other: "ไม่ระบุ" };

/** คนที่สมัครเอง รอแอดมินอนุมัติ ปรับระดับมือได้ก่อนกดอนุมัติ */
function PendingList({ players }: { players: Player[] }) {
  const { dispatch } = useStore();
  const [levels, setLevels] = useState<Record<string, Level>>({});
  return (
    <>
      <SectionTitle right={t("{n} คน", { n: players.length })}>{t("รออนุมัติ")}</SectionTitle>
      <ul className="space-y-2">
        {players.map((p) => {
          const level = levels[p.id] ?? p.level;
          return (
            <li key={p.id}>
              <Card className="space-y-3 ring-2 ring-amber-300">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} photo={p.photo} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {[p.gender && t(GENDER_LABEL[p.gender])].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5 text-sm font-medium">
                  {t("ระดับมือ (ปรับได้ก่อนอนุมัติ)")}
                  <Segmented
                    options={LEVELS.map((l) => ({ value: l.value, label: l.code, sub: l.label }))}
                    value={level}
                    onChange={(v) => setLevels({ ...levels, [p.id]: v })}
                    cols={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="accent" onClick={() => dispatch({ type: "updatePlayer", player: { ...p, level, pending: false } })}>
                    {t("อนุมัติ")}
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm(t("ไม่อนุมัติและลบ {name}?", { name: p.name }))) dispatch({ type: "removePlayer", playerId: p.id });
                    }}
                  >
                    {t("ไม่อนุมัติ")}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** คนที่เข้าด้วย LINE แล้วกด "นี่คือฉัน" ที่ชื่อที่แอดมินลงไว้ รอแอดมินยืนยันว่าเป็นคนเดียวกัน */
/** ผู้เล่นขอเปลี่ยนระดับมือเอง แอดมินอนุมัติก่อน การจับคู่จะได้ยุติธรรม */
function LevelRequests() {
  const { state, dispatch } = useStore();
  const list = state.players.filter((p) => p.levelRequest && p.levelRequest !== p.level);
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      <SectionTitle right={t("{n} คน", { n: list.length })}>{t("ขอเปลี่ยนระดับมือ")}</SectionTitle>
      {list.map((p) => (
        <Card key={p.id} className="flex items-center gap-3">
          <Avatar name={p.name} photo={p.photo} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{p.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <LevelBadge level={p.level} /> → <LevelBadge level={p.levelRequest!} />
            </span>
          </span>
          <Button
            variant="accent"
            className="px-3 py-2 text-xs"
            onClick={() => dispatch({ type: "updatePlayer", player: { ...p, level: p.levelRequest!, levelRequest: undefined } })}
          >
            {t("อนุมัติ")}
          </Button>
          <Button className="px-3 py-2 text-xs" onClick={() => dispatch({ type: "updatePlayer", player: { ...p, levelRequest: undefined } })}>
            {t("ไม่อนุมัติ")}
          </Button>
        </Card>
      ))}
    </div>
  );
}

function LineClaims() {
  const { state, auth } = useStore();
  const [claims, setClaims] = useState<LineClaim[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = auth.online && auth.isAdmin && Boolean(supabase);
  const load = useCallback(async () => {
    if (!supabase) return;
    setClaims(await listClaims(supabase));
  }, []);
  // โหลดใหม่เมื่อรายชื่อผู้เล่นเปลี่ยน (มีคนสมัคร/ผูกใหม่)
  const version = state.players.length;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    listClaims(supabase!)
      .then((c) => live && setClaims(c))
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [enabled, version]);
  if (!enabled || (claims.length === 0 && !error)) return null;

  const resolve = async (c: LineClaim, ok: boolean) => {
    setBusy(true);
    const err = await resolveClaim(supabase!, c.line_user_id, ok);
    setError(err ? t(err) : "");
    await load().catch(() => {});
    setBusy(false);
  };

  return (
    <>
      <SectionTitle right={t("{n} คน", { n: claims.length })}>{t("ขอผูกบัญชี LINE")}</SectionTitle>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {claims.map((c) => {
          const p = state.players.find((x) => x.id === c.player_id);
          return (
            <li key={c.line_user_id}>
              <Card className="space-y-3 ring-2 ring-amber-300">
                <div className="flex items-center gap-3">
                  <Avatar name={c.line_name ?? "?"} photo={c.picture ?? undefined} size={44} />
                  <span className="min-w-0 flex-1 text-sm">
                    {t("LINE \"{line}\" บอกว่าเป็น {name}", { line: c.line_name ?? "?", name: p?.name ?? "?" })}
                  </span>
                  {p && <Avatar name={p.name} photo={p.photo} size={44} />}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="accent" disabled={busy} onClick={() => resolve(c, true)}>
                    {t("ใช่ คนเดียวกัน")}
                  </Button>
                  <Button disabled={busy} onClick={() => resolve(c, false)}>
                    {t("ไม่ใช่")}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
