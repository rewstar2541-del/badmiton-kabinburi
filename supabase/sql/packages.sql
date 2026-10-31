-- แพ็กเกจสมาชิก: แอดมินตั้งชื่อ ราคา และวันหมดอายุเอง ผู้เล่นเลือกแพ็ก โอน แนบสลิป แอดมินยืนยันแล้วตั้งสมาชิกให้
-- kind = 'monthly' ใช้ได้ถึงสิ้นเดือนที่จ่าย / 'term' ใช้ได้ถึง until_date (เช่นรายปี)
create table if not exists public.packages (
  id text primary key default (gen_random_uuid())::text,
  name text not null check (length(btrim(name)) between 1 and 60),
  price numeric not null check (price >= 0),
  kind text not null check (kind in ('monthly', 'term')),
  until_date date,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (kind <> 'term' or until_date is not null)
);
alter table public.packages enable row level security;
drop policy if exists packages_read on public.packages;
create policy packages_read on public.packages for select to anon, authenticated using (true);
drop policy if exists packages_admin on public.packages;
create policy packages_admin on public.packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on table public.packages to anon, authenticated;
grant insert, update, delete on table public.packages to authenticated;

-- ตั้งต้นจากค่ารายเดือนเดิม (ถ้ามีราคา) ให้ผู้เล่นรายเดือนยังจ่ายได้เหมือนเดิม
insert into public.packages(name, price, kind, sort)
select 'รายเดือน', monthly_fee, 'monthly', 0 from public.settings where id = 1 and monthly_fee > 0
  and not exists (select 1 from public.packages);

-- สลิปจำว่าโอนค่าแพ็กเกจไหน (ว่าง = ค่าเล่นรายวัน)
alter table public.slips add column if not exists package_id text;

drop function if exists public.submit_slip(text, text, numeric, text);
create or replace function public.submit_slip(p_player text, p_pin text, p_amount numeric, p_image text, p_package text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_image is null or p_image not like 'data:image/%' or length(p_image) >= 800000 then
    return 'รูปไม่ถูกต้องหรือใหญ่เกินไป';
  end if;
  if (select count(*) from slips where date = d and player_id = p_player and removed_at is null) >= 3 then
    return 'ส่งสลิปวันนี้ครบ 3 รูปแล้ว';
  end if;
  if p_package is not null and not exists (select 1 from packages where id = p_package) then
    return 'ไม่พบแพ็กเกจนี้ ลองโหลดหน้าใหม่';
  end if;
  insert into slips(date, player_id, amount, image, package_id) values (d, p_player, coalesce(p_amount, 0), p_image, p_package);
  return null;
end $$;
revoke execute on function public.submit_slip(text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.submit_slip(text, text, numeric, text, text) to anon, authenticated;

-- ข้อมูลส่วนตัวของผู้เล่น: ส่ง package_id ของสลิปด้วย (ให้เห็นว่าสลิปสมัครแพ็กรอตรวจอยู่)
create or replace function public.my_private(p_player text, p_token text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare ids text[];
begin
  if not exists (select 1 from player_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
                 and player_id = p_player and expires_at > now()) then
    return jsonb_build_object('error', 'กรุณาเข้าสู่ระบบใหม่');
  end if;
  ids := array(select p_player union select id from players where guest_of = p_player);
  return jsonb_build_object(
    'drinks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'player_id', player_id, 'amount', amount, 'note', note)) from drinks where player_id = any(ids)), '[]'),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'player_id', player_id, 'paid_at', paid_at, 'amount', amount)) from monthly_payments where player_id = p_player), '[]'),
    'slips', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'player_id', player_id, 'amount', amount, 'created_at', created_at, 'package_id', package_id)) from slips where player_id = p_player and removed_at is null), '[]')
  );
end $$;

-- realtime: ให้ทุกเครื่องเห็นแพ็กเกจใหม่ทันที
do $$ begin
  alter publication supabase_realtime add table public.packages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
