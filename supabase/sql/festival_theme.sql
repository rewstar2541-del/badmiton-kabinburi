-- ธีมเทศกาล: แอดมินเลือกธีม (ว่าง = อัตโนมัติตามวันที่)
alter table public.settings add column if not exists festival text
  check (festival is null or festival in ('off', 'halloween', 'christmas', 'newyear', 'songkran'));
