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
