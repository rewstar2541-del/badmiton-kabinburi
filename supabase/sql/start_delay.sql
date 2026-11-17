-- เวลาก่อนลงสนาม (วินาที): กดผลแล้วคู่ต่อไปขึ้น "เตรียมลงสนาม" ก่อน แอดมินแก้คนได้ ครบเวลาแล้วเริ่มเกมเอง
-- ถ้าอยากให้ผู้เล่นกดผลเองเคารพเวลานี้ด้วย ให้รัน supabase/sql/report_game_delay.sql ต่อ (ไม่รัน = ผู้เล่นกดผลแล้วคู่ต่อไปยังลงทันที)
-- 0 = ลงทันที (แบบเดิม), -1 = รอแอดมินกด "ลงสนาม" เอง
alter table public.settings add column if not exists start_delay smallint not null default 20 check (start_delay between -1 and 600);
