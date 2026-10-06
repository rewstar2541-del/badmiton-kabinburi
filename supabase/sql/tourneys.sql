-- งานแข่ง: เก็บทั้งงานเป็น JSON 1 แถว (โครงสร้างเดียวกับ src/lib/tourney.ts)
create table if not exists public.tourneys (
  id text primary key,
  data jsonb not null,
  version int not null default 1,
  mode boolean not null default false,   -- วันนี้เป็นวันแข่ง: แอพเปลี่ยนเป็นหน้างานแข่ง
  active boolean not null default true,  -- false = จบงานแล้ว
  updated_at timestamptz not null default now()
);
alter table public.tourneys enable row level security;
drop policy if exists tourneys_read on public.tourneys;
create policy tourneys_read on public.tourneys for select using (true);
drop policy if exists tourneys_admin on public.tourneys;
create policy tourneys_admin on public.tourneys for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- สลิปแยกเก็บ เห็นเฉพาะแอดมิน
create table if not exists public.tourney_slips (
  team_id text primary key,
  tourney_id text not null references public.tourneys(id) on delete cascade,
  image text not null,
  at timestamptz not null default now()
);
alter table public.tourney_slips enable row level security;
drop policy if exists tourney_slips_admin on public.tourney_slips;
create policy tourney_slips_admin on public.tourney_slips for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.tourneys;
exception when duplicate_object then null; end $$;

-- แอดมินหรือกรรมการบันทึกทั้งงาน (กันเขียนทับกัน: ต้องส่ง version ล่าสุด, ชนกันคืน -1)
create or replace function public.tourney_save(p_id text, p_version int, p_data jsonb, p_player text default null, p_pin text default null)
returns int language plpgsql security definer set search_path to 'public' as $$
declare cur tourneys; v int;
begin
  select * into cur from tourneys where id = p_id;
  if not found then raise exception 'ไม่พบงานแข่ง'; end if;
  if not is_admin() then
    if not cur.active then raise exception 'งานนี้จบแล้ว'; end if;
    if check_player_pin(p_player, p_pin) is not null then raise exception 'ไม่มีสิทธิ์'; end if;
    if not coalesce(cur.data->'referees', '[]') ? p_player then raise exception 'เฉพาะกรรมการ'; end if;
    -- กรรมการแก้ได้แค่แมตช์ ห้ามแก้ทีม รายชื่อกรรมการ หรือข้อมูลงาน
    if (p_data - 'matches' - 'nextNo') is distinct from (cur.data - 'matches' - 'nextNo') then raise exception 'กรรมการแก้ได้แค่ผลแข่ง'; end if;
  end if;
  if p_data->>'id' is distinct from p_id then raise exception 'ข้อมูลไม่ถูกต้อง'; end if;
  update tourneys set data = p_data, version = version + 1, updated_at = now()
    where id = p_id and version = p_version returning version into v;
  return coalesce(v, -1);
end $$;

-- ผู้เล่นทำได้เฉพาะเรื่องของทีมตัวเอง: ดูตัวเต็มใน tourney_player.sql

revoke all on function public.tourney_save(text, int, jsonb, text, text) from public;
grant execute on function public.tourney_save(text, int, jsonb, text, text) to anon, authenticated;
revoke all on function public.tourney_player(text, text, text, text, jsonb) from public;
grant execute on function public.tourney_player(text, text, text, text, jsonb) to anon, authenticated;
