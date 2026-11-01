-- เบอร์สนาม: แอดมินตั้งเบอร์ตามสนามจริงได้ เช่น {3,5,7} หน้าสนามเรียงตามเบอร์
-- ว่าง (null) = เบอร์ 1..court_count แบบเดิม
alter table public.settings add column if not exists court_numbers smallint[]
  check (court_numbers is null or (cardinality(court_numbers) between 1 and 30 and 1 <= all(court_numbers) and 99 >= all(court_numbers)));
