-- กรอบรูปโปรไฟล์: ผู้เล่นเลือกใส่เอง (กรอบระดับมือตัวเอง หรือกรอบเทศกาลที่แอดมินแจก/ขายให้)
alter table public.players add column if not exists frame text;
alter table public.players add column if not exists frames text[] not null default '{}';

alter table public.players drop constraint if exists players_frame_check;
alter table public.players add constraint players_frame_check
  CHECK ((frame IS NULL) OR (frame = 'level') OR (frame = ANY (frames)));

-- ผู้เล่นเลือกกรอบของตัวเอง: ไม่ใส่ / กรอบระดับมือ / กรอบเทศกาลที่ได้รับแล้วเท่านั้น
CREATE OR REPLACE FUNCTION public.set_my_frame(p_player text, p_pin text, p_frame text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
  owned text[];
begin
  if err is not null then return err; end if;
  select frames into owned from players where id = p_player and guest_of is null;
  if not found then return 'ไม่พบผู้เล่น'; end if;
  if p_frame is not null and p_frame <> 'level' and not (p_frame = any (owned)) then return 'ยังไม่มีกรอบนี้'; end if;
  update players set frame = p_frame where id = p_player;
  return null;
end $function$
;

revoke execute on function public.set_my_frame(p_player text, p_pin text, p_frame text) from public, anon, authenticated;
grant execute on function public.set_my_frame(p_player text, p_pin text, p_frame text) to public, anon, authenticated;
