-- เพศ: เพิ่มตัวเลือก LGBTQ+ (ค่า 'lgbtq') ข้อมูลเดิมไม่เปลี่ยน
alter table public.players drop constraint if exists players_gender_check;
alter table public.players add constraint players_gender_check check (gender = any (array['male', 'female', 'other', 'lgbtq']));

CREATE OR REPLACE FUNCTION public.register_player_line(p_ticket text, p_name text, p_gender text, p_level integer, p_photo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  uid text := ticket_line_user(p_ticket);
  pic text;
  pid text;
begin
  if uid is null then return jsonb_build_object('error', 'กรุณาเข้าสู่ระบบด้วย LINE ใหม่'); end if;
  if exists (select 1 from player_auth where line_user_id = uid) then
    return jsonb_build_object('error', 'บัญชี LINE นี้ผูกกับผู้เล่นคนอื่นแล้ว');
  end if;
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('error', 'กรุณาใส่ชื่อเล่น'); end if;
  if p_gender not in ('male', 'female', 'other', 'lgbtq') or p_level not between 1 and 6 then
    return jsonb_build_object('error', 'คำสั่งไม่ถูกต้อง');
  end if;
  if not photo_ok(p_photo) then return jsonb_build_object('error', 'รูปใหญ่เกินไป'); end if;
  if (select count(*) from players where pending) >= 30 then
    return jsonb_build_object('error', 'มีคนรออนุมัติเยอะ ลองใหม่ภายหลัง');
  end if;
  select picture into pic from line_link_tickets where line_user_id = uid and picture is not null order by expires_at desc limit 1;
  if not photo_ok(pic) then pic := null; end if;
  insert into players(name, gender, level, photo, pending)
    values (left(trim(p_name), 40), p_gender, p_level, coalesce(nullif(p_photo, ''), pic), true) returning id into pid;
  insert into player_auth(player_id, line_user_id) values (pid, uid)
    on conflict (player_id) do update set line_user_id = excluded.line_user_id;
  update line_claims set status = 'cancelled' where line_user_id = uid and status = 'pending';
  return jsonb_build_object('id', pid);
end $function$;

CREATE OR REPLACE FUNCTION public.update_my_profile(p_player text, p_pin text, p_name text, p_photo text, p_gender text, p_bio text, p_level integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
  cur int;
  nm text := btrim(coalesce(p_name, ''));
begin
  if err is not null then return err; end if;
  if nm = '' or length(nm) > 30 then return 'กรุณาใส่ชื่อเล่น (ไม่เกิน 30 ตัวอักษร)'; end if;
  if not photo_ok(p_photo) then return 'รูปไม่ถูกต้องหรือใหญ่เกินไป'; end if;
  if p_gender is not null and p_gender not in ('male','female','other','lgbtq') then return 'คำสั่งไม่ถูกต้อง'; end if;
  if p_level is null or p_level not between 1 and 6 then return 'คำสั่งไม่ถูกต้อง'; end if;
  select level into cur from players where id = p_player and guest_of is null;
  if not found then return 'ไม่พบผู้เล่น'; end if;
  update players set
    name = nm,
    photo = nullif(p_photo, ''),
    gender = p_gender,
    bio = nullif(left(btrim(coalesce(p_bio, '')), 200), ''),
    level_request = case when p_level = cur then null else p_level end
  where id = p_player;
  return null;
end $function$;
