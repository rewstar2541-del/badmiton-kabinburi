-- เช็คอินด้วย QR ที่สนาม: แอดมินเปิด QR ของวัน (สร้างรหัสสุ่มเก็บไว้ 1 แถว/วัน)
-- วันไหนมีรหัส ผู้เล่นต้องสแกน QR ที่สนามถึงเช็คอินเองได้ (กดเช็คอินจากที่บ้านไม่ได้) แอดมินยังเช็คอินให้ได้ตามปกติ
create table if not exists public.checkin_codes (
  date date primary key,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.checkin_codes enable row level security;
drop policy if exists checkin_codes_admin on public.checkin_codes;
create policy checkin_codes_admin on public.checkin_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.checkin_codes from anon;

create or replace function public.qr_check_in(p_player text, p_pin text, p_code text)
returns text language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare d date := (now() at time zone 'Asia/Bangkok')::date; err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if not exists (select 1 from checkin_codes where date = d and code = p_code) then
    return 'QR นี้หมดอายุหรือไม่ถูกต้อง ให้สแกน QR ที่สนามของวันนี้';
  end if;
  if not exists (select 1 from announcements where date = d) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  insert into checkins(date, player_id) values (d, p_player) on conflict do nothing;
  return null;
end $$;
revoke all on function public.qr_check_in(text, text, text) from public;
grant execute on function public.qr_check_in(text, text, text) to anon, authenticated;

-- self_service เดิม + วันที่เปิด QR แล้ว เช็คอินด้วยปุ่มในแอพไม่ได้
create or replace function public.self_service(p_player text, p_pin text, p_action text)
 returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_action in ('rest', 'unrest') then
    update checkins set resting = (p_action = 'rest') where date = d and player_id = p_player;
    if not found then return 'วันนี้ยังไม่ได้เช็คอิน'; end if;
    return null;
  end if;
  if p_action = 'pay' then
    update checkins set paid_at = now()
      where date <= d and paid_at is null
        and player_id in (select p_player union select id from players where guest_of = p_player);
    return null;
  end if;
  if p_action = 'payMonth' then
    insert into monthly_payments(month, player_id, paid_at) values (to_char(d, 'YYYY-MM'), p_player, now()) on conflict do nothing;
    return null;
  end if;
  if not exists (select 1 from announcements where date = d) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  if p_action = 'signUp' then
    insert into signups(date, player_id) values (d, p_player) on conflict do nothing;
  elsif p_action = 'cancelSignUp' then
    delete from signups where date = d and player_id = p_player;
  elsif p_action = 'checkIn' then
    if exists (select 1 from checkin_codes where date = d) then return 'วันนี้เช็คอินด้วยการสแกน QR ที่สนาม'; end if;
    insert into checkins(date, player_id) values (d, p_player) on conflict do nothing;
  else
    return 'คำสั่งไม่ถูกต้อง';
  end if;
  return null;
end $function$;
