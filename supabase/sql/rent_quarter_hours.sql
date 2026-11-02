-- สนามเช่าเริ่มไม่ตรงชั่วโมงได้ (เช่น 18:15, 18:30, 18:45) เก็บเวลาเป็นชั่วโมงทศนิยม เช่น 18.5 = 18:30
alter table public.announcements alter column rent_start type numeric(4,2);
alter table public.announcements alter column rent_end type numeric(4,2);
alter table public.checkins alter column from_hour type numeric(4,2);
alter table public.checkins alter column to_hour type numeric(4,2);
