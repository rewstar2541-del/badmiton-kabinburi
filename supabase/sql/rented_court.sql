-- สนามเช่ารายชั่วโมง: ตั้งตอนประกาศจัดก๊วน (เวลาเริ่ม-เลิก ค่าเช่าต่อชั่วโมง)
-- แต่ละชั่วโมงหารค่าเช่าให้คนที่อยู่ชั่วโมงนั้น ชั่วโมงที่อยู่ = ตั้งแต่ชั่วโมงที่เช็คอินถึงเลิก (ผู้เล่น/แอดมินแก้ได้)
alter table public.announcements add column if not exists rent_start smallint check (rent_start between 0 and 23);
alter table public.announcements add column if not exists rent_end smallint check (rent_end between 1 and 24);
alter table public.announcements add column if not exists rent_per_hour integer check (rent_per_hour >= 0);
alter table public.checkins add column if not exists from_hour smallint check (from_hour between 0 and 23);
alter table public.checkins add column if not exists to_hour smallint check (to_hour between 1 and 24);

create or replace function public.set_my_hours(p_player text, p_pin text, p_from integer, p_to integer)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
  r record;
begin
  if err is not null then return err; end if;
  select rent_start, rent_end into r from announcements where date = d;
  if r.rent_start is null then return 'วันนี้ไม่ใช่สนามเช่า'; end if;
  if p_from is null or p_to is null or p_from < r.rent_start or p_to > r.rent_end or p_to <= p_from then
    return 'เวลาไม่ถูกต้อง';
  end if;
  if exists (select 1 from checkins where date = d and player_id = p_player and paid_at is not null) then
    return 'จ่ายแล้ว แก้เวลาไม่ได้ บอกแอดมินให้แก้';
  end if;
  update checkins set from_hour = p_from, to_hour = p_to where date = d and player_id = p_player;
  if not found then return 'วันนี้ยังไม่ได้เช็คอิน'; end if;
  return null;
end $$;
revoke execute on function public.set_my_hours(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.set_my_hours(text, text, integer, integer) to anon, authenticated;
