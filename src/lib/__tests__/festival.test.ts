import { describe, expect, it } from "vitest";
import { activeFestival } from "../festival";

describe("ธีมเทศกาล", () => {
  it("อัตโนมัติตามวันที่", () => {
    expect(activeFestival("auto", "2026-10-31")).toBe("halloween");
    expect(activeFestival(undefined, "2026-12-25")).toBe("christmas");
    expect(activeFestival("auto", "2027-01-02")).toBe("newyear");
    expect(activeFestival("auto", "2027-04-13")).toBe("songkran");
    expect(activeFestival("auto", "2027-03-01")).toBeNull();
  });
  it("แอดมินเลือกเอง หรือปิด", () => {
    expect(activeFestival("songkran", "2026-10-31")).toBe("songkran");
    expect(activeFestival("off", "2026-10-31")).toBeNull();
  });
  it("วันเกิดสมาชิก: ขึ้นเองเมื่อไม่มีเทศกาล ปิดได้", () => {
    expect(activeFestival("auto", "2027-03-01", true)).toBe("birthday");
    expect(activeFestival("auto", "2026-10-31", true)).toBe("halloween");
    expect(activeFestival("off", "2027-03-01", true)).toBeNull();
  });
});
