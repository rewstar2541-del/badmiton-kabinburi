-- คิวรอลงแยกแต่ละสนาม: แอดมินจัดคู่ถัดไปของสนามไว้ล่วงหน้า เกมในสนามจบแล้วคู่แรกในคิวลงต่อทันที
create table if not exists public.court_queue (
  id text primary key default (gen_random_uuid())::text,
  date date not null,
  court smallint not null,
  player_ids text[] not null check (cardinality(player_ids) = 4),
  at timestamptz not null default now()
);
create index if not exists court_queue_date on public.court_queue (date);
alter table public.court_queue enable row level security;
drop policy if exists court_queue_read on public.court_queue;
create policy court_queue_read on public.court_queue for select to anon, authenticated using (true);
drop policy if exists court_queue_admin on public.court_queue;
create policy court_queue_admin on public.court_queue for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on table public.court_queue to anon, authenticated;
grant insert, update, delete on table public.court_queue to authenticated;

-- ให้เครื่องอื่น (แอดมินอีกเครื่อง จอทีวี มือถือผู้เล่น) เห็นคิวทันที
do $$ begin
  alter publication supabase_realtime add table public.court_queue;
exception when duplicate_object then null;
end $$;
