-- สิทธิ์สมาชิกรายปี: ลงชื่อล่วงหน้าได้ก่อนคนอื่น
-- open_signup_days = คนทั่วไปลงชื่อได้ไม่เกินกี่วันก่อนวันเล่น (null = ทุกคนลงได้เท่ากัน ไม่เปิดสิทธิ์)
-- สมาชิกรายปีลงได้ตั้งแต่แอดมินสร้างวันจัดก๊วน (ไม่เกิน 90 วันเหมือนเดิม)
alter table public.settings add column if not exists open_signup_days integer;
alter table public.settings drop constraint if exists settings_open_signup_days_check;
alter table public.settings add constraint settings_open_signup_days_check
  check (open_signup_days is null or (open_signup_days >= 0 and open_signup_days <= 90));

CREATE OR REPLACE FUNCTION public.sign_up_day(p_player text, p_pin text, p_date date, p_on boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
  n int := (select open_signup_days from settings where id = 1);
begin
  if err is not null then return err; end if;
  if p_date < d or p_date > d + 90 then return 'ลงชื่อล่วงหน้าได้ไม่เกิน 90 วัน'; end if;
  if exists (select 1 from closed_days where date = p_date) then return 'วันนี้งดเล่น'; end if;
  if not exists (select 1 from announcements where date = p_date) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  if p_on then
    if n is not null and p_date > d + n and not exists (
      select 1 from players where id = p_player and annual_until >= p_date and (annual_from is null or annual_from <= p_date)
    ) then
      return 'ช่วงนี้เปิดให้สมาชิกรายปีลงชื่อก่อน';
    end if;
    insert into signups(date, player_id) values (p_date, p_player) on conflict do nothing;
  else
    delete from signups where date = p_date and player_id = p_player;
  end if;
  return null;
end $function$
;
