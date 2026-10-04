import { describe, expect, it } from "vitest";
import { cameSince, daysBefore, rosterCompare, visibleRoster, visitCounts, type RosterSort } from "../roster";
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

describe("roster sort", () => {
  const a = { id: "a", name: "ก้อง", level: 5 } as Player;
  const b = { id: "b", name: "ขวัญ", level: 1 } as Player;
  const c = { id: "c", name: "คิม", level: 6 } as Player;
  const days = [
    { date: "2026-08-01", checkIns: [{ playerId: "a" }], games: [], drinks: [] },
    { date: "2026-09-20", checkIns: [{ playerId: "b" }, { playerId: "c" }], games: [], drinks: [] },
    { date: "2026-09-27", checkIns: [{ playerId: "b" }], games: [], drinks: [] },
  ] as unknown as Day[];
  const counts = visitCounts(days, "2026-09-04");
  it("counts visits in the window only", () => {
    expect([counts.get("a"), counts.get("b"), counts.get("c")]).toEqual([undefined, 2, 1]);
  });
  it("sorts by visits, level and name", () => {
    const ids = (s: RosterSort) => [c, a, b].sort(rosterCompare(s, counts)).map((p) => p.id);
    expect(ids("often")).toEqual(["b", "c", "a"]);
    expect(ids("level")).toEqual(["a", "c", "b"]);
    expect(ids("name")).toEqual(["a", "b", "c"]);
  });
});
