"use client";

import { useRef, useState } from "react";
import { resizeToSquare } from "@/lib/image";
import { today, useStore } from "@/lib/store";
import { DEFAULT_LEVEL, LEVELS, isMonthlyPaid, type Gender, type Level, type Player } from "@/lib/types";
import { Avatar, Button, Card, Icon, LevelBadge, SectionTitle, inputClass } from "./ui";
import { t } from "@/lib/i18n";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "ชาย" },
  { value: "female", label: "หญิง" },
  { value: "other", label: "ไม่ระบุ" },
];

function Segmented<T extends string | number>({
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
}: {
  initial?: Player;
  onSave: (p: PlayerInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [photo, setPhoto] = useState(initial?.photo);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gender, setGender] = useState<Gender | undefined>(initial?.gender);
  const [level, setLevel] = useState<Level>(initial?.level ?? DEFAULT_LEVEL);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const phoneDigits = phone.replace(/\D/g, "");

  const reset = () => {
    setName("");
    setPhoto(undefined);
    setPhone("");
    setGender(undefined);
    setLevel(DEFAULT_LEVEL);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError(t("กรุณาใส่ชื่อเล่น"));
        if (phoneDigits && phoneDigits.length !== 10) return setError(t("เบอร์โทรต้องมี 10 หลัก"));
        if (!gender) return setError(t("กรุณาเลือกเพศ"));
        setError("");
        onSave({ name: name.trim(), photo, phone: phoneDigits || undefined, gender, level });
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

      <label className="block space-y-1.5 text-sm font-medium">
        {t("เบอร์โทร")}
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          placeholder="08x-xxx-xxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <div className="space-y-1.5 text-sm font-medium">
        {t("เพศ")}
        <Segmented options={GENDERS} value={gender} onChange={setGender} cols={3} />
      </div>

      <div className="space-y-1.5 text-sm font-medium">
        {t("ระดับมือ")}
        <Segmented
          options={LEVELS.map((l) => ({ value: l.value, label: l.code, sub: l.label }))}
          value={level}
          onChange={setLevel}
          cols={5}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" type="submit" className="flex-1">
          {initial ? t("บันทึก") : t("ลงทะเบียน")}
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
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const date = today();
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-4">
      <SectionTitle>{t("ลงทะเบียนผู้เล่นใหม่")}</SectionTitle>
      <Card>
        <PlayerForm onSave={(player) => dispatch({ type: "addPlayer", player })} />
      </Card>

      <SectionTitle right={t("{n} คน", { n: players.length })}>{t("ผู้เล่นทั้งหมด")}</SectionTitle>
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
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} photo={p.photo} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{p.name}</span>
                      <LevelBadge level={p.level} />
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {[p.phone, isMonthlyPaid(state.monthly, date, p.id) && t("รายเดือนเดือนนี้")].filter(Boolean).join(" · ") ||
                        " "}
                    </span>
                  </span>
                  <Button variant="ghost" className="px-3" onClick={() => setEditing(p.id)}>
                    {t("แก้ไข")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 text-red-500"
                    aria-label={t("ลบ {name}", { name: p.name })}
                    onClick={() => {
                      if (confirm(t("ลบ {name}?", { name: p.name }))) dispatch({ type: "removePlayer", playerId: p.id });
                    }}
                  >
                    <Icon.X width={18} height={18} />
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
