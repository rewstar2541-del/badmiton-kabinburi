-- เตือนสมาชิกรายปีใกล้หมดอายุทาง LINE (ต้องรัน annual_membership.sql ก่อน)
-- ทุกวัน 9 โมงเช้า: ส่งหาสมาชิกที่เหลือ 30 วัน และ 7 วัน (คนละครั้ง ต่อรอบสมาชิก) แล้วสรุปรายชื่อส่งเข้า LINE แอดมิน
-- ถ้าวันไหนระบบไม่ได้ส่ง วันถัดไปจะส่งตามให้ (เช่น เหลือ 29 วันก็ยังได้ข้อความรอบ 30 วัน)
-- ต่ออายุแล้ว (วันหมดอายุเปลี่ยน) จะเริ่มนับรอบเตือนใหม่เอง
-- ทดลองส่งทันที: select public.line_annual_reminders();

alter table public.line_settings add column if not exists notify_annual boolean not null default true;
alter table public.line_usage add column if not exists annual integer not null default 0;

-- จำว่าเตือนใครไปแล้ว ไม่ส่งซ้ำ
create table if not exists public.annual_reminders (
  player_id text not null references public.players(id) on delete cascade,
  until_date date not null,
  stage smallint not null check (stage in (7, 30)),
  sent_at timestamptz not null default now(),
  primary key (player_id, until_date, stage)
);
alter table public.annual_reminders enable row level security;
drop policy if exists annual_reminders_admin_read on public.annual_reminders;
create policy annual_reminders_admin_read on public.annual_reminders for select to authenticated using (public.is_admin());
revoke all on table public.annual_reminders from anon;

create or replace function public.line_annual_reminders(p_today date default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s line_settings;
  today date := coalesce(p_today, (now() at time zone 'Asia/Bangkok')::date);
  mon text[] := array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  due jsonb;
  msgs jsonb;
  boss jsonb;
  summary text;
  n int;
  i int;
begin
  select * into s from line_settings where id = 1;
  if s is null or not s.notify_annual then return jsonb_build_object('skipped', 'off'); end if;

  -- เหลือ 8-30 วัน = รอบ 30 วัน, 0-7 วัน = รอบ 7 วัน (ยังไม่เริ่มใช้ / หมดแล้ว ไม่เตือน)
  with d as (
    select p.id, p.name, p.annual_until, p.annual_until - today as left_days,
      case when p.annual_until - today <= 7 then 7 else 30 end as stage,
      format('%s %s %s', extract(day from p.annual_until)::int, mon[extract(month from p.annual_until)::int], extract(year from p.annual_until)::int + 543) as until_txt
    from players p
    where p.annual_until is not null and p.guest_of is null and not coalesce(p.pending, false)
      and p.annual_until - today between 0 and 30
      and (p.annual_from is null or p.annual_from <= today)
  ), fresh as (
    insert into annual_reminders (player_id, until_date, stage)
    select id, annual_until, stage from d
    on conflict do nothing
    returning player_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', d.name, 'until', d.annual_until, 'until_txt', d.until_txt, 'left', d.left_days, 'uid', a.line_user_id)
      order by d.annual_until, d.name), '[]')
    into due
    from fresh f
    join d on d.id = f.player_id
    left join player_auth a on a.player_id = d.id and a.line_user_id is not null;

  n := jsonb_array_length(due);
  if n = 0 then return jsonb_build_object('due', 0); end if;

  -- คนที่หมดวันเดียวกันได้ข้อความเดียวกัน ส่งรวดเดียว
  select coalesce(jsonb_agg(jsonb_build_object('to_many', g.ids, 'text', g.txt)), '[]') into msgs
  from (
    select jsonb_agg(x->>'uid') as ids,
      format(E'⏰ สมาชิกรายปีของคุณ%s\nต่ออายุกับแอดมินได้เลย ถ้าหมดอายุแล้วจะกลับไปคิดค่าสนามรายวันตามปกติ\nดูในแอพ: https://badmiton-kabinburi.vercel.app/',
        case when (x->>'left')::int = 0 then format('ใช้ได้ถึงวันนี้เป็นวันสุดท้าย (%s)', x->>'until_txt')
          else format('จะหมดอายุ ใช้ได้ถึง %s (อีก %s วัน)', x->>'until_txt', x->>'left') end) as txt
    from jsonb_array_elements(due) x
    where x->>'uid' is not null
    group by x->>'until', x->>'until_txt', x->>'left'
  ) g;

  -- สรุปให้แอดมินที่ผูก LINE ไว้ (แบบเดียวกับ my_admin_line)
  select jsonb_agg(distinct id) into boss from (
    select a.line_user_id as id from player_auth a join admins ad on ad.email = line_email(a.line_user_id)
    union
    select 'U' || substring(split_part(ad.email, '@', 1) from 2) from admins ad where ad.email like 'u%@line.kabinburi.app'
  ) x where id is not null;
  if boss is not null then
    select format(E'📋 สมาชิกรายปีใกล้หมดอายุ %s คน\n%s\nต่ออายุ: แท็บคิดเงิน > รายปี', n,
        string_agg(format('• %s ถึง %s (%s)%s', x->>'name', x->>'until_txt',
          case when (x->>'left')::int = 0 then 'วันสุดท้าย' else 'อีก ' || (x->>'left') || ' วัน' end,
          case when x->>'uid' is null then E'\n   ⚠️ ไม่ได้ผูก LINE ต้องแจ้งเอง' else '' end), E'\n'))
      into summary
      from jsonb_array_elements(due) x;
    msgs := msgs || jsonb_build_object('to_many', boss, 'text', left(summary, 4900));
  end if;

  -- ฟังก์ชัน line รับครั้งละ 10 ข้อความ
  if jsonb_array_length(msgs) > 0 then
    for i in 0 .. (jsonb_array_length(msgs) - 1) / 10 loop
      perform line_send('annual', (select jsonb_agg(e order by k) from jsonb_array_elements(msgs) with ordinality t(e, k) where k > i * 10 and k <= (i + 1) * 10));
    end loop;
  end if;
  return jsonb_build_object('due', n, 'messages', jsonb_array_length(msgs));
end $function$;

revoke execute on function public.line_annual_reminders(date) from public, anon, authenticated;

-- ตั้งเวลา: ทุกวัน 02:00 UTC = 09:00 เวลาไทย (รันซ้ำได้ ชื่องานเดิมจะถูกอัปเดต)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('line-annual-reminders', '0 2 * * *', 'select public.line_annual_reminders()');
