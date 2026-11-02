-- เปลี่ยนตัวระหว่างเกม (บาดเจ็บ เหนื่อย)
-- subs = [{ out, in, at, shuttles }] เรียงตามเวลา: คนออกจ่ายลูกถึงลูกที่ shuttles คนเข้าจ่ายลูกถัดไป
-- player_ids ยังเป็น 4 คนที่อยู่ในสนามตอนนี้ (ผลแพ้ชนะเป็นของคนที่เล่นจนจบ)
alter table public.games add column if not exists subs jsonb not null default '[]'::jsonb;

-- คนที่ถูกเปลี่ยนออกก็ถือว่าเล่นไปแล้ว ยกเลิกเช็คอินเองไม่ได้ (มีค่าลูกต้องจ่าย)
create or replace function public.undo_my_check_in(p_player text, p_pin text, p_cancel_signup boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if exists (
    select 1 from games
    where date = d
      and (p_player = any(player_ids) or subs @> jsonb_build_array(jsonb_build_object('out', p_player)))
  ) then
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
