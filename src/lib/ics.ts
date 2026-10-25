import type { Day } from "./types";

/** อีเว้นหนึ่งวันที่จะใส่ลงปฏิทินในมือถือ (ทั้งวัน เพราะแอพไม่ได้เก็บเวลาเริ่ม) */
export interface CalItem {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  details?: string;
}

/** วันจัดก๊วนและอีเว้นพิเศษตั้งแต่วันนี้ไป ไม่รวมวันงดเล่น เรียงตามวัน */
export function upcomingSessions(days: Day[], closed: Record<string, string>, from: string): Day[] {
  return days
    .filter((d) => d.announcement !== undefined && d.date >= from && !(d.date in closed))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const compact = (date: string) => date.replaceAll("-", "");

/** วันถัดไป (ปฏิทินนับวันจบของอีเว้นทั้งวันแบบไม่รวมวันนั้น) */
function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10);
}

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** ตัดบรรทัดยาวเกิน 75 ไบต์ตามมาตรฐาน iCalendar โดยไม่ตัดกลางตัวอักษรไทย */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** ไฟล์ .ics ที่ Apple Calendar / Google Calendar นำเข้าได้ (UID ตามวัน ปฏิทินที่รองรับจะอัพเดทอีเว้นเดิมเมื่อนำเข้าซ้ำ) */
export function buildIcs(items: CalItem[], calName: string, stamp = new Date()): string {
  const now = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//badminton-kabinburi//calendar//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calName)}`,
    ...items.flatMap((it) => [
      "BEGIN:VEVENT",
      `UID:${compact(it.date)}@badminton-kabinburi`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compact(it.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(it.date))}`,
      `SUMMARY:${escape(it.title)}`,
      ...(it.details ? [`DESCRIPTION:${escape(it.details)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** ลิงก์เปิดหน้าเพิ่มอีเว้นใน Google Calendar (ไม่ต้องโหลดไฟล์ ใช้ได้ทั้ง Android และ iPhone) */
export function googleCalendarUrl(it: CalItem): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: it.title,
    dates: `${compact(it.date)}/${compact(nextDay(it.date))}`,
  });
  if (it.details) p.set("details", it.details);
  return `https://calendar.google.com/calendar/render?${p}`;
}
