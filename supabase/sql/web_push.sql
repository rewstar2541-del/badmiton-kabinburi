-- แจ้งเตือนเด้งในมือถือ (Web Push) เมื่ออีก 1 เกมจะถึงคิว
-- ส่งจากเซิร์ฟเวอร์ของเว็บ (Vercel: /api/push) ด้วย secret key ของ Supabase ไม่ใช้ LINE ไม่มีค่าใช้จ่าย

-- สวิตช์ของแอดมิน (แถวเดียว) ทุกคนอ่านได้ แอดมินแก้ได้
create table if not exists public.push_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true
);
insert into public.push_settings (id) values (1) on conflict do nothing;
alter table public.push_settings enable row level security;
drop policy if exists push_settings_read on public.push_settings;
create policy push_settings_read on public.push_settings for select to anon, authenticated using (true);
drop policy if exists push_settings_admin on public.push_settings;
create policy push_settings_admin on public.push_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on table public.push_settings to anon, authenticated;
grant update on table public.push_settings to authenticated;

-- เครื่องที่ผู้เล่นเปิดรับแจ้งเตือน (1 คนมีได้หลายเครื่อง) ไม่มี policy = อ่าน/เขียนตรงไม่ได้ ใช้ผ่านฟังก์ชันด้านล่างและเซิร์ฟเวอร์เท่านั้น
create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) < 1000),
  player_id text not null references public.players(id) on delete cascade,
  p256dh text not null check (length(p256dh) < 200),
  auth text not null check (length(auth) < 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_player on public.push_subscriptions (player_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

-- กันส่งซ้ำ: 1 เรื่องต่อคนต่อวัน (key เช่น turn:2 = ตาที่ 3 ของวัน)
create table if not exists public.push_sent (
  date date not null,
  player_id text not null,
  key text not null,
  at timestamptz not null default now(),
  primary key (date, player_id, key)
);
alter table public.push_sent enable row level security;
revoke all on table public.push_sent from anon, authenticated;

-- ผู้เล่นเปิดรับแจ้งเตือนบนเครื่องนี้ (ต้องเข้าสู่ระบบอยู่) เครื่องเดิมเปลี่ยนคนได้
create or replace function public.push_subscribe(p_player text, p_pin text, p_endpoint text, p_p256dh text, p_auth text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if coalesce(p_endpoint, '') not like 'https://%' or length(p_endpoint) >= 1000
     or coalesce(length(p_p256dh), 0) not between 1 and 199 or coalesce(length(p_auth), 0) not between 1 and 99 then
    return 'ข้อมูลการแจ้งเตือนไม่ถูกต้อง';
  end if;
  if (select count(*) from push_subscriptions where player_id = p_player and endpoint <> p_endpoint) >= 5 then
    delete from push_subscriptions where endpoint in (
      select endpoint from push_subscriptions where player_id = p_player order by created_at limit 1);
  end if;
  insert into push_subscriptions (endpoint, player_id, p256dh, auth) values (p_endpoint, p_player, p_p256dh, p_auth)
  on conflict (endpoint) do update set player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  return null;
end $$;
revoke execute on function public.push_subscribe(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text, text, text) to anon, authenticated;

-- ปิดแจ้งเตือนบนเครื่องนี้ (รู้ endpoint ของเครื่องตัวเองเท่านั้นถึงลบได้)
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path to 'public' as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;
revoke execute on function public.push_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

-- แอดมินดูว่ามีผู้เล่นเปิดรับแจ้งเตือนกี่คน
create or replace function public.push_count()
returns integer language sql stable security definer set search_path to 'public' as $$
  select case when is_admin() then (select count(distinct player_id)::int from push_subscriptions) end;
$$;
revoke execute on function public.push_count() from public, anon, authenticated;
grant execute on function public.push_count() to authenticated;
