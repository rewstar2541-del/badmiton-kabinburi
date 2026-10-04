-- ผู้เล่นยกเลิกเช็คอินเอง (กดผิด) ได้ถ้ายังไม่ได้เล่นและยังไม่จ่าย
-- p_cancel_signup = true: ยกเลิกลงชื่อด้วย (ไม่มาแล้ว)
create or replace function public.undo_my_check_in(p_player text, p_pin text, p_cancel_signup boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if exists (select 1 from games where date = d and p_player = any(player_ids)) then
    return 'เล่นไปแล้ว ยกเลิกเช็คอินไม่ได้ ให้แอดมินช่วย';
  end if;
  if exists (select 1 from checkins where date = d and player_id = p_player and paid_at is not null) then
    return 'จ่ายเงินแล้ว ยกเลิกเช็คอินไม่ได้ ให้แอดมินช่วย';
  end if;
  delete from checkins where date = d and player_id = p_player;
  if p_cancel_signup then
    delete from signups where date = d and player_id = p_player;
  end if;
  return null;
end $$;
grant execute on function public.undo_my_check_in(text, text, boolean) to anon, authenticated;
