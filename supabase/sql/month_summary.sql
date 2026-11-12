-- สรุปปลายเดือนส่งแอดมินทาง LINE อัตโนมัติ: ทุกวันที่ 1 เวลา 08:00 (เวลาไทย) ส่งสรุปของเดือนที่แล้ว
-- รายรับ รายจ่าย กำไร ลูกที่ใช้ และยอดค้างจ่าย คิดแบบเดียวกับรายงานรายเดือนในแอพ (src/lib/report.ts)
-- ส่งหาแอดมินทุกคนที่เข้าสู่ระบบด้วย LINE (ไม่ส่งเข้ากลุ่ม เพราะเป็นตัวเลขการเงิน)
-- ทดสอบส่งเอง: select public.line_month_summary('2026-10');
-- ยกเลิกส่งอัตโนมัติ: select cron.unschedule('month-summary');

create extension if not exists pg_cron;

-- ตัวเลขของเดือน p_month (YYYY-MM)
create or replace function public.month_summary(p_month text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with s as (select * from settings where id = 1),
  ci as (
    select c.date, c.player_id, c.paid_at,
      coalesce(c.court_fee,
        case when exists (select 1 from monthly_payments m where m.month = p_month and m.player_id = c.player_id)
          or (p.annual_until is not null and c.date <= p.annual_until and (p.annual_from is null or c.date >= p.annual_from))
        then 0 else coalesce(dp.court_fee, s.court_fee) end) as court,
      coalesce(c.shuttle_fee,
        case when n.shuttles > 0
        then coalesce(dp.first_shuttle_fee, s.first_shuttle_fee) + (n.shuttles - 1) * coalesce(dp.next_shuttle_fee, s.next_shuttle_fee)
        else 0 end) as shuttle,
      (select coalesce(sum(d.amount), 0) from drinks d where d.date = c.date and d.player_id = c.player_id) as drinks
    from checkins c
    join players p on p.id = c.player_id
    cross join s
    left join day_prices dp on dp.date = c.date
    cross join lateral (
      select coalesce(sum(g.shuttles), 0) as shuttles from games g where g.date = c.date and c.player_id = any(g.player_ids)
    ) n
    where to_char(c.date, 'YYYY-MM') = p_month
  ),
  t as (
    select
      count(distinct date) as days,
      count(*) as visits,
      coalesce(sum(court + shuttle + drinks) filter (where paid_at is not null), 0) as received,
      coalesce(sum(court + shuttle + drinks) filter (where paid_at is null), 0) as unpaid,
      count(distinct player_id) filter (where paid_at is null and court + shuttle + drinks > 0) as unpaid_people
    from ci
  ),
  mf as (
    select count(*) as n, coalesce(sum(coalesce(m.amount, (select monthly_fee from s))), 0) as amount
    from monthly_payments m where m.month = p_month
  ),
  af as (select coalesce(sum(amount), 0) as amount from annual_payments where to_char(paid_on, 'YYYY-MM') = p_month),
  ex as (
    select coalesce(sum(amount), 0) as total, coalesce(sum(shuttles), 0) as shuttles,
      coalesce(jsonb_object_agg(category, amount) filter (where category is not null), '{}') as by
    from (select category, sum(amount) as amount, sum(shuttles) as shuttles from expenses
      where to_char(date, 'YYYY-MM') = p_month group by category) e
  ),
  gm as (
    select count(*) filter (where ended_at is not null) as games, coalesce(sum(shuttles), 0) as shuttles
    from games where to_char(date, 'YYYY-MM') = p_month
  )
  select jsonb_build_object(
    'month', p_month,
    'days', t.days, 'visits', t.visits, 'games', gm.games, 'shuttles', gm.shuttles, 'shuttlesBought', ex.shuttles,
    'received', t.received, 'monthlyFees', mf.amount, 'monthlyCount', mf.n, 'annualFees', af.amount,
    'income', t.received + mf.amount + af.amount,
    'expenses', ex.total, 'expenseBy', ex.by,
    'profit', t.received + mf.amount + af.amount - ex.total,
    'unpaid', t.unpaid, 'unpaidPeople', t.unpaid_people)
  from t, mf, af, ex, gm
$$;
revoke execute on function public.month_summary(text) from public, anon, authenticated;

-- ข้อความ LINE จากตัวเลขของเดือน
create or replace function public.month_summary_text(p_month text)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  r jsonb := month_summary(p_month);
  months text[] := array['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  cats jsonb := '{"court":"ค่าเช่าสนาม","shuttle":"ค่าลูกแบด","maintenance":"ค่าบำรุงรักษา","cleaning":"ค่าทำความสะอาด","drinks":"ค่าเครื่องดื่ม","equipment":"ค่าอุปกรณ์สนาม","other":"อื่นๆ"}';
  k text; v numeric; lines text := '';
  profit numeric := (r->>'profit')::numeric;
begin
  for k, v in select key, value::numeric from jsonb_each_text(r->'expenseBy') order by value::numeric desc loop
    lines := lines || format(E'\n  · %s %s', coalesce(cats->>k, k), to_char(v, 'FM999,999,990'));
  end loop;
  return format(E'📊 สรุปก๊วนเดือน%s %s\nตี %s วัน · คนมา %s ครั้ง · %s เกม\n\n💰 รายรับ %s บาท\n  · ค่าตีรายวัน (เก็บแล้ว) %s\n  · ค่าสมาชิกรายเดือน %s (%s คน)%s\n💸 รายจ่าย %s บาท%s\n%s %s บาท\n\n🏸 ลูกที่ใช้ %s ลูก%s%s\n\nดูละเอียด: แอพ > คิดเงิน > รายเดือน\nhttps://badmiton-kabinburi.vercel.app/',
    months[split_part(p_month, '-', 2)::int], split_part(p_month, '-', 1)::int + 543,
    r->>'days', r->>'visits', r->>'games',
    to_char((r->>'income')::numeric, 'FM999,999,990'),
    to_char((r->>'received')::numeric, 'FM999,999,990'),
    to_char((r->>'monthlyFees')::numeric, 'FM999,999,990'), r->>'monthlyCount',
    case when (r->>'annualFees')::numeric > 0 then format(E'\n  · ค่าสมาชิกรายปี %s', to_char((r->>'annualFees')::numeric, 'FM999,999,990')) else '' end,
    to_char((r->>'expenses')::numeric, 'FM999,999,990'), lines,
    case when profit >= 0 then '✅ กำไร' else '🔻 ขาดทุน' end, to_char(abs(profit), 'FM999,999,990'),
    r->>'shuttles',
    case when (r->>'shuttlesBought')::int > 0 then format(' (ซื้อเพิ่ม %s ลูก)', r->>'shuttlesBought') else '' end,
    case when (r->>'unpaid')::numeric > 0 then format(E'\n⏳ ยังค้างจ่าย %s บาท (%s คน)', to_char((r->>'unpaid')::numeric, 'FM999,999,990'), r->>'unpaidPeople') else '' end);
end $$;
revoke execute on function public.month_summary_text(text) from public, anon, authenticated;

-- ส่งสรุปหาแอดมินที่ใช้ LINE (ไม่ใส่เดือน = เดือนที่แล้วตามเวลาไทย)
create or replace function public.line_month_summary(p_month text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  m text := coalesce(p_month, to_char((now() at time zone 'Asia/Bangkok')::date - interval '1 month', 'YYYY-MM'));
  ids jsonb;
begin
  select jsonb_agg(distinct uid) into ids from (
    select a.line_user_id as uid from player_auth a join admins ad on ad.email = line_email(a.line_user_id)
    union
    select 'U' || substring(split_part(email, '@', 1) from 2) from admins where email like 'u%@line.kabinburi.app'
  ) x where uid is not null;
  if ids is null then return; end if;
  perform line_send('turn', jsonb_build_array(jsonb_build_object('to_many', ids, 'text', month_summary_text(m))));
end $$;
revoke execute on function public.line_month_summary(text) from public, anon, authenticated;

-- ทุกวันที่ 1 เวลา 01:00 UTC = 08:00 เวลาไทย
select cron.schedule('month-summary', '0 1 1 * *', 'select public.line_month_summary()');
