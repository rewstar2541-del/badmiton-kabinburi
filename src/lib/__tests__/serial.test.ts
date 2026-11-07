import { describe, expect, it } from "vitest";
import { serial } from "../serial";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("serial", () => {
  it("งานถัดไปรองานก่อนหน้าเสร็จ แม้งานแรกช้ากว่า (จบเกมก่อนเริ่มเกมใหม่)", async () => {
    const run = serial();
    const log: string[] = [];
    const a = run(async () => {
      await wait(30);
      log.push("endGame");
    });
    const b = run(async () => {
      log.push("startGame");
    });
    await Promise.all([a, b]);
    expect(log).toEqual(["endGame", "startGame"]);
  });

  it("งานก่อนหน้าพัง งานถัดไปยังทำต่อ และแต่ละงานได้ผลของตัวเอง", async () => {
    const run = serial();
    const a = run(async () => {
      throw new Error("x");
    });
    const b = run(async () => 2);
    await expect(a).rejects.toThrow("x");
    await expect(b).resolves.toBe(2);
  });
});

describe("serial: คำขอค้าง", () => {
  it("งานค้างนานเกิน ไม่ขวางงานถัดไปตลอดไป", async () => {
    const run = serial(20);
    run(() => new Promise(() => {}));
    await expect(run(async () => "ok")).resolves.toBe("ok");
  });
});
