"use client";

import { useState } from "react";
import { presence } from "@/lib/matchmaking";
import { MAX_GUESTS } from "@/lib/state";
import { useStore, useToday } from "@/lib/store";
import { DEFAULT_LEVEL, LEVELS, type Level, type Player } from "@/lib/types";
import { Segmented } from "./PlayersTab";
import { Avatar, Button, Card, LevelBadge, inputClass } from "./ui";
import { t } from "@/lib/i18n";

/** ชื่อเล่นกับระดับมือของแขก */
function GuestFields({ busy, onSave, onCancel }: { busy?: boolean; onSave: (name: string, level: Level) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim(), level);
        setName("");
      }}
    >
      <label className="block space-y-1.5 text-sm font-medium">
        {t("ชื่อเล่นของเพื่อน")}
        <input className={inputClass} placeholder={t("เช่น ต้น")} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="space-y-1.5 text-sm font-medium">
        {t("ระดับมือ")}
        <Segmented options={LEVELS.map((l) => ({ value: l.value, label: l.code, sub: l.label }))} value={level} onChange={setLevel} cols={5} />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" className="flex-1" disabled={busy || !name.trim()}>
          {t("เพิ่มแขกและเช็คอิน")}
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

/** แขกที่มาวันนี้ของคนคนนี้ */
export function useGuestsToday(hostId: string): Player[] {
  const { state } = useStore();
  const { day } = useToday();
  const here = new Set(day.checkIns.map((c) => c.playerId));
  return state.players.filter((p) => p.guestOf === hostId && here.has(p.id));
}

/** ผู้เล่นพาเพื่อนมา: เพื่อนเข้าคิวได้เลย ค่าใช้จ่ายรวมในบิลของคนพามา */
export function BringGuest({ player, pin }: { player: Player; pin: string }) {
  const { addGuest } = useStore();
  const { day } = useToday();
  const guests = useGuestsToday(player.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = guests.length >= MAX_GUESTS;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display font-semibold">{t("พาเพื่อนมาเล่น")}</h2>
        <p className="text-xs text-zinc-500">{t("เพื่อนเข้าคิวได้เลยไม่ต้องลงทะเบียน ค่าสนาม ค่าลูก ค่าน้ำของเพื่อนรวมในยอดของคุณ")}</p>
      </div>
      {guests.length > 0 && (
        <ul className="space-y-1.5">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm">
              <Avatar name={g.name} size={28} />
              <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
              <LevelBadge level={g.level} />
              <span className="text-xs text-zinc-500">{presence(day, g.id) === "home" ? t("จ่ายแล้ว") : t("อยู่ในคิว")}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {open ? (
        <GuestFields
          busy={busy}
          onCancel={() => setOpen(false)}
          onSave={async (name, level) => {
            setBusy(true);
            const err = await addGuest(player.id, pin, name, level);
            setBusy(false);
            setError(err ? t(err) : "");
            if (!err) {
              setOpen(false);
            }
          }}
        />
      ) : (
        <Button className="w-full" disabled={full} onClick={() => setOpen(true)}>
          {full ? t("พาแขกได้ไม่เกิน 3 คนต่อวัน") : t("+ เพิ่มเพื่อน")}
        </Button>
      )}
    </Card>
  );
}

/** แอดมินเพิ่มแขกให้สมาชิกที่มาวันนี้ */
export function AdminAddGuest({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { date, day } = useToday();
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const hosts = day.checkIns
    .map((c) => byId.get(c.playerId))
    .filter((p): p is Player => Boolean(p && !p.guestOf))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  const [host, setHost] = useState("");

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("เพิ่มแขก")}</h3>
        <p className="text-xs text-zinc-500">{t("ค่าใช้จ่ายของแขกรวมในบิลของคนที่พามา")}</p>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">
        {t("ใครพามา")}
        <select className={inputClass} value={host} onChange={(e) => setHost(e.target.value)}>
          <option value="">{t("เลือกคนที่พามา (ต้องเช็คอินแล้ว)")}</option>
          {hosts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {host && (
        <GuestFields
          onCancel={onClose}
          onSave={(name, level) => {
            dispatch({ type: "addGuest", date, hostId: host, name, level });
            onClose();
          }}
        />
      )}
      {!host && (
        <Button className="w-full" onClick={onClose}>
          {t("ยกเลิก")}
        </Button>
      )}
    </Card>
  );
}
