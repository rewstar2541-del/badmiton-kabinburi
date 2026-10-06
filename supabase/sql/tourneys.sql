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
    if check_player_pin(p_player, p_pin) is not null then raise exception 'ไม่มีสิทธิ์'; end if;
    if not coalesce(cur.data->'referees', '[]') ? p_player then raise exception 'เฉพาะกรรมการ'; end if;
    -- กรรมการแก้ได้แค่แมตช์ ห้ามแก้ทีม รายชื่อกรรมการ หรือข้อมูลงาน
    if (p_data - 'matches' - 'nextNo') is distinct from (cur.data - 'matches' - 'nextNo') then raise exception 'กรรมการแก้ได้แค่ผลแข่ง'; end if;
  end if;
  update tourneys set data = p_data, version = version + 1, updated_at = now()
    where id = p_id and version = p_version returning version into v;
  return coalesce(v, -1);
end $$;

-- ผู้เล่นทำได้เฉพาะเรื่องของทีมตัวเอง
create or replace function public.tourney_player(p_player text, p_pin text, p_id text, p_action text, p_arg jsonb default '{}')
returns text language plpgsql security definer set search_path to 'public' as $$
declare cur tourneys; d jsonb; err text; ti int; mi int; k int; tm jsonb; m jsonb; dv jsonb;
begin
  err := check_player_pin(p_player, p_pin);
  if err is not null then return err; end if;
  select * into cur from tourneys where id = p_id and active for update;
  if not found then return 'ไม่พบงานแข่ง'; end if;
  d := cur.data;
  select i - 1, t into ti, tm from jsonb_array_elements(d->'teams') with ordinality as x(t, i)
    where t->'playerIds' ? p_player limit 1;

  if p_action = 'signup' then
    if ti is not null then return 'คุณสมัครไว้แล้ว'; end if;
    if not (p_arg->'playerIds'->>0 = p_player) then return 'ข้อมูลไม่ถูกต้อง'; end if;
    select x into dv from jsonb_array_elements(d->'divisions') x where x->>'id' = p_arg->>'divId';
    if dv is null then return 'ไม่พบมือนี้'; end if;
    if coalesce((dv->>'drawn')::boolean, false) then return 'มือนี้จับสลากแล้ว'; end if;
    if (d->>'closeDate') < to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD') then return 'ปิดรับสมัครแล้ว'; end if;
    if (select count(*) from jsonb_array_elements(d->'teams') x where x->>'divId' = p_arg->>'divId') >= (dv->>'maxPairs')::int then return 'มือนี้เต็มแล้ว'; end if;
    if p_arg->'playerIds'->>1 is not null and exists (select 1 from jsonb_array_elements(d->'teams') x where x->'playerIds' ? (p_arg->'playerIds'->>1)) then
      return 'คู่ของคุณสมัครกับคนอื่นแล้ว';
    end if;
    tm := jsonb_build_object('id', p_arg->>'id', 'divId', p_arg->>'divId', 'names', p_arg->'names', 'playerIds', p_arg->'playerIds',
      'guest', coalesce(p_arg->'guest', 'false'), 'pay', 'no', 'here', '[false,false]'::jsonb);
    d := jsonb_set(d, '{teams}', (d->'teams') || jsonb_build_array(tm));
  elsif ti is null then
    return 'ยังไม่ได้สมัคร';
  elsif p_action = 'here' then
    k := case when tm->'playerIds'->>0 = p_player then 0 else 1 end;
    d := jsonb_set(d, array['teams', ti::text, 'here', k::text], 'true');
  elsif p_action = 'slip' then
    if length(p_arg->>'image') > 600000 then return 'รูปใหญ่เกินไป'; end if;
    insert into tourney_slips(team_id, tourney_id, image) values (tm->>'id', p_id, p_arg->>'image')
      on conflict (team_id) do update set image = excluded.image, at = now();
    if tm->>'pay' <> 'yes' then
      d := jsonb_set(jsonb_set(d, array['teams', ti::text, 'pay'], '"slip"'), array['teams', ti::text, 'slip'], '"db"');
    end if;
  elsif p_action in ('submit', 'confirm') then
    select i - 1, x into mi, m from jsonb_array_elements(d->'matches') with ordinality as y(x, i) where x->>'id' = p_arg->>'matchId';
    if m is null or m->>'winner' is not null then return 'แมตช์นี้จบแล้ว'; end if;
    if (tm->>'id') not in (m->>'a', m->>'b') then return 'ไม่ใช่แมตช์ของคุณ'; end if;
    if p_action = 'submit' then
      m := m || jsonb_build_object('games', p_arg->'games', 'pendingBy', tm->>'id', 'disputed', false, 'confirmed', false);
    else
      if m->>'pendingBy' is null or m->>'pendingBy' = tm->>'id' then return 'รออีกฝั่งกรอกผล'; end if;
      if (p_arg->>'ok')::boolean then m := m || '{"confirmed": true}'; else m := m || '{"disputed": true}'; end if;
    end if;
    d := jsonb_set(d, array['matches', mi::text], m);
  else
    return 'ไม่รู้จักคำสั่ง';
  end if;
  update tourneys set data = d, version = version + 1, updated_at = now() where id = p_id;
  return null;
end $$;

revoke all on function public.tourney_save(text, int, jsonb, text, text) from public;
grant execute on function public.tourney_save(text, int, jsonb, text, text) to anon, authenticated;
revoke all on function public.tourney_player(text, text, text, text, jsonb) from public;
grant execute on function public.tourney_player(text, text, text, text, jsonb) to anon, authenticated;
