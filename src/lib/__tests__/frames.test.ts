import { describe, expect, it } from "vitest";
import { FESTIVAL_FRAMES, frameOf, frameChoices, grantFrame, revokeFrame, isFrameId } from "../frames";
import { EMPTY_STATE, reducer } from "../state";
import type { Player } from "../types";

const P = (extra: Partial<Player> = {}): Player => ({ id: "a", name: "a", level: 3, ...extra });

describe("frameOf", () => {
  it("shows nothing until the player picks a frame", () => {
    expect(frameOf(P())).toBeNull();
  });
  it("the level frame follows the player's current level", () => {
    expect(frameOf(P({ frame: "level", level: 4 }))).toEqual({ kind: "level", level: 4 });
  });
  it("a festival frame shows only while the player still owns it", () => {
    expect(frameOf(P({ frame: "loykrathong", frames: ["loykrathong"] }))).toEqual({ kind: "festival", id: "loykrathong" });
    expect(frameOf(P({ frame: "loykrathong", frames: [] }))).toBeNull();
    expect(frameOf(P({ frame: "nope", frames: ["nope"] }))).toBeNull();
  });
  it("guests never show a frame", () => {
    expect(frameOf(P({ frame: "level", guestOf: "b" }))).toBeNull();
  });
});

describe("frameChoices", () => {
  it("offers no frame, the player's own level, then festival frames (owned ones unlocked)", () => {
    const list = frameChoices(P({ level: 2, frames: ["songkran"] }));
    expect(list[0]).toEqual({ value: null, locked: false });
    expect(list[1]).toEqual({ value: "level", locked: false });
    expect(list.slice(2).map((c) => [c.value, c.locked])).toEqual(FESTIVAL_FRAMES.map((f) => [f.id, f.id !== "songkran"]));
  });
});

describe("grant and revoke", () => {
  const run = (p: Player, a: ReturnType<typeof grantFrame> | ReturnType<typeof revokeFrame>) => reducer({ ...EMPTY_STATE, players: [p] }, a).players[0];
  it("adds a festival frame once and leaves the frame the player is wearing alone", () => {
    const p = run(run(P({ frame: "level" }), grantFrame(P(), "christmas")), grantFrame(P({ frames: ["christmas"] }), "christmas"));
    expect(p.frames).toEqual(["christmas"]);
    expect(p.frame).toBe("level");
  });
  it("taking a frame back also takes it off the avatar", () => {
    const worn = P({ frames: ["christmas", "newyear"], frame: "christmas" });
    const p = run(worn, revokeFrame(worn, "christmas"));
    expect(p.frames).toEqual(["newyear"]);
    expect(p.frame).toBeUndefined();
    const lvl = P({ frames: ["christmas"], frame: "level" });
    expect(run(lvl, revokeFrame(lvl, "christmas")).frame).toBe("level");
  });
  it("knows which ids are festival frames", () => {
    expect(isFrameId("halloween")).toBe(true);
    expect(isFrameId("level")).toBe(false);
  });
});
