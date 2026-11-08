import { describe, expect, it } from "vitest";
import { sessionFacts } from "../courtSplit";

describe("เวลาและสนามบนการ์ดหน้าแรก", () => {
  it("วันสนามเช่า: เวลาเริ่ม-เลิก และจำนวนคอร์ทของวันนั้น", () => {
    expect(sessionFacts({ rent: { start: 19, end: 21.5, courts: [2, 2, 2] } }, { courtCount: 2 })).toEqual({ time: "19:00-21:30", count: 2 });
    expect(sessionFacts({ rent: { start: 19, end: 22, courts: [4, 6, 6] } }, { courtCount: 2 })).toEqual({ time: "19:00-22:00", count: 6 });
  });

  it("ตั้งเบอร์สนามไว้: บอกเบอร์", () => {
    expect(sessionFacts({}, { courtCount: 3, courtNumbers: [7, 3, 5] })).toEqual({ numbers: [3, 5, 7] });
    expect(sessionFacts({ rent: { start: 19, end: 21, courts: [3, 3] } }, { courtCount: 3, courtNumbers: [3, 5, 7] })).toEqual({ time: "19:00-21:00", numbers: [3, 5, 7] });
  });

  it("วันเช่า 1 คอร์ท (ไม่มี courts) ไม่ใช้จำนวนในตั้งค่า", () => {
    expect(sessionFacts({ rent: { start: 19, end: 21 } }, { courtCount: 4 })).toEqual({ time: "19:00-21:00", count: 1 });
    expect(sessionFacts({ rent: { start: 19, end: 21 } }, { courtCount: 3, courtNumbers: [3, 5, 7] })).toEqual({ time: "19:00-21:00", count: 1 });
    expect(sessionFacts({ rent: { start: 19, end: 21, courts: [2, 3] } }, { courtCount: 3, courtNumbers: [3, 5, 7] })).toEqual({ time: "19:00-21:00", count: 3 });
  });

  it("ไม่มีสนามเช่าและไม่ได้ตั้งเบอร์: บอกจำนวนคอร์ท ไม่มีเวลา", () => {
    expect(sessionFacts({}, { courtCount: 2 })).toEqual({ count: 2 });
    expect(sessionFacts({}, { courtCount: 0 })).toEqual({});
  });
});
