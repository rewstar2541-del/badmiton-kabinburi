-- ให้คะแนนเกมหลังเล่น: ผู้เล่นกดดาว 1-5 ว่าเกมที่เพิ่งเล่นสูสี/สนุกแค่ไหน
-- เห็นเฉพาะแอดมิน (ใช้ดูว่าจัดคู่เกมไหนไม่เหมาะ) ผู้เล่นให้ได้เฉพาะเกมของตัวเองที่จบแล้ว ภายในวันนั้น แก้ได้
-- รันซ้ำได้ ไม่ทับของเดิม
create table if not exists public.game_ratings (
  game_id text not null references public.games(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  at timestamptz not null default now(),
  primary key (game_id, player_id)
);
alter table public.game_ratings enable row level security;
drop policy if exists game_ratings_admin on public.game_ratings;
create policy game_ratings_admin on public.game_ratings for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.game_ratings from anon;

create or replace function public.rate_game(p_player text, p_pin text, p_game text, p_stars int)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
  g games;
begin
  if err is not null then return err; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then return 'ให้คะแนน 1-5 ดาว'; end if;
  select * into g from games where id = p_game;
  if not found or g.ended_at is null or not (p_player = any(g.player_ids)) then
    return 'ให้คะแนนได้เฉพาะเกมที่เล่นจบแล้ว';
  end if;
  if g.date <> d then return 'ให้คะแนนได้เฉพาะเกมของวันนี้'; end if;
  insert into game_ratings (game_id, player_id, stars, at) values (p_game, p_player, p_stars, now())
    on conflict (game_id, player_id) do update set stars = excluded.stars, at = excluded.at;
  return null;
end $$;
revoke execute on function public.rate_game(text, text, text, int) from public;
grant execute on function public.rate_game(text, text, text, int) to anon, authenticated;

-- แอดมินเห็นคะแนนใหม่ทันทีโดยไม่ต้องรีเฟรช
do $$ begin
  alter publication supabase_realtime add table public.game_ratings;
exception when duplicate_object then null;
end $$;
