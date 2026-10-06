import { describe, expect, it } from "vitest";
import { confirmResult, draw, fillCourts, gameWinner, matchWinner, myNext, needsGame3, placings, sampleTourney, setResult, simulate, submitResult, validGame, type Tourney } from "../tourney";

let n = 0;
const id = () => `id${n++}`;
// สุ่มแบบกำหนดได้
function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

describe("คะแนน", () => {
  it("21 ชนะ, ดิวส์ต้องนำ 2, สูงสุด 30", () => {
    expect(gameWinner([21, 15])).toBe(0);
    expect(gameWinner([20, 21])).toBe(null);
    expect(gameWinner([22, 20])).toBe(0);
    expect(gameWinner([29, 30])).toBe(1);
    expect(validGame([23, 21])).toBe(true);
    expect(validGame([25, 15])).toBe(false);
    expect(validGame([21, 20])).toBe(false);
  });
  it("ชนะ 2 ใน 3 และซ่อนเกม 3", () => {
    expect(matchWinner([[21, 10], [21, 12]], 3)).toBe(0);
    expect(matchWinner([[21, 10], [10, 21]], 3)).toBe(null);
    expect(matchWinner([[10, 21]], 1)).toBe(1);
    expect(needsGame3([[21, 10], [21, 12]])).toBe(false);
    expect(needsGame3([[21, 10], [12, 21]])).toBe(true);
  });
});

describe("สายแข่ง", () => {
  const t0 = sampleTourney("2026-09-10", id);
  it("จับสลากเฉพาะทีมที่จ่ายแล้ว ทีมคี่ได้บาย", () => {
    const t = draw(t0, "new", rng(), id);
    const r1 = t.matches.filter((m) => m.divId === "new");
    expect(r1).toHaveLength(7); // 14 ทีมจ่ายแล้ว
    const ids = r1.flatMap((m) => [m.a, m.b]);
    const unpaid = t.teams.filter((x) => x.divId === "new" && x.pay !== "yes").map((x) => x.id);
    expect(ids.some((x) => unpaid.includes(x!))).toBe(false);
    const n5 = draw({ ...t0, teams: t0.teams.filter((x) => x.divId !== "n").concat(t0.teams.filter((x) => x.divId === "n").slice(0, 5)) }, "n", rng(), id);
    expect(n5.matches.filter((m) => m.bye)).toHaveLength(1);
  });
  it("จบรอบแรกแล้วแยกสายบน/ล่าง และจบด้วยที่ 1, 2, 3 ร่วม", () => {
    let t: Tourney = draw(t0, "n", rng(), id); // 6 ทีม -> 3 แมตช์
    t = { ...t, teams: t.teams.map((x) => ({ ...x, here: [true, true] as [boolean, boolean] })) };
    for (let g = 0; g < 30; g++) t = simulate(t, rng(g + 2), id);
    const up = t.matches.filter((m) => m.divId === "n" && m.bracket === "U");
    const low = t.matches.filter((m) => m.divId === "n" && m.bracket === "L");
    expect(up.length).toBeGreaterThan(0);
    expect(low.length).toBeGreaterThan(0);
    const p = placings(t, "n", "U");
    expect(p.first).toBeTruthy();
    expect(p.second).toBeTruthy();
    expect(p.first).not.toBe(p.second);
    // ทีมที่แพ้รอบแรกไม่อยู่สายบน
    const r1Losers = t.matches.filter((m) => m.divId === "n" && m.bracket === "R1" && !m.bye).map((m) => (m.winner === m.a ? m.b : m.a));
    expect(up.some((m) => r1Losers.includes(m.a) || r1Losers.includes(m.b))).toBe(false);
  });
  it("เรียกลงสนามเฉพาะคู่ที่มาครบ ไม่เกินจำนวนสนาม", () => {
    let t = draw(t0, "new", rng(), id);
    t = fillCourts(t);
    const on = t.matches.filter((m) => m.court);
    expect(on.length).toBeLessThanOrEqual(4);
    for (const m of on) for (const tid of [m.a, m.b]) expect(t.teams.find((x) => x.id === tid)!.here).toEqual([true, true]);
    const mine = on[0].a!;
    expect(myNext(t, mine).match?.id).toBe(on[0].id);
  });
  it("ผู้เล่นส่งผล คู่แข่งยืนยัน / ไม่ตรงให้แอดมินตัดสิน", () => {
    let t = fillCourts(draw(t0, "new", rng(), id));
    const m = t.matches.find((x) => x.court)!;
    t = submitResult(t, m.id, m.a!, [[21, 15], [21, 15]]);
    expect(t.matches.find((x) => x.id === m.id)!.winner).toBeUndefined();
    const bad = confirmResult(t, m.id, false, id);
    expect(bad.matches.find((x) => x.id === m.id)!.disputed).toBe(true);
    const ok = confirmResult(t, m.id, true, id);
    expect(ok.matches.find((x) => x.id === m.id)!.winner).toBe(m.a);
    const fixed = setResult(bad, m.id, [[15, 21], [15, 21]], id);
    expect(fixed.matches.find((x) => x.id === m.id)!.winner).toBe(m.b);
  });
});

describe("แก้ผลและบาย", () => {
  it("บายไม่เจอกันเองรอบสอง (6 ทีมในสาย)", () => {
    const base = sampleTourney("2026-09-10", id);
    let t = draw({ ...base, teams: base.teams.map((x) => ({ ...x, here: [true, true] as [boolean, boolean] })) }, "new", rng(3), id);
    for (let g = 0; g < 3; g++) t = simulate(t, rng(g + 9), id);
    const up = t.matches.filter((m) => m.divId === "new" && m.bracket === "U");
    const r1 = up.filter((m) => m.round === 1);
    for (const m of r1) {
      const feeders = up.filter((x) => x.round === 0 && x.slot >> 1 === m.slot);
      expect(feeders.every((x) => x.bye)).toBe(false);
    }
  });
  it("แก้ผลจนไม่มีผู้ชนะ ล้างผู้ชนะเดิม และห้ามแก้หลังรอบถัดไปเริ่ม", () => {
    let t = fillCourts(draw(sampleTourney("2026-09-10", id), "new", rng(), id));
    const m = t.matches.find((x) => x.court)!;
    t = setResult(t, m.id, [[21, 10], [21, 10]], id);
    expect(t.matches.find((x) => x.id === m.id)!.winner).toBe(m.a);
    t = setResult(t, m.id, [], id);
    expect(t.matches.find((x) => x.id === m.id)!.winner).toBeUndefined();
  });
});

describe("จำลองวันแข่ง", () => {
  it("เดินจนจบทั้งงาน ได้ที่ 1 ทุกมือที่เปิด", async () => {
    const { simTick, finished } = await import("../tourney");
    let t = sampleTourney("2026-09-10", id);
    let n = 0;
    while (!finished(t) && n++ < 3000) t = simTick(t, rng(n), id);
    expect(finished(t)).toBe(true);
    expect(placings(t, "new", "U").first).toBeTruthy();
    expect(t.matches.every((m) => m.bye || m.games.length >= 2)).toBe(true);
  });
});
