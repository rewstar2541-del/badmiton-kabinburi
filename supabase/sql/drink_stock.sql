-- สต็อกน้ำ: นับจริงล่าสุด แล้วบวกขวดที่ซื้อ (รายจ่าย "ค่าเครื่องดื่ม") ลบค่าน้ำที่ลงหลังจากนั้น (1 รายการ = 1 ขวด)
-- รันซ้ำได้ ไม่ทับข้อมูลเดิม

-- เวลาที่ลงค่าน้ำ ใช้เทียบกับเวลานับสต็อก (แถวเก่าได้เวลาที่รันไฟล์นี้ ซึ่งอยู่ก่อนการนับครั้งแรกอยู่แล้ว)
alter table public.drinks add column if not exists created_at timestamptz not null default now();

-- จำนวนขวดที่ซื้อ (เฉพาะรายจ่ายค่าเครื่องดื่ม)
alter table public.expenses add column if not exists bottles integer;

create table if not exists public.drink_stock (
  id integer primary key default 1 check (id = 1),
  base integer not null default 0,
  counted_at timestamptz not null default now(),
  low integer not null default 12
);
alter table public.drink_stock enable row level security;
drop policy if exists drink_stock_admin on public.drink_stock;
create policy drink_stock_admin on public.drink_stock for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.drink_stock from anon;
grant all on table public.drink_stock to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.drink_stock;
exception when duplicate_object then null; end $$;
