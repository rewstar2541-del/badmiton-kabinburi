import { describe, expect, it } from "vitest";
import { cameSince, daysBefore, visibleRoster } from "../roster";
import type { Day, Player } from "../types";

const mk = (i: number): Player => ({ id: "p" + i, name: "คน" + i, level: 2 } as Player);

describe("roster", () => {
  const many = Array.from({ length: 150 }, (_, i) => mk(i));
  it("shows only relevant players in a big club until you search", () => {
    const keep = new Set(["p1", "p2"]);
    expect(visibleRoster(many, "", (p) => keep.has(p.id)).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(visibleRoster(many, "คน14", () => false).map((p) => p.id)).toEqual(["p14", ...Array.from({ length: 10 }, (_, i) => "p14" + i)]);
  });
  it("shows everyone in a small club", () => {
    expect(visibleRoster(many.slice(0, 5), "", () => false)).toHaveLength(5);
  });
  it("finds who came recently", () => {
    const days = [
      { date: "2026-08-01", checkIns: [{ playerId: "old" }] },
      { date: "2026-10-01", checkIns: [{ playerId: "new" }] },
    ] as unknown as Day[];
    expect([...cameSince(days, daysBefore("2026-10-04", 30))]).toEqual(["new"]);
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });
});
