"use client";

import { t } from "@/lib/i18n";
import { partnerStats, type MateStat } from "@/lib/social";
import { useStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { Avatar, Card } from "./ui";

/** สถิติคู่หู: ตีคู่กับใครชนะบ่อย และเจอใครแพ้บ่อย (จากเกมที่แอดมินบันทึกผล) */
export function PartnerStats({ player }: { player: Player }) {
  const { state } = useStore();
  const s = partnerStats(state, player.id);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const row = (m: MateStat, text: string) => {
    const p = byId.get(m.id);
    return (
      <li key={m.id} className="flex items-center gap-2.5">
        <Avatar name={p?.name ?? "?"} photo={p?.photo} size={30} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p?.name ?? "?"}</span>
        <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{text}</span>
      </li>
    );
  };
  const partners = s.partners.filter((m) => m.wins > 0).slice(0, 3);
  const rivals = s.rivals.filter((m) => m.games > m.wins).slice(0, 3);
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("คู่หูและคู่แข่ง")}</h3>
        <span className="shrink-0 text-xs text-zinc-500">{t("จาก {n} เกมที่บันทึกผล", { n: s.decided })}</span>
      </div>
      {s.decided === 0 ? (
        <p className="text-sm text-zinc-500">{t("ยังไม่มีเกมที่บันทึกผลแพ้ชนะ แอดมินกด \"ทีม A ชนะ\" หรือ \"ทีม B ชนะ\" ตอนจบเกม แล้วสถิติจะขึ้นที่นี่")}</p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold tracking-wide text-emerald-700">{t("ตีคู่แล้วชนะบ่อย")}</h4>
            {partners.length ? (
              <ul className="space-y-2">{partners.map((m) => row(m, t("ชนะ {w} จาก {g} เกม", { w: m.wins, g: m.games })))}</ul>
            ) : (
              <p className="text-sm text-zinc-500">{t("ยังไม่มี")}</p>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold tracking-wide text-red-600">{t("เจอแล้วแพ้บ่อย")}</h4>
            {rivals.length ? (
              <ul className="space-y-2">{rivals.map((m) => row(m, t("แพ้ {l} จาก {g} เกม", { l: m.games - m.wins, g: m.games })))}</ul>
            ) : (
              <p className="text-sm text-zinc-500">{t("ยังไม่มี")}</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
