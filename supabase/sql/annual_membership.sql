-- สมาชิกรายปี: วันเริ่ม/วันหมดอายุเก็บที่ผู้เล่น (ทุกคนอ่านได้ เพื่อให้ผู้เล่นเห็นสถานะตัวเองและบิลไม่คิดค่าสนาม)
-- ส่วนประวัติการจ่ายและยอดเงินแยกอีกตาราง เห็นเฉพาะแอดมิน
alter table public.players add column if not exists annual_from date;
alter table public.players add column if not exists annual_until date;

create table if not exists public.annual_payments (
  id text primary key default (gen_random_uuid())::text,
  player_id text not null references public.players(id) on delete cascade,
  paid_on date not null,
  from_date date not null,
  until_date date not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  check (until_date >= from_date)
);
create index if not exists annual_payments_player_idx on public.annual_payments (player_id);
alter table public.annual_payments enable row level security;
drop policy if exists annual_payments_admin on public.annual_payments;
create policy annual_payments_admin on public.annual_payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.annual_payments from anon;

-- กติกาวันหมดอายุตามยอดที่จ่าย (แอดมินตั้งเองในหน้าคิดเงิน > รายปี)
create table if not exists public.annual_rules (
  min_amount numeric primary key check (min_amount >= 0),
  end_month int not null check (end_month between 1 and 12),
  years_ahead int not null default 1 check (years_ahead between 0 and 5)
);
alter table public.annual_rules enable row level security;
drop policy if exists annual_rules_admin on public.annual_rules;
create policy annual_rules_admin on public.annual_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.annual_rules from anon;
-- ตั้งต้นตามที่ใช้อยู่: จ่าย 1,000 หมดอายุสิ้น มิ.ย. ปีหน้า / 2,000 ขึ้นไป หมดอายุสิ้น ธ.ค. ปีหน้า
insert into public.annual_rules(min_amount, end_month, years_ahead) values (1000, 6, 1), (2000, 12, 1) on conflict do nothing;
