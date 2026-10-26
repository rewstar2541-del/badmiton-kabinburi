"use client";

import { useState } from "react";
import { RankingCard } from "./Ranking";
import { ClubSummaryView } from "./YearSummary";

/** ตารางอันดับ + ปุ่มเปิดสรุปก๊วนและรางวัลประจำเดือน (เต็มจอ) */
export function ClubCorner() {
  const [month, setMonth] = useState<string | null>(null);
  return (
    <>
      <RankingCard onSummary={setMonth} />
      {month && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-zinc-100 px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <ClubSummaryView period={month} onClose={() => setMonth(null)} />
        </div>
      )}
    </>
  );
}
