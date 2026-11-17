-- ผู้เล่นกดผลเองแล้วเคารพ "เวลาก่อนลงสนาม" (settings.start_delay): ตั้งไว้แล้ว คู่ต่อไปขึ้นคิวเตรียมลงสนามแทนการลงทันที
-- ต้องรัน supabase/sql/start_delay.sql และ self_report.sql ก่อน แล้วรันไฟล์นี้ (รันซ้ำได้)
create or replace function public.report_game(p_player text, p_pin text, p_game text, p_result text, p_next text[] default null, p_queued text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
  g games%rowtype;
  mine text;
  w text;
  -- ไม่พังถ้ายังไม่ได้รัน start_delay.sql (ไม่มีคอลัมน์ = 0 = ลงทันที)
  delay int := coalesce((select (to_jsonb(s) ->> 'start_delay')::int from settings s where id = 1), 0);
begin
  if err is not null then return err; end if;
  if p_result not in ('win', 'draw', 'lose') then return 'ผลไม่ถูกต้อง'; end if;
  select * into g from games where id = p_game and date = d for update;
  if not found or not (p_player = any(g.player_ids)) then return 'กดผลได้เฉพาะเกมที่ตัวเองเล่นวันนี้'; end if;
  if g.ended_at is not null then return 'มีคนในสนามกดผลไปแล้ว'; end if;
  -- กันกดจบเกมทันทีหลังลงสนาม (วนเกมปั๊มสถิติ)
  if now() - g.started_at < interval '3 minutes' then return 'เพิ่งเริ่มเล่น รอให้เล่นจบก่อนแล้วค่อยกดผล'; end if;
  mine := case when array_position(g.player_ids, p_player) <= 2 then 'A' else 'B' end;
  w := case p_result when 'win' then mine when 'lose' then (case mine when 'A' then 'B' else 'A' end) end;
  update games set ended_at = now(), winner = w, draw = (p_result = 'draw'), reported_by = p_player where id = p_game;

  -- คู่ถัดไปลงสนามต่อ (เครื่องผู้เล่นจัดคู่ตามคิวแบบเดียวกับแอดมิน) ลงไม่ได้ก็ข้ามไป แอดมินจัดเองทีหลัง
  if p_next is null or cardinality(p_next) <> 4 then return null; end if;
  -- ทีละวัน กันสองสนามกดพร้อมกันแล้วได้คู่ถัดไปคู่เดียวกัน
  perform pg_advisory_xact_lock(hashtext('report_game:' || d::text));
  if (select count(distinct x) from unnest(p_next) x) <> 4 then return null; end if;
  if exists (select 1 from games where date = d and court = g.court and ended_at is null) then return null; end if;
  if exists (select 1 from games where date = d and ended_at is null and player_ids && p_next) then return null; end if;
  if (select count(*) from checkins where date = d and player_id = any(p_next) and paid_at is null and not coalesce(resting, false)) <> 4 then return null; end if;
  if p_queued is not null then
    -- คู่ที่แอดมินจัดไว้: ต้องเป็นคู่แรกในคิวของสนามนี้
    if p_queued <> (select id from court_queue where date = d and court = g.court order by at, id limit 1) then return null; end if;
    -- ตั้งเวลาก่อนลงสนามไว้ (start_delay <> 0): ปล่อยคู่นี้ไว้ในคิว แอดมินแก้คนได้ แล้วเครื่องแอดมินเริ่มเกมให้เมื่อครบเวลา
    if delay <> 0 then return null; end if;
    delete from court_queue where id = p_queued and date = d and court = g.court and player_ids = p_next;
    if not found then return null; end if;
  else
    -- คู่ที่ระบบจัดเอง: ทั้ง 4 คนต้องอยู่ในคิวรอ 8 อันดับแรก (เล่นน้อยได้ก่อน แล้วรอนานได้ก่อน แบบเดียวกับในแอพ)
    if (
      select count(*) from (
        select c.player_id
        from checkins c
        where c.date = d and c.paid_at is null and not coalesce(c.resting, false)
          and not exists (select 1 from games x where x.date = d and x.ended_at is null and c.player_id = any(x.player_ids))
          and not exists (select 1 from court_queue q where q.date = d and c.player_id = any(q.player_ids))
        order by
          (select count(*) from games x where x.date = d and c.player_id = any(x.player_ids)),
          greatest(c.at, (select max(x.ended_at) from games x where x.date = d and c.player_id = any(x.player_ids)))
        limit 8
      ) top where top.player_id = any(p_next)
    ) <> 4 then return null; end if;
  end if;
  -- ตั้งเวลาก่อนลงสนามไว้: ขึ้นคิว "เตรียมลงสนาม" ก่อน ยังไม่เริ่มเกม
  if delay <> 0 then
    insert into court_queue(date, court, player_ids, at) values (d, g.court, p_next, now());
    return null;
  end if;
  insert into games(date, court, player_ids, started_at, shuttles) values (d, g.court, p_next, now(), 1);
  return null;
end $$;
revoke execute on function public.report_game(text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.report_game(text, text, text, text, text[], text) to anon, authenticated;
