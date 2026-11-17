-- มือตึงล้วน (กติกาจัดคู่หลังบ้าน ไม่แจ้งผู้เล่น): ระดับ level ขึ้นไป ตั้งแต่เกมที่ fromGame ของวัน ลงกับมือตึงด้วยกันทั้ง 4 คน
-- รอเกิน waitMin นาทีแล้วยังไม่ได้ลง = ลงกับระดับต่ำลงมาได้ตามเพดานปกติ
-- level: 4 = S, 5 = P (ดู LEVELS ในโค้ด) / รันซ้ำได้ ไม่ลบข้อมูลเดิม
alter table public.settings add column if not exists strong_group jsonb not null
  default '{"on": true, "level": 4, "fromGame": 2, "waitMin": 10}'::jsonb;
