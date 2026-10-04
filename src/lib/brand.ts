import { t } from "./i18n";

/** ชื่อแอพ (ภาษาไทย ใช้ในไฟล์รายงานและหัวเว็บ) */
export const APP_NAME = ["แบดมินตันกบินทร์บุรี", "สวนน้อมเกล้า"] as const;

/** ชื่อแอพตามภาษาที่เลือก (Rew ให้เปลี่ยนภาษาทุกอย่างในแอพ 2026-10-04) */
export function appName(): [string, string] {
  return [t(APP_NAME[0]), t(APP_NAME[1])];
}
