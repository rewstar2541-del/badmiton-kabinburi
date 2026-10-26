-- คะแนนสะสมความขยัน: มาเล่นครบเดือนได้แต้ม แลกส่วนลดค่าลูกหรือน้ำฟรี
-- กติกา (จำนวนวัน แต้ม ราคาแลก) เก็บที่ตั้งค่า
alter table public.settings add column if not exists loyalty jsonb;
grant select (loyalty) on table public.settings to anon, authenticated;

-- สมุดแต้ม: kind = earn ได้จากเดือนที่มาครบ (date = วันแรกของเดือน)
--           kind = shuttle / drink แลกเป็นส่วนลดในบิลวันนั้น (amount = บาทที่ลด)
-- ทุกคนอ่านได้ (ผู้เล่นเห็นแต้มตัวเอง) เขียนได้เฉพาะแอดมิน
create table if not exists public.loyalty_points (
  id text primary key default (gen_random_uuid())::text,
  player_id text not null references public.players(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('earn', 'shuttle', 'drink')),
  points integer not null check (points > 0),
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_points_player_idx on public.loyalty_points (player_id);
alter table public.loyalty_points enable row level security;
drop policy if exists loyalty_points_read on public.loyalty_points;
create policy loyalty_points_read on public.loyalty_points for select to anon, authenticated using (true);
drop policy if exists loyalty_points_admin on public.loyalty_points;
create policy loyalty_points_admin on public.loyalty_points for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on table public.loyalty_points to anon;
grant all on table public.loyalty_points to authenticated;

-- อัปเดตทุกเครื่องแบบเรียลไทม์
do $$ begin
  alter publication supabase_realtime add table public.loyalty_points;
exception when duplicate_object then null;
end $$;
