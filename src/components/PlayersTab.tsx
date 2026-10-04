"use client";

import { useRef, useState } from "react";
import { resizeToSquare } from "@/lib/image";
import { useStore } from "@/lib/store";
import type { Gender, Level, Player } from "@/lib/types";
import { Avatar, Button, Card, LEVEL_LABEL, LevelBadge, inputClass } from "./ui";

const LEVELS: Level[] = [1, 2, 3, 4, 5];

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
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-1 py-2 text-sm ${
            value === o.value ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
          }`}
        >
          {o.label}
          {o.sub && <div className="truncate text-[10px] opacity-80">{o.sub}</div>}
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
  const [level, setLevel] = useState<Level>(initial?.level ?? 3);
  const [isMonthly, setMonthly] = useState(initial?.isMonthly ?? false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const phoneDigits = phone.replace(/\D/g, "");

  const reset = () => {
    setName("");
    setPhoto(undefined);
    setPhone("");
    setGender(undefined);
    setLevel(3);
    setMonthly(false);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("กรุณาใส่ชื่อเล่น");
        if (phoneDigits && phoneDigits.length !== 10) return setError("เบอร์โทรต้องมี 10 หลัก");
        if (!gender) return setError("กรุณาเลือกเพศ");
        setError("");
        onSave({ name: name.trim(), photo, phone: phoneDigits || undefined, gender, level, isMonthly });
        if (!initial) reset();
      }}
    >
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="เลือกรูป">
          <Avatar name={name || "+"} photo={photo} size={72} />
          <span className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-zinc-900 text-xs text-white">
            📷
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
        <div className="flex-1 space-y-1">
          <label className="text-sm">ชื่อเล่น</label>
          <input className={inputClass} placeholder="เช่น ต้น" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        เบอร์โทร
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          placeholder="08x-xxx-xxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <div className="space-y-1 text-sm">
        เพศ
        <Segmented options={GENDERS} value={gender} onChange={setGender} cols={3} />
      </div>

      <div className="space-y-1 text-sm">
        ระดับมือ
        <Segmented
          options={LEVELS.map((l) => ({ value: l, label: String(l), sub: LEVEL_LABEL[l] }))}
          value={level}
          onChange={setLevel}
          cols={5}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={isMonthly} onChange={(e) => setMonthly(e.target.checked)} />
        สมาชิกรายเดือน (ไม่คิดค่าสนามรายวัน)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" type="submit" className="flex-1">
          {initial ? "บันทึก" : "ลงทะเบียน"}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
      </div>
    </form>
  );
}

export function PlayersTab() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-semibold">ลงทะเบียนผู้เล่นใหม่</h2>
        <PlayerForm onSave={(player) => dispatch({ type: "addPlayer", player })} />
      </Card>

      <div className="text-sm text-zinc-500">ทั้งหมด {players.length} คน</div>
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
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} photo={p.photo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    {p.phone && <span className="block text-xs text-zinc-500">{p.phone}</span>}
                  </span>
                  <LevelBadge level={p.level} />
                  {p.isMonthly && <span className="text-xs text-emerald-600">รายเดือน</span>}
                  <Button variant="ghost" onClick={() => setEditing(p.id)}>
                    แก้ไข
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`ลบ ${p.name}?`)) dispatch({ type: "removePlayer", id: p.id });
                    }}
                  >
                    ลบ
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
