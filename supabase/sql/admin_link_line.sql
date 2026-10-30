-- แอดมินผูก LINE ที่ยังไม่มีชื่อ เข้ากับชื่อในก๊วนเอง (ไม่ต้องรอผู้เล่นกดขอผูก)

-- LINE ที่เพิ่งเข้าสู่ระบบแล้วยังไม่ได้ผูกกับชื่อ (ย้อนหลัง 7 วัน)
create or replace function public.list_unlinked_lines()
returns table(line_user_id text, line_name text, picture text, last_seen timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then return; end if;
  return query
    select t.line_user_id, (array_agg(t.line_name order by t.expires_at desc))[1],
           (array_agg(t.picture order by t.expires_at desc))[1], max(t.expires_at)
    from line_link_tickets t
    where t.expires_at > now() - interval '7 days'
      and not exists (select 1 from player_auth a where a.line_user_id = t.line_user_id)
    group by t.line_user_id
    order by max(t.expires_at) desc
    limit 30;
end $$;

-- แอดมินผูก LINE นี้กับชื่อนี้ คืนข้อความผิดพลาด หรือ null
create or replace function public.admin_link_line(p_line_user text, p_player text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare pic text;
begin
  if not is_admin() then return 'ต้องเป็นแอดมิน'; end if;
  if not exists (select 1 from line_link_tickets where line_user_id = p_line_user) then return 'ไม่พบบัญชี LINE นี้'; end if;
  if exists (select 1 from player_auth where line_user_id = p_line_user) then return 'บัญชี LINE นี้ผูกกับผู้เล่นคนอื่นแล้ว'; end if;
  if not exists (select 1 from players where id = p_player and not pending and guest_of is null) then return 'ไม่พบผู้เล่น'; end if;
  if exists (select 1 from player_auth where player_id = p_player and line_user_id is not null) then
    return 'ชื่อนี้ผูกกับบัญชี LINE อื่นแล้ว';
  end if;
  insert into player_auth(player_id, line_user_id) values (p_player, p_line_user)
    on conflict (player_id) do update set line_user_id = excluded.line_user_id;
  select picture into pic from line_link_tickets where line_user_id = p_line_user and picture is not null order by expires_at desc limit 1;
  update players set photo = pic where id = p_player and photo is null and pic is not null and photo_ok(pic);
  update line_claims set status = case when line_user_id = p_line_user then 'approved' else 'rejected' end
    where (line_user_id = p_line_user or player_id = p_player) and status = 'pending';
  return null;
end $$;

revoke execute on function public.list_unlinked_lines() from public, anon;
revoke execute on function public.admin_link_line(text, text) from public, anon;
grant execute on function public.list_unlinked_lines() to authenticated;
grant execute on function public.admin_link_line(text, text) to authenticated;
