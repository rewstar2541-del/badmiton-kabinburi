-- ผู้เล่นทำได้เฉพาะเรื่องของทีมตัวเอง (สมัคร, มาถึง, ส่งสลิป, ส่ง/ยืนยันสกอร์)
create or replace function public.tourney_player(p_player text, p_pin text, p_id text, p_action text, p_arg jsonb default '{}')
returns text language plpgsql security definer set search_path to 'public' as $$
declare cur tourneys; d jsonb; err text; ti int; mi int; k int; tm jsonb; m jsonb; dv jsonb; p2 text; n1 text; n2 text;
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
    select x into dv from jsonb_array_elements(d->'divisions') x where x->>'id' = p_arg->>'divId';
    if dv is null then return 'ไม่พบมือนี้'; end if;
    if coalesce((dv->>'drawn')::boolean, false) then return 'มือนี้จับสลากแล้ว'; end if;
    if (d->>'closeDate') < to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD') then return 'ปิดรับสมัครแล้ว'; end if;
    if (select count(*) from jsonb_array_elements(d->'teams') x where x->>'divId' = p_arg->>'divId') >= (dv->>'maxPairs')::int then return 'มือนี้เต็มแล้ว'; end if;
    -- ชื่อมาจากตาราง players เสมอ id ทีมสร้างที่เซิร์ฟเวอร์
    select name into n1 from players where id = p_player;
    p2 := nullif(p_arg->'playerIds'->>1, '');
    if p2 is not null then
      if p2 = p_player then return 'ข้อมูลไม่ถูกต้อง'; end if;
      select name into n2 from players where id = p2 and not pending;
      if n2 is null then return 'ไม่พบคู่ของคุณ'; end if;
      if exists (select 1 from jsonb_array_elements(d->'teams') x where x->'playerIds' ? p2) then return 'คู่ของคุณสมัครกับคนอื่นแล้ว'; end if;
    else
      n2 := left(trim(coalesce(p_arg->'names'->>1, '')), 40);
      if n2 = '' then return 'ใส่ชื่อคู่ก่อน'; end if;
    end if;
    tm := jsonb_build_object('id', 'tm-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10), 'divId', dv->>'id',
      'names', jsonb_build_array(n1, n2), 'playerIds', case when p2 is null then jsonb_build_array(p_player) else jsonb_build_array(p_player, p2) end,
      'guest', p2 is null, 'pay', 'no', 'here', '[false,false]'::jsonb);
    d := jsonb_set(d, '{teams}', (d->'teams') || jsonb_build_array(tm));
  elsif ti is null then
    return 'ยังไม่ได้สมัคร';
  elsif p_action = 'here' then
    k := case when tm->'playerIds'->>0 = p_player then 0 else 1 end;
    d := jsonb_set(d, array['teams', ti::text, 'here', k::text], 'true');
  elsif p_action = 'slip' then
    if length(p_arg->>'image') > 600000 or p_arg->>'image' not like 'data:image/%' then return 'รูปไม่ถูกต้อง'; end if;
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
      if jsonb_typeof(p_arg->'games') <> 'array' or jsonb_array_length(p_arg->'games') not between 1 and 3
         or exists (select 1 from jsonb_array_elements(p_arg->'games') g
                    where jsonb_typeof(g) <> 'array' or jsonb_array_length(g) <> 2
                       or jsonb_typeof(g->0) <> 'number' or jsonb_typeof(g->1) <> 'number'
                       or (g->>0)::numeric not between 0 and 30 or (g->>1)::numeric not between 0 and 30) then
        return 'สกอร์ไม่ถูกต้อง';
      end if;
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
