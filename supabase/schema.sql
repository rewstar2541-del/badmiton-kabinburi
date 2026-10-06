-- สแนปช็อตโครงสร้างฐานข้อมูล (schema public) ดึงจากฐานข้อมูลจริงเมื่อ 2026-10-05 — ไฟล์อ้างอิงแบบอ่านอย่างเดียว ใช้สร้างฐานข้อมูลใหม่หากข้อมูลหาย ไม่มีการรันอัตโนมัติ
-- Schema snapshot (schema public) taken 2026-10-05 from the live Supabase DB (project hhwvocerzkkbbyozbdso) — read-only reference for rebuilding the database if lost; it is NOT run automatically.
-- Table data is not included. Requires the extensions below (installed in schema "extensions" on Supabase;
-- defaults such as gen_random_bytes() rely on "extensions" being on the search_path, as it is on Supabase).
--
-- Order: extensions -> tables (columns + primary/unique keys) -> indexes -> functions
--        -> check / foreign-key constraints (board_posts_photo_check calls photo_ok())
--        -> row level security -> triggers -> policies -> function grants -> realtime publication.

-- ============================================================
-- Extensions (as installed on the live DB)
-- ============================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
-- (plpgsql is built in)

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.admins (
  email text not null,
  constraint admins_pkey PRIMARY KEY (email)
);

create table if not exists public.announcements (
  date date not null,
  message text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  title text,
  fee integer,
  cap integer,
  constraint announcements_pkey PRIMARY KEY (date)
);

create table if not exists public.board_posts (
  id text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  player_id text not null,
  kind text not null,
  title text not null,
  detail text,
  price integer,
  photo text,
  created_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone,
  has_photo boolean generated always as (photo IS NOT NULL) stored,
  removed boolean default false not null,
  constraint board_posts_pkey PRIMARY KEY (id)
);

create table if not exists public.checkins (
  date date not null,
  player_id text not null,
  at timestamp with time zone default now() not null,
  paid_at timestamp with time zone,
  resting boolean default false not null,
  court_fee numeric,
  shuttle_fee numeric,
  constraint checkins_pkey PRIMARY KEY (date, player_id)
);

create table if not exists public.closed_days (
  date date not null,
  reason text default ''::text not null,
  constraint closed_days_pkey PRIMARY KEY (date)
);

create table if not exists public.day_prices (
  date date not null,
  court_fee numeric not null,
  first_shuttle_fee numeric not null,
  next_shuttle_fee numeric not null,
  constraint day_prices_pkey PRIMARY KEY (date)
);

create table if not exists public.drinks (
  id text default (gen_random_uuid())::text not null,
  date date not null,
  player_id text not null,
  amount integer not null,
  note text default 'น้ำ'::text not null,
  constraint drinks_pkey PRIMARY KEY (id)
);

create table if not exists public.event_photos (
  id uuid default gen_random_uuid() not null,
  date date not null,
  path text not null,
  caption text,
  created_at timestamp with time zone default now() not null,
  constraint event_photos_pkey PRIMARY KEY (id)
);

create table if not exists public.expenses (
  id text not null,
  date date not null,
  category text not null,
  amount integer not null,
  note text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  shuttles integer,
  constraint expenses_pkey PRIMARY KEY (id)
);

create table if not exists public.games (
  id text default (gen_random_uuid())::text not null,
  date date not null,
  court smallint not null,
  player_ids text[] not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  shuttles smallint default 1 not null,
  winner text,
  constraint games_pkey PRIMARY KEY (id)
);

create table if not exists public.line_claims (
  line_user_id text not null,
  player_id text not null,
  line_name text,
  picture text,
  created_at timestamp with time zone default now() not null,
  status text default 'pending'::text not null,
  constraint line_claims_pkey PRIMARY KEY (line_user_id)
);

create table if not exists public.line_link_tickets (
  ticket_hash text not null,
  line_user_id text not null,
  line_name text,
  expires_at timestamp with time zone default (now() + '00:30:00'::interval) not null,
  picture text,
  constraint line_link_tickets_pkey PRIMARY KEY (ticket_hash)
);

create table if not exists public.line_prefs (
  player_id text not null,
  turn boolean default true not null,
  announce boolean default true not null,
  constraint line_prefs_pkey PRIMARY KEY (player_id)
);

create table if not exists public.line_settings (
  id integer default 1 not null,
  group_id text,
  notify_signup boolean default true not null,
  notify_turn boolean default true not null,
  hook_secret text default encode(gen_random_bytes(24), 'hex'::text) not null,
  notify_turn_personal boolean default true not null,
  link_code text,
  link_code_expires timestamp with time zone,
  notify_announce boolean default false not null,
  monthly_limit integer default 300 not null,
  turn_reserve integer default 100 not null,
  oa_basic_id text,
  last_error text,
  last_error_at timestamp with time zone,
  constraint line_settings_pkey PRIMARY KEY (id)
);

create table if not exists public.line_usage (
  month text not null,
  sent integer default 0 not null,
  turn integer default 0 not null,
  announce integer default 0 not null,
  skipped integer default 0 not null,
  constraint line_usage_pkey PRIMARY KEY (month)
);

create table if not exists public.monthly_payments (
  month text not null,
  player_id text not null,
  paid_at timestamp with time zone default now() not null,
  amount integer,
  constraint monthly_payments_pkey PRIMARY KEY (month, player_id)
);

create table if not exists public.notices (
  id text not null,
  kind text default 'news'::text not null,
  title text not null,
  body text,
  until date,
  created_at timestamp with time zone default now() not null,
  constraint notices_pkey PRIMARY KEY (id)
);

create table if not exists public.pair_requests (
  id text not null,
  date date not null,
  from_id text not null,
  to_id text not null,
  status text default 'pending'::text not null,
  at timestamp with time zone default now() not null,
  constraint pair_requests_pkey PRIMARY KEY (id)
);

create table if not exists public.player_auth (
  player_id text not null,
  pin_hash text,
  fails integer default 0 not null,
  locked_until timestamp with time zone,
  line_user_id text,
  constraint player_auth_line_user_id_key UNIQUE (line_user_id),
  constraint player_auth_pkey PRIMARY KEY (player_id)
);

create table if not exists public.player_contacts (
  player_id text not null,
  phone text not null,
  constraint player_contacts_pkey PRIMARY KEY (player_id)
);

create table if not exists public.player_sessions (
  token_hash text not null,
  player_id text not null,
  expires_at timestamp with time zone default (now() + '180 days'::interval) not null,
  constraint player_sessions_pkey PRIMARY KEY (token_hash)
);

create table if not exists public.players (
  id text default (gen_random_uuid())::text not null,
  name text not null,
  photo text,
  gender text,
  level smallint default 3 not null,
  created_at timestamp with time zone default now() not null,
  prefer text[] default '{}'::text[] not null,
  avoid text[] default '{}'::text[] not null,
  guest_of text,
  pending boolean default false not null,
  plan text,
  bio text,
  level_request integer,
  birthday text,
  constraint players_pkey PRIMARY KEY (id)
);

create table if not exists public.poll_votes (
  poll_id text not null,
  player_id text not null,
  dates date[] default '{}'::date[] not null,
  at timestamp with time zone default now() not null,
  constraint poll_votes_pkey PRIMARY KEY (poll_id, player_id)
);

create table if not exists public.polls (
  id text not null,
  question text not null,
  dates date[] not null,
  created_at timestamp with time zone default now() not null,
  chosen date,
  closed boolean default false not null,
  constraint polls_pkey PRIMARY KEY (id)
);

create table if not exists public.settings (
  id smallint default 1 not null,
  court_count smallint default 4 not null,
  court_fee integer default 40 not null,
  first_shuttle_fee integer default 30 not null,
  next_shuttle_fee integer default 25 not null,
  monthly_fee integer default 150 not null,
  promptpay_id text default ''::text not null,
  constraint settings_pkey PRIMARY KEY (id)
);

create table if not exists public.shuttle_stock (
  id integer default 1 not null,
  base integer default 0 not null,
  counted_at timestamp with time zone default now() not null,
  low integer default 12 not null,
  constraint shuttle_stock_pkey PRIMARY KEY (id)
);

create table if not exists public.signups (
  date date not null,
  player_id text not null,
  at timestamp with time zone default now() not null,
  constraint signups_pkey PRIMARY KEY (date, player_id)
);

create table if not exists public.slips (
  id uuid default gen_random_uuid() not null,
  date date not null,
  player_id text not null,
  amount numeric default 0 not null,
  image text not null,
  created_at timestamp with time zone default now() not null,
  removed_at timestamp with time zone,
  constraint slips_pkey PRIMARY KEY (id)
);

create table if not exists public.translations (
  src text not null,
  lang text not null,
  "out" text not null,
  created_at timestamp with time zone default now() not null,
  constraint translations_pkey PRIMARY KEY (src, lang)
);

-- ============================================================
-- Indexes (other than primary key / unique constraint indexes)
-- ============================================================
CREATE INDEX board_posts_created ON public.board_posts USING btree (created_at DESC);
CREATE INDEX checkins_player_idx ON public.checkins USING btree (player_id);
CREATE INDEX drinks_date_idx ON public.drinks USING btree (date);
CREATE INDEX drinks_player_idx ON public.drinks USING btree (player_id);
CREATE INDEX expenses_date ON public.expenses USING btree (date);
CREATE INDEX games_date_idx ON public.games USING btree (date);
CREATE INDEX monthly_payments_player_idx ON public.monthly_payments USING btree (player_id);
CREATE INDEX pair_requests_date ON public.pair_requests USING btree (date);
CREATE INDEX slips_date_idx ON public.slips USING btree (date);

-- ============================================================
-- Functions (pg_get_functiondef, verbatim)
-- ============================================================
-- SQL-language function bodies reference tables/other functions; skip body validation while creating (as pg_dump does).
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.add_guest(p_host text, p_pin text, p_name text, p_level integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_host, p_pin);
  gid text;
begin
  if err is not null then return err; end if;
  if exists (select 1 from players where id = p_host and guest_of is not null) then return 'คำสั่งไม่ถูกต้อง'; end if;
  if not exists (select 1 from announcements where date = d) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  if coalesce(trim(p_name), '') = '' then return 'กรุณาใส่ชื่อเล่น'; end if;
  -- 1-5 = New BG N S P, 6 = NB (อยู่ระหว่าง BG กับ N)
  if p_level not between 1 and 6 then return 'คำสั่งไม่ถูกต้อง'; end if;
  if (select count(*) from checkins c join players p on p.id = c.player_id where c.date = d and p.guest_of = p_host) >= 3 then
    return 'พาแขกได้ไม่เกิน 3 คนต่อวัน';
  end if;
  insert into players(name, level, guest_of) values (left(trim(p_name), 40), p_level, p_host) returning id into gid;
  insert into checkins(date, player_id) values (d, gid);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_link_me(p_player text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  uid text;
begin
  if not is_admin() then return jsonb_build_object('error', 'ต้องเป็นแอดมิน'); end if;
  if em !~ '^u[0-9a-f]{32}@line\.kabinburi\.app$' then return jsonb_build_object('error', 'กรุณาเข้าสู่ระบบด้วย LINE ใหม่'); end if;
  uid := 'U' || substr(split_part(em, '@', 1), 2);
  -- ผูกกับชื่อนี้อยู่แล้ว: แค่ออก session ให้เครื่องนี้
  if exists (select 1 from player_auth where line_user_id = uid and player_id = p_player) then
    return jsonb_build_object('token', new_player_session(p_player));
  end if;
  if exists (select 1 from player_auth where line_user_id = uid) then
    return jsonb_build_object('error', 'บัญชี LINE นี้ผูกกับผู้เล่นคนอื่นแล้ว');
  end if;
  if not exists (select 1 from players where id = p_player and not pending and guest_of is null) then
    return jsonb_build_object('error', 'ไม่พบผู้เล่น');
  end if;
  if exists (select 1 from player_auth where player_id = p_player and line_user_id is not null) then
    return jsonb_build_object('error', 'ชื่อนี้ผูกกับบัญชี LINE อื่นแล้ว');
  end if;
  insert into player_auth(player_id, line_user_id) values (p_player, uid)
    on conflict (player_id) do update set line_user_id = excluded.line_user_id;
  update line_claims set status = 'cancelled' where line_user_id = uid and status = 'pending';
  return jsonb_build_object('token', new_player_session(p_player));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reset_pin(p_player text)
 RETURNS text
 LANGUAGE sql
AS $function$ select 'เลิกใช้แล้ว'::text; $function$
;

CREATE OR REPLACE FUNCTION public.admins_guard_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'ลบตัวเองไม่ได้ ให้แอดมินคนอื่นลบให้';
  end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION public.board_close(p_player text, p_pin text, p_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  update board_posts set closed_at = now() where id = p_id and player_id = p_player and closed_at is null;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.board_post(p_player text, p_pin text, p_kind text, p_title text, p_detail text, p_price integer, p_photo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
  t text := btrim(coalesce(p_title, ''));
begin
  if err is not null then return err; end if;
  if p_kind not in ('lost','found','sell') then return 'คำสั่งไม่ถูกต้อง'; end if;
  if t = '' or length(t) > 60 then return 'กรุณาใส่หัวข้อ (ไม่เกิน 60 ตัวอักษร)'; end if;
  if not photo_ok(p_photo) then return 'รูปไม่ถูกต้องหรือใหญ่เกินไป'; end if;
  if (select count(*) from board_posts where player_id = p_player and closed_at is null) >= 5 then
    return 'ลงประกาศได้ไม่เกิน 5 รายการ ปิดรายการเก่าก่อน';
  end if;
  insert into board_posts (player_id, kind, title, detail, price, photo)
  values (p_player, p_kind, t, nullif(left(btrim(coalesce(p_detail, '')), 300), ''),
          case when p_kind = 'sell' then p_price end, nullif(p_photo, ''));
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.board_remove(p_player text, p_pin text, p_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  update board_posts set removed = true, photo = null, closed_at = coalesce(closed_at, now())
    where id = p_id and player_id = p_player;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_pair(p_player text, p_pin text, p_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  update pair_requests set status = 'cancelled'
    where id = p_id and status in ('pending', 'accepted') and (from_id = p_player or to_id = p_player);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.check_player_pin(p_player text, p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare pend boolean;
begin
  select pending into pend from players where id = p_player;
  if not found then return 'ไม่พบผู้เล่น'; end if;
  if pend then return 'รอแอดมินอนุมัติก่อน'; end if;
  if exists (select 1 from player_sessions where token_hash = encode(digest(coalesce(p_pin, ''), 'sha256'), 'hex')
             and player_id = p_player and expires_at > now()) then
    return null;
  end if;
  return 'กรุณาเข้าสู่ระบบด้วย LINE ใหม่';
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if e = '' then return 'ต้องล็อคอินก่อน'; end if;
  lock table admins in exclusive mode;
  if exists (select 1 from admins) then return 'มีแอดมินแล้ว ให้แอดมินเพิ่มอีเมลคุณ'; end if;
  insert into admins(email) values (e);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_player(p_ticket text, p_player text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare uid text := ticket_line_user(p_ticket); t line_link_tickets;
begin
  if uid is null then return jsonb_build_object('error', 'กรุณาเข้าสู่ระบบด้วย LINE ใหม่'); end if;
  if exists (select 1 from player_auth where line_user_id = uid) then
    return jsonb_build_object('error', 'บัญชี LINE นี้ผูกกับผู้เล่นคนอื่นแล้ว');
  end if;
  if not exists (select 1 from players where id = p_player and not pending and guest_of is null) then
    return jsonb_build_object('error', 'ไม่พบผู้เล่น');
  end if;
  if exists (select 1 from player_auth where player_id = p_player and line_user_id is not null) then
    return jsonb_build_object('error', 'ชื่อนี้ผูกกับบัญชี LINE อื่นแล้ว ให้แอดมินช่วย');
  end if;
  if (select count(*) from line_claims where status = 'pending') >= 50 then
    return jsonb_build_object('error', 'มีคนรออนุมัติเยอะ ลองใหม่ภายหลัง');
  end if;
  select * into t from line_link_tickets where ticket_hash = encode(digest(p_ticket, 'sha256'), 'hex');
  insert into line_claims(line_user_id, player_id, line_name, picture, status) values (uid, p_player, t.line_name, t.picture, 'pending')
    on conflict (line_user_id) do update set player_id = excluded.player_id, line_name = excluded.line_name,
      picture = excluded.picture, status = 'pending', created_at = now();
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.has_admins()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from admins);
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'))
$function$
;

CREATE OR REPLACE FUNCTION public.line_email(p_uid text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$ select lower(p_uid) || '@line.kabinburi.app' $function$
;

CREATE OR REPLACE FUNCTION public.line_on_announce()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s line_settings; ids jsonb; txt text; wd text[] := array['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
begin
  select * into s from line_settings where id = 1;
  if s is null or not s.notify_announce or new.date < (now() at time zone 'Asia/Bangkok')::date then return new; end if;
  select jsonb_agg(distinct a.line_user_id) into ids
    from player_auth a
    join players p on p.id = a.player_id and not coalesce(p.pending, false) and p.guest_of is null
    left join line_prefs lp on lp.player_id = a.player_id
    where a.line_user_id is not null and coalesce(lp.announce, true)
      and (exists (select 1 from checkins c where c.player_id = a.player_id and c.date >= current_date - 60)
        or exists (select 1 from signups g where g.player_id = a.player_id and g.date >= current_date - 60));
  if ids is null then return new; end if;
  txt := format(E'%s %s %s/%s\n%s%s\nลงชื่อในแอพ: https://badmiton-kabinburi.vercel.app/',
    case when new.title is null then '🏸 เปิดลงชื่อ' else '⭐ อีเว้น' end,
    wd[extract(dow from new.date)::int + 1], extract(day from new.date)::int, extract(month from new.date)::int,
    coalesce(new.title, 'จัดก๊วน'),
    case when coalesce(new.message, '') = '' then '' else E'\n' || new.message end);
  perform line_send('announce', jsonb_build_array(jsonb_build_object('to_many', ids, 'text', left(txt, 1000))));
  return new;
exception when others then return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.line_on_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s line_settings; names text[]; ids text[]; msgs jsonb := '[]'; i int; uid text; mate text; opp text;
begin
  select * into s from line_settings where id = 1;
  if s is null then return new; end if;
  ids := new.player_ids;
  select array_agg(coalesce(p.name, '?') order by x.ord) into names
    from unnest(ids) with ordinality as x(pid, ord) left join players p on p.id = x.pid;
  if s.notify_turn_personal then
    for i in 1..4 loop
      select a.line_user_id into uid from player_auth a
        left join line_prefs lp on lp.player_id = a.player_id
        where a.player_id = ids[i] and coalesce(lp.turn, true);
      continue when uid is null;
      mate := names[case i when 1 then 2 when 2 then 1 when 3 then 4 else 3 end];
      opp := case when i <= 2 then names[3] || ' + ' || names[4] else names[1] || ' + ' || names[2] end;
      msgs := msgs || jsonb_build_object('to', uid, 'text',
        format(E'🏸 ถึงคิวคุณแล้ว ลงสนาม %s ได้เลย\nคู่: %s\nเจอ: %s', new.court, mate, opp));
      uid := null;
    end loop;
  end if;
  if s.notify_turn and s.group_id is not null then
    msgs := msgs || jsonb_build_object('to', s.group_id, 'text',
      format(E'🏸 สนาม %s ลงได้เลย\n%s + %s  vs  %s + %s', new.court, names[1], names[2], names[3], names[4]));
  end if;
  perform line_send('turn', msgs);
  return new;
exception when others then return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.line_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int; nm text;
begin
  if not coalesce((select notify_signup from line_settings where id = 1), false) then return new; end if;
  select name into nm from players where id = new.player_id;
  select count(*) into n from signups where date = new.date;
  perform line_push(format('✍️ %s ลงชื่อตีแบดวันนี้แล้ว (รวม %s คน)', nm, n));
  return new;
exception when others then return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.line_push(p_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s line_settings;
begin
  select * into s from line_settings where id = 1;
  if s.group_id is null then return; end if;
  perform net.http_post(
    url := 'https://hhwvocerzkkbbyozbdso.supabase.co/functions/v1/line',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', s.hook_secret),
    body := jsonb_build_object('text', p_text)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.line_send(p_kind text, p_messages jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s line_settings;
begin
  select * into s from line_settings where id = 1;
  if s is null or jsonb_array_length(p_messages) = 0 then return; end if;
  perform net.http_post(
    url := 'https://hhwvocerzkkbbyozbdso.supabase.co/functions/v1/line',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', s.hook_secret),
    body := jsonb_build_object('kind', p_kind, 'messages', p_messages));
end $function$
;

CREATE OR REPLACE FUNCTION public.link_line(p_ticket text, p_player text, p_pin text, p_new_pin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
AS $function$ select jsonb_build_object('error', 'รีเฟรชหน้าเว็บแล้วลองใหม่'); $function$
;

CREATE OR REPLACE FUNCTION public.monthly_payment_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.amount := coalesce(new.amount, (select monthly_fee from settings where id = 1), 150);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_admin_line()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select a.line_user_id from player_auth a
      where a.line_user_id is not null and line_email(a.line_user_id) = lower(auth.jwt() ->> 'email') limit 1),
    case when lower(auth.jwt() ->> 'email') like 'u%@line.kabinburi.app'
      then 'U' || substring(split_part(lower(auth.jwt() ->> 'email'), '@', 1) from 2) end)
  where is_admin()
$function$
;

CREATE OR REPLACE FUNCTION public.my_line(p_player text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin); s line_settings; pr line_prefs;
begin
  select * into s from line_settings where id = 1;
  if err is not null then return jsonb_build_object('error', err); end if;
  select * into pr from line_prefs where player_id = p_player;
  return jsonb_build_object(
    'linked', exists (select 1 from player_auth where player_id = p_player and line_user_id is not null),
    'turn', coalesce(pr.turn, true),
    'announce', coalesce(pr.announce, true),
    'oa', s.oa_basic_id,
    'turn_on', coalesce(s.notify_turn_personal, false),
    'announce_on', coalesce(s.notify_announce, false));
end $function$
;

CREATE OR REPLACE FUNCTION public.my_private(p_player text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare ids text[];
begin
  if not exists (select 1 from player_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
                 and player_id = p_player and expires_at > now()) then
    return jsonb_build_object('error', 'กรุณาเข้าสู่ระบบใหม่');
  end if;
  ids := array(select p_player union select id from players where guest_of = p_player);
  return jsonb_build_object(
    'drinks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'player_id', player_id, 'amount', amount, 'note', note)) from drinks where player_id = any(ids)), '[]'),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'player_id', player_id, 'paid_at', paid_at, 'amount', amount)) from monthly_payments where player_id = p_player), '[]'),
    'slips', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'player_id', player_id, 'amount', amount, 'created_at', created_at)) from slips where player_id = p_player and removed_at is null), '[]')
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.new_line_link_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if not is_admin() then raise exception 'ต้องเป็นแอดมิน'; end if;
  update line_settings set link_code = c, link_code_expires = now() + interval '15 minutes' where id = 1;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.new_player_session(p_player text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare tok text := encode(gen_random_bytes(32), 'hex');
begin
  insert into player_sessions(token_hash, player_id) values (encode(digest(tok, 'sha256'), 'hex'), p_player);
  return tok;
end $function$
;

CREATE OR REPLACE FUNCTION public.photo_ok(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(p, '') = '' or (length(p) <= 200000 and p ~ '^(data:image/(jpeg|png|webp);base64,|https://profile\.line-scdn\.net/)');
$function$
;

CREATE OR REPLACE FUNCTION public.player_line_emails()
 RETURNS TABLE(player_id text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then return; end if;
  return query select a.player_id, line_email(a.line_user_id) from player_auth a where a.line_user_id is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.player_login(p_player text, p_pin text, p_new_pin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
AS $function$ select jsonb_build_object('error', 'กรุณาเข้าสู่ระบบด้วย LINE'); $function$
;

CREATE OR REPLACE FUNCTION public.player_logout(p_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  update player_sessions set expires_at = now() where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$function$
;

CREATE OR REPLACE FUNCTION public.register_player(p_name text, p_phone text, p_gender text, p_level integer, p_photo text)
 RETURNS jsonb
 LANGUAGE sql
AS $function$ select jsonb_build_object('error', 'กรุณาเข้าสู่ระบบด้วย LINE'); $function$
;

CREATE OR REPLACE FUNCTION public.register_player_line(p_ticket text, p_name text, p_phone text, p_gender text, p_level integer, p_photo text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select register_player_line(p_ticket, p_name, p_gender, p_level, p_photo);
$function$
;

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
  if p_gender not in ('male', 'female', 'other') or p_level not between 1 and 6 then
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
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_my_slip(p_player text, p_pin text, p_slip uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  update slips set removed_at = now(), image = ''
   where id = p_slip and player_id = p_player and removed_at is null
     and date = (now() at time zone 'Asia/Bangkok')::date;
  if not found then return 'ลบสลิปนี้ไม่ได้ (ลบได้เฉพาะสลิปของตัวเองที่ส่งวันนี้)'; end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_pair(p_player text, p_pin text, p_to text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_to = p_player then return 'เลือกคนอื่น'; end if;
  if not exists (select 1 from checkins where date = d and player_id = p_player and paid_at is null) then return 'ต้องเช็คอินวันนี้ก่อน'; end if;
  if not exists (select 1 from checkins where date = d and player_id = p_to and paid_at is null) then return 'คนนี้ยังไม่ได้เช็คอินวันนี้'; end if;
  -- ขอได้ทีละคน คำขอเก่าของเราถูกยกเลิก
  update pair_requests set status = 'cancelled' where date = d and from_id = p_player and status in ('pending', 'accepted');
  insert into pair_requests (id, date, from_id, to_id) values (encode(gen_random_bytes(8), 'hex'), d, p_player, p_to);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.resolve_claim(p_line_user text, p_ok boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c line_claims;
begin
  if not is_admin() then return 'ต้องเป็นแอดมิน'; end if;
  select * into c from line_claims where line_user_id = p_line_user and status = 'pending';
  if not found then return 'ไม่พบคำขอ'; end if;
  if not p_ok then
    update line_claims set status = 'rejected' where line_user_id = p_line_user;
    return null;
  end if;
  if exists (select 1 from player_auth where player_id = c.player_id and line_user_id is not null) then
    update line_claims set status = 'rejected' where line_user_id = p_line_user;
    return 'ชื่อนี้ผูกกับบัญชี LINE อื่นแล้ว';
  end if;
  insert into player_auth(player_id, line_user_id) values (c.player_id, c.line_user_id)
    on conflict (player_id) do update set line_user_id = excluded.line_user_id;
  update players set photo = c.picture where id = c.player_id and photo is null and photo_ok(c.picture);
  update line_claims set status = case when line_user_id = p_line_user then 'approved' else 'rejected' end
    where player_id = c.player_id and status = 'pending';
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_pair(p_player text, p_pin text, p_id text, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
  r pair_requests;
begin
  if err is not null then return err; end if;
  select * into r from pair_requests where id = p_id;
  if not found or r.status <> 'pending' then return 'คำขอนี้ถูกยกเลิกไปแล้ว'; end if;
  if r.to_id = p_player then
    if p_accept then
      -- คนหนึ่งจับคู่ได้ทีละคู่ คำขออื่นของสองคนนี้ถูกยกเลิก
      update pair_requests set status = 'cancelled'
        where date = r.date and id <> r.id and status in ('pending', 'accepted')
          and (from_id in (r.from_id, r.to_id) or to_id in (r.from_id, r.to_id));
      update pair_requests set status = 'accepted', at = now() where id = r.id;
    else
      update pair_requests set status = 'declined' where id = r.id;
    end if;
    return null;
  end if;
  return 'ทำรายการนี้ไม่ได้';
end $function$
;

CREATE OR REPLACE FUNCTION public.self_service(p_player text, p_pin text, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_action in ('rest', 'unrest') then
    update checkins set resting = (p_action = 'rest') where date = d and player_id = p_player;
    if not found then return 'วันนี้ยังไม่ได้เช็คอิน'; end if;
    return null;
  end if;
  -- ผู้เล่นกดจ่ายเอง: ปิดยอดวันนี้และยอดค้างทั้งหมด รวมของแขกที่พามา
  if p_action = 'pay' then
    update checkins set paid_at = now()
      where date <= d and paid_at is null
        and player_id in (select p_player union select id from players where guest_of = p_player);
    return null;
  end if;
  if p_action = 'payMonth' then
    insert into monthly_payments(month, player_id, paid_at) values (to_char(d, 'YYYY-MM'), p_player, now()) on conflict do nothing;
    return null;
  end if;
  if not exists (select 1 from announcements where date = d) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  if p_action = 'signUp' then
    insert into signups(date, player_id) values (d, p_player) on conflict do nothing;
  elsif p_action = 'cancelSignUp' then
    delete from signups where date = d and player_id = p_player;
  elsif p_action = 'checkIn' then
    insert into checkins(date, player_id) values (d, p_player) on conflict do nothing;
  else
    return 'คำสั่งไม่ถูกต้อง';
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_line_prefs(p_player text, p_pin text, p_turn boolean, p_announce boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  insert into line_prefs(player_id, turn, announce) values (p_player, p_turn, p_announce)
  on conflict (player_id) do update set turn = excluded.turn, announce = excluded.announce;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_birthday(p_player text, p_pin text, p_bday text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_bday is not null and p_bday !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then return 'คำสั่งไม่ถูกต้อง'; end if;
  update players set birthday = p_bday where id = p_player and guest_of is null;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_plan(p_player text, p_pin text, p_plan text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_plan not in ('daily','monthly') then return 'คำสั่งไม่ถูกต้อง'; end if;
  update players set plan = p_plan where id = p_player and guest_of is null;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_partner_prefs(p_player text, p_pin text, p_prefer text[], p_avoid text[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if coalesce(array_length(p_prefer, 1), 0) > 5 or coalesce(array_length(p_avoid, 1), 0) > 5 then
    return 'เลือกได้ไม่เกิน 5 คน';
  end if;
  update players set prefer = coalesce(p_prefer, '{}'), avoid = coalesce(p_avoid, '{}') where id = p_player;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.sign_up_day(p_player text, p_pin text, p_date date, p_on boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_date < d or p_date > d + 90 then return 'ลงชื่อล่วงหน้าได้ไม่เกิน 90 วัน'; end if;
  if exists (select 1 from closed_days where date = p_date) then return 'วันนี้งดเล่น'; end if;
  if not exists (select 1 from announcements where date = p_date) then return 'วันนี้ยังไม่มีประกาศจัดก๊วน'; end if;
  if p_on then
    insert into signups(date, player_id) values (p_date, p_player) on conflict do nothing;
  else
    delete from signups where date = p_date and player_id = p_player;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.signup_cap_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c int;
  taken int;
begin
  if is_admin() then return new; end if;
  select cap into c from announcements where date = new.date;
  if c is null or signup_confirmed(new.date, new.player_id) then return new; end if;
  select (select count(*) from checkins where date = new.date)
       + (select count(*) from (select player_id, row_number() over (order by at, player_id) n from signups where date = new.date) r
          where r.n <= c and not exists (select 1 from checkins k where k.date = new.date and k.player_id = r.player_id))
    into taken;
  if taken >= c then
    raise exception 'วันนี้เต็มแล้ว คุณอยู่ในรายชื่อสำรอง ให้แอดมินเช็คอินให้';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.signup_confirmed(p_date date, p_player text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (select cap from announcements where date = p_date),
  ranked as (select player_id, row_number() over (order by at, player_id) n from signups where date = p_date)
  select coalesce((select cap from c) is null, true)
    or exists (select 1 from ranked, c where ranked.player_id = p_player and ranked.n <= c.cap);
$function$
;

CREATE OR REPLACE FUNCTION public.slip_image(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select image from slips where id = p_id and public.is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.submit_slip(p_player text, p_pin text, p_amount numeric, p_image text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  err text := check_player_pin(p_player, p_pin);
begin
  if err is not null then return err; end if;
  if p_image is null or p_image not like 'data:image/%' or length(p_image) >= 800000 then
    return 'รูปไม่ถูกต้องหรือใหญ่เกินไป';
  end if;
  if (select count(*) from slips where date = d and player_id = p_player and removed_at is null) >= 3 then
    return 'ส่งสลิปวันนี้ครบ 3 รูปแล้ว';
  end if;
  insert into slips(date, player_id, amount, image) values (d, p_player, coalesce(p_amount, 0), p_image);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_line_user(p_ticket text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select line_user_id from line_link_tickets
  where ticket_hash = encode(digest(coalesce(p_ticket, ''), 'sha256'), 'hex') and expires_at > now();
$function$
;

-- note: on the live DB the body of undo_my_check_in uses CRLF (\r\n) line endings; normalized to LF here.
CREATE OR REPLACE FUNCTION public.undo_my_check_in(p_player text, p_pin text, p_cancel_signup boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

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
  if p_gender is not null and p_gender not in ('male','female','other') then return 'คำสั่งไม่ถูกต้อง'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.vote_poll(p_player text, p_pin text, p_poll text, p_dates date[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  err text := check_player_pin(p_player, p_pin);
  pl polls;
begin
  if err is not null then return err; end if;
  select * into pl from polls where id = p_poll;
  if not found or pl.closed then return 'โหวตนี้ปิดแล้ว'; end if;
  insert into poll_votes (poll_id, player_id, dates, at)
    values (p_poll, p_player, array(select unnest(coalesce(p_dates, '{}')) intersect select unnest(pl.dates)), now())
    on conflict (poll_id, player_id) do update set dates = excluded.dates, at = excluded.at;
  return null;
end $function$
;

-- ============================================================
-- Check and foreign-key constraints
-- (added after the functions because board_posts_photo_check calls photo_ok())
-- ============================================================
alter table public.admins add constraint admins_email_check CHECK ((email = lower(email)));
alter table public.admins add constraint admins_email_lower CHECK ((email = lower(email)));
alter table public.announcements add constraint announcements_cap_check CHECK (((cap IS NULL) OR ((cap >= 1) AND (cap <= 500))));
alter table public.announcements add constraint announcements_fee_check CHECK (((fee IS NULL) OR (fee >= 0)));
alter table public.announcements add constraint announcements_title_check CHECK (((title IS NULL) OR (char_length(title) <= 60)));
alter table public.board_posts add constraint board_posts_detail_check CHECK (((detail IS NULL) OR (length(detail) <= 300)));
alter table public.board_posts add constraint board_posts_kind_check CHECK ((kind = ANY (ARRAY['lost'::text, 'found'::text, 'sell'::text])));
alter table public.board_posts add constraint board_posts_photo_check CHECK (photo_ok(photo));
alter table public.board_posts add constraint board_posts_price_check CHECK (((price IS NULL) OR ((price >= 0) AND (price <= 1000000))));
alter table public.board_posts add constraint board_posts_title_check CHECK (((length(title) >= 1) AND (length(title) <= 60)));
alter table public.checkins add constraint checkins_court_fee_check CHECK ((court_fee >= (0)::numeric));
alter table public.checkins add constraint checkins_shuttle_fee_check CHECK ((shuttle_fee >= (0)::numeric));
alter table public.day_prices add constraint day_prices_court_fee_check CHECK ((court_fee >= (0)::numeric));
alter table public.day_prices add constraint day_prices_first_shuttle_fee_check CHECK ((first_shuttle_fee >= (0)::numeric));
alter table public.day_prices add constraint day_prices_next_shuttle_fee_check CHECK ((next_shuttle_fee >= (0)::numeric));
alter table public.drinks add constraint drinks_amount_check CHECK ((amount > 0));
alter table public.event_photos add constraint event_photos_caption_check CHECK ((length(caption) <= 200));
alter table public.expenses add constraint expenses_amount_check CHECK ((amount > 0));
alter table public.expenses add constraint expenses_category_check CHECK ((category = ANY (ARRAY['court'::text, 'shuttle'::text, 'maintenance'::text, 'cleaning'::text, 'drinks'::text, 'equipment'::text, 'other'::text])));
alter table public.expenses add constraint expenses_shuttles_check CHECK (((shuttles IS NULL) OR (shuttles > 0)));
alter table public.games add constraint games_player_ids_check CHECK ((cardinality(player_ids) = 4));
alter table public.games add constraint games_shuttles_check CHECK ((shuttles >= 0));
alter table public.games add constraint games_winner_check CHECK ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.line_settings add constraint line_settings_id_check CHECK ((id = 1));
alter table public.line_settings add constraint line_settings_monthly_limit_check CHECK (((monthly_limit >= 0) AND (monthly_limit <= 100000)));
alter table public.line_settings add constraint line_settings_turn_reserve_check CHECK ((turn_reserve >= 0));
alter table public.monthly_payments add constraint monthly_payments_month_check CHECK ((month ~ '^\d{4}-\d{2}$'::text));
alter table public.notices add constraint notices_body_check CHECK (((body IS NULL) OR (length(body) <= 500)));
alter table public.notices add constraint notices_kind_check CHECK ((kind = ANY (ARRAY['news'::text, 'urgent'::text])));
alter table public.notices add constraint notices_title_check CHECK (((length(title) >= 1) AND (length(title) <= 80)));
alter table public.pair_requests add constraint pair_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])));
alter table public.players add constraint players_bio_check CHECK (((bio IS NULL) OR (length(bio) <= 200)));
alter table public.players add constraint players_birthday_check CHECK (((birthday IS NULL) OR (birthday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'::text)));
alter table public.players add constraint players_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])));
alter table public.players add constraint players_level_check CHECK (((level >= 1) AND (level <= 6)));
alter table public.players add constraint players_level_request_check CHECK (((level_request >= 1) AND (level_request <= 6)));
alter table public.players add constraint players_plan_check CHECK ((plan = ANY (ARRAY['daily'::text, 'monthly'::text])));
alter table public.settings add constraint settings_id_check CHECK ((id = 1));
alter table public.shuttle_stock add constraint shuttle_stock_id_check CHECK ((id = 1));
alter table public.slips add constraint slips_image_check CHECK ((length(image) < 800000));
alter table public.translations add constraint translations_lang_check CHECK ((lang = ANY (ARRAY['en'::text, 'zh'::text])));
alter table public.board_posts add constraint board_posts_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.checkins add constraint checkins_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.drinks add constraint drinks_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.line_claims add constraint line_claims_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.line_prefs add constraint line_prefs_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.monthly_payments add constraint monthly_payments_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.pair_requests add constraint pair_requests_from_id_fkey FOREIGN KEY (from_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.pair_requests add constraint pair_requests_to_id_fkey FOREIGN KEY (to_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_auth add constraint player_auth_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_contacts add constraint player_contacts_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_sessions add constraint player_sessions_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.players add constraint players_guest_of_fkey FOREIGN KEY (guest_of) REFERENCES players(id) ON DELETE SET NULL;
alter table public.poll_votes add constraint poll_votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.poll_votes add constraint poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
alter table public.signups add constraint signups_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.slips add constraint slips_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.admins enable row level security;
alter table public.announcements enable row level security;
alter table public.board_posts enable row level security;
alter table public.checkins enable row level security;
alter table public.closed_days enable row level security;
alter table public.day_prices enable row level security;
alter table public.drinks enable row level security;
alter table public.event_photos enable row level security;
alter table public.expenses enable row level security;
alter table public.games enable row level security;
alter table public.line_claims enable row level security;
alter table public.line_link_tickets enable row level security;
alter table public.line_prefs enable row level security;
alter table public.line_settings enable row level security;
alter table public.line_usage enable row level security;
alter table public.monthly_payments enable row level security;
alter table public.notices enable row level security;
alter table public.pair_requests enable row level security;
alter table public.player_auth enable row level security;
alter table public.player_contacts enable row level security;
alter table public.player_sessions enable row level security;
alter table public.players enable row level security;
alter table public.poll_votes enable row level security;
alter table public.polls enable row level security;
alter table public.settings enable row level security;
alter table public.shuttle_stock enable row level security;
alter table public.signups enable row level security;
alter table public.slips enable row level security;
alter table public.translations enable row level security;

-- ============================================================
-- Triggers (pg_get_triggerdef, verbatim)
-- ============================================================
CREATE TRIGGER admins_guard_delete BEFORE DELETE ON public.admins FOR EACH ROW EXECUTE FUNCTION admins_guard_delete();
CREATE TRIGGER line_announce AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION line_on_announce();
CREATE TRIGGER checkins_cap_guard BEFORE INSERT ON public.checkins FOR EACH ROW EXECUTE FUNCTION signup_cap_guard();
CREATE TRIGGER line_game AFTER INSERT ON public.games FOR EACH ROW EXECUTE FUNCTION line_on_game();
CREATE TRIGGER monthly_payment_amount BEFORE INSERT ON public.monthly_payments FOR EACH ROW EXECUTE FUNCTION monthly_payment_amount();
CREATE TRIGGER line_signup AFTER INSERT ON public.signups FOR EACH ROW EXECUTE FUNCTION line_on_signup();

-- ============================================================
-- Policies (rebuilt from pg_policies)
-- ============================================================
create policy "admins add admins" on public.admins as permissive for insert to authenticated
  with check (is_admin());
create policy "admins read admins" on public.admins as permissive for select to authenticated
  using (is_admin());
create policy "admins remove admins" on public.admins as permissive for delete to authenticated
  using (is_admin());
create policy "admins see admins" on public.admins as permissive for select to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins write announcements" on public.announcements as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy "read announcements" on public.announcements as permissive for select to anon, authenticated
  using (true);
create policy "admins remove" on public.board_posts as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.board_posts as permissive for update to public
  using (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.board_posts as permissive for select to public
  using (true);
create policy "admins delete" on public.checkins as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.checkins as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.checkins as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.checkins as permissive for select to anon, authenticated
  using (true);
create policy "admins write closed days" on public.closed_days as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy "read closed days" on public.closed_days as permissive for select to anon, authenticated
  using (true);
create policy "admins delete" on public.day_prices as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.day_prices as permissive for insert to public
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.day_prices as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.day_prices as permissive for select to public
  using (true);
create policy "admins delete" on public.drinks as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.drinks as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.drinks as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.drinks as permissive for select to authenticated
  using (is_admin());
create policy event_photos_admin on public.event_photos as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy event_photos_read on public.event_photos as permissive for select to public
  using (true);
create policy "admins insert" on public.expenses as permissive for insert to public
  with check (( SELECT is_admin() AS is_admin));
create policy "admins read" on public.expenses as permissive for select to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins remove" on public.expenses as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.expenses as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "admins delete" on public.games as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.games as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.games as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.games as permissive for select to anon, authenticated
  using (true);
create policy line_claims_admin_read on public.line_claims as permissive for select to public
  using (is_admin());
create policy "admins read line settings" on public.line_settings as permissive for select to authenticated
  using (is_admin());
create policy "admins update line settings" on public.line_settings as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());
create policy line_usage_admin_read on public.line_usage as permissive for select to public
  using (is_admin());
create policy "admins delete" on public.monthly_payments as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.monthly_payments as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.monthly_payments as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.monthly_payments as permissive for select to authenticated
  using (is_admin());
create policy "admins insert" on public.notices as permissive for insert to public
  with check (( SELECT is_admin() AS is_admin));
create policy "admins remove" on public.notices as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.notices as permissive for update to public
  using (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.notices as permissive for select to public
  using (true);
create policy "admins remove" on public.pair_requests as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.pair_requests as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.pair_requests as permissive for select to public
  using (true);
create policy "admins delete" on public.player_contacts as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.player_contacts as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins read contacts" on public.player_contacts as permissive for select to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.player_contacts as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "admins delete" on public.players as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.players as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.players as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.players as permissive for select to anon, authenticated
  using (true);
create policy "anyone can read" on public.poll_votes as permissive for select to public
  using (true);
create policy "admins insert" on public.polls as permissive for insert to public
  with check (( SELECT is_admin() AS is_admin));
create policy "admins remove" on public.polls as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.polls as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.polls as permissive for select to public
  using (true);
create policy "admins delete" on public.settings as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));
create policy "admins insert" on public.settings as permissive for insert to authenticated
  with check (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.settings as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "anyone can read" on public.settings as permissive for select to anon, authenticated
  using (true);
create policy "admins insert" on public.shuttle_stock as permissive for insert to public
  with check (( SELECT is_admin() AS is_admin));
create policy "admins read" on public.shuttle_stock as permissive for select to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins remove" on public.shuttle_stock as permissive for delete to public
  using (( SELECT is_admin() AS is_admin));
create policy "admins update" on public.shuttle_stock as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));
create policy "admins write signups" on public.signups as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy "read signups" on public.signups as permissive for select to anon, authenticated
  using (true);
create policy "admins delete slips" on public.slips as permissive for delete to authenticated
  using (is_admin());
create policy "read slips" on public.slips as permissive for select to authenticated
  using (is_admin());
create policy translations_read on public.translations as permissive for select to public
  using (true);

-- ============================================================
-- Function EXECUTE privileges (from pg_proc.proacl; postgres and service_role keep execute on all)
-- "public" below = the PUBLIC pseudo-role. Functions with only a revoke line are not callable by anon/authenticated.
-- ============================================================
revoke execute on function public.add_guest(p_host text, p_pin text, p_name text, p_level integer) from public, anon, authenticated;
grant execute on function public.add_guest(p_host text, p_pin text, p_name text, p_level integer) to anon, authenticated;
revoke execute on function public.admin_link_me(p_player text) from public, anon, authenticated;
grant execute on function public.admin_link_me(p_player text) to authenticated;
revoke execute on function public.admin_reset_pin(p_player text) from public, anon, authenticated;
grant execute on function public.admin_reset_pin(p_player text) to authenticated;
revoke execute on function public.admins_guard_delete() from public, anon, authenticated;
revoke execute on function public.board_close(p_player text, p_pin text, p_id text) from public, anon, authenticated;
grant execute on function public.board_close(p_player text, p_pin text, p_id text) to public, anon, authenticated;
revoke execute on function public.board_post(p_player text, p_pin text, p_kind text, p_title text, p_detail text, p_price integer, p_photo text) from public, anon, authenticated;
grant execute on function public.board_post(p_player text, p_pin text, p_kind text, p_title text, p_detail text, p_price integer, p_photo text) to public, anon, authenticated;
revoke execute on function public.board_remove(p_player text, p_pin text, p_id text) from public, anon, authenticated;
grant execute on function public.board_remove(p_player text, p_pin text, p_id text) to public, anon, authenticated;
revoke execute on function public.cancel_pair(p_player text, p_pin text, p_id text) from public, anon, authenticated;
grant execute on function public.cancel_pair(p_player text, p_pin text, p_id text) to public, anon, authenticated;
revoke execute on function public.check_player_pin(p_player text, p_pin text) from public, anon, authenticated;
revoke execute on function public.claim_first_admin() from public, anon, authenticated;
grant execute on function public.claim_first_admin() to authenticated;
revoke execute on function public.claim_player(p_ticket text, p_player text) from public, anon, authenticated;
grant execute on function public.claim_player(p_ticket text, p_player text) to public, anon, authenticated;
revoke execute on function public.has_admins() from public, anon, authenticated;
grant execute on function public.has_admins() to authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.line_email(p_uid text) from public, anon, authenticated;
grant execute on function public.line_email(p_uid text) to public, anon, authenticated;
revoke execute on function public.line_on_announce() from public, anon, authenticated;
grant execute on function public.line_on_announce() to public, anon, authenticated;
revoke execute on function public.line_on_game() from public, anon, authenticated;
grant execute on function public.line_on_game() to public, anon, authenticated;
revoke execute on function public.line_on_signup() from public, anon, authenticated;
grant execute on function public.line_on_signup() to public, anon, authenticated;
revoke execute on function public.line_push(p_text text) from public, anon, authenticated;
revoke execute on function public.line_send(p_kind text, p_messages jsonb) from public, anon, authenticated;
revoke execute on function public.link_line(p_ticket text, p_player text, p_pin text, p_new_pin text) from public, anon, authenticated;
grant execute on function public.link_line(p_ticket text, p_player text, p_pin text, p_new_pin text) to anon, authenticated;
revoke execute on function public.monthly_payment_amount() from public, anon, authenticated;
grant execute on function public.monthly_payment_amount() to public, anon, authenticated;
revoke execute on function public.my_admin_line() from public, anon, authenticated;
grant execute on function public.my_admin_line() to public, anon, authenticated;
revoke execute on function public.my_line(p_player text, p_pin text) from public, anon, authenticated;
grant execute on function public.my_line(p_player text, p_pin text) to public, anon, authenticated;
revoke execute on function public.my_private(p_player text, p_token text) from public, anon, authenticated;
grant execute on function public.my_private(p_player text, p_token text) to anon, authenticated;
revoke execute on function public.new_line_link_code() from public, anon, authenticated;
grant execute on function public.new_line_link_code() to authenticated;
revoke execute on function public.new_player_session(p_player text) from public, anon, authenticated;
revoke execute on function public.photo_ok(p text) from public, anon, authenticated;
grant execute on function public.photo_ok(p text) to public, anon, authenticated;
revoke execute on function public.player_line_emails() from public, anon, authenticated;
grant execute on function public.player_line_emails() to anon, authenticated;
revoke execute on function public.player_login(p_player text, p_pin text, p_new_pin text) from public, anon, authenticated;
grant execute on function public.player_login(p_player text, p_pin text, p_new_pin text) to anon, authenticated;
revoke execute on function public.player_logout(p_token text) from public, anon, authenticated;
grant execute on function public.player_logout(p_token text) to anon, authenticated;
revoke execute on function public.register_player(p_name text, p_phone text, p_gender text, p_level integer, p_photo text) from public, anon, authenticated;
grant execute on function public.register_player(p_name text, p_phone text, p_gender text, p_level integer, p_photo text) to anon, authenticated;
revoke execute on function public.register_player_line(p_ticket text, p_name text, p_phone text, p_gender text, p_level integer, p_photo text) from public, anon, authenticated;
grant execute on function public.register_player_line(p_ticket text, p_name text, p_phone text, p_gender text, p_level integer, p_photo text) to anon, authenticated;
revoke execute on function public.register_player_line(p_ticket text, p_name text, p_gender text, p_level integer, p_photo text) from public, anon, authenticated;
grant execute on function public.register_player_line(p_ticket text, p_name text, p_gender text, p_level integer, p_photo text) to public, anon, authenticated;
revoke execute on function public.remove_my_slip(p_player text, p_pin text, p_slip uuid) from public, anon, authenticated;
grant execute on function public.remove_my_slip(p_player text, p_pin text, p_slip uuid) to public, anon, authenticated;
revoke execute on function public.request_pair(p_player text, p_pin text, p_to text) from public, anon, authenticated;
grant execute on function public.request_pair(p_player text, p_pin text, p_to text) to public, anon, authenticated;
revoke execute on function public.resolve_claim(p_line_user text, p_ok boolean) from public, anon, authenticated;
grant execute on function public.resolve_claim(p_line_user text, p_ok boolean) to public, anon, authenticated;
revoke execute on function public.respond_pair(p_player text, p_pin text, p_id text, p_accept boolean) from public, anon, authenticated;
grant execute on function public.respond_pair(p_player text, p_pin text, p_id text, p_accept boolean) to public, anon, authenticated;
revoke execute on function public.self_service(p_player text, p_pin text, p_action text) from public, anon, authenticated;
grant execute on function public.self_service(p_player text, p_pin text, p_action text) to anon, authenticated;
revoke execute on function public.set_line_prefs(p_player text, p_pin text, p_turn boolean, p_announce boolean) from public, anon, authenticated;
grant execute on function public.set_line_prefs(p_player text, p_pin text, p_turn boolean, p_announce boolean) to public, anon, authenticated;
revoke execute on function public.set_my_birthday(p_player text, p_pin text, p_bday text) from public, anon, authenticated;
grant execute on function public.set_my_birthday(p_player text, p_pin text, p_bday text) to public, anon, authenticated;
revoke execute on function public.set_my_plan(p_player text, p_pin text, p_plan text) from public, anon, authenticated;
grant execute on function public.set_my_plan(p_player text, p_pin text, p_plan text) to public, anon, authenticated;
revoke execute on function public.set_partner_prefs(p_player text, p_pin text, p_prefer text[], p_avoid text[]) from public, anon, authenticated;
grant execute on function public.set_partner_prefs(p_player text, p_pin text, p_prefer text[], p_avoid text[]) to anon, authenticated;
revoke execute on function public.sign_up_day(p_player text, p_pin text, p_date date, p_on boolean) from public, anon, authenticated;
grant execute on function public.sign_up_day(p_player text, p_pin text, p_date date, p_on boolean) to public, anon, authenticated;
revoke execute on function public.signup_cap_guard() from public, anon, authenticated;
grant execute on function public.signup_cap_guard() to public, anon, authenticated;
revoke execute on function public.signup_confirmed(p_date date, p_player text) from public, anon, authenticated;
grant execute on function public.signup_confirmed(p_date date, p_player text) to public, anon, authenticated;
revoke execute on function public.slip_image(p_id uuid) from public, anon, authenticated;
grant execute on function public.slip_image(p_id uuid) to authenticated;
revoke execute on function public.submit_slip(p_player text, p_pin text, p_amount numeric, p_image text) from public, anon, authenticated;
grant execute on function public.submit_slip(p_player text, p_pin text, p_amount numeric, p_image text) to anon, authenticated;
revoke execute on function public.ticket_line_user(p_ticket text) from public, anon, authenticated;
revoke execute on function public.undo_my_check_in(p_player text, p_pin text, p_cancel_signup boolean) from public, anon, authenticated;
grant execute on function public.undo_my_check_in(p_player text, p_pin text, p_cancel_signup boolean) to public, anon, authenticated;
revoke execute on function public.update_my_profile(p_player text, p_pin text, p_name text, p_photo text, p_gender text, p_bio text, p_level integer) from public, anon, authenticated;
grant execute on function public.update_my_profile(p_player text, p_pin text, p_name text, p_photo text, p_gender text, p_bio text, p_level integer) to public, anon, authenticated;
revoke execute on function public.vote_poll(p_player text, p_pin text, p_poll text, p_dates date[]) from public, anon, authenticated;
grant execute on function public.vote_poll(p_player text, p_pin text, p_poll text, p_dates date[]) to public, anon, authenticated;

-- ============================================================
-- Views: none in schema public.
-- ============================================================

-- ============================================================
-- Realtime publication (tables in supabase_realtime on the live DB)
-- ============================================================
-- alter publication supabase_realtime add table public.players;
-- alter publication supabase_realtime add table public.player_contacts;
-- alter publication supabase_realtime add table public.checkins;
-- alter publication supabase_realtime add table public.games;
-- alter publication supabase_realtime add table public.drinks;
-- alter publication supabase_realtime add table public.monthly_payments;
-- alter publication supabase_realtime add table public.settings;
-- alter publication supabase_realtime add table public.announcements;
-- alter publication supabase_realtime add table public.signups;
-- alter publication supabase_realtime add table public.slips;
-- alter publication supabase_realtime add table public.closed_days;
-- alter publication supabase_realtime add table public.day_prices;
-- alter publication supabase_realtime add table public.expenses;
-- alter publication supabase_realtime add table public.shuttle_stock;
-- alter publication supabase_realtime add table public.pair_requests;
-- alter publication supabase_realtime add table public.polls;
-- alter publication supabase_realtime add table public.poll_votes;
-- alter publication supabase_realtime add table public.board_posts;
-- alter publication supabase_realtime add table public.notices;

-- ============================================================
-- Table / column privileges for anon and authenticated (from pg_class.relacl / pg_attribute.attacl)
-- Supabase grants ALL on new public tables to anon/authenticated by default; these lines reproduce
-- the live state, including the tables where that default was revoked. postgres and service_role keep ALL.
-- (Some column grants are redundant with a table-level ALL; kept as found on the live DB.)
-- ============================================================
revoke all on table public.admins from anon, authenticated;
grant all on table public.admins to anon;
grant all on table public.admins to authenticated;
revoke all on table public.announcements from anon, authenticated;
grant all on table public.announcements to anon;
grant all on table public.announcements to authenticated;
grant insert (fee, cap) on table public.announcements to anon;
grant insert (title, fee, cap) on table public.announcements to authenticated;
grant select (title, fee, cap) on table public.announcements to anon;
grant select (title, fee, cap) on table public.announcements to authenticated;
grant update (fee, cap) on table public.announcements to anon;
grant update (title, fee, cap) on table public.announcements to authenticated;
revoke all on table public.board_posts from anon, authenticated;
grant all on table public.board_posts to anon;
grant all on table public.board_posts to authenticated;
grant select (removed) on table public.board_posts to anon;
grant select (removed) on table public.board_posts to authenticated;
revoke all on table public.checkins from anon, authenticated;
grant all on table public.checkins to anon;
grant all on table public.checkins to authenticated;
revoke all on table public.closed_days from anon, authenticated;
grant all on table public.closed_days to anon;
grant all on table public.closed_days to authenticated;
revoke all on table public.day_prices from anon, authenticated;
grant all on table public.day_prices to anon;
grant all on table public.day_prices to authenticated;
revoke all on table public.drinks from anon, authenticated;
grant all on table public.drinks to anon;
grant all on table public.drinks to authenticated;
revoke all on table public.event_photos from anon, authenticated;
grant all on table public.event_photos to anon;
grant all on table public.event_photos to authenticated;
revoke all on table public.expenses from anon, authenticated;
grant all on table public.expenses to authenticated;
revoke all on table public.games from anon, authenticated;
grant all on table public.games to anon;
grant all on table public.games to authenticated;
revoke all on table public.line_claims from anon, authenticated;
grant all on table public.line_claims to anon;
grant all on table public.line_claims to authenticated;
revoke all on table public.line_link_tickets from anon, authenticated;
revoke all on table public.line_prefs from anon, authenticated;
grant all on table public.line_prefs to anon;
grant all on table public.line_prefs to authenticated;
revoke all on table public.line_settings from anon, authenticated;
grant select (id, group_id, notify_signup, notify_turn, notify_turn_personal, notify_announce, monthly_limit, turn_reserve, oa_basic_id, last_error, last_error_at) on table public.line_settings to authenticated;
grant update (group_id, notify_signup, notify_turn, notify_turn_personal, notify_announce, monthly_limit, turn_reserve) on table public.line_settings to authenticated;
revoke all on table public.line_usage from anon, authenticated;
grant all on table public.line_usage to anon;
grant all on table public.line_usage to authenticated;
revoke all on table public.monthly_payments from anon, authenticated;
grant all on table public.monthly_payments to anon;
grant all on table public.monthly_payments to authenticated;
grant select (amount) on table public.monthly_payments to anon;
grant select (amount) on table public.monthly_payments to authenticated;
revoke all on table public.notices from anon, authenticated;
grant all on table public.notices to anon;
grant all on table public.notices to authenticated;
revoke all on table public.pair_requests from anon, authenticated;
grant all on table public.pair_requests to anon;
grant all on table public.pair_requests to authenticated;
grant update (status) on table public.pair_requests to authenticated;
revoke all on table public.player_auth from anon, authenticated;
revoke all on table public.player_contacts from anon, authenticated;
grant all on table public.player_contacts to anon;
grant all on table public.player_contacts to authenticated;
revoke all on table public.player_sessions from anon, authenticated;
revoke all on table public.players from anon, authenticated;
grant all on table public.players to anon;
grant all on table public.players to authenticated;
grant insert (bio, level_request) on table public.players to authenticated;
grant select (bio, level_request) on table public.players to anon;
grant select (bio, level_request) on table public.players to authenticated;
grant update (bio, level_request) on table public.players to authenticated;
revoke all on table public.poll_votes from anon, authenticated;
grant all on table public.poll_votes to anon;
grant all on table public.poll_votes to authenticated;
revoke all on table public.polls from anon, authenticated;
grant all on table public.polls to anon;
grant all on table public.polls to authenticated;
revoke all on table public.settings from anon, authenticated;
grant all on table public.settings to anon;
grant all on table public.settings to authenticated;
revoke all on table public.shuttle_stock from anon, authenticated;
grant all on table public.shuttle_stock to authenticated;
revoke all on table public.signups from anon, authenticated;
grant all on table public.signups to anon;
grant all on table public.signups to authenticated;
revoke all on table public.slips from anon, authenticated;
grant delete on table public.slips to authenticated;
grant select (id, date, player_id, amount, created_at, removed_at) on table public.slips to anon;
grant select (id, date, player_id, amount, created_at, removed_at) on table public.slips to authenticated;
revoke all on table public.translations from anon, authenticated;
grant all on table public.translations to anon;
grant all on table public.translations to authenticated;
