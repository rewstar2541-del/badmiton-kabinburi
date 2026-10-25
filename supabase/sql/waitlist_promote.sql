-- รายชื่อสำรอง: มีคนยกเลิกลงชื่อ (หรือแอดมินเพิ่มจำนวนที่รับ) คนสำรองที่ได้ขึ้นเป็นตัวจริงได้ข้อความ LINE ส่วนตัว
-- ลำดับตัวจริง/สำรองคำนวณจากลำดับการลงชื่อเหมือนเดิม (signup_confirmed) ไฟล์นี้เพิ่มแค่การแจ้งเตือน
-- ส่งถึงทุกคนที่ผูก LINE (ข้อความสำคัญ มาครั้งเดียว) ใช้โควตาแบบถึงคิว ส่งก่อนเสมอ แต่ไม่เกิน monthly_limit
-- ถอนออก: drop trigger if exists signups_promote on public.signups;
--          drop trigger if exists announcements_promote on public.announcements;

-- แจ้งคนที่ตอนนี้เป็นตัวจริงของวันนั้น แต่ไม่อยู่ใน p_before (ตัวจริงก่อนเปลี่ยน)
create or replace function public.line_notify_promoted(p_date date, p_before text[])
returns void language plpgsql security definer set search_path to 'public' as $$
declare a announcements; ids jsonb; wd text[] := array['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  now_th timestamp := now() at time zone 'Asia/Bangkok';
begin
  -- วันที่ผ่านไปแล้ว หรือวันนี้หลัง 3 ทุ่ม (ใกล้เลิก) ไม่ต้องแจ้ง
  if p_date < now_th::date or (p_date = now_th::date and extract(hour from now_th) >= 21) then return; end if;
  if exists (select 1 from closed_days where date = p_date) then return; end if;
  select * into a from announcements where date = p_date;
  if a is null then return; end if;
  select jsonb_agg(distinct au.line_user_id) into ids
    from (select player_id, row_number() over (order by at, player_id) n from signups where date = p_date) r
    join player_auth au on au.player_id = r.player_id and au.line_user_id is not null
    where (a.cap is null or r.n <= a.cap) and not (r.player_id = any(p_before))
      -- แอดมินเช็คอินให้แล้ว (อยู่ที่สนามแล้ว) ไม่ต้องแจ้ง
      and not exists (select 1 from checkins k where k.date = p_date and k.player_id = r.player_id);
  if ids is null then return; end if;
  perform line_send('turn', jsonb_build_array(jsonb_build_object('to_many', ids, 'text', left(format(
    E'🎉 มีที่ว่างแล้ว คุณได้ขึ้นจากสำรองเป็นตัวจริง %s %s/%s%s\nถ้าไม่มาแล้ว กดยกเลิกในแอพ ให้คนสำรองถัดไปได้ที่แทน\nเปิดแอพ: https://badmiton-kabinburi.vercel.app/',
    wd[extract(dow from p_date)::int + 1], extract(day from p_date)::int, extract(month from p_date)::int,
    coalesce(' · ' || a.title, '')), 1000))));
end $$;
revoke execute on function public.line_notify_promoted(date, text[]) from public, anon, authenticated;

-- ยกเลิกลงชื่อ (ทีละคนหรือหลายคนพร้อมกัน): เทียบตัวจริงก่อน/หลังลบ
create or replace function public.signups_promote_waitlist()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare d date; c int; before text[];
begin
  for d in select distinct date from gone loop
    select cap into c from announcements where date = d;
    continue when c is null;
    -- สองคนยกเลิกพร้อมกัน: รอให้อีกรายการเสร็จก่อน จะได้นับตัวจริงถูก
    perform pg_advisory_xact_lock(hashtext('signups:' || d));
    select array_agg(player_id) into before from (
      select player_id, row_number() over (order by at, player_id) n
        from (select player_id, at from signups where date = d union all select player_id, at from gone where date = d) x
    ) r where r.n <= c;
    perform line_notify_promoted(d, coalesce(before, '{}'));
  end loop;
  return null;
exception when others then
  update line_settings set last_error = 'แจ้งคนได้ขึ้นจากสำรองไม่สำเร็จ: ' || sqlerrm, last_error_at = now() where id = 1;
  return null;
end $$;
revoke execute on function public.signups_promote_waitlist() from public, anon, authenticated;

drop trigger if exists signups_promote on public.signups;
create trigger signups_promote after delete on public.signups
  referencing old table as gone for each statement execute function public.signups_promote_waitlist();

-- แอดมินเพิ่มจำนวนที่รับ (หรือยกเลิกการจำกัด): คนสำรองที่ได้ที่ใหม่ได้แจ้งด้วย
create or replace function public.announcements_promote_waitlist()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare before text[];
begin
  if old.cap is null or (new.cap is not null and new.cap <= old.cap) then return new; end if;
  select array_agg(player_id) into before
    from (select player_id, row_number() over (order by at, player_id) n from signups where date = new.date) r
    where r.n <= old.cap;
  perform line_notify_promoted(new.date, coalesce(before, '{}'));
  return new;
exception when others then
  update line_settings set last_error = 'แจ้งคนได้ขึ้นจากสำรองไม่สำเร็จ: ' || sqlerrm, last_error_at = now() where id = 1;
  return new;
end $$;
revoke execute on function public.announcements_promote_waitlist() from public, anon, authenticated;

drop trigger if exists announcements_promote on public.announcements;
create trigger announcements_promote after update of cap on public.announcements
  for each row execute function public.announcements_promote_waitlist();
