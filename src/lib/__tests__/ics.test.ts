import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, upcomingSessions } from "../ics";
import type { Day } from "../types";

const day = (date: string, extra: Partial<Day> = {}): Day => ({ date, checkIns: [], games: [], drinks: [], ...extra });

describe("ส่งออกปฏิทิน", () => {
  it("เอาเฉพาะวันจัดก๊วนที่ยังไม่ผ่าน และไม่ใช่วันงดเล่น", () => {
    const days = [
      day("2026-10-30", { announcement: "" }),
      day("2026-10-20", { announcement: "" }),
      day("2026-10-27"),
      day("2026-10-26", { announcement: "", announcementTitle: "กินเลี้ยง" }),
      day("2026-10-28", { announcement: "" }),
    ];
    const got = upcomingSessions(days, { "2026-10-28": "สนามปิด" }, "2026-10-25").map((d) => d.date);
    expect(got).toEqual(["2026-10-26", "2026-10-30"]);
  });

  it("สร้างไฟล์ .ics เป็นอีเว้นทั้งวัน ข้ามเดือนได้", () => {
    const ics = buildIcs([{ date: "2026-10-31", title: "🏸 ตีก๊วน, ปกติ", details: "คนละ 50\nเอาเสื้อมา" }], "ก๊วน", new Date("2026-10-25T16:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261101\r\n");
    expect(ics).toContain("UID:20261031@badminton-kabinburi");
    expect(ics).toContain("DTSTAMP:20261025T160000Z");
    expect(ics).toContain("SUMMARY:🏸 ตีก๊วน\\, ปกติ");
    expect(ics).toContain("DESCRIPTION:คนละ 50\\nเอาเสื้อมา");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("ตัดบรรทัดยาวไม่เกิน 75 ไบต์ และต่อกลับได้ข้อความเดิม", () => {
    const long = "ทำความสะอาดสนามและกินเลี้ยงปีใหม่ ".repeat(5);
    const ics = buildIcs([{ date: "2026-12-31", title: long }], "ก๊วน");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${long}`);
  });

  it("ลิงก์ Google Calendar", () => {
    const url = new URL(googleCalendarUrl({ date: "2026-10-26", title: "กินเลี้ยง", details: "คนละ 100" }));
    expect(url.host).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261026/20261027");
    expect(url.searchParams.get("text")).toBe("กินเลี้ยง");
    expect(url.searchParams.get("details")).toBe("คนละ 100");
  });
});
