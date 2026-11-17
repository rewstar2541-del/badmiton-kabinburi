-- เวลาก่อนลงสนาม (วินาที): กดผลแล้วคู่ต่อไปขึ้น "เตรียมลงสนาม" ก่อน แอดมินแก้คนได้ ครบเวลาแล้วเริ่มเกมเอง
-- 0 = ลงทันที (แบบเดิม), -1 = รอแอดมินกด "ลงสนาม" เอง
alter table public.settings add column if not exists start_delay smallint not null default 20 check (start_delay between -1 and 600);
