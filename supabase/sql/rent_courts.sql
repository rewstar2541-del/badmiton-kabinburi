-- สนามเช่า: จำนวนคอร์ทแต่ละชั่วโมง (เริ่มจาก rent_start) เช่น {4,5,5} = 19-20 4 คอร์ท, 20-22 5 คอร์ท
-- มีค่านี้เมื่อไร rent_per_hour = ค่าเช่าต่อคอร์ทต่อชั่วโมง / ไม่มี (null) = ค่าเช่ารวมต่อชั่วโมงแบบเดิม
alter table public.announcements add column if not exists rent_courts smallint[];
