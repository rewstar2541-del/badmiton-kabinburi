-- รายการน้ำที่ขาย: แอดมินตั้งชื่อกับราคาไว้ครั้งเดียว (เช่น น้ำเปล่า 10, เกลือแร่ 20)
-- แอดมินและผู้เล่นกดเพิ่มในบิลได้เลย ไม่ต้องพิมพ์ชื่อ/ราคาใหม่ทุกครั้ง
-- เก็บเป็น [{"name": "น้ำเปล่า", "price": 10}, ...] ไม่เพิ่ม/ลบข้อมูลเดิม รันซ้ำได้
alter table public.settings add column if not exists drink_menu jsonb not null default '[]'::jsonb;

-- ผู้เล่นเพิ่มค่าน้ำเองได้เฉพาะก่อนจ่าย (จ่ายแล้วบิลปิด ค่าน้ำที่เพิ่มทีหลังจะไม่ถูกเก็บ)
-- ฉบับเดียวกับใน schema.sql เพิ่มเช็คจ่ายแล้ว
create or replace function public.add_my_drink(p_player text, p_pin text, p_amount integer, p_note text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare d date := (now() at time zone 'Asia/Bangkok')::date; err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_amount is null or p_amount not between 1 and 200 then return 'จำนวนเงินไม่ถูกต้อง'; end if;
  if not exists (select 1 from checkins where date = d and player_id = p_player) then return 'วันนี้ยังไม่ได้เช็คอิน'; end if;
  if exists (select 1 from checkins where date = d and player_id = p_player and paid_at is not null) then return 'จ่ายแล้ว เพิ่มค่าน้ำไม่ได้ บอกแอดมิน'; end if;
  if (select count(*) from drinks where date = d and player_id = p_player) >= 10 then return 'เพิ่มค่าน้ำวันนี้ครบ 10 รายการแล้ว'; end if;
  insert into drinks(date, player_id, amount, note, added_by) values (d, p_player, p_amount, coalesce(nullif(left(trim(p_note), 40), ''), 'น้ำ'), 'self');
  return null;
end $$;
