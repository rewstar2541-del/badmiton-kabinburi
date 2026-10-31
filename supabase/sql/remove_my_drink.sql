-- ผู้เล่นลบค่าน้ำที่ตัวเองลงผิด (เฉพาะวันนี้ ยังไม่จ่าย และเป็นรายการที่ผู้เล่นลงเอง ไม่ใช่แอดมินลง)
alter table public.drinks add column if not exists added_by text not null default 'admin';

create or replace function public.add_my_drink(p_player text, p_pin text, p_amount integer, p_note text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare d date := (now() at time zone 'Asia/Bangkok')::date; err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_amount is null or p_amount not between 1 and 200 then return 'จำนวนเงินไม่ถูกต้อง'; end if;
  if not exists (select 1 from checkins where date = d and player_id = p_player) then return 'วันนี้ยังไม่ได้เช็คอิน'; end if;
  if (select count(*) from drinks where date = d and player_id = p_player) >= 10 then return 'เพิ่มค่าน้ำวันนี้ครบ 10 รายการแล้ว'; end if;
  insert into drinks(date, player_id, amount, note, added_by) values (d, p_player, p_amount, coalesce(nullif(left(trim(p_note), 40), ''), 'น้ำ'), 'self');
  return null;
end $$;

-- มีฟังก์ชันชื่อนี้อยู่แล้ว (ชื่อพารามิเตอร์ต่างกัน) ลบของเดิมก่อน
drop function if exists public.remove_my_drink(text, text, text);
create or replace function public.remove_my_drink(p_player text, p_pin text, p_drink text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if exists (select 1 from checkins where date = d and player_id = p_player and paid_at is not null) then
    return 'จ่ายแล้ว ลบค่าน้ำไม่ได้ บอกแอดมินให้แก้';
  end if;
  if exists (select 1 from drinks where id = p_drink and player_id = p_player and added_by <> 'self') then
    return 'รายการนี้แอดมินเป็นคนลง บอกแอดมินให้แก้';
  end if;
  delete from drinks where id = p_drink and player_id = p_player and date = d and added_by = 'self';
  if not found then return 'ลบค่าน้ำนี้ไม่ได้ (ลบได้เฉพาะของตัวเองวันนี้)'; end if;
  return null;
end $$;
revoke execute on function public.remove_my_drink(text, text, text) from public, anon, authenticated;
grant execute on function public.remove_my_drink(text, text, text) to anon, authenticated;
