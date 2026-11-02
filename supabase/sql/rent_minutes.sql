-- เวลาเช่า/เวลามา-กลับ ละเอียดถึงนาที (เก็บเป็นชั่วโมงทศนิยม 19.0167 = 19:01)
alter table public.announcements alter column rent_start type numeric(7,4);
alter table public.announcements alter column rent_end type numeric(7,4);
alter table public.checkins alter column from_hour type numeric(7,4);
alter table public.checkins alter column to_hour type numeric(7,4);
