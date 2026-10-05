"use client";

import { useState } from "react";
import { RankingCard } from "./Ranking";
import { YearSummaryView } from "./YearSummary";

/** ตารางอันดับ + ปุ่มเปิดสรุปก๊วนรายปี (เต็มจอ) */
export function ClubCorner() {
  const [year, setYear] = useState(false);
  return (
    <>
      <RankingCard onYear={() => setYear(true)} />
      {year && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-zinc-100 px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <YearSummaryView onClose={() => setYear(false)} />
        </div>
      )}
    </>
  );
}
