-- ยกเลิกประกาศจัดก๊วน (ลบแถว announcements) ล้างคนลงชื่อและคำขอจับคู่ของวันนั้นด้วย
-- กันชื่อค้างแม้แอดมินใช้แอพเวอร์ชันเก่าที่ยังไม่ได้ล้างให้
create or replace function public.clear_signups_on_cancel()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  delete from pair_requests where date = old.date;
  delete from signups where date = old.date;
  return old;
end $$;

drop trigger if exists announce_cancel_clear on public.announcements;
create trigger announce_cancel_clear after delete on public.announcements
  for each row execute function clear_signups_on_cancel();

-- ล้างครั้งเดียว: ชื่อลงและคำขอจับคู่ที่ค้างอยู่ในวันที่ไม่มีประกาศแล้ว (ตั้งแต่วันนี้ไป ไม่แตะประวัติ)
delete from pair_requests p where p.date >= (now() at time zone 'Asia/Bangkok')::date and not exists (select 1 from announcements a where a.date = p.date);
delete from signups s where s.date >= (now() at time zone 'Asia/Bangkok')::date and not exists (select 1 from announcements a where a.date = s.date);
