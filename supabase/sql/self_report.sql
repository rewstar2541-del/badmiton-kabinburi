-- ผู้เล่นในสนามกดผลเกมเองได้ (ตอนแอดมินลงไปเล่นหมด)
-- ใครก็ได้ใน 4 คนกด "ทีมเราชนะ / เสมอ / ทีมเราแพ้" ผลมีผลทันที คู่ถัดไปลงสนามต่อเลย
-- อีกทีมกด "ไม่ตรง" ได้ภายใน 2 นาที เกมจะติดป้ายให้แอดมินมาแก้ (ไม่หยุดคิว)
alter table public.games add column if not exists reported_by text;
alter table public.games add column if not exists disputed_by text;

create or replace function public.report_game(p_player text, p_pin text, p_game text, p_result text, p_next text[] default null, p_queued text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
  g games%rowtype;
  mine text;
  w text;
begin
  if err is not null then return err; end if;
  if p_result not in ('win', 'draw', 'lose') then return 'ผลไม่ถูกต้อง'; end if;
  select * into g from games where id = p_game and date = d for update;
  if not found or not (p_player = any(g.player_ids)) then return 'กดผลได้เฉพาะเกมที่ตัวเองเล่นวันนี้'; end if;
  if g.ended_at is not null then return 'เกมนี้จบไปแล้ว'; end if;
  mine := case when array_position(g.player_ids, p_player) <= 2 then 'A' else 'B' end;
  w := case p_result when 'win' then mine when 'lose' then (case mine when 'A' then 'B' else 'A' end) end;
  update games set ended_at = now(), winner = w, draw = (p_result = 'draw'), reported_by = p_player where id = p_game;

  -- คู่ถัดไปลงสนามต่อ (เครื่องผู้เล่นจัดคู่ตามคิวแบบเดียวกับแอดมิน) ลงไม่ได้ก็ข้ามไป แอดมินจัดเองทีหลัง
  if p_next is null or cardinality(p_next) <> 4 then return null; end if;
  if (select count(distinct x) from unnest(p_next) x) <> 4 then return null; end if;
  if exists (select 1 from games where date = d and court = g.court and ended_at is null) then return null; end if;
  if exists (select 1 from games where date = d and ended_at is null and player_ids && p_next) then return null; end if;
  if (select count(*) from checkins where date = d and player_id = any(p_next) and paid_at is null and not coalesce(resting, false)) <> 4 then return null; end if;
  if p_queued is not null then
    delete from court_queue where id = p_queued and date = d and court = g.court and player_ids = p_next;
    if not found then return null; end if;
  end if;
  insert into games(date, court, player_ids, started_at, shuttles) values (d, g.court, p_next, now(), 1);
  return null;
end $$;
revoke execute on function public.report_game(text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.report_game(text, text, text, text, text[], text) to anon, authenticated;

create or replace function public.dispute_game(p_player text, p_pin text, p_game text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  err text := check_player_pin(p_player, p_pin);
  g games%rowtype;
begin
  if err is not null then return err; end if;
  select * into g from games where id = p_game for update;
  if not found or not (p_player = any(g.player_ids)) or g.reported_by is null or g.ended_at is null then return 'แจ้งไม่ตรงได้เฉพาะเกมที่ตัวเองเล่น'; end if;
  if (array_position(g.player_ids, p_player) <= 2) = (array_position(g.player_ids, g.reported_by) <= 2) then return 'ทีมเดียวกับคนกดผล แจ้งไม่ตรงไม่ได้'; end if;
  -- เผื่อเวลาเน็ตช้า 1 นาทีจาก 2 นาทีที่แสดงบนจอ
  if now() - g.ended_at > interval '3 minutes' then return 'เลยเวลาแจ้งแล้ว บอกแอดมินให้แก้ผล'; end if;
  update games set disputed_by = p_player where id = p_game;
  return null;
end $$;
revoke execute on function public.dispute_game(text, text, text) from public, anon, authenticated;
grant execute on function public.dispute_game(text, text, text) to anon, authenticated;
